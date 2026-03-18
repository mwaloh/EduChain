/**
 * Script to onboard a new institution to EduChain
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log(`
Usage: ts-node scripts/operations/onboard-institution.ts <institution-address> <admin-address> <institution-name> [metadata-uri]

Example:
  ts-node scripts/operations/onboard-institution.ts \\
    0x1234... 0x5678... "Meru University" \\
    "ipfs://QmInstitutionMetadata"
    `);
    process.exit(1);
  }

  const institutionAddress = args[0];
  const adminAddress = args[1];
  const institutionName = args[2];
  const metadataURI = args[3] || '';

  // Validate addresses
  if (!ethers.isAddress(institutionAddress) || !ethers.isAddress(adminAddress)) {
    throw new Error('Invalid Ethereum address');
  }

  const network = process.env.NETWORK || 'amoy';
  const rpcUrl = process.env.RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    throw new Error('Missing RPC_URL or PRIVATE_KEY in .env');
  }

  // Load deployment info
  const deploymentPath = path.join(__dirname, `../../deployments/${network}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error('Contract not deployed. Run deployment script first.');
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  const contractAddress = deployment.contractAddress;

  // Connect to contract
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const contractArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../artifacts/contracts/EduChain.sol/EduChain.json'),
      'utf-8'
    )
  );

  const contract = new ethers.Contract(contractAddress, contractArtifact.abi, wallet);

  console.log('🏛️  Onboarding institution...\n');
  console.log(`   Institution Address: ${institutionAddress}`);
  console.log(`   Admin Address: ${adminAddress}`);
  console.log(`   Name: ${institutionName}`);
  console.log(`   Metadata URI: ${metadataURI || '(none)'}\n`);

  // Check if caller is owner
  const owner = await contract.owner();
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error('Only contract owner can onboard institutions');
  }

  // Onboard institution
  console.log('⏳ Sending transaction...');
  const tx = await contract.onboardInstitution(
    institutionAddress,
    adminAddress,
    institutionName,
    metadataURI
  );

  console.log(`📤 Transaction hash: ${tx.hash}`);
  console.log('⏳ Waiting for confirmation...');
  
  const receipt = await tx.wait();
  console.log(`✅ Institution onboarded!`);
  console.log(`   Block: ${receipt.blockNumber}`);
  console.log(`   Gas used: ${receipt.gasUsed.toString()}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

