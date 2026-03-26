import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

export function adminRoute(prisma: PrismaClient) {
  const router = Router();

  /**
   * GET /api/admin/institutions/pending - Get all pending institution signups
   * TODO: Add admin authentication middleware
   */
  router.get('/institutions/pending', async (req, res) => {
    try {
      const pendingSignups = await prisma.institutionSignup.findMany({
        where: {
          status: { in: ['pending', 'verified'] }
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          institutionName: true,
          adminEmail: true,
          adminName: true,
          domain: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      res.json({
        success: true,
        signups: pendingSignups,
        count: pendingSignups.length
      });
    } catch (error: any) {
      console.error('Error fetching pending signups:', error);
      res.status(500).json({ error: 'Failed to fetch pending signups' });
    }
  });

  /**
   * POST /api/admin/institutions/:signupId/approve - Approve institution signup
   */
  router.post('/institutions/:signupId/approve', async (req, res) => {
    try {
      const { signupId } = req.params;

      const signup = await prisma.institutionSignup.findUnique({
        where: { id: signupId }
      });

      if (!signup) {
        return res.status(404).json({ error: 'Signup request not found' });
      }

      if (signup.status !== 'verified') {
        return res.status(400).json({ error: 'Signup must be verified first' });
      }

      // Create the institution in the blockchain-ready table
      const institution = await prisma.institution.create({
        data: {
          name: signup.institutionName,
          metadataURI: `https://${signup.domain}`, // Store domain for reference
          active: true,
        }
      });

      // Update signup status
      await prisma.institutionSignup.update({
        where: { id: signupId },
        data: { status: 'approved' }
      });

      // TODO: Send approval email to institution admin
      // await emailService.sendInstitutionApprovalEmail(signup.adminEmail, signup.institutionName);

      res.json({
        success: true,
        message: 'Institution approved successfully',
        institution: {
          id: institution.id,
          name: institution.name,
          address: institution.address,
          active: institution.active,
        }
      });
    } catch (error: any) {
      console.error('Institution approval error:', error);
      res.status(500).json({ error: 'Failed to approve institution' });
    }
  });

  /**
   * POST /api/admin/institutions/:signupId/reject - Reject institution signup
   */
  router.post('/institutions/:signupId/reject', async (req, res) => {
    try {
      const { signupId } = req.params;
      const { reason } = req.body;

      const signup = await prisma.institutionSignup.findUnique({
        where: { id: signupId }
      });

      if (!signup) {
        return res.status(404).json({ error: 'Signup request not found' });
      }

      // Update status to rejected
      await prisma.institutionSignup.update({
        where: { id: signupId },
        data: { status: 'rejected' }
      });

      // TODO: Send rejection email
      // await emailService.sendInstitutionRejectionEmail(signup.adminEmail, signup.institutionName, reason);

      res.json({
        success: true,
        message: 'Institution signup rejected'
      });
    } catch (error: any) {
      console.error('Institution rejection error:', error);
      res.status(500).json({ error: 'Failed to reject institution' });
    }
  });

  /**
   * GET /api/admin/stats - Get admin dashboard statistics
   */
  router.get('/stats', async (req, res) => {
    try {
      const [
        totalInstitutions,
        pendingSignups,
        totalCredentials,
        totalVerifications,
        recentSignups
      ] = await Promise.all([
        prisma.institution.count({ where: { active: true } }),
        prisma.institutionSignup.count({ where: { status: { in: ['pending', 'verified'] } } }),
        prisma.credential.count(),
        prisma.verificationLog.count(),
        prisma.institutionSignup.findMany({
          where: { status: { in: ['pending', 'verified'] } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            institutionName: true,
            adminEmail: true,
            domain: true,
            status: true,
            createdAt: true,
          }
        })
      ]);

      res.json({
        success: true,
        stats: {
          totalInstitutions,
          pendingSignups,
          totalCredentials,
          totalVerifications,
        },
        recentSignups
      });
    } catch (error: any) {
      console.error('Error fetching admin stats:', error);
      res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
  });

  return router;
}
