/**
 * Analytics API Routes
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export function analyticsRoute(prisma: PrismaClient) {
  const router = Router();

  /**
   * GET /api/analytics/overview
   * Get platform overview statistics
   */
  router.get('/overview', async (req: Request, res: Response) => {
    try {
      const [
        totalCredentials,
        totalVerifications,
        totalInstitutions,
        revokedCount,
        expiredCount,
        fraudAttempts,
      ] = await Promise.all([
        prisma.credential.count(),
        prisma.verificationLog.count(),
        prisma.institution.count({ where: { active: true } }),
        prisma.credential.count({ where: { revoked: true } }),
        prisma.credential.count({
          where: {
            expiresOn: { lte: new Date() },
            revoked: false,
          },
        }),
        prisma.fraudAttempt.count(),
      ]);

      res.json({
        credentials: {
          total: totalCredentials,
          revoked: revokedCount,
          expired: expiredCount,
          active: totalCredentials - revokedCount,
        },
        verifications: totalVerifications,
        institutions: totalInstitutions,
        fraudAttempts,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Analytics error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/analytics/institutions
   * Get institution statistics
   */
  router.get('/institutions', async (req: Request, res: Response) => {
    try {
      const institutions = await prisma.institution.findMany({
        where: { active: true },
        include: {
          _count: {
            select: {
              credentials: true,
              verificationLogs: true,
            },
          },
        },
        orderBy: {
          credentials: {
            _count: 'desc',
          },
        },
      });

      res.json(
        institutions.map((inst) => ({
          address: inst.address,
          name: inst.name,
          credentialsIssued: inst._count.credentials,
          verifications: inst._count.verificationLogs,
          active: inst.active,
        }))
      );
    } catch (error: any) {
      console.error('Institutions analytics error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/analytics/trending
   * Get trending degrees/types
   */
  router.get('/trending', async (req: Request, res: Response) => {
    try {
      // This would require parsing IPFS metadata or storing degree types in DB
      // For now, return verification trends
      const recentVerifications = await prisma.verificationLog.findMany({
        take: 100,
        orderBy: { timestamp: 'desc' },
        include: {
          credential: true,
          institution: true,
        },
      });

      res.json({
        recentVerifications: recentVerifications.length,
        timeRange: 'last 100 verifications',
        data: recentVerifications.map((v) => ({
          tokenId: v.tokenId.toString(),
          institution: v.institution.name,
          status: v.status,
          timestamp: v.timestamp,
        })),
      });
    } catch (error: any) {
      console.error('Trending analytics error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/analytics/fraud
   * Get fraud attempt statistics
   */
  router.get('/fraud', async (req: Request, res: Response) => {
    try {
      const fraudAttempts = await prisma.fraudAttempt.findMany({
        take: 50,
        orderBy: { timestamp: 'desc' },
      });

      const total = await prisma.fraudAttempt.count();

      res.json({
        total,
        recentAttempts: fraudAttempts.map((f) => ({
          tokenId: f.tokenId.toString(),
          verifierAddress: f.verifierAddress,
          attemptedStatus: f.attemptedStatus,
          actualStatus: f.actualStatus,
          timestamp: f.timestamp,
        })),
      });
    } catch (error: any) {
      console.error('Fraud analytics error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/analytics/verifications/:tokenId
   * Get verification history for a credential
   */
  router.get('/verifications/:tokenId', async (req: Request, res: Response) => {
    try {
      const tokenId = BigInt(req.params.tokenId);

      const logs = await prisma.verificationLog.findMany({
        where: { tokenId },
        include: {
          institution: true,
        },
        orderBy: { timestamp: 'desc' },
      });

      res.json({
        tokenId: req.params.tokenId,
        verificationCount: logs.length,
        verifications: logs.map((log) => ({
          verifierAddress: log.verifierAddress,
          status: log.status,
          timestamp: log.timestamp,
          institution: log.institution.name,
        })),
      });
    } catch (error: any) {
      console.error('Verification history error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

