/**
 * Audit API Routes
 * Real audit logging for compliance and tracking
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export function auditRoute(prisma: PrismaClient) {
  const router = Router();

  /**
   * GET /api/audit/logs
   * Get audit logs with filtering and pagination
   */
  router.get('/logs', async (req: Request, res: Response) => {
    try {
      const {
        page = 1,
        limit = 50,
        action,
        user,
        status,
        startDate,
        endDate
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const where: any = {};

      if (action) where.action = { contains: action as string, mode: 'insensitive' };
      if (user) where.userAddress = { contains: user as string, mode: 'insensitive' };
      if (status) where.status = status as string;

      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = new Date(startDate as string);
        if (endDate) where.timestamp.lte = new Date(endDate as string);
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip,
          take: limitNum,
          include: {
            verificationLog: true,
            credential: true
          }
        }),
        prisma.auditLog.count({ where })
      ]);

      res.json({
        logs: logs.map(log => ({
          id: log.id,
          timestamp: log.timestamp,
          action: log.action,
          userAddress: log.userAddress,
          userRole: log.userRole,
          details: log.details,
          status: log.status,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          relatedCredentialId: log.relatedCredentialId,
          relatedVerificationId: log.relatedVerificationId
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error: any) {
      console.error('Audit logs error:', error);
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  });

  /**
   * GET /api/audit/stats
   * Get audit statistics
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const [
        totalLogs,
        todayLogs,
        failedActions,
        topActions,
        recentActivity
      ] = await Promise.all([
        prisma.auditLog.count(),
        prisma.auditLog.count({
          where: {
            timestamp: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        }),
        prisma.auditLog.count({ where: { status: 'failed' } }),
        prisma.auditLog.groupBy({
          by: ['action'],
          _count: { action: true },
          orderBy: { _count: { action: 'desc' } },
          take: 5
        }),
        prisma.auditLog.findMany({
          take: 10,
          orderBy: { timestamp: 'desc' },
          select: {
            timestamp: true,
            action: true,
            userAddress: true,
            status: true
          }
        })
      ]);

      res.json({
        summary: {
          totalLogs,
          todayLogs,
          failedActions,
          successRate: totalLogs > 0 ? ((totalLogs - failedActions) / totalLogs * 100).toFixed(1) : 0
        },
        topActions: topActions.map(item => ({
          action: item.action,
          count: item._count.action
        })),
        recentActivity
      });
    } catch (error: any) {
      console.error('Audit stats error:', error);
      res.status(500).json({ error: 'Failed to fetch audit stats' });
    }
  });

  return router;
}