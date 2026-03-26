import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { emailService } from '../services/emailService';
import { validateInstitutionEmail, sendDomainVerificationEmail } from '../services/domainVerificationService';
import crypto from 'crypto';

export function institutionRoute(prisma: PrismaClient) {
  const router = Router();

  /**
   * POST /api/institutions/signup - Register new institution
   */
  router.post('/signup', async (req, res) => {
    try {
      const { institutionName, adminEmail, adminName, domain, password } = req.body;

      // Validation
      if (!institutionName || !adminEmail || !adminName || !domain || !password) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      // Check if institution already exists
      const existingInstitution = await prisma.institution.findFirst({
        where: {
          OR: [
            { name: institutionName },
            { metadataURI: { contains: domain } } // Simple domain check
          ]
        }
      });

      if (existingInstitution) {
        return res.status(400).json({ error: 'Institution already registered' });
      }

      // Check if admin email already used
      const existingSignup = await prisma.institutionSignup.findUnique({
        where: { adminEmail }
      });

      if (existingSignup) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Hash password
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

      // Generate verification token
      const verificationToken = crypto.randomUUID();

      // Create signup request
      const signup = await prisma.institutionSignup.create({
        data: {
          institutionName,
          adminEmail,
          adminName,
          domain,
          passwordHash,
          verificationToken,
          status: 'pending',
        }
      });

      // Send verification email
      try {
        const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/institution/verify/${verificationToken}`;

        await emailService.sendInstitutionVerificationEmail({
          adminEmail,
          adminName,
          institutionName,
          verificationUrl,
        });

        res.json({
          success: true,
          message: 'Registration submitted. Please check your email for verification.'
        });
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail the signup, but log the error
        res.json({
          success: true,
          message: 'Registration submitted. Email verification may be delayed.'
        });
      }
    } catch (error: any) {
      console.error('Institution signup error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/institutions/verify/:token - Verify institution email
   */
  router.get('/verify/:token', async (req, res) => {
    try {
      const { token } = req.params;

      const signup = await prisma.institutionSignup.findUnique({
        where: { verificationToken: token }
      });

      if (!signup) {
        return res.status(404).json({ error: 'Invalid verification token' });
      }

      if (signup.status !== 'pending') {
        return res.status(400).json({ error: 'Token already used or expired' });
      }

      // Update status to verified
      await prisma.institutionSignup.update({
        where: { id: signup.id },
        data: { status: 'verified' }
      });

      res.json({
        success: true,
        message: 'Email verified successfully. Your institution registration is pending admin approval.'
      });
    } catch (error: any) {
      console.error('Institution verification error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/institutions/approve/:signupId - Admin approves institution signup
   * Requires admin authentication (TODO: implement admin auth)
   */
  router.post('/approve/:signupId', async (req, res) => {
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
   * POST /api/institutions/reject/:signupId - Admin rejects institution signup
   */
  router.post('/reject/:signupId', async (req, res) => {
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
   * GET /api/institutions/pending - Get all pending institution signups
   * Requires admin authentication (TODO: implement admin auth)
   */
  router.get('/pending', async (req, res) => {
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
        }
      });

      res.json(pendingSignups);
    } catch (error: any) {
      console.error('Error fetching pending signups:', error);
      res.status(500).json({ error: 'Failed to fetch pending signups' });
    }
  });

  return router;
}