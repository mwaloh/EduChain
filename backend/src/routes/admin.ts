import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

export function adminRoute(prisma: PrismaClient) {
  const router = Router();

  router.get('/institutions/pending', async (_req, res) => {
    try {
      const pendingSignups = await prisma.institutionSignup.findMany({
        where: { status: { in: ['pending', 'verified'] } },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, signups: pendingSignups, count: pendingSignups.length });
    } catch (error: any) {
      console.error('Error fetching pending signups:', error);
      res.status(500).json({ error: 'Failed to fetch pending signups' });
    }
  });

  router.get('/institutions', async (_req, res) => {
    try {
      const institutions = await prisma.institution.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          admins: {
            where: { deletedAt: null },
            select: { id: true, email: true, walletAddress: true, active: true },
          },
        },
      });

      res.json({ success: true, institutions, count: institutions.length });
    } catch (error: any) {
      console.error('Error fetching institutions:', error);
      res.status(500).json({ error: 'Failed to fetch institutions' });
    }
  });

  router.post('/institutions/:signupId/approve', async (req, res) => {
    try {
      const { signupId } = req.params;
      const reviewerEmail = (req.headers['x-admin-email'] as string) || 'super-admin@educhain.local';
      const signup = await prisma.institutionSignup.findUnique({ where: { id: signupId } });
      if (!signup) return res.status(404).json({ error: 'Signup request not found' });
      if (signup.status !== 'verified') {
        return res
          .status(400)
          .json({ error: 'Institution must verify email first. Approve is only allowed after status is verified.' });
      }

      const institution = await prisma.$transaction(async (tx) => {
        const created = await tx.institution.create({
          data: {
            code: signup.institutionCode || null,
            name: signup.institutionName,
            locationText: signup.locationText,
            country: signup.country,
            county: signup.county,
            city: signup.city,
            foundedYear: signup.foundedYear,
            latitude: signup.latitude,
            longitude: signup.longitude,
            locationPinned: signup.locationPinned,
            logoUrl: signup.logoUrl,
            metadataURI: signup.metadataURI || `https://${signup.domain}`,
            status: 'approved',
            active: true,
          },
        });

        const user = await tx.user.upsert({
          where: { email: signup.adminEmail.toLowerCase() },
          update: {
            name: signup.adminName,
            role: 'institution_admin',
            walletAddress: signup.adminWalletAddress || undefined,
            institutionId: created.id,
            deletedAt: null,
          },
          create: {
            email: signup.adminEmail.toLowerCase(), // Store email in lowercase for consistency
            name: signup.adminName,
            role: 'institution_admin',
            walletAddress: signup.adminWalletAddress || null,
            institutionId: created.id,
          },
        });

        await tx.institutionAdmin.create({
          data: {
            institutionId: created.id,
            userId: user.id,
            email: signup.adminEmail.toLowerCase(),
            walletAddress: signup.adminWalletAddress || null,
            active: true,
          },
        });

        const approvedSignup = await tx.institutionSignup.update({
          where: { id: signup.id },
          data: {
            status: 'approved',
            reviewedAt: new Date(),
            reviewedBy: reviewerEmail,
            approvedInstitutionId: created.id,
            reviewNotes: null,
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'INSTITUTION_SIGNUP_APPROVED',
            userAddress: signup.adminWalletAddress || 'N/A',
            userRole: 'super_admin',
            actorEmail: reviewerEmail,
            entityType: 'institution_signup',
            entityId: signup.id,
            details: JSON.stringify({ signupId: signup.id, institutionId: created.id }),
            beforeJson: JSON.stringify({ status: signup.status }),
            afterJson: JSON.stringify({ status: approvedSignup.status, institutionId: created.id }),
            status: 'success',
          },
        });
        return created;
      });

      res.json({ success: true, message: 'Institution approved successfully', institution });
    } catch (error: any) {
      console.error('Institution approval error:', error);
      res.status(500).json({ error: 'Failed to approve institution' });
    }
  });

  router.post('/institutions/:signupId/reject', async (req, res) => {
    try {
      const { signupId } = req.params;
      const { reason } = req.body as { reason?: string };
      const reviewerEmail = (req.headers['x-admin-email'] as string) || 'super-admin@educhain.local';

      const signup = await prisma.institutionSignup.findUnique({ where: { id: signupId } });
      if (!signup) return res.status(404).json({ error: 'Signup request not found' });

      const updated = await prisma.institutionSignup.update({
        where: { id: signupId },
        data: {
          status: 'rejected',
          reviewNotes: reason || 'Rejected by super admin',
          reviewedAt: new Date(),
          reviewedBy: reviewerEmail,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: 'INSTITUTION_SIGNUP_REJECTED',
          userAddress: signup.adminWalletAddress || 'N/A',
          userRole: 'super_admin',
          actorEmail: reviewerEmail,
          entityType: 'institution_signup',
          entityId: signup.id,
          details: JSON.stringify({ signupId, reason: reason || null }),
          beforeJson: JSON.stringify({ status: signup.status }),
          afterJson: JSON.stringify({ status: updated.status, reviewNotes: updated.reviewNotes }),
          status: 'success',
        },
      });

      res.json({ success: true, message: 'Institution signup rejected' });
    } catch (error: any) {
      console.error('Institution rejection error:', error);
      res.status(500).json({ error: 'Failed to reject institution' });
    }
  });

  router.patch('/institutions/:institutionId', async (req, res) => {
    try {
      const { institutionId } = req.params;
      const { name, locationText, country, county, city, foundedYear, latitude, longitude, status } = req.body;
      const reviewerEmail = (req.headers['x-admin-email'] as string) || 'super-admin@educhain.local';
      const current = await prisma.institution.findUnique({ where: { id: institutionId } });
      if (!current || current.deletedAt) return res.status(404).json({ error: 'Institution not found' });

      const updated = await prisma.institution.update({
        where: { id: institutionId },
        data: {
          name: name ?? current.name,
          locationText: locationText ?? current.locationText,
          country: country ?? current.country,
          county: county ?? current.county,
          city: city ?? current.city,
          foundedYear: foundedYear ?? current.foundedYear,
          latitude: latitude ?? current.latitude,
          longitude: longitude ?? current.longitude,
          status: status ?? current.status,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: 'INSTITUTION_UPDATED',
          userAddress: 'N/A',
          userRole: 'super_admin',
          actorEmail: reviewerEmail,
          entityType: 'institution',
          entityId: institutionId,
          beforeJson: JSON.stringify(current),
          afterJson: JSON.stringify(updated),
          details: JSON.stringify({ institutionId }),
          status: 'success',
        },
      });
      res.json({ success: true, institution: updated });
    } catch (error: any) {
      console.error('Institution update error:', error);
      res.status(500).json({ error: 'Failed to update institution' });
    }
  });

  router.delete('/institutions/:institutionId', async (req, res) => {
    try {
      const { institutionId } = req.params;
      const reviewerEmail = (req.headers['x-admin-email'] as string) || 'super-admin@educhain.local';
      const current = await prisma.institution.findUnique({ where: { id: institutionId } });
      if (!current || current.deletedAt) return res.status(404).json({ error: 'Institution not found' });

      const deleted = await prisma.institution.update({
        where: { id: institutionId },
        data: { deletedAt: new Date(), active: false, status: 'suspended' },
      });

      await prisma.auditLog.create({
        data: {
          action: 'INSTITUTION_SOFT_DELETED',
          userAddress: 'N/A',
          userRole: 'super_admin',
          actorEmail: reviewerEmail,
          entityType: 'institution',
          entityId: institutionId,
          beforeJson: JSON.stringify(current),
          afterJson: JSON.stringify(deleted),
          details: JSON.stringify({ institutionId }),
          status: 'success',
        },
      });
      res.json({ success: true, message: 'Institution archived (soft-deleted).' });
    } catch (error: any) {
      console.error('Institution delete error:', error);
      res.status(500).json({ error: 'Failed to delete institution' });
    }
  });

  router.get('/stats', async (_req, res) => {
    try {
      const [
        totalInstitutions,
        pendingSignups,
        totalCredentials,
        totalVerifications,
        recentSignups
      ] = await Promise.all([
        prisma.institution.count({ where: { active: true, deletedAt: null } }),
        prisma.institutionSignup.count({ where: { status: { in: ['pending', 'verified'] } } }),
        prisma.credential.count(),
        prisma.verificationLog.count(),
        prisma.institutionSignup.findMany({
          where: { status: { in: ['pending', 'verified'] } },
          orderBy: { createdAt: 'desc' },
          take: 5,
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
