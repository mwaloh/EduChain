/**
 * Script to revoke a credential
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
Usage: ts-node scripts/operations/revoke-credential.ts <token-id> <reason>

Example:
  ts-node scripts/operations/revoke-credential.ts 1 "Academic misconduct"
    `);
    process.exit(1);
  }

  const tokenId = args[0];
  const reason = args[1];

  const network = process.env.NETWORK || 'amoy';
  const rpcUrl = process.env.RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    throw new Error('Missing RPC_URL or PRIVATE_KEY in .env');
  }

  const deploymentPath = path.join(__dirname, `../../deployments/${network}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error('Contract not deployed');
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  const contractAddress = deployment.contractAddress;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const contractArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../artifacts/contracts/EduChain.sol/EduChain.json'),
      'utf-8'
    )
  );

  const contract = new ethers.Contract(contractAddress, contractArtifact.abi, wallet);

  console.log('❌ Revoking credential...\n');
  console.log(`   Token ID: ${tokenId}`);
  console.log(`   Reason: ${reason}\n`);

  const tx = await contract.revoke(tokenId, reason);

  console.log(`📤 Transaction hash: ${tx.hash}`);
  console.log('⏳ Waiting for confirmation...');
  
  const receipt = await tx.wait();
  console.log(`✅ Credential revoked!`);
  console.log(`   Block: ${receipt.blockNumber}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

