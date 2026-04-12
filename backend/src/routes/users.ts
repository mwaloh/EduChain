import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createUserWallet } from '../services/walletService';
import crypto from 'crypto';

const router = express.Router();
const prisma = new PrismaClient();
const CREDENTIALS_PROVIDER = 'credentials';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * GET /api/users/me
 * Get current user profile
 * Requires: x-user-id header (set by auth middleware)
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        walletAddress: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * POST /api/users/google
 * Create or update user from Google OAuth
 * Called from NextAuth callback
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { email, name, image, googleId } = req.body;

    if (!email || !googleId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user exists (case-insensitive)
    let user = await prisma.user.findFirst({
      where: { 
        email: email.toLowerCase(),
        deletedAt: null 
      },
    });

    if (!user) {
      // Create new user with auto-generated wallet
      const wallet = createUserWallet(email);

      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(), // Store email in lowercase for consistency
          name,
          image,
          googleId,
          role: 'student',
          walletAddress: wallet.address,
        },
      });
      console.log(`[GOOGLE AUTH] New user created: ${email}`);

      // TODO: In production, securely store the private key
      // Example: Send to key management service, encrypt, etc.
      console.log(
        `[SECURITY] New wallet created for ${email}. Private key should be encrypted and stored securely.`
      );
    } else {
      // Update existing user with Google info
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          name: name || user.name,
          image: image || user.image,
        },
      });
      console.log(`[GOOGLE AUTH] User updated: ${email} (institutionId: ${user.institutionId || 'none'})`);
    }

    // Create or update account
    const existingAccount = await prisma.account.findFirst({
      where: {
        userId: user.id,
        provider: 'google',
      },
    });

    if (!existingAccount) {
      await prisma.account.create({
        data: {
          userId: user.id,
          provider: 'google',
          providerAccountId: googleId,
          type: 'oauth',
        },
      });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      walletAddress: user.walletAddress,
      role: user.role,
    });
  } catch (error) {
    console.error('Error in Google OAuth:', error);
    res.status(500).json({ error: 'OAuth error' });
  }
});

/**
 * POST /api/users/credentials-auth
 * Authenticate or register users for NextAuth Credentials provider.
 *
 * Body:
 *  - mode: "signup" | "login"
 *  - email: string
 *  - password: string
 *  - name?: string (required for signup)
 *  - role?: "student" | "employer" | "institution" (optional for signup)
 */
router.post('/credentials-auth', async (req: Request, res: Response) => {
  try {
    const {
      mode = 'login',
      authMode,
      email,
      password,
      name,
      role,
    } = req.body as {
      mode?: 'signup' | 'login';
      authMode?: 'signup' | 'login';
      email?: string;
      password?: string;
      name?: string;
      role?: 'student' | 'employer' | 'institution';
    };

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const passwordHash = hashPassword(password);

    const resolvedMode = authMode === 'signup' || mode === 'signup' ? 'signup' : 'login';

    if (resolvedMode === 'signup') {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required for signup' });
      }

      const existingUser = await prisma.user.findFirst({
        where: { email: normalizedEmail, deletedAt: null },
      });

      if (existingUser) {
        return res.status(409).json({ error: 'User already exists' });
      }

      const wallet = createUserWallet(normalizedEmail);
      const resolvedRole =
        role === 'employer'
          ? 'employer'
          : role === 'institution'
            ? 'institution_admin'
            : 'student';

      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: name.trim(),
          role: resolvedRole,
          walletAddress: wallet.address,
        },
      });

      await prisma.account.create({
        data: {
          userId: user.id,
          provider: CREDENTIALS_PROVIDER,
          providerAccountId: normalizedEmail,
          type: 'credentials',
          access_token: passwordHash,
        },
      });

      return res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        image: user.image,
      });
    }

    let user = await prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const credentialsAccount = await prisma.account.findFirst({
      where: {
        userId: user.id,
        provider: CREDENTIALS_PROVIDER,
        providerAccountId: normalizedEmail,
      },
    });

    if (!credentialsAccount?.access_token) {
      return res.status(401).json({ error: 'Credentials login is not set up for this user' });
    }

    if (credentialsAccount.access_token !== passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Backfill wallet for legacy users missing one.
    if (!user.walletAddress) {
      const generatedWallet = createUserWallet(normalizedEmail);
      user = await prisma.user.update({
        where: { id: user.id },
        data: { walletAddress: generatedWallet.address },
      });
    }

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      image: user.image,
    });
  } catch (error) {
    console.error('Error in credentials auth:', error);
    res.status(500).json({ error: 'Credentials auth failed' });
  }
});

/**
 * POST /api/users/link-wallet
 * Link an existing MetaMask wallet to a user account
 * Requires: x-user-id header and walletAddress in body
 */
router.post('/link-wallet', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { walletAddress } = req.body;

    if (!userId || !walletAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { walletAddress },
    });

    res.json({
      id: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
    });
  } catch (error) {
    console.error('Error linking wallet:', error);
    res.status(500).json({ error: 'Failed to link wallet' });
  }
});

/**
 * POST /api/users/update-role
 * Update user role
 * Requires: x-user-id header
 */
router.post('/update-role', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const validRoles = ['student', 'employer', 'institution_admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    res.json({
      id: user.id,
      role: user.role,
    });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

/**
 * GET /api/users/by-email/:email
 * Get user by email (for testing/linking purposes)
 */
router.get('/by-email/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        walletAddress: true,
        role: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user by email:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
