# EduChain

EduChain is a blockchain-based academic credential platform for issuing, claiming, sharing, and verifying academic records. It combines a soulbound NFT smart contract, a Next.js frontend, an Express/Prisma backend, and IPFS-backed metadata to support institutions, students, employers, and platform administrators.

## What the project does

- Issues academic credentials as non-transferable NFTs on Polygon Amoy.
- Lets approved institutions onboard admins and mint or revoke credentials.
- Lets students claim credentials, manage privacy, and share access links.
- Lets employers verify credentials individually or in bulk.
- Records analytics, audit logs, claim tokens, share tokens, and reward activity.
- Includes an EDU reward layer for participation events such as issuance and verification.

## Architecture

```text
frontend (Next.js 14)
  -> role-based dashboards, auth, wallet interaction, verification UI

backend (Express + Prisma)
  -> verification, analytics, onboarding, claim/share flows, rewards, admin APIs
  -> persists app data in SQLite through Prisma
  -> optionally listens for on-chain events

contracts (Hardhat + Solidity)
  -> EduChain soulbound credential contract
  -> EduRewardToken contract

IPFS / Web3 storage
  -> credential and institution metadata

Polygon Amoy
  -> credential issuance, revocation, verification, role-based access control
```

## Monorepo layout

```text
.
|- contracts/                Solidity contracts
|- scripts/                  Hardhat deployment and contract operation scripts
|- tests/                    Smart contract tests
|- frontend/                 Next.js application
|- backend/                  Express API and Prisma schema/migrations
|- metadata/                 Metadata templates
|- README.md                 Project overview and setup
|- QUICK_START.md            Earlier quick-start notes
|- ENV_SETUP.md              Root environment setup notes
```

## Core roles

- `OWNER`: platform owner with institution and verifier management permissions.
- `INSTITUTION_ADMIN_ROLE`: can mint and revoke credentials for their institution.
- `EMPLOYER_VERIFIER_ROLE`: verifier role on-chain.
- `student`: app-level role for claiming, viewing, and sharing credentials.
- `institution_admin`: app-level role mapped from approved institution admins.
- `employer`: app-level role for verification workflows.

## Main features in this codebase

- Soulbound credential minting and revocation in `contracts/EduChain.sol`
- Institution onboarding and metadata management
- Public and employer verification flows
- Student claim and privacy controls
- Share links and QR-based credential access
- Bulk import and bulk verification support
- Admin review tools for institution and student management
- Analytics, fraud attempt logging, and audit logs
- Google OAuth plus email/password auth
- Token reward configuration and reward history APIs

## Tech stack

- Smart contracts: Solidity `0.8.24`, OpenZeppelin, Hardhat
- Frontend: Next.js `14`, React `18`, TypeScript, Tailwind CSS, NextAuth
- Backend: Express, TypeScript, Prisma
- Database: SQLite via Prisma (`backend/db/schema.prisma`)
- Blockchain network: Polygon Amoy by default
- Storage: IPFS / Pinata / Web3 storage integrations

## Prerequisites

- Node.js 18 or newer
- npm
- A wallet/private key for deployments or contract writes
- Polygon Amoy testnet funds if deploying to Amoy

## Installation

Install dependencies in the root, frontend, and backend workspaces:

```bash
npm install
cd frontend && npm install
cd ../backend && npm install
cd ..
```

## Environment variables

This project reads configuration from the root `.env`, `backend/.env`, and `frontend/.env.local`.

### 1. Root `.env`

Used by Hardhat and root scripts:

```env
RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
NETWORK=amoy

INFURA_IPFS_AUTH=
PINATA_API_KEY=
PINATA_SECRET_KEY=
CONTRACT_ADDRESS=
```

### 2. `backend/.env`

Used by the Express API and Prisma:

```env
DATABASE_URL="file:./dev.db"
PORT=9999

CONTRACT_ADDRESS=0xYourEduChainContract
RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
NETWORK=amoy

FRONTEND_URL=http://localhost:3000
IPFS_GATEWAY_URL=https://ipfs.io/ipfs
WEB3_STORAGE_TOKEN=

SENDGRID_API_KEY=
FROM_EMAIL=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=

SUPER_ADMIN_EMAIL=
SUPER_ADMIN_PASSWORD=
ADMIN_REWARD_EMAIL=
ADMIN_REWARD_PASSWORD=

EVENT_POLL_INTERVAL_MS=
EVENT_MAX_BLOCK_SPAN=
EVENT_BLOCK_CONFIRMATIONS=
```

### 3. `frontend/.env.local`

Used by the Next.js app:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:9999
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourEduChainContract
NEXT_PUBLIC_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY

NEXTAUTH_SECRET=change-me
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

