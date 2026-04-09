import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Middleware to verify super-admin access
 * Checks if the user has SUPER_ADMIN role in database
 */
export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const userEmail = (req.headers['x-user-email'] as string) || '';
    const userId = (req.headers['x-user-id'] as string) || '';

    if (!userEmail && !userId) {
      return res.status(401).json({ error: 'Unauthorized: No user credentials provided' });
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : { email: userEmail },
    });

    if (!user || user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    // Attach user to request
    (req as any).user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Middleware to verify institution admin access
 * Checks if user is an institution admin for the institution in x-institution-id header
 */
export async function requireInstitutionAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const userEmail = (req.headers['x-user-email'] as string) || '';
    const institutionId = (req.headers['x-institution-id'] as string) || '';

    if (!userEmail || !institutionId) {
      return res.status(400).json({ error: 'Missing required headers: x-user-email, x-institution-id' });
    }

    // Verify admin record exists
    const adminRecord = await prisma.institutionAdmin.findFirst({
      where: {
        email: userEmail,
        institution: { id: institutionId },
        deletedAt: null,
      },
    });

    if (!adminRecord) {
      return res.status(403).json({ error: 'Forbidden: Not an admin for this institution' });
    }

    if (!adminRecord.active) {
      return res.status(403).json({ error: 'Forbidden: Admin account is inactive' });
    }

    // Attach to request
    (req as any).institutionAdmin = adminRecord;
    (req as any).institutionId = institutionId;
    next();
  } catch (error) {
    console.error('Institution admin middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Middleware to verify authenticated user (any role)
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const userEmail = (req.headers['x-user-email'] as string) || '';
    const userId = (req.headers['x-user-id'] as string) || '';

    if (!userEmail && !userId) {
      return res.status(401).json({ error: 'Unauthorized: No user credentials' });
    }

    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : { email: userEmail },
    });

    if (!user || user.deletedAt) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Middleware to verify employer/verifier access
 */
export async function requireEmployer(req: Request, res: Response, next: NextFunction) {
  try {
    const userEmail = (req.headers['x-user-email'] as string) || '';
    const userId = (req.headers['x-user-id'] as string) || '';

    if (!userEmail && !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : { email: userEmail },
    });

    if (!user || !['employer', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Employer access required' });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    console.error('Employer middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
