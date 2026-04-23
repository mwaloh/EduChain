import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { emailService } from '../services/emailService';
import crypto from 'crypto';
import { ensureCanonicalMeruInstitution, MERU_ALIASES, MERU_CODE } from '../utils/institutionDefaults';

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function institutionRoute(prisma: PrismaClient) {
  const router = Router();

  router.post('/signup', async (req, res) => {
    try {
      const {
        institutionName,
        institutionCode,
        adminEmail,
        adminName,
        adminWalletAddress,
        adminPhone,
        domain,
        password,
        locationText,
        country,
        county,
        city,
        foundedYear,
        latitude,
        longitude,
        locationPinned,
        logoUrl,
      } = req.body;

      if (!institutionName || !adminEmail || !adminName || !domain || !password) {
        return res.status(400).json({ error: 'Institution name, admin details, domain, and password are required.' });
      }

      const parsedLat = parseOptionalNumber(latitude);
      const parsedLng = parseOptionalNumber(longitude);
      const isPinned = Boolean(locationPinned);

      if (isPinned && (parsedLat === null || parsedLng === null)) {
        return res.status(400).json({ error: 'Pinned location requires latitude and longitude.' });
      }

      const existingInstitution = await prisma.institution.findFirst({
        where: {
          deletedAt: null,
          OR: [{ name: institutionName }, institutionCode ? { code: institutionCode } : undefined].filter(Boolean) as any,
        },
      });
      if (existingInstitution) {
        return res.status(400).json({ error: 'Institution already registered.' });
      }

      const existingSignup = await prisma.institutionSignup.findFirst({ 
        where: { 
          adminEmail: adminEmail.toLowerCase(),
        } 
      });
      if (existingSignup) {
        return res.status(400).json({ error: 'Admin email already has an onboarding request.' });
      }

      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      const verificationToken = crypto.randomUUID();

      await prisma.institutionSignup.create({
        data: {
          institutionName,
          institutionCode: institutionCode || null,
          adminEmail: adminEmail.toLowerCase(), // Store email in lowercase for consistency
          adminName,
          adminWalletAddress: adminWalletAddress || null,
          adminPhone: adminPhone || null,
          domain,
          locationText: locationText || null,
          country: country || null,
          county: county || null,
          city: city || null,
          foundedYear: parseOptionalNumber(foundedYear),
          latitude: parsedLat,
          longitude: parsedLng,
          locationPinned: isPinned,
          logoUrl: logoUrl || null,
          passwordHash,
          verificationToken,
          status: 'pending',
        },
      });

      try {
        const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/institution/verify/${verificationToken}`;
        await emailService.sendInstitutionVerificationEmail({
          adminEmail,
          adminName,
          institutionName,
          verificationUrl,
        });
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }

      await prisma.auditLog.create({
        data: {
          action: 'INSTITUTION_SIGNUP_SUBMITTED',
          userAddress: adminWalletAddress || 'N/A',
          userRole: 'institution_admin_candidate',
          actorEmail: adminEmail,
          entityType: 'institution_signup',
          details: JSON.stringify({ institutionName, adminEmail, domain }),
          afterJson: JSON.stringify({ institutionName, institutionCode, adminEmail, status: 'pending' }),
          status: 'success',
        },
      });

      res.json({
        success: true,
        message: 'Registration submitted. Please verify your email, then await super admin approval.',
      });
    } catch (error: any) {
      console.error('Institution signup error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/verify/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const signup = await prisma.institutionSignup.findUnique({ where: { verificationToken: token } });

      if (!signup) {
        return res.status(404).json({ error: 'Invalid verification token' });
      }
      if (signup.status !== 'pending') {
        return res.status(400).json({ error: 'Token already used or expired' });
      }

      await prisma.institutionSignup.update({
        where: { id: signup.id },
        data: { status: 'verified' },
      });

      await prisma.auditLog.create({
        data: {
          action: 'INSTITUTION_SIGNUP_VERIFIED',
          userAddress: signup.adminWalletAddress || 'N/A',
          userRole: 'institution_admin_candidate',
          actorEmail: signup.adminEmail,
          entityType: 'institution_signup',
          entityId: signup.id,
          details: JSON.stringify({ signupId: signup.id, adminEmail: signup.adminEmail }),
          status: 'success',
        },
      });

      res.json({ success: true, message: 'Email verified. Your onboarding request is now pending super admin review.' });
    } catch (error: any) {
      console.error('Institution verification error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/institutions/profile?email=
   * Returns institution record for a logged-in institution admin (matched by email).
   */
  router.get('/profile', async (req, res) => {
    try {
      const emailRaw = typeof req.query.email === 'string' ? req.query.email.trim() : '';
      if (!emailRaw) {
        return res.status(400).json({ error: 'Query parameter email is required.' });
      }

      const user =
        (await prisma.user.findFirst({
          where: { email: emailRaw, deletedAt: null },
          include: { institution: true, institutionAdmin: true },
        })) ||
        (await prisma.user.findFirst({
          where: { email: emailRaw.toLowerCase(), deletedAt: null },
          include: { institution: true, institutionAdmin: true },
        }));

      if (!user) {
        console.warn(`[INSTITUTION PROFILE] User not found with email: ${emailRaw}`);
        return res.status(404).json({ error: 'User not found. Please ensure you are logged in with the correct email.' });
      }

      if (!user.institution) {
        console.warn(`[INSTITUTION PROFILE] User ${user.email} has no institution assigned. Status: awaiting approval or rejected.`);
        return res.status(404).json({ 
          error: 'Institution profile not yet assigned. If you just onboarded, please complete email verification and wait for super admin approval. You can also register at /institution/signup.' 
        });
      }

      // Important: being linked to an institution is not enough.
      // User must be an active institution admin to access institution portal context.
      if (user.role !== 'institution_admin' || !user.institutionAdmin || !user.institutionAdmin.active || user.institutionAdmin.deletedAt) {
        console.warn(`[INSTITUTION PROFILE] User ${user.email} is not an active institution admin.`);
        return res.status(403).json({
          error: 'You are not an institution admin for this institution.',
        });
      }

      if (user.institution.deletedAt) {
        console.warn(`[INSTITUTION PROFILE] User ${user.email}'s institution has been deleted.`);
        return res.status(404).json({ error: 'Your institution profile has been deleted.' });
      }

      const normalizedInstitution =
        user.institution.code === MERU_CODE || MERU_ALIASES.includes(user.institution.name)
          ? await ensureCanonicalMeruInstitution(prisma, { address: user.institution.address })
          : user.institution;

      res.json({
        success: true,
        isInstitutionAdmin: true,
        institution: normalizedInstitution,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          walletAddress: user.walletAddress,
        },
      });
    } catch (error: any) {
      console.error('Institution profile error:', error);
      res.status(500).json({ error: 'Failed to load institution profile. Please check server logs or contact support.' });
    }
  });

  router.get('/pending', async (_req, res) => {
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

  return router;
}
