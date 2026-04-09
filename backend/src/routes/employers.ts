import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logAudit, auditActions } from '../utils/auditService';

export function employersRoute(prisma: PrismaClient) {
  const router = Router();

  /**
   * POST /api/employers/signup
   * Submit employer registration request
   * Public endpoint - no authentication required
   */
  router.post('/signup', async (req: Request, res: Response) => {
    try {
      const {
        companyName,
        companyEmail,
        contactName,
        contactPhone,
        industry,
        location,
        website,
        description,
      } = req.body;

      // Validation
      if (!companyName || !companyEmail || !contactName || !contactPhone || !industry || !location) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check if employer already exists
      const existingEmployer = await prisma.employer.findFirst({
        where: {
          email: companyEmail.toLowerCase(),
          deletedAt: null,
        },
      });

      if (existingEmployer) {
        return res.status(409).json({ error: 'An employer with this email already exists' });
      }

      // Create employer with pending status
      const employer = await prisma.employer.create({
        data: {
          name: companyName,
          email: companyEmail.toLowerCase(),
          contactName,
          contactPhone,
          industry,
          location,
          website: website || null,
          description: description || null,
          isApproved: false, // Manual approval required
          approvedAt: null,
        },
      });

      // Log audit
      await logAudit({
        action: 'EMPLOYER_SIGNUP',
        actorEmail: companyEmail,
        userRole: 'employer',
        entityType: 'Employer',
        entityId: employer.id,
        afterJson: JSON.stringify({
          id: employer.id,
          name: employer.name,
          email: employer.email,
          industry: employer.industry,
          status: 'pending_approval',
        }),
        status: 'success',
        details: {
          industry,
          location,
          website,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Employer signup submitted successfully',
        employer: {
          id: employer.id,
          name: employer.name,
          email: employer.email,
          status: 'pending_approval',
        },
      });
    } catch (error: any) {
      console.error('Error creating employer:', error);
      res.status(500).json({ error: 'Failed to submit employer signup' });
    }
  });

  /**
   * GET /api/employers/pending
   * Get all pending employer signups (super-admin only)
   */
  router.get('/pending', async (req: Request, res: Response) => {
    try {
      const adminEmail = (req.headers['x-user-email'] as string) || '';

      // Verify super-admin
      const superAdmin = await prisma.user.findFirst({
        where: {
          email: adminEmail,
          role: 'super_admin',
          deletedAt: null,
        },
      });

      if (!superAdmin) {
        return res.status(403).json({ error: 'Unauthorized - Super admin access required' });
      }

      // Get pending employers
      const pendingEmployers = await prisma.employer.findMany({
        where: {
          isApproved: false,
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
      });

      res.json({
        success: true,
        employers: pendingEmployers.map((emp) => ({
          id: emp.id,
          name: emp.name,
          email: emp.email,
          contactName: emp.contactName,
          contactPhone: emp.contactPhone,
          industry: emp.industry,
          location: emp.location,
          website: emp.website,
          description: emp.description,
          createdAt: emp.createdAt,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching pending employers:', error);
      res.status(500).json({ error: 'Failed to fetch pending employers' });
    }
  });

  /**
   * POST /api/employers/:id/approve
   * Approve employer signup (super-admin only)
   */
  router.post('/:id/approve', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const adminEmail = (req.headers['x-user-email'] as string) || '';

      // Verify super-admin
      const superAdmin = await prisma.user.findFirst({
        where: {
          email: adminEmail,
          role: 'super_admin',
          deletedAt: null,
        },
      });

      if (!superAdmin) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Get employer
      const employer = await prisma.employer.findUnique({
        where: { id },
      });

      if (!employer) {
        return res.status(404).json({ error: 'Employer not found' });
      }

      if (employer.isApproved) {
        return res.status(400).json({ error: 'Employer is already approved' });
      }

      // Approve employer
      const updated = await prisma.employer.update({
        where: { id },
        data: {
          isApproved: true,
          approvedAt: new Date(),
        },
      });

      // Log audit
      await logAudit({
        action: 'EMPLOYER_APPROVED',
        actorEmail: adminEmail,
        userRole: 'super_admin',
        entityType: 'Employer',
        entityId: id,
        afterJson: JSON.stringify(updated),
        status: 'success',
        details: {
          employerName: employer.name,
          industry: employer.industry,
        },
      });

      res.json({
        success: true,
        message: 'Employer approved successfully',
        employer: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          isApproved: updated.isApproved,
        },
      });
    } catch (error: any) {
      console.error('Error approving employer:', error);
      res.status(500).json({ error: 'Failed to approve employer' });
    }
  });

  /**
   * POST /api/employers/:id/reject
   * Reject employer signup (super-admin only)
   */
  router.post('/:id/reject', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminEmail = (req.headers['x-user-email'] as string) || '';

      // Verify super-admin
      const superAdmin = await prisma.user.findFirst({
        where: {
          email: adminEmail,
          role: 'super_admin',
          deletedAt: null,
        },
      });

      if (!superAdmin) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Get employer
      const employer = await prisma.employer.findUnique({
        where: { id },
      });

      if (!employer) {
        return res.status(404).json({ error: 'Employer not found' });
      }

      // Soft delete employer
      const updated = await prisma.employer.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });

      // Log audit
      await logAudit({
        action: 'EMPLOYER_REJECTED',
        actorEmail: adminEmail,
        userRole: 'super_admin',
        entityType: 'Employer',
        entityId: id,
        afterJson: JSON.stringify({ ...updated, status: 'rejected' }),
        status: 'success',
        details: {
          employerName: employer.name,
          reason: reason || 'No reason provided',
        },
      });

      res.json({
        success: true,
        message: 'Employer request rejected',
      });
    } catch (error: any) {
      console.error('Error rejecting employer:', error);
      res.status(500).json({ error: 'Failed to reject employer' });
    }
  });

  /**
   * GET /api/employers/verified/:id
   * Get employer verification history (requires employer approval)
   */
  router.get('/verified/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Get employer
      const employer = await prisma.employer.findUnique({
        where: { id },
        include: {
          verificationLogs: {
            orderBy: { timestamp: 'desc' },
            take: 100,
          },
        },
      });

      if (!employer || employer.deletedAt || !employer.isApproved) {
        return res.status(404).json({ error: 'Employer not found or not approved' });
      }

      // Get statistics
      const allLogs = await prisma.verificationLog.findMany({
        where: {
          verifierAddress: employer.email,
        },
      });

      res.json({
        success: true,
        employer: {
          id: employer.id,
          name: employer.name,
          industry: employer.industry,
          location: employer.location,
        },
        stats: {
          totalVerifications: allLogs.length,
          approvedCount: allLogs.filter(l => l.status === 'verified').length,
          rejectedCount: allLogs.filter(l => l.status === 'rejected').length,
        },
        recentVerifications: employer.verificationLogs.slice(0, 20).map((log) => ({
          timestamp: log.timestamp,
          credentials_verified: log.notes || 'Multiple',
          status: log.status,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching employer verification history:', error);
      res.status(500).json({ error: 'Failed to fetch verification history' });
    }
  });

  return router;
}
