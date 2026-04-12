/**
 * Simple localhost deployment using Hardhat's default network
 */

import hre from 'hardhat';
import type { Contract } from 'ethers';

async function main() {
  console.log('🚀 Deploying EduChain contract to local network...\n');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const EduChain = await hre.ethers.getContractFactory('EduChain');
  const contract = await EduChain.deploy(deployer.address);
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log('\n✅ EduChain deployed to:', address);
  console.log('🔗 Local network: http://127.0.0.1:8545');
  console.log('\n📝 Update frontend/.env.local with:');
  console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  console.log(`   NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545\n`);

  try {
    const c = contract as unknown as Contract;
    const tx = await c.getFunction('onboardInstitution')(
      deployer.address,
      deployer.address,
      'Test University',
      'ipfs://QmTest'
    );
    await tx.wait();
    console.log('✅ Test institution onboarded!\n');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`⚠️  Auto-onboard failed: ${msg}\n`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('DEPLOY FAILED:', error);
    process.exitCode = 1;
  });

