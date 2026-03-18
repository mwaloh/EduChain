import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { emailService } from '../../services/emailService';
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

  return router;
}