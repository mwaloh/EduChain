# Environment Setup Guide

## Creating .env File

Create a `.env` file in the project root with the following content:

```env
# Blockchain Configuration
RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
NETWORK=amoy
```

## Getting Your Values

### 1. Get RPC URL (Alchemy)

1. Go to [Alchemy.com](https://www.alchemy.com/)
2. Sign up or log in
3. Create a new app:
   - Network: Polygon
   - Chain: Polygon Amoy (Testnet)
4. Copy the HTTP URL (starts with `https://polygon-amoy.g.alchemy.com/v2/...`)

### 2. Get Private Key (MetaMask)

⚠️ **SECURITY WARNING**: Never share your private key or commit it to git!

**Option A: Use a Test Wallet**
1. Create a new MetaMask account (for testing only)
2. Export private key:
   - Click account icon → Settings
   - Advanced → Show Private Key
   - Copy the key (starts with `0x`)

**Option B: Use Hardhat Account (Local Development)**
For local testing only, you can use Hardhat's default accounts.

### 3. Get Testnet ETH

Before deploying, you need testnet MATIC on Polygon Amoy:

1. Get testnet tokens from a faucet:
   - [Polygon Faucet](https://faucet.polygon.technology/)
   - Select "Polygon Amoy Testnet"
   - Enter your wallet address
   - Request testnet MATIC

2. Or use [Alchemy Faucet](https://www.alchemy.com/faucets/polygon-amoy)

## Quick Setup (Windows PowerShell)

Run this in your project root:

```powershell
# Create .env file
@"
RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
NETWORK=amoy
"@ | Set-Content -Path .env
```

Then edit `.env` and replace:
- `YOUR_ALCHEMY_API_KEY` with your actual Alchemy API key
- `YOUR_PRIVATE_KEY_HERE` with your wallet private key

## Verify Setup

After creating `.env`, run:

```bash
npm run deploy:educhain
```

If successful, you'll see:
- ✅ Contract deployed
- Contract address printed
- Deployment info saved

## Troubleshooting

### "Missing RPC_URL or PRIVATE_KEY"
- Make sure `.env` file exists in project root
- Check that variables are on separate lines
- No quotes needed around values

### "insufficient funds"
- Get testnet MATIC from faucet (see step 3 above)

### "nonce too high"
- Wait a few seconds and try again
- Or manually increment nonce in wallet

