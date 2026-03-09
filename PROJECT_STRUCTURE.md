# EduChain Project Structure

## 📁 Directory Overview

```
EduChain/
│
├── contracts/                    # Solidity Smart Contracts
│   ├── EduChain.sol              # Main contract (full-featured)
│   └── AcademicCredential.sol   # Legacy contract
│
├── scripts/                      # Hardhat Scripts
│   ├── deploy-educhain.ts       # Deploy EduChain contract
│   ├── deploy.ts                # Legacy deployment (AcademicCredential)
│   ├── mint.ts                  # Legacy mint script
│   ├── ipfs-upload.ts           # IPFS metadata upload utility
│   └── operations/              # Operational scripts
│       ├── onboard-institution.ts
│       ├── mint-credential.ts
│       └── revoke-credential.ts
│
├── tests/                        # Test Files
│   └── contracts/
│       └── EduChain.test.ts     # Comprehensive contract tests
│
├── frontend/                     # Next.js Frontend Application
│   ├── src/
│   │   ├── app/                # Next.js 14 App Router
│   │   │   ├── page.tsx        # Landing page
│   │   │   ├── student/        # Student dashboard
│   │   │   ├── admin/          # Institution admin
│   │   │   ├── employer/       # Employer verification
│   │   │   ├── verify/         # Public verification
│   │   │   └── api/            # API routes
│   │   ├── components/         # React components
│   │   ├── hooks/              # Custom React hooks
│   │   └── lib/                # Utilities
│   │       ├── contract.ts     # Contract interaction
│   │       ├── ipfs.ts         # IPFS utilities
│   │       ├── chain.ts        # Chain configuration
│   │       └── wallet.ts       # Wallet utilities
│   └── package.json
│
├── backend/                      # Analytics Backend Service
│   ├── src/
│   │   ├── index.ts            # Express server entry point
│   │   ├── routes/             # API route handlers
│   │   │   ├── verify.ts       # Verification endpoints
│   │   │   └── analytics.ts    # Analytics endpoints
│   │   └── services/           # Background services
│   │       └── eventListener.ts # Blockchain event listener
│   ├── db/
│   │   └── schema.prisma       # Prisma database schema
│   └── package.json
│
├── metadata/                     # IPFS Metadata Templates
│   └── credential-template.json
│
├── deployments/                  # Deployment artifacts (gitignored)
│   └── amoy.json               # Deployment info
│
├── hardhat.config.ts            # Hardhat configuration
├── package.json                 # Root dependencies
└── README.md                    # Project documentation
```

## 🔑 Key Files

### Smart Contracts

- **`contracts/EduChain.sol`**: Main contract with:
  - Soulbound NFT logic
  - Multi-institution RBAC
  - Verification events
  - Privacy controls
  - Pausable & ReentrancyGuard

### Scripts

- **`scripts/deploy-educhain.ts`**: Deploys EduChain contract
- **`scripts/ipfs-upload.ts`**: Uploads credential metadata to IPFS
- **`scripts/operations/onboard-institution.ts`**: Onboards new institutions
- **`scripts/operations/mint-credential.ts`**: Mints credentials (for testing/institutions)
- **`scripts/operations/revoke-credential.ts`**: Revokes credentials

### Backend

- **`backend/src/index.ts`**: Express server setup
- **`backend/src/routes/verify.ts`**: Verification API (`POST /api/verify`, `GET /api/verify/:tokenId`)
- **`backend/src/routes/analytics.ts`**: Analytics endpoints
- **`backend/src/services/eventListener.ts`**: Listens to blockchain events and syncs DB
- **`backend/db/schema.prisma`**: Database schema with:
  - Institution
  - Credential
  - VerificationLog
  - Analytics
  - FraudAttempt

### Frontend

- **`frontend/src/app/student/page.tsx`**: Student dashboard
- **`frontend/src/app/admin/page.tsx`**: Institution admin interface
- **`frontend/src/app/employer/page.tsx`**: Employer verification UI
- **`frontend/src/app/verify/page.tsx`**: Public verification page

### Tests

- **`tests/contracts/EduChain.test.ts`**: Comprehensive test suite covering:
  - Deployment
  - Institution onboarding
  - Credential minting
  - Soulbound transfers
  - Revocation
  - Verification
  - Pausable functionality
  - Privacy features

## 🔄 Data Flow

1. **Institution Issues Credential**:
   - Admin calls `mint()` on EduChain contract
   - Metadata uploaded to IPFS
   - NFT minted to student address
   - Event `CredentialMinted` emitted

2. **Event Listener Syncs to DB**:
   - Backend service listens to events
   - Creates Credential record in PostgreSQL
   - Updates Institution credential count

3. **Employer Verifies**:
   - Frontend/API calls contract `verify()` function
   - Contract emits `CredentialVerified` event
   - Backend logs verification to VerificationLog table
   - Returns status to verifier

4. **Analytics**:
   - API queries PostgreSQL for stats
   - Returns aggregated data (institutions, trends, fraud attempts)

## 🚀 Development Workflow

1. **Local Development**:
   - Deploy to Hardhat local node
   - Run backend with local PostgreSQL
   - Frontend connects to local contract

2. **Testnet Deployment**:
   - Deploy to Polygon Amoy
   - Update environment variables
   - Run database migrations
   - Start event listener service

3. **Production** (Future):
   - Deploy to Polygon mainnet
   - Use production PostgreSQL
   - Enable monitoring and alerts

