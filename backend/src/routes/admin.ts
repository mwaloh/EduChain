import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { ensureCanonicalMeruInstitution } from '../utils/institutionDefaults';

export function adminRoute(prisma: PrismaClient) {
  const router = Router();

  async function getOrCreateMeruInstitution() {
    return ensureCanonicalMeruInstitution(prisma);
  }

  async function backfillStudentsToMeru() {
    const meru = await getOrCreateMeruInstitution();
    const students = await prisma.user.findMany({
      where: { role: 'student', deletedAt: null },
      select: { id: true, email: true, walletAddress: true, institutionId: true },
    });

    let usersLinked = 0;
    let profilesUpserted = 0;

    for (const user of students) {
      if (!user.institutionId || user.institutionId !== meru.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { institutionId: meru.id },
        });
        usersLinked++;
      }

      const existingProfile = await prisma.studentProfile.findFirst({
        where: {
          OR: [{ userId: user.id }, { email: user.email }],
          deletedAt: null,
        },
      });

      if (existingProfile) {
        await prisma.studentProfile.update({
          where: { id: existingProfile.id },
          data: {
            userId: user.id,
            institutionId: meru.id,
            email: user.email,
            walletAddress: user.walletAddress || existingProfile.walletAddress,
            status: existingProfile.status || 'active',
          },
        });
      } else {
        await prisma.studentProfile.create({
          data: {
            userId: user.id,
            institutionId: meru.id,
            email: user.email,
            walletAddress: user.walletAddress || null,
            status: 'active',
          },
        });
      }
      profilesUpserted++;
    }

    const totalProfiles = await prisma.studentProfile.count({
      where: { institutionId: meru.id, deletedAt: null },
    });

    return {
      institution: { id: meru.id, name: meru.name, code: meru.code },
      processedStudents: students.length,
      usersLinked,
      profilesUpserted,
      totalProfiles,
    };
  }

  function isAuthorizedBackfillRequest(req: any): boolean {
    const headerEmail = String(req.headers['x-admin-email'] || '').trim().toLowerCase();
    const headerPassword = String(req.headers['x-admin-password'] || '');
    const configuredEmail = String(process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_REWARD_EMAIL || '').trim().toLowerCase();
    const configuredPassword = String(process.env.SUPER_ADMIN_PASSWORD || process.env.ADMIN_REWARD_PASSWORD || '');

    if (!configuredPassword) return false;
    if (configuredEmail && headerEmail !== configuredEmail) return false;
    return headerPassword === configuredPassword;
  }

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

  /**
   * GET /api/admin/students/unlinked
   * Shows student users that are not linked to an institution or student profile.
   */
  router.get('/students/unlinked', async (_req, res) => {
    try {
      const usersWithoutInstitution = await prisma.user.count({
        where: {
          role: 'student',
          deletedAt: null,
          institutionId: null,
        },
      });

      const usersWithoutProfile = await prisma.user.count({
        where: {
          role: 'student',
          deletedAt: null,
          studentProfile: null,
        },
      });

      const sample = await prisma.user.findMany({
        where: {
          role: 'student',
          deletedAt: null,
          OR: [{ institutionId: null }, { studentProfile: null }],
        },
        select: {
          id: true,
          email: true,
          institutionId: true,
          createdAt: true,
          studentProfile: {
            select: { id: true, institutionId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      res.json({
        success: true,
        summary: {
          usersWithoutInstitution,
          usersWithoutProfile,
          totalPotentiallyUnlinked: sample.length,
        },
        sample,
      });
    } catch (error: any) {
      console.error('Error fetching unlinked students:', error);
      res.status(500).json({ error: 'Failed to fetch unlinked students' });
    }
  });

  /**
   * POST /api/admin/students/unlinked/backfill
   * Secure one-click backfill to link student users + profiles to Meru institution.
   * Requires headers:
   * - x-admin-email (if SUPER_ADMIN_EMAIL or ADMIN_REWARD_EMAIL is configured)
   * - x-admin-password (SUPER_ADMIN_PASSWORD or ADMIN_REWARD_PASSWORD)
   */
  router.post('/students/unlinked/backfill', async (req, res) => {
    try {
      if (!isAuthorizedBackfillRequest(req)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const result = await backfillStudentsToMeru();
      return res.json({ success: true, result });
    } catch (error: any) {
      console.error('Error backfilling unlinked students:', error);
      return res.status(500).json({ error: 'Failed to backfill unlinked students' });
    }
  });

  /**
   * POST /api/admin/credentials/:tokenId/backfill
   * Manually backfill stored credential details for older records.
   * Requires x-admin-password and optionally x-admin-email.
   */
  router.post('/credentials/:tokenId/backfill', async (req, res) => {
    try {
      if (!isAuthorizedBackfillRequest(req)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const tokenId = BigInt(req.params.tokenId);
      const {
        studentName,
        studentEmail,
        institutionName,
        degree,
        program,
        grade,
        graduationYear,
      } = req.body as {
        studentName?: string;
        studentEmail?: string;
        institutionName?: string;
        degree?: string;
        program?: string;
        grade?: string;
        graduationYear?: number | string | null;
      };

      const credential = await prisma.credential.findUnique({
        where: { tokenId },
      });

      if (!credential) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      const updated = await prisma.credential.update({
        where: { tokenId },
        data: {
          studentName: studentName?.trim() || null,
          studentEmail: studentEmail?.trim().toLowerCase() || null,
          institutionName: institutionName?.trim() || null,
          degree: degree?.trim() || null,
          program: program?.trim() || null,
          grade: grade?.trim() || null,
          graduationYear:
            graduationYear !== undefined && graduationYear !== null && String(graduationYear).trim() !== ''
              ? Number(graduationYear)
              : null,
        },
      });

      return res.json({
        success: true,
        credential: {
          id: updated.id,
          tokenId: updated.tokenId.toString(),
          studentName: updated.studentName,
          studentEmail: updated.studentEmail,
          institutionName: updated.institutionName,
          degree: updated.degree,
          program: updated.program,
          grade: updated.grade,
          graduationYear: updated.graduationYear,
        },
      });
    } catch (error: any) {
      console.error('Error backfilling credential details:', error);
      return res.status(500).json({ error: 'Failed to backfill credential details' });
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
