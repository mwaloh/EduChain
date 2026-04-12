import { ethers } from "ethers";
import { PrismaClient } from "@prisma/client";

/**
 * RewardTokenService
 * Manages automated EDU token reward distribution for platform participation
 */

export interface RewardConfig {
  [key: string]: {
    amount: number; // EDU tokens to award
    description: string;
  };
}

// Default reward amounts (in EDU tokens)
const DEFAULT_REWARD_CONFIG: RewardConfig = {
  CREDENTIAL_ISSUED_STUDENT: { amount: 10, description: "Student receives credential" },
  CREDENTIAL_ISSUED_INSTITUTION: { amount: 5, description: "Institution issues credential" },
  CREDENTIAL_VERIFIED_VALID: { amount: 0.5, description: "Employer verifies valid credential" },
  BULK_VERIFICATION_COMPLETED: { amount: 2, description: "Completed bulk verification" },
  EARLY_ADOPTER_BONUS: { amount: 100, description: "Early platform adopter" },
};

export class RewardTokenService {
  private prisma: PrismaClient;
  private rewardConfig: RewardConfig;
  private tokenContractAddress: string;
  private tokenABI: any[];
  private wallet: ethers.Wallet;
  private provider: ethers.JsonRpcProvider;
  private tokenContract: ethers.Contract;

  constructor(
    prisma: PrismaClient,
    provider: ethers.JsonRpcProvider,
    wallet: ethers.Wallet,
    tokenContractAddress: string,
    tokenABI: any[],
    customConfig?: Partial<RewardConfig>
  ) {
    this.prisma = prisma;
    this.provider = provider;
    this.wallet = wallet.connect(provider);
    this.tokenContractAddress = tokenContractAddress;
    this.tokenABI = tokenABI;

    // Merge custom config with defaults
    this.rewardConfig = { ...DEFAULT_REWARD_CONFIG, ...customConfig } as RewardConfig;

    // Initialize contract
    this.tokenContract = new ethers.Contract(
      tokenContractAddress,
      tokenABI,
      this.wallet
    );
  }

  /**
   * Mint reward tokens to a recipient
   * @param recipientAddress Wallet address to receive tokens
   * @param reason Reason for reward (key from config)
   * @param customAmount Optional override amount
   * @param relatedId Optional credential or verification ID for reference
   * @returns Transaction hash or null if failed
   */
  async rewardParticipation(
    recipientAddress: string,
    reason: string,
    customAmount?: number,
    relatedId?: { credentialId?: string; verificationLogId?: string }
  ): Promise<string | null> {
    try {
      // Validate recipient address
      if (!ethers.isAddress(recipientAddress)) {
        console.error(`Invalid recipient address: ${recipientAddress}`);
        return null;
      }

      // Get reward amount
      const rewardConfig = this.rewardConfig[reason];
      if (!rewardConfig && !customAmount) {
        console.warn(`No reward config found for reason: ${reason}`);
        return null;
      }

      const amount = customAmount || rewardConfig.amount;
      if (amount <= 0) {
        console.warn(`Invalid reward amount: ${amount}`);
        return null;
      }

      // Create record in database with pending status
      const tokenReward = await this.prisma.tokenReward.create({
        data: {
          recipientAddress,
          amount,
          reason,
          credentialId: relatedId?.credentialId,
          verificationLogId: relatedId?.verificationLogId,
          status: "pending",
          metadata: JSON.stringify({
            config: rewardConfig,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      // Convert amount to Wei (18 decimals for EDU token)
      const amountInWei = ethers.parseUnits(amount.toString(), 18);

      // Call smart contract to mint tokens
      const tx = await this.tokenContract.mintReward(recipientAddress, amountInWei);
      const receipt = await tx.wait();

      if (receipt && receipt.hash) {
        // Update database with confirmed status and transaction hash
        await this.prisma.tokenReward.update({
          where: { id: tokenReward.id },
          data: {
            status: "confirmed",
            transactionHash: receipt.hash,
            confirmedAt: new Date(),
          },
        });

        console.log(`✅ Reward minted: ${amount} EDU to ${recipientAddress} (TX: ${receipt.hash})`);
        return receipt.hash;
      }
    } catch (error) {
      console.error(`Error minting reward for ${recipientAddress}:`, error);

      // Log failed attempt
      try {
        await this.prisma.tokenReward.create({
          data: {
            recipientAddress,
            amount: customAmount || this.rewardConfig[reason]?.amount || 0,
            reason,
            status: "failed",
            metadata: JSON.stringify({
              error: (error as Error).message,
              timestamp: new Date().toISOString(),
            }),
          },
        });
      } catch (dbError) {
        console.error("Failed to log reward error:", dbError);
      }
    }

    return null;
  }

  /**
   * Reward credential issuance
   */
  async rewardCredentialIssuance(
    studentAddress: string,
    institutionAddress: string,
    credentialId: string
  ): Promise<void> {
    // Reward student
    await this.rewardParticipation(
      studentAddress,
      "CREDENTIAL_ISSUED_STUDENT",
      undefined,
      { credentialId }
    );

    // Reward institution
    await this.rewardParticipation(
      institutionAddress,
      "CREDENTIAL_ISSUED_INSTITUTION",
      undefined,
      { credentialId }
    );
  }

  /**
   * Reward credential verification
   */
  async rewardVerification(
    verifierAddress: string,
    verificationLogId: string,
    isValid: boolean = true
  ): Promise<void> {
    if (isValid) {
      await this.rewardParticipation(
        verifierAddress,
        "CREDENTIAL_VERIFIED_VALID",
        undefined,
        { verificationLogId }
      );
    }
  }

  /**
   * Reward bulk verification completion
   */
  async rewardBulkVerification(
    verifierAddress: string,
    verificationCount: number
  ): Promise<void> {
    // Calculate bonus based on volume
    const bonus = Math.min(verificationCount * 0.1, 50); // Cap at 50 EDU
    const totalReward =
      (this.rewardConfig["BULK_VERIFICATION_COMPLETED"]?.amount || 2) + bonus;

    await this.rewardParticipation(verifierAddress, "BULK_VERIFICATION_COMPLETED", totalReward);
  }

  /**
   * Get reward statistics
   */
  async getRewardStatistics() {
    const totalRewards = await this.prisma.tokenReward.aggregate({
      _sum: { amount: true },
      where: { status: "confirmed" },
    });

    const rewardsByReason = await this.prisma.tokenReward.groupBy({
      by: ["reason"],
      _count: true,
      _sum: { amount: true },
      where: { status: "confirmed" },
    });

    const topRecipients = await this.prisma.tokenReward.groupBy({
      by: ["recipientAddress"],
      _sum: { amount: true },
      _count: true,
      where: { status: "confirmed" },
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    });

    return {
      totalDistributed: totalRewards._sum.amount || 0,
      byReason: rewardsByReason,
      topRecipients,
    };
  }

  /**
   * Get rewards earned by a specific address
   */
  async getEarnedRewards(address: string) {
    const rewards = await this.prisma.tokenReward.findMany({
      where: {
        recipientAddress: address,
        status: "confirmed",
      },
      orderBy: { createdAt: "desc" },
    });

    const total = rewards.reduce((sum, reward) => sum + reward.amount, 0);

    return { total, rewards };
  }

  /**
   * Update reward configuration
   */
  updateConfig(newConfig: Partial<RewardConfig>) {
    this.rewardConfig = { ...this.rewardConfig, ...newConfig } as RewardConfig;
  }

  /**
   * Get current reward configuration
   */
  getConfig(): RewardConfig {
    return { ...this.rewardConfig };
  }
}
