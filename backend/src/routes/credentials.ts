import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logAudit, auditActions } from '../utils/auditService';
import { getRewardService } from '../services/rewardServiceInit';

export function credentialsRoute(prisma: PrismaClient) {
  const router = Router();

  /**
   * POST /api/credentials/record
   * Record a credential minted for a student
   * Called after successful blockchain minting
   */
  router.post('/record', async (req: Request, res: Response) => {
    try {
      const {
        studentEmail,
        tokenId,
        institutionId,
        ipfsCid,
        degree,
        program,
        issuedOn,
        expiresOn,
      } = req.body;

      const adminEmail = (req.headers['x-user-email'] as string) || '';

      if (!studentEmail || !tokenId || !institutionId) {
        return res.status(400).json({ error: 'Missing required fields: studentEmail, tokenId, institutionId' });
      }

      // Verify admin can record credentials for this institution
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

      // Find the student
      const student = await prisma.studentProfile.findFirst({
        where: {
          institutionId,
          email: studentEmail,
          deletedAt: null,
        },
      });

      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Record credential in database
      const credential = await prisma.credential.create({
        data: {
          tokenId: BigInt(tokenId),
          studentAddress: student.walletAddress || '',
          studentHash: '', // Would be computed from student data
          ipfsCid,
          institutionId,
          issuedOn: new Date(issuedOn * 1000),
          expiresOn: expiresOn ? new Date(expiresOn * 1000) : null,
          revoked: false,
        },
      });

      // Log audit
      await logAudit({
        action: auditActions.CREDENTIAL_MINTED,
        actorEmail: adminEmail,
        userRole: 'institution_admin',
        entityType: 'Credential',
        entityId: credential.id,
        afterJson: JSON.stringify(credential),
        status: 'success',
        details: {
          tokenId,
          studentEmail,
          program,
          degree,
        },
      });

      // Award tokens (async, non-blocking)
      try {
        const rewardService = getRewardService();
        const institutionRecord = await prisma.institution.findUnique({
          where: { id: institutionId },
        });

        if (institutionRecord?.walletAddress && student.walletAddress) {
          // Reward student for receiving credential
          await rewardService.rewardParticipation(
            student.walletAddress,
            "CREDENTIAL_ISSUED_STUDENT",
            undefined,
            { credentialId: credential.id }
          );

          // Reward institution for issuing credential
          await rewardService.rewardParticipation(
            institutionRecord.walletAddress,
            "CREDENTIAL_ISSUED_INSTITUTION",
            undefined,
            { credentialId: credential.id }
          );
        }
      } catch (rewardError) {
        // Log reward error but don't fail the credential recording
        console.warn(
          `Warning: Failed to award tokens for credential ${credential.id}:`,
          rewardError
        );
      }

      res.status(201).json({
        success: true,
        credential: {
          id: credential.id,
          tokenId: credential.tokenId.toString(),
          studentAddress: credential.studentAddress,
          issuedOn: credential.issuedOn,
          expiresOn: credential.expiresOn,
          revoked: credential.revoked,
          ipfsCid: credential.ipfsCid,
        },
      });
    } catch (error: any) {
      console.error('Error recording credential:', error);
      res.status(500).json({ error: 'Failed to record credential' });
    }
  });

  /**
   * GET /api/credentials/student/:email
   * Get all credentials for a student
   */
  router.get('/student/:email', async (req: Request, res: Response) => {
    try {
      const { email } = req.params;
      const institutionId = (req.headers['x-institution-id'] as string) || '';

      if (!institutionId) {
        return res.status(400).json({ error: 'Institution ID required' });
      }

      // Find student
      const student = await prisma.studentProfile.findFirst({
        where: {
          email,
          institutionId,
          deletedAt: null,
        },
      });

      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Get student credentials
      const credentials = await prisma.credential.findMany({
        where: {
          studentAddress: student.walletAddress || '',
          institutionId,
        },
        orderBy: { issuedOn: 'desc' },
      });

      // Get institution details
      const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
        select: { name: true, code: true },
      });

      res.json({
        success: true,
        student: {
          email: student.email,
          program: student.program,
          yearOfStudy: student.yearOfStudy,
          admissionNo: student.admissionNo,
          walletAddress: student.walletAddress,
        },
        institution: institution,
        credentials: credentials.map((c) => ({
          id: c.id,
          tokenId: c.tokenId.toString(),
          issuedOn: c.issuedOn,
          expiresOn: c.expiresOn,
          revoked: c.revoked,
          revocationReason: c.revocationReason,
          ipfsCid: c.ipfsCid,
        })),
        stats: {
          total: credentials.length,
          active: credentials.filter((c) => !c.revoked && (!c.expiresOn || c.expiresOn > new Date())).length,
          revoked: credentials.filter((c) => c.revoked).length,
          expired: credentials.filter((c) => c.expiresOn && c.expiresOn <= new Date() && !c.revoked).length,
        },
      });
    } catch (error: any) {
      console.error('Error fetching student credentials:', error);
      res.status(500).json({ error: 'Failed to fetch credentials' });
    }
  });

  /**
   * GET /api/credentials/:id
   * Get credential details (public endpoint - needed for verification page)
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const credential = await prisma.credential.findUnique({
        where: { id },
        include: {
          institution: {
            select: { id: true, name: true, code: true, locationText: true },
          },
          verificationLogs: {
            orderBy: { timestamp: 'desc' },
            take: 10,
          },
        },
      });

      if (!credential) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      // Find student by wallet address to get email
      const student = await prisma.studentProfile.findFirst({
        where: {
          walletAddress: credential.studentAddress,
          institutionId: credential.institutionId,
        },
        select: { email: true, program: true, yearOfStudy: true },
      });

      res.json({
        success: true,
        credential: {
          id: credential.id,
          tokenId: credential.tokenId.toString(),
          studentEmail: student?.email || credential.studentAddress,
          degree: 'Academic Credential', // Would be stored in credential metadata
          program: student?.program || 'Unknown',
          institution: credential.institution,
          issuedOn: Math.floor(credential.issuedOn.getTime() / 1000),
          expiresOn: credential.expiresOn ? Math.floor(credential.expiresOn.getTime() / 1000) : 0,
          revoked: credential.revoked,
          revocationReason: credential.revocationReason || null,
          ipfsCid: credential.ipfsCid,
          createdAt: credential.createdAt.toISOString(),
        },
        verificationLogs: credential.verificationLogs.map((log) => ({
          timestamp: log.timestamp.toISOString(),
          verifierAddress: log.verifierAddress,
          status: log.status,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching credential:', error);
      res.status(500).json({ error: 'Failed to fetch credential' });
    }
  });

  /**
   * PUT /api/credentials/:id/revoke
   * Revoke a credential (institution admin only)
   */
  router.put('/:id/revoke', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminEmail = (req.headers['x-user-email'] as string) || '';
      const institutionId = (req.headers['x-institution-id'] as string) || '';

      if (!institutionId) {
        return res.status(400).json({ error: 'Institution ID required' });
      }

      // Find credential
      const credential = await prisma.credential.findUnique({
        where: { id },
      });

      if (!credential) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      // Verify admin can revoke from this institution
      const adminRecord = await prisma.institutionAdmin.findFirst({
        where: {
          institution: { id: institutionId },
          email: adminEmail,
          deletedAt: null,
        },
      });

      if (!adminRecord || credential.institutionId !== institutionId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Revoke credential
      const updated = await prisma.credential.update({
        where: { id },
        data: {
          revoked: true,
          revocationReason: reason || 'Revoked by institution',
        },
      });

      // Log audit
      await logAudit({
        action: auditActions.CREDENTIAL_REVOKED,
        actorEmail: adminEmail,
        userRole: 'institution_admin',
        entityType: 'Credential',
        entityId: id,
        afterJson: JSON.stringify(updated),
        status: 'success',
        details: {
          tokenId: credential.tokenId.toString(),
          reason: reason || 'No reason provided',
        },
      });

      res.json({
        success: true,
        message: 'Credential revoked successfully',
        credential: {
          id: updated.id,
          tokenId: updated.tokenId.toString(),
          revoked: updated.revoked,
          revocationReason: updated.revocationReason,
        },
      });
    } catch (error: any) {
      console.error('Error revoking credential:', error);
      res.status(500).json({ error: 'Failed to revoke credential' });
    }
  });

  /**
   * GET /api/credentials/institution/:institutionId/history
   * Get credential minting history for institution
   */
  router.get('/institution/:institutionId/history', async (req: Request, res: Response) => {
    try {
      const { institutionId } = req.params;
      const adminEmail = (req.headers['x-user-email'] as string) || '';
      const { page = '1', limit = '20' } = req.query;

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

      const pageNum = Math.max(1, Number(page));
      const pageSize = Math.min(100, Math.max(1, Number(limit)));
      const skip = (pageNum - 1) * pageSize;

      // Get credentials
      const [credentials, total] = await Promise.all([
        prisma.credential.findMany({
          where: { institutionId },
          skip,
          take: pageSize,
          orderBy: { issuedOn: 'desc' },
        }),
        prisma.credential.count({ where: { institutionId } }),
      ]);

      res.json({
        success: true,
        credentials: credentials.map((c) => ({
          id: c.id,
          tokenId: c.tokenId.toString(),
          studentAddress: c.studentAddress,
          issuedOn: c.issuedOn,
          expiresOn: c.expiresOn,
          revoked: c.revoked,
        })),
        pagination: {
          page: pageNum,
          limit: pageSize,
          total,
          pages: Math.ceil(total / pageSize),
        },
      });
    } catch (error: any) {
      console.error('Error fetching credential history:', error);
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  });

  /**
   * POST /api/credentials/:id/verify
   * Log a verification of a credential by an external verifier (employer, etc.)
   * Public endpoint - no authentication required
   */
  router.post('/:id/verify', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { verifierEmail, verifierCompany, notes } = req.body;

      // Find credential
      const credential = await prisma.credential.findUnique({
        where: { id },
      });

      if (!credential) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      // Create verification log
      const verificationLog = await prisma.verificationLog.create({
        data: {
          credentialId: id,
          tokenId: credential.tokenId,
          institutionId: credential.institutionId,
          verifierAddress: verifierEmail || 'anonymous',
          status: 'verified',
          timestamp: new Date(),
        },
      });

      // Log audit
      await logAudit({
        action: 'CREDENTIAL_VERIFIED',
        actorEmail: verifierEmail || 'anonymous',
        userRole: 'external_verifier',
        entityType: 'Credential',
        entityId: id,
        afterJson: JSON.stringify(verificationLog),
        status: 'success',
        details: {
          verifierCompany,
          credentialId: credential.tokenId.toString(),
        },
      });

      res.json({
        success: true,
        message: 'Verification logged successfully',
        verificationLog: {
          id: verificationLog.id,
          timestamp: verificationLog.timestamp,
          verifierAddress: verificationLog.verifierAddress,
          status: verificationLog.status,
        },
      });
    } catch (error: any) {
      console.error('Error logging verification:', error);
      res.status(500).json({ error: 'Failed to log verification' });
    }
  });

  return router;
}
