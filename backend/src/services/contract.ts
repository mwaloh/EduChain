import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import IPFSService from "./ipfs";

class ContractService {
  private contract: ethers.Contract | null = null;
  private wallet: ethers.Wallet | null = null;

  constructor() {
    this.initializeContract();
  }

  private resolveDeploymentPath(network: string): string | null {
    const candidates = [
      path.join(process.cwd(), "..", "deployments", `${network}.json`),
      path.join(process.cwd(), "deployments", `${network}.json`),
      path.join(__dirname, `../../deployments/${network}.json`),
    ];

    return candidates.find((p) => fs.existsSync(p)) ?? null;
  }

  private resolveEduChainArtifactPath(): string | null {
    const candidates = [
      path.join(
        process.cwd(),
        "..",
        "artifacts",
        "contracts",
        "EduChain.sol",
        "EduChain.json"
      ),
      path.join(
        process.cwd(),
        "artifacts",
        "contracts",
        "EduChain.sol",
        "EduChain.json"
      ),
      path.join(
        __dirname,
        "../../artifacts/contracts/EduChain.sol/EduChain.json"
      ),
    ];

    return candidates.find((p) => fs.existsSync(p)) ?? null;
  }

  private initializeContract() {
    try {
      const network = process.env.NETWORK || "amoy";
      const rpcUrl = process.env.RPC_URL;
      const privateKey = process.env.PRIVATE_KEY;
      const configuredContractAddress = process.env.CONTRACT_ADDRESS;

      if (!rpcUrl || !privateKey) {
        console.warn("Missing RPC_URL or PRIVATE_KEY for contract service");
        return;
      }

      let contractAddress = configuredContractAddress;
      if (contractAddress && !ethers.isAddress(contractAddress)) {
        console.warn(
          "Invalid CONTRACT_ADDRESS provided; falling back to deployment file lookup"
        );
        contractAddress = undefined;
      }

      if (!contractAddress) {
        const deploymentPath = this.resolveDeploymentPath(network);
        if (!deploymentPath) {
          console.warn(
            "Contract deployment file not found and CONTRACT_ADDRESS is not set"
          );
          return;
        }

        const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
        contractAddress = deployment.contractAddress;
      }

      if (!contractAddress || !ethers.isAddress(contractAddress)) {
        console.warn("Unable to resolve a valid contract address");
        return;
      }

      const artifactPath = this.resolveEduChainArtifactPath();
      if (!artifactPath) {
        console.warn("EduChain contract artifact not found");
        return;
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, provider);

      const contractArtifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));

      this.contract = new ethers.Contract(
        contractAddress,
        contractArtifact.abi,
        this.wallet
      );
    } catch (error) {
      console.error("Failed to initialize contract service:", error);
    }
  }

  async issueCredential(
    studentAddress: string,
    ipfsCid: string,
    expiresOn: number = 0
  ): Promise<string> {
    if (!this.contract || !this.wallet) {
      throw new Error("Contract service not initialized");
    }

    if (!ethers.isAddress(studentAddress)) {
      throw new Error("Invalid student address");
    }

    // Generate student hash
    const studentHash = ethers.id(`${studentAddress}-${Date.now()}`);

    // Current timestamp for issuedOn
    const issuedOn = Math.floor(Date.now() / 1000);

    console.log(`Minting credential for ${studentAddress} with CID ${ipfsCid}`);

    // Mint the credential
    const tx = await this.contract.mint(
      studentAddress,
      ipfsCid,
      issuedOn,
      expiresOn
    );

    const receipt = await tx.wait();
    console.log(`Credential minted. Transaction: ${receipt.hash}`);

    return receipt.hash;
  }

  getContract(): ethers.Contract | null {
    return this.contract;
  }
}

export default new ContractService();