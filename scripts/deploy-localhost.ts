/**
 * Deployment script for local Hardhat network
 * Uses Hardhat's built-in signers (no .env needed)
 */

import hre from 'hardhat';
import type { Contract } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('🚀 Deploying EduChain contract to local network...\n');

  // Always use ethers from hre for deploying contracts
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = deployer.address;
  const balance = await hre.ethers.provider.getBalance(deployerAddress);

  console.log(`📋 Network: localhost`);
  console.log(`👤 Deployer: ${deployerAddress}`);
  console.log(`💰 Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  // Use Hardhat's contract factory
  const EduChain = await hre.ethers.getContractFactory('EduChain');

  // Deploy contract
  console.log('⏳ Deploying...');
  const contract = await EduChain.deploy(deployerAddress);
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log(`\n✅ Contract deployed!`);
  console.log(`📍 Address: ${contractAddress}`);
  console.log(`🔗 Local network: http://127.0.0.1:8545\n`);

  // Save deployment info
  const deploymentInfo = {
    network: 'localhost',
    contractAddress,
    deployer: deployerAddress,
    blockNumber: await hre.ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
    transactionHash: contract.deploymentTransaction()?.hash,
  };

  const deploymentPath = path.join(__dirname, '../deployments/localhost.json');
  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  console.log(`💾 Deployment info saved to: ${deploymentPath}\n`);

  // Test: Onboard first institution (using deployer as institution admin)
  console.log('🧪 Testing: Onboarding deployer as first institution...');
  try {
    const c = contract as unknown as Contract;
    const tx = await c.getFunction('onboardInstitution')(
      deployerAddress,
      deployerAddress,
      'Test University',
      'ipfs://QmTest'
    );
    await tx.wait();
    console.log('✅ Test institution onboarded successfully!\n');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`⚠️  Could not auto-onboard: ${msg}\n`);
  }

  // Next steps
  console.log('📝 Next steps:');
  console.log(`   1. Update frontend/.env.local with:`);
  console.log(`      NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`      NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545`);
  console.log('   2. Start frontend: cd frontend && npm run dev');
  console.log('   3. Test minting: Use frontend admin panel or scripts\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

