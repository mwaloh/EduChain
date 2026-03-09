/**
 * Deployment script for EduChain smart contract
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Validate private key format
function isValidPrivateKey(key: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  // Must be 0x + 64 hex characters = 66 total
  return /^0x[a-fA-F0-9]{64}$/.test(trimmed);
}

async function main() {
  console.log('🚀 Deploying EduChain contract...\n');

  // Get network and deployer
  const network = process.env.NETWORK || 'amoy';
  const rpcUrl = process.env.RPC_URL;
  const privateKey = process.env.PRIVATE_KEY?.trim();

  if (!rpcUrl) {
    throw new Error('❌ Missing RPC_URL in .env\n   Get one from: https://www.alchemy.com/');
  }

  if (!privateKey) {
    throw new Error(
      '❌ Missing PRIVATE_KEY in .env\n' +
      '   Export from MetaMask: Settings > Advanced > Show Private Key\n' +
      '   Or generate a test wallet for development'
    );
  }

  if (!isValidPrivateKey(privateKey)) {
    throw new Error(
      '❌ Invalid PRIVATE_KEY format in .env\n\n' +
      `   Current value: ${privateKey.substring(0, 20)}...\n` +
      '   Required format: 0x + 64 hexadecimal characters (66 characters total)\n' +
      '   Example: PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef\n\n' +
      '   To get a private key:\n' +
      '   1. MetaMask: Settings > Advanced > Show Private Key\n' +
      '   2. Or use a test wallet generator\n'
    );
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const deployerAddress = await wallet.getAddress();

  console.log(`📋 Network: ${network}`);
  console.log(`👤 Deployer: ${deployerAddress}`);
  console.log(`💰 Balance: ${ethers.formatEther(await provider.getBalance(deployerAddress))} ETH\n`);

  // Read contract artifact
  const contractPath = path.join(
    __dirname,
    '../artifacts/contracts/EduChain.sol/EduChain.json'
  );

  if (!fs.existsSync(contractPath)) {
    throw new Error('Contract not compiled. Run: npm run build');
  }

  const contractArtifact = JSON.parse(fs.readFileSync(contractPath, 'utf-8'));
  const contractFactory = new ethers.ContractFactory(
    contractArtifact.abi,
    contractArtifact.bytecode,
    wallet
  );

  // Deploy contract
  console.log('⏳ Deploying...');
  const contract = await contractFactory.deploy(deployerAddress);
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log(`\n✅ Contract deployed!`);
  console.log(`📍 Address: ${contractAddress}`);
  console.log(`🔗 Explorer: https://amoy.polygonscan.com/address/${contractAddress}\n`);

  // Save deployment info
  const deploymentInfo = {
    network,
    contractAddress,
    deployer: deployerAddress,
    blockNumber: await provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
    transactionHash: contract.deploymentTransaction()?.hash,
  };

  const deploymentPath = path.join(__dirname, `../deployments/${network}.json`);
  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  console.log(`💾 Deployment info saved to: ${deploymentPath}\n`);

  // Next steps
  console.log('📝 Next steps:');
  console.log(`   1. Update frontend/.env.local with: NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`);
  console.log('   2. Run onboarding script to add institutions');
  console.log('   3. Grant roles to institution admins\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

