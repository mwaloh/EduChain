import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AccessTokenService } from '../services/accessTokenService';

export function shareRoute(prisma: PrismaClient) {
  const router = Router();
  const accessTokenService = new AccessTokenService(prisma);

  /**
   * POST /api/share - Generate shareable credential link
   * Student creates a shareable link for their credential
   */
  router.post('/', async (req, res) => {
    try {
      const { credentialId, creatorAddress, expiresInDays, limited } = req.body;

      if (!credentialId || !creatorAddress) {
        return res.status(400).json({ error: 'credentialId and creatorAddress are required' });
      }

      const token = await accessTokenService.generateAccessToken({
        credentialId,
        creatorAddress,
        expiresInDays,
        limited,
      });

      const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify/${token}`;

      res.json({
        success: true,
        data: {
          token,
          shareUrl,
        },
      });
    } catch (error: any) {
      console.error('Share creation error:', error);

      if (error.message.includes('not found') || error.message.includes('Access denied')) {
        return res.status(403).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/share/:token - Generate QR code data URL for sharing
   * Returns a data URL that can be displayed as an image
   */
  router.get('/:token/qr', async (req, res) => {
    try {
      const { token } = req.params;

      // Verify token is valid
      const details = await accessTokenService.getAccessTokenDetails(token);

      if (!details) {
        return res.status(404).json({ error: 'Shareable link not found' });
      }

      if (details.isExpired) {
        return res.status(400).json({ error: 'Share link has expired' });
      }

      const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify/${token}`;

      // Return URL for frontend to generate QR (qrcode library is client-side friendly in Next.js)
      res.json({
        success: true,
        data: {
          shareUrl,
          qrText: shareUrl,
        },
      });
    } catch (error: any) {
      console.error('QR generation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/share/:token/details - Get share link details
   */
  router.get('/:token/details', async (req, res) => {
    try {
      const { token } = req.params;

      const details = await accessTokenService.getAccessTokenDetails(token);

      if (!details) {
        return res.status(404).json({ error: 'Share link not found' });
      }

      res.json({
        success: true,
        data: details,
      });
    } catch (error: any) {
      console.error('Share details error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * DELETE /api/share/:token - Revoke a shareable link
   */
  router.delete('/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const { creatorAddress } = req.body;

      if (!creatorAddress) {
        return res.status(400).json({ error: 'creatorAddress is required' });
      }

      await accessTokenService.revokeAccessToken(token, creatorAddress);

      res.json({
        success: true,
        message: 'Share link revoked',
      });
    } catch (error: any) {
      console.error('Revoke error:', error);

      if (error.message.includes('Access denied')) {
        return res.status(403).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}