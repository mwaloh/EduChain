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

  private initializeContract() {
    try {
      const network = process.env.NETWORK || "amoy";
      const rpcUrl = process.env.RPC_URL;
      const privateKey = process.env.PRIVATE_KEY;

      if (!rpcUrl || !privateKey) {
        console.warn("Missing RPC_URL or PRIVATE_KEY for contract service");
        return;
      }

      const deploymentPath = path.join(
        __dirname,
        `../../deployments/${network}.json`
      );
      if (!fs.existsSync(deploymentPath)) {
        console.warn("Contract deployment file not found");
        return;
      }

      const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
      const contractAddress = deployment.contractAddress;

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, provider);

      const contractArtifact = JSON.parse(
        fs.readFileSync(
          path.join(
            __dirname,
            "../../artifacts/contracts/EduChain.sol/EduChain.json"
          ),
          "utf-8"
        )
      );

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