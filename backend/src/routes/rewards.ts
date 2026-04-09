import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { getRewardService } from "../services/rewardServiceInit";
import { REWARD_CATEGORIES, getEnabledRewards } from "../config/rewardConfig";

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/rewards/earned/:address
 * Get total and breakdown of rewards earned by a specific address
 */
router.get("/earned/:address", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    // Validate address format
    if (!address || address.length < 40) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const rewardService = getRewardService();
    const earned = await rewardService.getEarnedRewards(address);

    return res.json({
      address,
      totalEarned: earned.total.toString(),
      rewardsCount: earned.rewards.length,
      rewards: earned.rewards.map((r) => ({
        id: r.id,
        amount: r.amount.toString(),
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt,
        credentialId: r.credentialId,
        verificationLogId: r.verificationLogId,
      })),
    });
  } catch (error) {
    console.error("Error fetching earned rewards:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch earned rewards", details: String(error) });
  }
});

/**
 * GET /api/rewards/statistics
 * Get platform-wide reward statistics
 */
router.get("/statistics", async (req: Request, res: Response) => {
  try {
    const rewardService = getRewardService();
    const stats = await rewardService.getRewardStatistics();

    return res.json({
      totalDistributed: stats.totalDistributed.toString(),
      byReason: stats.byReason.map((item: any) => ({
        reason: item.reason,
        count: item._count,
        total: item._sum.amount?.toString() || "0",
      })),
      topRecipients: stats.topRecipients.map((item: any) => ({
        address: item.recipientAddress,
        totalEarned: item._sum.amount?.toString() || "0",
        rewardCount: item._count,
      })),
    });
  } catch (error) {
    console.error("Error fetching reward statistics:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch reward statistics", details: String(error) });
  }
});

/**
 * GET /api/rewards/config
 * Get reward configuration
 */
router.get("/config", (req: Request, res: Response) => {
  try {
    const enabledRewards = getEnabledRewards();

    return res.json({
      enabled: Object.entries(enabledRewards).map(([key, config]) => ({
        reason: key,
        amount: config.amount,
        description: config.description,
        category: config.category,
      })),
      categories: ["student", "institution", "employer", "ecosystem"],
    });
  } catch (error) {
    console.error("Error fetching reward config:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch reward config", details: String(error) });
  }
});

/**
 * POST /api/rewards/manual
 * Admin endpoint to manually issue rewards (requires admin authentication)
 */
router.post("/manual", async (req: Request, res: Response) => {
  try {
    // Verify admin access
    const adminEmail = req.headers["x-admin-email"];
    const adminPassword = process.env.ADMIN_REWARD_PASSWORD;

    if (!adminEmail || req.headers["x-admin-password"] !== adminPassword) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { recipientAddress, reason, customAmount } = req.body;

    if (!recipientAddress || !reason) {
      return res.status(400).json({
        error: "recipientAddress and reason are required",
      });
    }

    const rewardService = getRewardService();
    const txHash = await rewardService.rewardParticipation(
      recipientAddress,
      reason,
      customAmount
    );

    if (txHash) {
      return res.json({
        success: true,
        transactionHash: txHash,
        message: `Reward issued: ${customAmount || REWARD_CATEGORIES[reason as keyof typeof REWARD_CATEGORIES]?.amount || 0} EDU to ${recipientAddress}`,
      });
    } else {
      return res.status(400).json({
        error: "Failed to issue reward",
      });
    }
  } catch (error) {
    console.error("Error issuing manual reward:", error);
    return res.status(500).json({
      error: "Failed to issue reward",
      details: String(error),
    });
  }
});

/**
 * GET /api/rewards/history
 * Get recent reward distribution history
 */
router.get("/history", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const skip = (page - 1) * limit;

    const [rewards, total] = await Promise.all([
      prisma.tokenReward.findMany({
        where: { status: "confirmed" },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.tokenReward.count({
        where: { status: "confirmed" },
      }),
    ]);

    return res.json({
      data: rewards.map((r) => ({
        id: r.id,
        recipientAddress: r.recipientAddress,
        amount: r.amount.toString(),
        reason: r.reason,
        transactionHash: r.transactionHash,
        createdAt: r.createdAt,
        confirmedAt: r.confirmedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching reward history:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch reward history", details: String(error) });
  }
});

export default router;
