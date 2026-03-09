/**
 * Simple localhost deployment using Hardhat's default network
 */

import hre from 'hardhat';

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

  // Test onboarding
  try {
    const tx = await contract.onboardInstitution(
      deployer.address,
      deployer.address,
      'Test University',
      'ipfs://QmTest'
    );
    await tx.wait();
    console.log('✅ Test institution onboarded!\n');
  } catch (error: any) {
    console.log(`⚠️  Auto-onboard failed: ${error.message}\n`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('DEPLOY FAILED:', error);
    process.exitCode = 1;
  });

