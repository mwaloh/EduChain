import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

// Claim token service for credential discovery and claiming
export class ClaimTokenService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate a unique claim token for a credential
   */
  async generateClaimToken(params: {
    credentialId: string;
    studentEmail: string;
    studentName?: string;
    expiresInDays?: number;
  }): Promise<string> {
    const { credentialId, studentEmail, studentName, expiresInDays = 30 } = params;

    // Verify credential exists
    const credential = await this.prisma.credential.findUnique({
      where: { id: credentialId },
    });

    if (!credential) {
      throw new Error('Credential not found');
    }

    // Check if claim token already exists for this credential
    const existingToken = await this.prisma.claimToken.findFirst({
      where: {
        credentialId,
        claimed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingToken) {
      return existingToken.token;
    }

    // Generate new token
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await this.prisma.claimToken.create({
      data: {
        token,
        credentialId,
        studentEmail,
        studentName,
        expiresAt,
      },
    });

    return token;
  }

  /**
   * Validate and claim a token
   */
  async claimToken(params: {
    token: string;
    claimantAddress: string;
  }): Promise<{
    credential: any;
    institution: any;
    metadata: any;
  }> {
    const { token, claimantAddress } = params;

    // Find valid claim token
    const claimToken = await this.prisma.claimToken.findUnique({
      where: { token },
      include: {
        credential: {
          include: {
            institution: true,
          },
        },
      },
    });

    if (!claimToken) {
      throw new Error('Invalid claim token');
    }

    if (claimToken.claimed) {
      throw new Error('Token has already been claimed');
    }

    if (claimToken.expiresAt < new Date()) {
      throw new Error('Claim token has expired');
    }

    // Mark token as claimed
    await this.prisma.claimToken.update({
      where: { id: claimToken.id },
      data: {
        claimed: true,
        claimedAt: new Date(),
        claimedBy: claimantAddress,
      },
    });

    // Fetch metadata from IPFS (simplified - in real implementation, use IPFS service)
    let metadata = null;
    try {
      // This would normally fetch from IPFS
      metadata = {
        degree: 'Sample Degree',
        grade: 'First Class',
        issuedDate: claimToken.credential.issuedOn.toISOString().split('T')[0],
        expiresDate: claimToken.credential.expiresOn?.toISOString().split('T')[0] || null,
      };
    } catch (error) {
      console.warn('Failed to fetch metadata:', error);
    }

    return {
      credential: claimToken.credential,
      institution: claimToken.credential.institution,
      metadata,
    };
  }

  /**
   * Get claim token details (for validation)
   */
  async getClaimTokenDetails(token: string) {
    const claimToken = await this.prisma.claimToken.findUnique({
      where: { token },
      include: {
        credential: {
          include: {
            institution: true,
          },
        },
      },
    });

    if (!claimToken) {
      return null;
    }

    return {
      token: claimToken.token,
      studentEmail: claimToken.studentEmail,
      studentName: claimToken.studentName,
      claimed: claimToken.claimed,
      expiresAt: claimToken.expiresAt,
      institutionName: claimToken.credential.institution.name,
      isExpired: claimToken.expiresAt < new Date(),
    };
  }

  /**
   * Clean up expired tokens (maintenance function)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.claimToken.deleteMany({
      where: {
        claimed: false,
        expiresAt: { lt: new Date() },
      },
    });

    return result.count;
  }
}