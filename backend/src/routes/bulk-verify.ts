/**
 * Bulk Verification API Routes
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

interface BulkJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  tokenIds: string[];
  results: any[];
  createdAt: Date;
  completedAt?: Date;
  verifierAddress: string;
}

// Store jobs in memory (in production, use database)
const activeJobs = new Map<string, BulkJob>();

export function bulkVerifyRoute(prisma: PrismaClient) {
  const router = Router();

  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  const RPC_URL = process.env.RPC_URL;

  if (!CONTRACT_ADDRESS || !RPC_URL) {
    throw new Error('CONTRACT_ADDRESS and RPC_URL must be set');
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const CONTRACT_ABI = [
    'function getCredentialStatus(uint256 tokenId) external view returns ((bool,uint64,uint64,string,string,address))',
    'function ownerOf(uint256 tokenId) external view returns (address)',
  ];

  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

  /**
   * POST /api/bulk-verify/start
   * Start a bulk verification job
   */
  router.post('/start', async (req: Request, res: Response) => {
    try {
      const { tokenIds, verifierAddress } = req.body;

      if (!tokenIds || !Array.isArray(tokenIds) || tokenIds.length === 0) {
        return res.status(400).json({ error: 'tokenIds array required' });
      }

      if (!verifierAddress) {
        return res.status(400).json({ error: 'verifierAddress required' });
      }

      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const job: BulkJob = {
        id: jobId,
        status: 'queued',
        tokenIds: tokenIds.slice(0, 1000), // Limit to 1000 per job
        results: [],
        createdAt: new Date(),
        verifierAddress: verifierAddress.toLowerCase(),
      };

      activeJobs.set(jobId, job);

      // Process asynchronously
      processJob(jobId, contract, prisma).catch((error) => {
        console.error(`Job ${jobId} failed:`, error);
        const job = activeJobs.get(jobId);
        if (job) {
          job.status = 'failed';
        }
      });

      res.json({
        jobId,
        status: 'queued',
        tokenCount: job.tokenIds.length,
        createdAt: job.createdAt.toISOString(),
      });
    } catch (error: any) {
      console.error('Bulk verification start error:', error);
      res.status(500).json({ error: error.message || 'Failed to start bulk verification' });
    }
  });

  /**
   * GET /api/bulk-verify/:jobId
   * Get bulk verification job status
   */
  router.get('/:jobId', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const job = activeJobs.get(jobId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const progress = {
        processed: job.results.length,
        total: job.tokenIds.length,
        percentage: Math.round((job.results.length / job.tokenIds.length) * 100),
      };

      res.json({
        jobId: job.id,
        status: job.status,
        progress,
        results: job.results.slice(0, 100), // Return first 100 results
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString(),
      });
    } catch (error: any) {
      console.error('Job status error:', error);
      res.status(500).json({ error: error.message || 'Failed to get job status' });
    }
  });

  /**
   * GET /api/bulk-verify/:jobId/results
   * Get full results of a completed job
   */
  router.get('/:jobId/results', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const { format = 'json' } = req.query;

      const job = activeJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.status !== 'completed') {
        return res.status(400).json({ error: 'Job not yet completed' });
      }

      if (format === 'csv') {
        // Generate CSV
        const csvHeaders = ['Token ID', 'Status', 'Valid', 'Revoked', 'Institution'].join(',');
        const csvRows = job.results.map((result) =>
          [
            result.tokenId,
            result.status,
            result.isValid ? 'Yes' : 'No',
            result.isRevoked ? 'Yes' : 'No',
            result.institution || 'Unknown',
          ].join(',')
        );
        const csv = [csvHeaders, ...csvRows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="verification_results_${jobId}.csv"`);
        res.send(csv);
      } else {
        // Return JSON
        res.json({
          jobId: job.id,
          status: job.status,
          results: job.results,
          summary: {
            total: job.results.length,
            valid: job.results.filter((r) => r.isValid).length,
            revoked: job.results.filter((r) => r.isRevoked).length,
            expired: job.results.filter((r) => r.isExpired).length,
          },
          completedAt: job.completedAt?.toISOString(),
        });
      }
    } catch (error: any) {
      console.error('Results fetch error:', error);
      res.status(500).json({ error: error.message || 'Failed to get results' });
    }
  });

  return router;
}

/**
 * Process a bulk verification job
 */
async function processJob(
  jobId: string,
  contract: ethers.Contract,
  prisma: PrismaClient
) {
  const job = activeJobs.get(jobId);
  if (!job) return;

  job.status = 'processing';

  for (const tokenId of job.tokenIds) {
    try {
      const tokenIdBigInt = BigInt(tokenId);

      // Get credential status
      const credentialStatus = await contract.getCredentialStatus(tokenIdBigInt);
      const owner = await contract.ownerOf(tokenIdBigInt);

      // Check if expired
      const isExpired =
        credentialStatus.expiresOn > BigInt(0) &&
        BigInt(Math.floor(Date.now() / 1000)) > credentialStatus.expiresOn;

      // Get institution
      const institution = await prisma.institution.findUnique({
        where: { address: credentialStatus.institution.toLowerCase() },
      });

      // Log verification
      const credential = await prisma.credential.findUnique({
        where: { tokenId: tokenIdBigInt },
      });

      if (credential) {
        const status = credentialStatus.revoked
          ? 'revoked'
          : isExpired
          ? 'expired'
          : 'valid';

        await prisma.verificationLog.create({
          data: {
            verifierAddress: job.verifierAddress,
            tokenId: tokenIdBigInt,
            credentialId: credential.id,
            institutionId: credential.institutionId,
            status: status,
            revoked: status === 'revoked',
          },
        });
      }

      // Add result
      job.results.push({
        tokenId: tokenId,
        isValid: !credentialStatus.revoked && !isExpired,
        isRevoked: credentialStatus.revoked,
        isExpired: isExpired,
        institution: institution?.name || 'Unknown',
        status: credentialStatus.revoked
          ? 'revoked'
          : isExpired
          ? 'expired'
          : 'valid',
        verifiedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`Error verifying token ${tokenId}:`, error);
      job.results.push({
        tokenId: tokenId,
        isValid: false,
        isRevoked: false,
        isExpired: false,
        institution: 'Unknown',
        status: 'error',
        error: (error as any).message,
        verifiedAt: new Date().toISOString(),
      });
    }
  }

  job.status = 'completed';
  job.completedAt = new Date();
}
