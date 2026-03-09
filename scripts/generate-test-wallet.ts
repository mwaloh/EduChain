/**
 * Generate a test wallet for development
 * Use this to create a wallet for testing purposes only
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
  console.log('🔐 Generating test wallet...\n');

  // Generate a random wallet
  const wallet = ethers.Wallet.createRandom();

  console.log('✅ Test wallet generated!\n');
  console.log('📋 Wallet Details:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Address:     ${wallet.address}`);
  console.log(`Private Key: ${wallet.privateKey}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Save to .env (optional)
  const envPath = path.join(__dirname, '../.env');
  const shouldUpdate = process.argv.includes('--update-env');

  if (shouldUpdate) {
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
      // Replace existing PRIVATE_KEY
      envContent = envContent.replace(
        /PRIVATE_KEY=.*/g,
        `PRIVATE_KEY=${wallet.privateKey}`
      );
      // Add if it doesn't exist
      if (!envContent.includes('PRIVATE_KEY=')) {
        envContent += `\nPRIVATE_KEY=${wallet.privateKey}\n`;
      }
    } else {
      envContent = `# Generated test wallet\nPRIVATE_KEY=${wallet.privateKey}\nRPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY\nNETWORK=amoy\n`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated .env file with new private key\n');
  }

  console.log('📝 Next Steps:');
  console.log('   1. Fund this wallet with testnet MATIC:');
  console.log(`      Address: ${wallet.address}`);
  console.log('      Faucet: https://faucet.polygon.technology/');
  console.log('   2. Update your .env file:');
  console.log(`      PRIVATE_KEY=${wallet.privateKey}`);
  if (!shouldUpdate) {
    console.log('\n   Or run with --update-env to auto-update .env:');
    console.log('   ts-node scripts/generate-test-wallet.ts --update-env');
  }
  console.log('\n⚠️  SECURITY WARNING:');
  console.log('   - This is a TEST wallet only');
  console.log('   - Never use for mainnet or real funds');
  console.log('   - Keep the private key secure');
  console.log('   - Do NOT commit .env to git\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

