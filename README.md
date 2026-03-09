# EduChain

**Decentralized Academic Credential Management and Verification Platform**

EduChain is a complete blockchain-based solution for issuing, managing, and verifying academic credentials using Soulbound NFTs on Polygon. Built with Solidity smart contracts, Next.js frontend, PostgreSQL analytics backend, and IPFS storage.

## 🎯 Problem Statement

Fake academic certificates are a growing issue in Kenya and globally. Traditional verification is slow, expensive, centralized, and vulnerable to fraud. EduChain provides a unified, trusted verification layer for employers, institutions, and students.

## ✨ Features

- **Soulbound NFTs**: Non-transferable academic credentials
- **Multi-Institution Support**: Consortium of Kenyan universities
- **Instant Verification**: Real-time credential authenticity checks
- **Privacy Protection**: Zero-knowledge privacy with selective disclosure
- **Analytics Dashboard**: Track verifications, fraud attempts, and trends
- **Revocation Support**: Institutions can revoke credentials for fraud/misconduct
- **IPFS Storage**: Decentralized metadata storage
- **Role-Based Access**: OWNER, INSTITUTION_ADMIN, EMPLOYER_VERIFIER, STUDENT

## 🏗️ Architecture

```
┌─────────────────┐
│   Next.js       │  Frontend (Student/Institution/Employer Dashboards)
│   Frontend      │
└────────┬────────┘
         │
         ├─────────────────┐
         │                 │
┌────────▼────────┐  ┌─────▼──────┐
│  Polygon Amoy   │  │ PostgreSQL │  Analytics Backend
│  Smart Contract │  │  Database  │
│   (EduChain)    │  │            │
└─────────────────┘  └────────────┘
         │
┌────────▼────────┐
│      IPFS       │  Certificate Metadata Storage
└─────────────────┘
```

## 📁 Project Structure

```
/
├── contracts/
│   ├── EduChain.sol              # Main smart contract
│   └── AcademicCredential.sol    # Legacy contract
├── scripts/
│   ├── deploy-educhain.ts       # Deployment script
│   ├── ipfs-upload.ts           # IPFS metadata upload utility
│   └── operations/
│       ├── onboard-institution.ts
│       └── mint-credential.ts
├── tests/
│   └── contracts/
│       └── EduChain.test.ts      # Comprehensive test suite
├── frontend/
│   └── src/
│       ├── app/                 # Next.js pages
│       ├── components/          # React components
│       └── lib/                 # Utilities (contract, IPFS, etc.)
├── backend/
│   ├── src/
│   │   ├── index.ts             # Express server
│   │   ├── routes/              # API routes (verify, analytics)
│   │   └── services/            # Event listener service
│   └── db/
│       └── schema.prisma        # Database schema
└── metadata/
    └── credential-template.json # IPFS metadata template
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Hardhat
- MetaMask or compatible wallet

### 1. Clone and Install

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Install backend dependencies
cd backend && npm install && cd ..
```

### 2. Configure Environment

Create `.env` in project root:

```env
# Blockchain
RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
NETWORK=amoy

# IPFS (Optional)
INFURA_IPFS_AUTH=your_infura_auth
PINATA_API_KEY=your_pinata_key
PINATA_SECRET_KEY=your_pinata_secret
```

Create `backend/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/educhain"
CONTRACT_ADDRESS=0xYourDeployedContractAddress
RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
PORT=3001
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourDeployedContractAddress
NEXT_PUBLIC_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
```

### 3. Deploy Smart Contract

```bash
# Compile contracts
npm run build

# Deploy to Polygon Amoy
npm run deploy:amoy
```

Copy the deployed contract address and update environment files.

### 4. Setup Database

```bash
cd backend

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Open Prisma Studio
npm run db:studio
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

### 6. Onboard an Institution

```bash
# Replace addresses and name as needed
ts-node scripts/operations/onboard-institution.ts \
  0xInstitutionAddress 0xAdminAddress "Meru University" \
  "ipfs://QmInstitutionMetadata"
```

## 📝 Usage

### Minting Credentials (Institutions)

```bash
ts-node scripts/operations/mint-credential.ts \
  0xStudentAddress "BSc Computer Science" \
  "First Class Honours" "Meru University" \
  "2024-01-15" "2028-01-15"
```

### Verifying Credentials

1. **Via Frontend**: Navigate to `/verify` and enter tokenId
2. **Via API**: 
   ```bash
   curl -X POST http://localhost:3001/api/verify \
     -H "Content-Type: application/json" \
     -d '{"tokenId": "1", "verifierAddress": "0x..."}'
   ```

### Analytics

- **Overview**: `GET /api/analytics/overview`
- **Institutions**: `GET /api/analytics/institutions`
- **Trending**: `GET /api/analytics/trending`
- **Fraud Attempts**: `GET /api/analytics/fraud`

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test file
npx hardhat test tests/contracts/EduChain.test.ts
```

## 🔐 Security Features

- ✅ Reentrancy protection
- ✅ Access control (RBAC)
- ✅ Pausable contract (emergency stop)
- ✅ Rate limiting on verification
- ✅ Soulbound transfers disabled
- ✅ Institution-based revocation
- ✅ Event logging for audit trail

## 📊 Smart Contract Functions

### Institution Management
- `onboardInstitution()` - Add new institution
- `revokeInstitution()` - Revoke institution rights
- `updateInstitutionMetadata()` - Update institution info

### Credential Management
- `mint()` - Issue new credential
- `revoke()` - Revoke credential (fraud/misconduct)
- `getCredentialStatus()` - Query credential status

### Verification
- `verify()` - Verify credential authenticity (emits event)

### Privacy
- `setRevealConsent()` - Student control over data disclosure
- `setSelectiveDisclosure()` - Field-level privacy controls

## 🎨 Frontend Pages

- `/` - Landing page
- `/student` - Student dashboard (view credentials)
- `/admin` - Institution admin (issue/revoke)
- `/employer` - Employer verification interface
- `/verify` - Public verification page
- `/analytics` - Analytics dashboard

## 📚 API Endpoints

### Verification
- `POST /api/verify` - Verify credential
- `GET /api/verify/:tokenId` - Get credential status

### Analytics
- `GET /api/analytics/overview` - Platform statistics
- `GET /api/analytics/institutions` - Institution stats
- `GET /api/analytics/trending` - Trending degrees/types
- `GET /api/analytics/fraud` - Fraud attempt logs

## 🛠️ Tech Stack

- **Smart Contracts**: Solidity 0.8.24, OpenZeppelin
- **Blockchain**: Polygon Amoy (testnet)
- **Frontend**: Next.js 14, TypeScript, TailwindCSS
- **Backend**: Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL
- **Storage**: IPFS (Pinata/Infura)
- **Testing**: Hardhat, Chai, Mocha


## 🤝 Contributing

This is a final year project. For questions or contributions, please contact Dickson Waweru(Mwaloh)-254712704419.

## 📧 Contact

For institutional onboarding or support, please reach out through the platform.

---

**Built with ❤️ for Kenya's education sector**
