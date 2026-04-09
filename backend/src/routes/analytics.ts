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

  /**
   * GET /api/analytics/institution/:institutionId
   * Get institution-scoped analytics
   * Requires: x-user-email, x-institution-id headers (admin only)
   */
  router.get('/institution/:institutionId', async (req: Request, res: Response) => {
    try {
      const { institutionId } = req.params;
      const adminEmail = (req.headers['x-user-email'] as string) || '';

      // Verify institution admin
      const adminRecord = await prisma.institutionAdmin.findFirst({
        where: {
          institution: { id: institutionId },
          email: adminEmail,
          deletedAt: null,
        },
      });

      if (!adminRecord) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Get institution details
      const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
        include: {
          _count: {
            select: {
              credentials: true,
              students: {
                where: { deletedAt: null },
              },
              verificationLogs: true,
              admins: {
                where: { deletedAt: null },
              },
            },
          },
        },
      });

      if (!institution) {
        return res.status(404).json({ error: 'Institution not found' });
      }

      // Get credentials breakdown
      const totalCredentials = await prisma.credential.count({
        where: { institutionId },
      });

      const revokedCredentials = await prisma.credential.count({
        where: { institutionId, revoked: true },
      });

      const expiredCredentials = await prisma.credential.count({
        where: {
          institutionId,
          expiresOn: { lte: new Date() },
          revoked: false,
        },
      });

      const activeCredentials = totalCredentials - revokedCredentials;

      // Get verification logs
      const verifications = await prisma.verificationLog.count({
        where: { institutionId },
      });

      // Get student status breakdown
      const studentStats = await prisma.studentProfile.groupBy({
        by: ['status'],
        where: { institutionId, deletedAt: null },
        _count: true,
      });

      // Get recent verifications
      const recentVerifications = await prisma.verificationLog.findMany({
        where: { institutionId },
        take: 10,
        orderBy: { timestamp: 'desc' },
        select: {
          tokenId: true,
          status: true,
          timestamp: true,
          verifierAddress: true,
        },
      });

      res.json({
        success: true,
        institution: {
          id: institution.id,
          name: institution.name,
          code: institution.code,
          location: institution.locationText,
          status: institution.status,
        },
        credentials: {
          total: totalCredentials,
          active: activeCredentials,
          revoked: revokedCredentials,
          expired: expiredCredentials,
        },
        students: {
          total: institution._count.students,
          byStatus: Object.fromEntries(
            studentStats.map((stat) => [stat.status, stat._count])
          ),
        },
        verifications: {
          total: verifications,
          recent: recentVerifications,
        },
        admins: {
          total: institution._count.admins,
        },
      });
    } catch (error: any) {
      console.error('Institution analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  /**
   * GET /api/analytics/institution/:institutionId/students
   * Get institution student enrollment trends
   */
  router.get('/institution/:institutionId/students', async (req: Request, res: Response) => {
    try {
      const { institutionId } = req.params;
      const adminEmail = (req.headers['x-user-email'] as string) || '';

      // Verify admin
      const adminRecord = await prisma.institutionAdmin.findFirst({
        where: {
          institution: { id: institutionId },
          email: adminEmail,
          deletedAt: null,
        },
      });

      if (!adminRecord) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Get all students
      const students = await prisma.studentProfile.findMany({
        where: { institutionId, deletedAt: null },
        select: {
          id: true,
          email: true,
          program: true,
          yearOfStudy: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Get enrollment by month (last 12 months)
      const now = new Date();
      const last12Months = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i);
        return d;
      });

      const enrollmentByMonth = await Promise.all(
        last12Months.map(async (date) => {
          const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
          const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

          const count = await prisma.studentProfile.count({
            where: {
              institutionId,
              createdAt: { gte: monthStart, lte: monthEnd },
              deletedAt: null,
            },
          });

          return {
            month: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            enrollments: count,
          };
        })
      );

      // Distribution by program
      const programDist = await prisma.studentProfile.groupBy({
        by: ['program'],
        where: { institutionId, deletedAt: null },
        _count: true,
      });

      // Distribution by year
      const yearDist = await prisma.studentProfile.groupBy({
        by: ['yearOfStudy'],
        where: { institutionId, deletedAt: null },
        _count: true,
      });

      res.json({
        success: true,
        students: {
          total: students.length,
          list: students,
        },
        trends: {
          enrollmentByMonth: enrollmentByMonth.reverse(),
          byProgram: Object.fromEntries(
            programDist.map((p) => [p.program || 'Unknown', p._count])
          ),
          byYear: Object.fromEntries(
            yearDist.map((y) => [y.yearOfStudy || 'Unknown', y._count])
          ),
        },
      });
    } catch (error: any) {
      console.error('Student analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch student analytics' });
    }
  });

  return router;
}

