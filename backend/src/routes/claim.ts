import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { ClaimTokenService } from '../services/claimTokenService';
import { emailService } from '../services/emailService';

export function claimRoute(prisma: PrismaClient) {
  const router = Router();
  const claimService = new ClaimTokenService(prisma);

  /**
   * GET /api/claim/:token - Validate claim token and show claim page
   */
  router.get('/:token', async (req, res) => {
    try {
      const { token } = req.params;

      const details = await claimService.getClaimTokenDetails(token);

      if (!details) {
        return res.status(404).json({ error: 'Claim token not found' });
      }

      if (details.claimed) {
        return res.status(400).json({ error: 'Token has already been claimed' });
      }

      if (details.isExpired) {
        return res.status(400).json({ error: 'Claim token has expired' });
      }

      res.json({
        success: true,
        data: details,
      });
    } catch (error: any) {
      console.error('Claim token validation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/claim/:token - Claim the credential
   */
  router.post('/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const { claimantAddress } = req.body;

      if (!claimantAddress) {
        return res.status(400).json({ error: 'claimantAddress is required' });
      }

      const result = await claimService.claimToken({
        token,
        claimantAddress,
      });

      // Send confirmation email
      try {
        await emailService.sendCredentialVerifiedEmail({
          studentEmail: result.credential.studentAddress, // This should be email, but we don't have it yet
          studentName: 'Student', // Placeholder
          employerName: 'EduChain System',
          degree: result.metadata?.degree || 'Digital Credential',
          verificationDate: new Date().toLocaleDateString(),
        });
      } catch (emailError) {
        console.warn('Failed to send claim confirmation email:', emailError);
      }

      res.json({
        success: true,
        message: 'Credential claimed successfully',
        data: {
          credentialId: result.credential.id,
          tokenId: result.credential.tokenId.toString(),
          institutionName: result.institution.name,
          metadata: result.metadata,
        },
      });
    } catch (error: any) {
      console.error('Claim error:', error);

      if (error.message.includes('already been claimed') ||
          error.message.includes('expired') ||
          error.message.includes('Invalid')) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/claim/generate - Generate claim token for a credential (Institution only)
   */
  router.post('/generate', async (req, res) => {
    try {
      const { credentialId, studentEmail, studentName } = req.body;

      if (!credentialId || !studentEmail) {
        return res.status(400).json({ error: 'credentialId and studentEmail are required' });
      }

      const token = await claimService.generateClaimToken({
        credentialId,
        studentEmail,
        studentName,
      });

      // Generate claim URL
      const claimUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/claim/${token}`;

      // Send email notification
      try {
        const credential = await prisma.credential.findUnique({
          where: { id: credentialId },
          include: { institution: true },
        });

        if (credential) {
          await emailService.sendCredentialIssuedEmail({
            studentEmail,
            studentName: studentName || 'Student',
            institutionName: credential.institution.name,
            degree: 'Digital Credential', // This should come from metadata
            claimToken: token,
            claimUrl,
          });
        }
      } catch (emailError) {
        console.warn('Failed to send credential issued email:', emailError);
      }

      res.json({
        success: true,
        data: {
          token,
          claimUrl,
        },
      });
    } catch (error: any) {
      console.error('Generate claim token error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}