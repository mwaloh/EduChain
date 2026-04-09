import { PrismaClient } from "@prisma/client";
import { ethers } from "ethers";
import { RewardTokenService } from "./RewardTokenService";
import { REWARD_CATEGORIES } from "../config/rewardConfig";
import * as fs from "fs";
import * as path from "path";

/**
 * Initialize RewardTokenService singleton
 * Call this once at application startup
 */
let rewardService: RewardTokenService | null = null;

export async function initializeRewardService(
  prisma: PrismaClient
): Promise<RewardTokenService> {
  if (rewardService) {
    return rewardService;
  }

  try {
    // Get environment variables
    const rpcUrl = process.env.RPC_URL;
    const privateKey = process.env.PRIVATE_KEY;
    const network = process.env.NETWORK || "amoy";

    if (!rpcUrl || !privateKey) {
      throw new Error("Missing RPC_URL or PRIVATE_KEY environment variables");
    }

    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey);

    // Load token contract address and ABI
    const deploymentFile = path.join(
      process.cwd(),
      "..",
      "deployments",
      `${network}.json`
    );

    if (!fs.existsSync(deploymentFile)) {
      throw new Error(`Deployment file not found: ${deploymentFile}`);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));

    // Check if deployment is an array (multiple contracts) or single object
    let tokenDeployment;
    if (Array.isArray(deployment)) {
      // Find EduRewardToken deployment in array
      tokenDeployment = deployment.find(
        (d: any) => d.contractName === "EduRewardToken"
      );
    } else {
      // Single contract deployment - assume it's EduRewardToken if network matches
      tokenDeployment = {
        contractName: "EduRewardToken",
        address: deployment.contractAddress,
        network: deployment.network
      };
    }

    if (!tokenDeployment) {
      throw new Error("EduRewardToken contract not found in deployment file");
    }

    // Load token ABI
    const tokenAbiPath = path.join(
      process.cwd(),
      "..",
      "artifacts",
      "contracts",
      "EduRewardToken.sol",
      "EduRewardToken.json"
    );

    if (!fs.existsSync(tokenAbiPath)) {
      throw new Error(`Token ABI not found: ${tokenAbiPath}`);
    }

    const tokenArtifact = JSON.parse(fs.readFileSync(tokenAbiPath, "utf-8"));

    // Create reward configuration from constants
    const rewardConfig = Object.entries(REWARD_CATEGORIES).reduce(
      (acc, [key, config]) => {
        if (config.enabled) {
          acc[key] = {
            amount: config.amount,
            description: config.description,
          };
        }
        return acc;
      },
      {} as { [key: string]: { amount: number; description: string } }
    );

    // Initialize service
    rewardService = new RewardTokenService(
      prisma,
      provider,
      wallet,
      tokenDeployment.address,
      tokenArtifact.abi,
      rewardConfig
    );

    console.log("✅ RewardTokenService initialized successfully");
    console.log(`   Token Contract: ${tokenDeployment.address}`);
    console.log(`   Network: ${network}`);
    console.log(`   Rewards Enabled: ${Object.keys(rewardConfig).length}`);

    return rewardService;
  } catch (error) {
    console.error("❌ Failed to initialize RewardTokenService:", error);
    throw error;
  }
}

/**
 * Get the initialized reward service
 * Must call initializeRewardService first
 */
export function getRewardService(): RewardTokenService {
  if (!rewardService) {
    throw new Error(
      "RewardTokenService not initialized. Call initializeRewardService() first."
    );
  }
  return rewardService;
}

/**
 * Reset service (useful for testing)
 */
export function resetRewardService() {
  rewardService = null;
}
