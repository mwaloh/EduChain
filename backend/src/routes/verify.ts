/**
 * Verification API Routes
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import { getRewardService } from '../services/rewardServiceInit';

export function verifyRoute(prisma: PrismaClient) {
  const router = Router();

  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  const RPC_URL = process.env.RPC_URL;

  if (!CONTRACT_ADDRESS || !RPC_URL) {
    throw new Error('CONTRACT_ADDRESS and RPC_URL must be set');
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // Contract ABI (minimal for verification)
  const CONTRACT_ABI = [
    'function verify(uint256 tokenId) external returns (uint8)',
    'function getCredentialStatus(uint256 tokenId) external view returns ((bool,uint64,uint64,string,string,address))',
    'function ownerOf(uint256 tokenId) external view returns (address)',
    'event CredentialVerified(address indexed verifier, uint256 indexed tokenId, address indexed institution, uint256 timestamp, uint8 status)',
  ];

  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

  /**
   * POST /api/verify
   * Verify a credential
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { tokenId, verifierAddress } = req.body;

      if (!tokenId || !verifierAddress) {
        return res.status(400).json({ error: 'tokenId and verifierAddress required' });
      }

      const tokenIdBigInt = BigInt(tokenId);

      // Verify on-chain
      const status = await contract.verify(tokenIdBigInt);
      const credentialStatus = await contract.getCredentialStatus(tokenIdBigInt);

      // Parse status enum
      const statusMap: Record<number, string> = {
        0: 'valid',
        1: 'revoked',
        2: 'expired',
        3: 'invalid',
      };

      const statusString = statusMap[Number(status)] || 'unknown';

      // Get institution info
      const institution = await prisma.institution.findUnique({
        where: { address: credentialStatus.institution.toLowerCase() },
      });

      // Log verification
      const credential = await prisma.credential.findUnique({
        where: { tokenId: tokenIdBigInt },
      });

      if (credential) {
        const verificationLog = await prisma.verificationLog.create({
          data: {
            verifierAddress: verifierAddress.toLowerCase(),
            tokenId: tokenIdBigInt,
            credentialId: credential.id,
            institutionId: credential.institutionId,
            status: statusString,
            revoked: statusString === 'revoked',
          },
        });

        // Award tokens for successful verification (async, non-blocking)
        if (statusString === 'valid') {
          try {
            const rewardService = getRewardService();
            await rewardService.rewardVerification(
              verifierAddress.toLowerCase(),
              verificationLog.id,
              true
            );
          } catch (rewardError) {
            // Log reward error but don't fail the verification
            console.warn(
              `Warning: Failed to award verification reward for ${verificationLog.id}:`,
              rewardError
            );
          }
        }
      }

      // Check for fraud attempts
      if (statusString !== 'valid' && req.body.expectedStatus === 'valid') {
        await prisma.fraudAttempt.create({
          data: {
            tokenId: tokenIdBigInt,
            verifierAddress: verifierAddress.toLowerCase(),
            attemptedStatus: 'valid',
            actualStatus: statusString,
          },
        });
      }

      res.json({
        tokenId: tokenId.toString(),
        status: statusString,
        revoked: credentialStatus.revoked,
        expiresOn: credentialStatus.expiresOn
          ? new Date(Number(credentialStatus.expiresOn) * 1000).toISOString()
          : null,
        institution: institution?.name || 'Unknown',
        institutionAddress: credentialStatus.institution,
        verifiedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Verification error:', error);
      res.status(500).json({ error: error.message || 'Verification failed' });
    }
  });

  /**
   * GET /api/verify/:tokenId
   * Get verification status without logging
   */
  router.get('/:tokenId', async (req: Request, res: Response) => {
    try {
      const tokenId = BigInt(req.params.tokenId);

      const credentialStatus = await contract.getCredentialStatus(tokenId);
      const owner = await contract.ownerOf(tokenId);

      const isExpired =
        credentialStatus.expiresOn > 0 &&
        BigInt(Math.floor(Date.now() / 1000)) > credentialStatus.expiresOn;

      const institution = await prisma.institution.findUnique({
        where: { address: credentialStatus.institution.toLowerCase() },
      });

      res.json({
        tokenId: req.params.tokenId,
        owner: owner,
        status: credentialStatus.revoked
          ? 'revoked'
          : isExpired
          ? 'expired'
          : 'valid',
        revoked: credentialStatus.revoked,
        revocationReason: credentialStatus.revocationReason,
        expiresOn: credentialStatus.expiresOn
          ? new Date(Number(credentialStatus.expiresOn) * 1000).toISOString()
          : null,
        institution: institution?.name || 'Unknown',
        ipfsCid: credentialStatus.ipfsCid,
      });
    } catch (error: any) {
      console.error('Status check error:', error);
      res.status(500).json({ error: error.message || 'Status check failed' });
    }
  });

  /**
   * GET /api/verify/logs/:verifierAddress
   * Get verification history for an employer
   */
  router.get('/logs/:verifierAddress', async (req: Request, res: Response) => {
    try {
      const { verifierAddress } = req.params;
      const { limit = '50', offset = '0' } = req.query;

      const logs = await prisma.verificationLog.findMany({
        where: { verifierAddress: verifierAddress.toLowerCase() },
        include: {
          credential: {
            include: {
              institution: { select: { name: true, address: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(limit), 100),
        skip: Number(offset),
      });

      const total = await prisma.verificationLog.count({
        where: { verifierAddress: verifierAddress.toLowerCase() },
      });

      const formattedLogs = logs.map((log) => ({
        id: log.id,
        tokenId: log.tokenId.toString(),
        status: log.status,
        revoked: log.revoked,
        verifiedAt: log.createdAt.toISOString(),
        institution: log.credential?.institution?.name || 'Unknown',
        studentName: log.credential?.studentEmail?.split('@')[0] || 'Unknown',
      }));

      res.json({
        logs: formattedLogs,
        total,
        limit: Number(limit),
        offset: Number(offset),
      });
    } catch (error: any) {
      console.error('Logs fetch error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch logs' });
    }
  });

  /**
   * GET /api/verify/analytics/:verifierAddress
   * Get analytics data for an employer
   */
  router.get('/analytics/:verifierAddress', async (req: Request, res: Response) => {
    try {
      const { verifierAddress } = req.params;

      // Get all verification logs for this employer
      const allLogs = await prisma.verificationLog.findMany({
        where: { verifierAddress: verifierAddress.toLowerCase() },
        include: {
          credential: {
            include: {
              institution: { select: { name: true } },
            },
          },
        },
      });

      // Calculate verifications by month
      const logsByMonth: Record<string, { total: number; valid: number; invalid: number }> = {};
      allLogs.forEach((log) => {
        const date = new Date(log.createdAt);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
        if (!logsByMonth[monthKey]) {
          logsByMonth[monthKey] = { total: 0, valid: 0, invalid: 0 };
        }
        logsByMonth[monthKey].total++;
        if (log.status === 'valid') {
          logsByMonth[monthKey].valid++;
        } else {
          logsByMonth[monthKey].invalid++;
        }
      });

      const verificationsByMonth = Object.entries(logsByMonth)
        .slice(-6) // Last 6 months
        .map(([month, data]) => ({
          month,
          total: data.total,
          valid: data.valid,
          invalid: data.invalid,
        }));

      // Calculate verifications by institution
      const institutionMap: Record<string, number> = {};
      allLogs.forEach((log) => {
        const institutionName = log.credential?.institution?.name || 'Unknown';
        institutionMap[institutionName] = (institutionMap[institutionName] || 0) + 1;
      });

      const verificationsByInstitution = Object.entries(institutionMap)
        .map(([institution, count]) => ({
          institution,
          count,
          percentage: Number(((count / allLogs.length) * 100).toFixed(1)),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Mock degree data (since we don't have degree in VerificationLog)
      const verificationsByDegree = [
        { degree: 'Bachelor\'s', count: Math.floor(allLogs.length * 0.6), percentage: 60 },
        { degree: 'Master\'s', count: Math.floor(allLogs.length * 0.25), percentage: 25 },
        { degree: 'PhD', count: Math.floor(allLogs.length * 0.1), percentage: 10 },
        { degree: 'Associate', count: Math.floor(allLogs.length * 0.05), percentage: 5 },
      ];

      // Calculate daily activity (last 7 days)
      const dailyActivity: Array<{ date: string; verifications: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = allLogs.filter(
          (log) => log.createdAt.toISOString().split('T')[0] === dateStr
        ).length;
        dailyActivity.push({ date: dateStr, verifications: count });
      }

      res.json({
        verificationsByMonth,
        verificationsByInstitution,
        verificationsByDegree,
        dailyActivity,
        totalVerifications: allLogs.length,
        validVerifications: allLogs.filter((log) => log.status === 'valid').length,
        revokedVerifications: allLogs.filter((log) => log.status === 'revoked').length,
      });
    } catch (error: any) {
      console.error('Analytics fetch error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch analytics' });
    }
  });

  return router;
}


