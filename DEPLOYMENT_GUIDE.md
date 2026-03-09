# 🚀 EduChain Deployment Guide

## Current Status

✅ Contracts compiled successfully  
✅ Private key configured  
⚠️ RPC URL needs to be set  

---

## Step 1: Get Alchemy API Key

1. **Go to [Alchemy.com](https://www.alchemy.com/)**
2. **Sign up or Log in**
3. **Create a new app:**
   - Click "Create App"
   - Name: `EduChain` (or any name)
   - Network: **Polygon**
   - Chain: **Polygon Amoy** (Testnet)
   - Click "Create App"

4. **Copy your HTTP URL:**
   - It looks like: `https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY_HERE`
   - Copy the entire URL

---

## Step 2: Update .env File

Open `.env` in the project root and update:

```env
RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_ACTUAL_API_KEY_HERE
PRIVATE_KEY=0x9c085b6d7063d574ac4f4adecbaff4e2a2631ea75648a37d9b292d5276d75b76
NETWORK=amoy
```

**Replace:**
- `YOUR_ACTUAL_API_KEY_HERE` with your actual Alchemy API key from Step 1

---

## Step 3: Fund Your Wallet

Your deployer wallet address: **`0x7eA4D92561e367880c02a2F996E89607492d91d7`**

1. **Go to [Polygon Faucet](https://faucet.polygon.technology/)**
2. **Select "Polygon Amoy Testnet"**
3. **Enter your address:** `0x7eA4D92561e367880c02a2F996E89607492d91d7`
4. **Request testnet MATIC** (usually instant, but may take a few minutes)

You'll need at least 0.01 MATIC for deployment (fees are very low on testnet).

---

## Step 4: Deploy Contract

Once RPC URL is updated and wallet is funded:

```bash
npm run deploy:educhain
```

---

## Step 5: Update Frontend Environment

After deployment, copy the contract address and update `frontend/.env.local`:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourDeployedContractAddress
NEXT_PUBLIC_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY
```

---

## Step 6: Onboard an Institution

After deployment, onboard your first institution:

```bash
ts-node scripts/operations/onboard-institution.ts \
  0xInstitutionAddress 0xAdminAddress "Meru University" \
  "ipfs://QmInstitutionMetadata"
```

---

## Troubleshooting

### "401 Unauthorized"
- RPC URL is still a placeholder
- Update `.env` with real Alchemy API key

### "insufficient funds"
- Get testnet MATIC from faucet
- Wait a few minutes after requesting

### "nonce too high"
- Wait a few seconds and try again
- Or reset your wallet nonce

---

## Quick Commands

```bash
# Compile contracts
npm run build

# Deploy contract
npm run deploy:educhain

# Onboard institution
ts-node scripts/operations/onboard-institution.ts ...

# Mint credential
ts-node scripts/operations/mint-credential.ts ...
```

