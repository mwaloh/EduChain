/**
 * Token Rewards Configuration
 * Defines reward amounts and categories for all platform participation types
 */

export interface RewardAmount {
  amount: number; // EDU tokens
  description: string;
  category: "student" | "institution" | "employer" | "ecosystem";
  enabled: boolean;
}

export const REWARD_CATEGORIES = {
  // Student rewards
  CREDENTIAL_ISSUED_STUDENT: {
    amount: 10,
    description: "Received a new academic credential",
    category: "student",
    enabled: true,
  },
  CREDENTIAL_SHARED: {
    amount: 2,
    description: "Shared credential with employer",
    category: "student",
    enabled: true,
  },

  // Institution rewards
  CREDENTIAL_ISSUED_INSTITUTION: {
    amount: 5,
    description: "Issued an academic credential",
    category: "institution",
    enabled: true,
  },
  BULK_MINT_COMPLETED: {
    amount: 50,
    description: "Completed bulk credential import (per 100 credentials)",
    category: "institution",
    enabled: true,
  },
  INSTITUTION_JOINED: {
    amount: 500,
    description: "Institution onboarded to platform",
    category: "institution",
    enabled: true,
  },

  // Employer/Verifier rewards
  CREDENTIAL_VERIFIED_VALID: {
    amount: 0.5,
    description: "Verified a valid credential",
    category: "employer",
    enabled: true,
  },
  VERIFICATION_MILESTONE_10: {
    amount: 5,
    description: "Completed 10 verifications",
    category: "employer",
    enabled: true,
  },
  VERIFICATION_MILESTONE_100: {
    amount: 50,
    description: "Completed 100 verifications",
    category: "employer",
    enabled: true,
  },
  BULK_VERIFICATION_COMPLETED: {
    amount: 2,
    description: "Completed bulk verification job",
    category: "employer",
    enabled: true,
  },

  // Ecosystem participation
  EARLY_ADOPTER_BONUS: {
    amount: 100,
    description: "Early platform adopter",
    category: "ecosystem",
    enabled: true,
  },
  REFERRAL_BONUS: {
    amount: 25,
    description: "Referred new institution to platform",
    category: "ecosystem",
    enabled: false, // Disabled until referral system implemented
  },
} as const;

/**
 * Calculate reward for bulk operations based on volume
 * Provides incentive for large-scale adoption
 */
export function calculateBulkReward(
  itemCount: number,
  baseReward: number
): number {
  if (itemCount < 10) return baseReward;
  if (itemCount < 50) return baseReward * 1.5;
  if (itemCount < 100) return baseReward * 2;
  if (itemCount < 500) return baseReward * 3;
  return baseReward * 5; // Max multiplier for 500+
}

/**
 * Get reward amount for a specific reason
 */
export function getRewardAmount(reason: string): number {
  const reward = REWARD_CATEGORIES[reason as keyof typeof REWARD_CATEGORIES];
  if (!reward || !reward.enabled) {
    console.warn(`Reward not found or disabled for: ${reason}`);
    return 0;
  }
  return reward.amount;
}

/**
 * Check if a reward type is enabled
 */
export function isRewardEnabled(reason: string): boolean {
  const reward = REWARD_CATEGORIES[reason as keyof typeof REWARD_CATEGORIES];
  return reward?.enabled ?? false;
}

/**
 * Get all enabled rewards
 */
type RewardKey = keyof typeof REWARD_CATEGORIES;

export function getEnabledRewards(): Partial<Record<RewardKey, RewardAmount>> {
  const out: Partial<Record<RewardKey, RewardAmount>> = {};
  for (const key of Object.keys(REWARD_CATEGORIES) as RewardKey[]) {
    const config = REWARD_CATEGORIES[key];
    if (config.enabled) {
      out[key] = config as unknown as RewardAmount;
    }
  }
  return out;
}
