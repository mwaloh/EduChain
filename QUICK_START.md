# 🚀 EduChain Quick Start Guide

## Current Status

✅ **Project Structure:** Complete  
✅ **Contracts:** Compiled and ready  
✅ **Frontend:** Updated to use EduChain  
✅ **Backend:** Code ready  
✅ **Scripts:** All deployment scripts ready  
⚠️ **Blockchain:** Needs Alchemy API key  

---

## What You Can Do NOW (Without Blockchain)

### 1. Test Locally with Hardhat

```bash
# Start local Hardhat node
npx hardhat node

# In another terminal, deploy to local network
hardhat run scripts/deploy-educhain.ts --network localhost
```

### 2. Set Up Backend Database

```bash
cd backend

# Create .env file
# DATABASE_URL="postgresql://user:password@localhost:5432/educhain"

# Generate Prisma client
npm run db:generate

# Run migrations (if you have PostgreSQL set up)
npm run db:migrate
```

### 3. Review Frontend Pages

```bash
cd frontend
npm run dev
# Open http://localhost:3000
```

---

## What Needs Alchemy API Key

### Deployment to Polygon Amoy

1. **Get API Key:**
   - https://www.alchemy.com/
   - Create app → Polygon → Polygon Amoy

2. **Update `.env`:**
   ```env
   RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY_HERE
   ```

3. **Fund Wallet:**
   - Address: `0x7eA4D92561e367880c02a2F996E89607492d91d7`
   - Faucet: https://faucet.polygon.technology/

4. **Deploy:**
   ```bash
   npm run verify:setup  # Check everything
   npm run deploy:educhain
   ```

---

## Complete Workflow (After API Key Setup)

### 1. Deploy Contract
```bash
npm run deploy:educhain
```

### 2. Update Frontend
```bash
# Update frontend/.env.local
NEXT_PUBLIC_CONTRACT_ADDRESS=0xDeployedAddress
NEXT_PUBLIC_RPC_URL=your_alchemy_url
```

### 3. Onboard Institution
```bash
ts-node scripts/operations/onboard-institution.ts \
  0xInstitutionAddress 0xAdminAddress "Meru University" \
  "ipfs://QmInstitutionMetadata"
```

### 4. Mint Credential
```bash
ts-node scripts/operations/mint-credential.ts \
  0xStudentAddress "BSc Computer Science" \
  "First Class Honours" "Meru University" \
  "2024-01-15" "2028-01-15"
```

### 5. Start Services

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

---

## Testing Commands

```bash
# Run contract tests
npm test

# Run EduChain specific tests
npm run test:educhain

# Generate test wallet
npm run generate:wallet

# Verify setup
npm run verify:setup
```

---

## Project Structure

```
/
├── contracts/
│   ├── EduChain.sol          ✅ Main contract
│   └── legacy/               📦 Old contracts
├── scripts/
│   ├── deploy-educhain.ts    ✅ Deploy script
│   ├── operations/           ✅ Mint, onboard, revoke
│   └── verify-setup.ts       ✅ Setup checker
├── frontend/                 ✅ Next.js app
├── backend/                  ✅ Analytics API
└── tests/                    ✅ Test suite
```

---

## Next Steps Checklist

- [ ] Get Alchemy API key
- [ ] Update `.env` with RPC_URL
- [ ] Fund testnet wallet
- [ ] Run `npm run verify:setup`
- [ ] Deploy contract
- [ ] Update frontend `.env.local`
- [ ] Onboard first institution
- [ ] Test minting a credential
- [ ] Start backend service
- [ ] Start frontend app

---

**Ready when you are!** 🚀

