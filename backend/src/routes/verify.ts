/**
 * Verification API Routes
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

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
        await prisma.verificationLog.create({
          data: {
            verifierAddress: verifierAddress.toLowerCase(),
            tokenId: tokenIdBigInt,
            credentialId: credential.id,
            institutionId: credential.institutionId,
            status: statusString,
            revoked: statusString === 'revoked',
          },
        });
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

  return router;
}