PINATA_API_KEY=
PINATA_SECRET=
```

## Database setup

The active Prisma datasource in this repo is SQLite, not PostgreSQL.

```bash
cd backend
npm run db:generate
npm run db:migrate
```

Optional:

```bash
cd backend
npm run db:studio
```

## Smart contract workflow

Compile contracts:

```bash
npm run build
```

Run tests:

```bash
npm test
npm run test:educhain
```

Deploy to Polygon Amoy:

```bash
npm run deploy:educhain
```

Deploy to a local running node:

```bash
npm run deploy:local
```

Useful root scripts:

- `npm run build`
- `npm run clean`
- `npm test`
- `npm run test:educhain`
- `npm run deploy:amoy`
- `npm run deploy:educhain`
- `npm run deploy:local`
- `npm run generate:wallet`
- `npm run verify:setup`

## Running the application locally

Start the backend:

```bash
cd backend
npm run dev
```

Start the frontend in a second terminal:

```bash
cd frontend
npm run dev
```

The default local URLs are:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:9999`
- Health check: `http://localhost:9999/health`

## Typical usage flow

1. Deploy the smart contract and copy the contract address into root, backend, and frontend env files.
2. Run Prisma migrations in `backend/`.
3. Start backend and frontend.
4. Onboard an institution.
5. Create or import students.
6. Mint credentials.
7. Let students claim or share credentials.
8. Verify credentials from the employer or public verification flow.

## Useful operational scripts

Examples from `scripts/`:

- `scripts/deploy-educhain.ts`
- `scripts/ipfs-upload.ts`
- `scripts/operations/onboard-institution.ts`
- `scripts/operations/mint-credential.ts`
- `scripts/operations/revoke-credential.ts`
- `scripts/create-test-users.ts`
- `scripts/verify-setup.ts`

## Frontend routes

Main app pages currently present in `frontend/src/app`:

- `/`
- `/login`
- `/role-selection`
- `/student`
- `/student/credentials`
- `/student/privacy`
- `/student/share`
- `/institution`
- `/institution/mint`
- `/institution/revoke`
- `/institution/manage`
- `/institution/students`
- `/institution/batch`
- `/institution/verify/[token]`
- `/employer`
- `/employer/verify`
- `/employer/bulk`
- `/verify`
- `/verify/[tokenId]`
- `/claim/[token]`
- `/admin`

## Backend API surface

The backend mounts these route groups:

- `/api/verify`
- `/api/bulk-verify`
- `/api/analytics`
- `/api/ipfs`
- `/api/audit`
- `/api/claim`
- `/api/institutions`
- `/api/students`
- `/api/credentials`
- `/api/employers`
- `/api/share`
- `/api/bulk-import`
- `/api/users`
- `/api/admin`
- `/api/rewards`

Common examples:

```bash
curl http://localhost:9999/health
```

```bash
curl http://localhost:9999/api/analytics/overview
```

```bash
curl http://localhost:9999/api/verify/1
```

```bash
curl -X POST http://localhost:9999/api/verify ^
  -H "Content-Type: application/json" ^
  -d "{\"tokenId\":\"1\",\"verifierAddress\":\"0xYourWalletAddress\"}"
```

## Contract capabilities

Key functions in `EduChain`:

- `mint()`
- `revoke()`
- `verify()`
- `getCredentialStatus()`
- `setRevealConsent()`
- `setSelectiveDisclosure()`
- `onboardInstitution()`
- `revokeInstitution()`
- `updateInstitutionMetadata()`
- `grantEmployerVerifier()`
- `revokeEmployerVerifier()`
- `pause()`
- `unpause()`

Key contract properties:

- Credentials are soulbound and cannot be transferred between wallets.
- Verification is rate limited per address per day.
- Verification emits on-chain events used by backend analytics/listener flows.

## Data model highlights

Important Prisma models in `backend/db/schema.prisma` include:

- `User`
- `Institution`
- `InstitutionSignup`
- `InstitutionAdmin`
- `StudentProfile`
- `Credential`
- `VerificationLog`
- `FraudAttempt`
- `AuditLog`
- `ClaimToken`
- `AccessToken`
- `BulkImportJob`
- `TokenReward`

## Known documentation notes

- Older repo documents may still mention PostgreSQL, but the current checked-in Prisma datasource is SQLite.
- The project contains several historical implementation notes and phase reports. Treat this README as the main starting point for setup and orientation.

## Related project docs

- `QUICK_START.md`
- `ENV_SETUP.md`
- `PROJECT_STRUCTURE.md`
- `DEPLOYMENT_GUIDE.md`
- `GOOGLE_OAUTH_SETUP.md`
- `INTEGRATION_GUIDE.md`
- `TOKEN_REWARDS_DOCUMENTATION.md`

