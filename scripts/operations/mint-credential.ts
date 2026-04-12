/**
 * Script to mint a credential (for testing/institutions)
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { uploadCredentialMetadata, generateCredentialMetadata } from '../ipfs-upload.js';

dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 5) {
    console.log(`
Usage: ts-node scripts/operations/mint-credential.ts \\
  <student-address> <degree> <grade> <institution> <issued-date> [expires-date]

Example:
  ts-node scripts/operations/mint-credential.ts \\
    0xStudent... "BSc Computer Science" \\
    "First Class Honours" "Meru University" \\
    "2024-01-15" "2028-01-15"
    `);
    process.exit(1);
  }

  const studentAddress = args[0];
  const degree = args[1];
  const grade = args[2];
  const institution = args[3];
  const issuedDate = args[4];
  const expiresDate = args[5] || '0'; // 0 means no expiry

  if (!ethers.isAddress(studentAddress)) {
    throw new Error('Invalid student address');
  }

  // Generate student hash (in production, this would be computed from actual student data)
  const studentHash = ethers.id(`${studentAddress}-${degree}-${institution}`);

  // Upload metadata to IPFS
  console.log('📤 Uploading metadata to IPFS...\n');
  const metadata = generateCredentialMetadata({
    degree,
    grade,
    institution,
    studentHash: studentHash,
    issuedDate,
  });

  const ipfsCid = await uploadCredentialMetadata(metadata);
  console.log(`✅ Metadata CID: ${ipfsCid}\n`);

  // Convert dates to Unix timestamps
  const issuedOn = Math.floor(new Date(issuedDate).getTime() / 1000);
  const expiresOn = expiresDate === '0' ? 0 : Math.floor(new Date(expiresDate).getTime() / 1000);

  // Connect to contract
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

  console.log('🎓 Minting credential...\n');
  console.log(`   Student: ${studentAddress}`);
  console.log(`   Degree: ${degree}`);
  console.log(`   Institution: ${institution}`);
  console.log(`   IPFS CID: ${ipfsCid}\n`);

  // Mint credential
  const tx = await contract.mint(
    studentAddress,
    ipfsCid,
    issuedOn,
    expiresOn,
    studentHash
  );

  console.log(`📤 Transaction hash: ${tx.hash}`);
  console.log('⏳ Waiting for confirmation...');
  
  const receipt = await tx.wait();
  
  // Find the token ID from events
  const mintEvent = receipt.logs.find((log: any) => {
    try {
      const parsed = contract.interface.parseLog(log);
      return parsed?.name === 'CredentialMinted';
    } catch {
      return false;
    }
  });

  if (mintEvent) {
    const parsed = contract.interface.parseLog(mintEvent);
    const tokenId = parsed?.args[1];
    console.log(`\n✅ Credential minted!`);
    console.log(`   Token ID: ${tokenId}`);
    console.log(`   Block: ${receipt.blockNumber}`);
  } else {
    console.log(`\n✅ Credential minted!`);
    console.log(`   Block: ${receipt.blockNumber}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

