import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createUserWallet } from '../services/walletService';

const router = express.Router();
const prisma = new PrismaClient();

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
