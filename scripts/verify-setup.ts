/**
 * Verify deployment setup before deploying
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('🔍 Verifying deployment setup...\n');

  let allGood = true;

  // Check RPC URL
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl || rpcUrl.includes('YOUR_ALCHEMY_API_KEY')) {
    console.log('❌ RPC_URL is missing or has placeholder');
    console.log('   Get one from: https://www.alchemy.com/\n');
    allGood = false;
  } else {
    console.log('✅ RPC_URL configured');
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const network = await provider.getNetwork();
      console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
    } catch (error: any) {
      console.log(`   ⚠️  Cannot connect: ${error.message}`);
      allGood = false;
    }
  }

  // Check Private Key
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    console.log('❌ PRIVATE_KEY is invalid or missing');
    allGood = false;
  } else {
    console.log('✅ PRIVATE_KEY configured');
    const wallet = new ethers.Wallet(privateKey);
    console.log(`   Address: ${wallet.address}`);
  }

  // Check wallet balance
  if (rpcUrl && !rpcUrl.includes('YOUR_ALCHEMY_API_KEY') && privateKey) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const balance = await provider.getBalance(wallet.address);
      const balanceEth = ethers.formatEther(balance);
      
      console.log(`\n💰 Wallet Balance: ${balanceEth} MATIC`);
      
      if (balance === 0n) {
        console.log('   ⚠️  Wallet has no funds!');
        console.log(`   Get testnet MATIC: https://faucet.polygon.technology/`);
        console.log(`   Address: ${wallet.address}`);
        allGood = false;
      } else if (parseFloat(balanceEth) < 0.001) {
        console.log('   ⚠️  Low balance - may not be enough for deployment');
      } else {
        console.log('   ✅ Sufficient balance for deployment');
      }
    } catch (error: any) {
      console.log(`\n⚠️  Could not check balance: ${error.message}`);
    }
  }

  // Check contract compilation
  const contractPath = path.join(__dirname, '../artifacts/contracts/EduChain.sol/EduChain.json');
  if (!fs.existsSync(contractPath)) {
    console.log('\n❌ Contract not compiled');
    console.log('   Run: npm run build');
    allGood = false;
  } else {
    console.log('\n✅ Contract compiled');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (allGood) {
    console.log('✅ All checks passed! Ready to deploy.');
    console.log('\nRun: npm run deploy:educhain');
  } else {
    console.log('❌ Setup incomplete. Please fix the issues above.');
  }
  console.log('='.repeat(50) + '\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

