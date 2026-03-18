import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

// Access token service for credential sharing
export class AccessTokenService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate a shareable access token for a credential
   */
  async generateAccessToken(params: {
    credentialId: string;
    creatorAddress: string;
    expiresInDays?: number;
    limited?: boolean;
  }): Promise<string> {
    const { credentialId, creatorAddress, expiresInDays = 30, limited = false } = params;

    // Verify credential exists and belongs to creator
    const credential = await this.prisma.credential.findUnique({
      where: { id: credentialId },
    });

    if (!credential) {
      throw new Error('Credential not found');
    }

    if (credential.studentAddress.toLowerCase() !== creatorAddress.toLowerCase()) {
      throw new Error('Access denied: credential does not belong to this address');
    }

    // Generate new token
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const accessToken = await this.prisma.accessToken.create({
      data: {
        token,
        credentialId,
        creatorAddress: creatorAddress.toLowerCase(),
        expiresAt,
        limited,
      },
    });

    return accessToken.token;
  }

  /**
   * Verify and use an access token
   */
  async verifyAccessToken(token: string) {
    const accessToken = await this.prisma.accessToken.findUnique({
      where: { token },
      include: {
        credential: {
          include: {
            institution: true,
          },
        },
      },
    });

    if (!accessToken) {
      throw new Error('Invalid access token');
    }

    if (accessToken.expiresAt < new Date()) {
      throw new Error('Access token has expired');
    }

    // Increment view count
    await this.prisma.accessToken.update({
      where: { id: accessToken.id },
      data: { viewCount: accessToken.viewCount + 1 },
    });

    return {
      credential: accessToken.credential,
      institution: accessToken.credential.institution,
      creator: accessToken.creatorAddress,
    };
  }

  /**
   * Get access token details
   */
  async getAccessTokenDetails(token: string) {
    const accessToken = await this.prisma.accessToken.findUnique({
      where: { token },
    });

    if (!accessToken) {
      return null;
    }

    return {
      token: accessToken.token,
      creator: accessToken.creatorAddress,
      expiresAt: accessToken.expiresAt,
      viewCount: accessToken.viewCount,
      limited: accessToken.limited,
      isExpired: accessToken.expiresAt < new Date(),
    };
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.accessToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return result.count;
  }

  /**
   * Revoke an access token
   */
  async revokeAccessToken(token: string, creatorAddress: string): Promise<void> {
    const accessToken = await this.prisma.accessToken.findUnique({
      where: { token },
    });

    if (!accessToken) {
      throw new Error('Access token not found');
    }

    if (accessToken.creatorAddress.toLowerCase() !== creatorAddress.toLowerCase()) {
      throw new Error('Access denied: you cannot revoke this token');
    }

    await this.prisma.accessToken.delete({
      where: { id: accessToken.id },
    });
  }
}