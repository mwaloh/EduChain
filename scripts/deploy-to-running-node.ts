/**
 * Deploy to already-running Hardhat node
 * Connect directly via ethers to localhost:8545
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('🚀 Deploying EduChain to running Hardhat node...\n');

  // Connect to running Hardhat node
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  
  // Use first account from Hardhat (private key from your Hardhat node output)
  // Account #0: 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
  const deployerKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const wallet = new ethers.Wallet(deployerKey, provider);
  const deployerAddress = wallet.address;

  const balance = await provider.getBalance(deployerAddress);
  console.log(`📋 Network: localhost:8545`);
  console.log(`👤 Deployer: ${deployerAddress}`);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

  // Load contract artifact
  const contractPath = path.join(__dirname, '../artifacts/contracts/EduChain.sol/EduChain.json');
  if (!fs.existsSync(contractPath)) {
    throw new Error('Contract not compiled. Run: npm run build');
  }

  const contractArtifact = JSON.parse(fs.readFileSync(contractPath, 'utf-8'));
  const contractFactory = new ethers.ContractFactory(
    contractArtifact.abi,
    contractArtifact.bytecode,
    wallet
  );

  // Deploy
  console.log('⏳ Deploying...');
  const contract = await contractFactory.deploy(deployerAddress);
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log(`\n✅ Contract deployed!`);
  console.log(`📍 Address: ${contractAddress}\n`);

  // Save deployment info
  const deploymentInfo = {
    network: 'localhost',
    contractAddress,
    deployer: deployerAddress,
    blockNumber: await provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
    transactionHash: contract.deploymentTransaction()?.hash,
  };

  const deploymentPath = path.join(__dirname, '../deployments/localhost.json');
  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  console.log(`💾 Saved to: ${deploymentPath}\n`);

  // Test onboarding (ABI method name depends on contract; cast for TS)
  try {
    const c = contract as ethers.Contract;
    const tx = await c.getFunction('onboardInstitution')(
      deployerAddress,
      deployerAddress,
      'Test University',
      'ipfs://QmTest'
    );
    await tx.wait();
    console.log('✅ Test institution onboarded!\n');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`⚠️  Auto-onboard: ${msg}\n`);
  }

  console.log('📝 Next steps:');
  console.log(`   Update frontend/.env.local:`);
  console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`   NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

