require('dotenv').config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';

// Validate private key format
function validatePrivateKey(key) {
  if (!key) return false;
  const trimmed = key.trim();
  return /^0x[a-fA-F0-9]{64}$/.test(trimmed);
}

const amoyAccounts = PRIVATE_KEY && validatePrivateKey(PRIVATE_KEY)
  ? [PRIVATE_KEY.trim()]
  : [];

if (process.env.NETWORK === 'amoy' && amoyAccounts.length === 0) {
  console.warn('\n⚠️  WARNING: Invalid or missing PRIVATE_KEY in .env');
  console.warn('   Please update .env with a valid private key (0x + 64 hex characters)');
  console.warn('   Example: PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef\n');
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: { type: 'edr-simulated' },
    localhost: { type: 'http', url: 'http://127.0.0.1:8545' },
    amoy: {
      type: 'http',
      url: RPC_URL,
      chainId: 80002,
      accounts: amoyAccounts,
    },
  },
  paths: {
    tests: './tests',
  },
};
