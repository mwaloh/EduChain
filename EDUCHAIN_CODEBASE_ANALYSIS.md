# EduChain Codebase Analysis Report

**Date**: April 4, 2026  
**Status**: Ready for Token Reward Integration

---

## 1. Token System Current State

### 1.1 EduRewardToken Deployment

**File**: [contracts/EduRewardToken.sol](contracts/EduRewardToken.sol)

**Deployed On Amoy Testnet**:
```json
{
  "network": "amoy",
  "contractAddress": "0x22a8B017A0060432C0FFf6414431a303BEDBDbb9",
  "deployer": "0x7eA4D92561e367880c02a2F996E89607492d91d7",
  "timestamp": "2026-03-17T18:46:12.160Z"
}
```

### 1.2 Token Contract Interface

```solidity
contract EduRewardToken is ERC20, Ownable {
  // Mints 1,000,000 EDU tokens initially to owner
  constructor(address initialOwner)
  
  // Only owner can mint rewards
  function mintReward(address to, uint256 amount) external onlyOwner
    - to: recipient address
    - amount: tokens in wei (10^18 = 1 EDU token)
  
  // Decimals: 18
  function decimals() public pure override returns (uint8)
}
```

### 1.3 Current Balance & Owner Status

**Owner**: `0x7eA4D92561e367880c02a2F996E89607492d91d7`  
**Initial Supply**: 1,000,000 EDU tokens  
**Decimals**: 18 (standard ERC-20)  
**Reward Distribution Code**: ❌ **NONE FOUND** - No backend calls to `mintReward()` exist

---

## 2. Credential Minting Flow

### 2.1 API Endpoint

**File**: [backend/src/routes/credentials.ts](backend/src/routes/credentials.ts)  
**Route**: `POST /api/credentials/record`  
**Authentication**: Institution admin (x-user-email header)

### 2.2 Minting Code Structure

```typescript
// POST /api/credentials/record
router.post('/record', async (req: Request, res: Response) => {
  try {
    const {
      studentEmail,
      tokenId,        // BigInt from blockchain
      institutionId,
      ipfsCid,        // IPFS metadata hash
      degree,
      program,
      issuedOn,       // Unix timestamp
      expiresOn,      // Unix timestamp (0 for no expiry)
    } = req.body;

    // ✅ Uses async/await with try-catch
    // ✅ Validates institution admin permission
    // ✅ Finds student by email
    
    const credential = await prisma.credential.create({
      data: {
        tokenId: BigInt(tokenId),
        studentAddress: student.walletAddress || '',
        ipfsCid,
        institutionId,
        issuedOn: new Date(issuedOn * 1000),
        expiresOn: expiresOn ? new Date(expiresOn * 1000) : null,
        revoked: false,
      },
    });

    // ✅ Logs to AuditLog with action: CREDENTIAL_MINTED
    await logAudit({
      action: auditActions.CREDENTIAL_MINTED,
      actorEmail: adminEmail,
      userRole: 'institution_admin',
      entityType: 'Credential',
      entityId: credential.id,
      afterJson: JSON.stringify(credential),
      status: 'success',
      details: { tokenId, studentEmail, program, degree },
    });

    res.status(201).json({
      success: true,
      credential: {
        id: credential.id,
        tokenId: credential.tokenId.toString(),
        studentAddress: credential.studentAddress,
        issuedOn: credential.issuedOn,
        expiresOn: credential.expiresOn,
        revoked: credential.revoked,
        ipfsCid: credential.ipfsCid,
      },
    });
  } catch (error: any) {
    console.error('Error recording credential:', error);
    res.status(500).json({ error: 'Failed to record credential' });
  }
});
```

### 2.3 IPFS Metadata Storage

**File**: [backend/src/services/ipfs.ts](backend/src/services/ipfs.ts)

```typescript
class IPFSService {
  // Upload metadata to IPFS (web3.storage or mock)
  static async uploadJSON(metadata: object): Promise<string> {
    try {
      if (WEB3_STORAGE_TOKEN) {
        const cid = await uploadToWeb3Storage(metadata, WEB3_STORAGE_TOKEN);
        return cid;  // Returns Content Identifier
      }
      
      // Fallback: Mock IPFS for development
      const mockCid = generateMockCID(metadata);
      return mockCid;
    } catch (error: any) {
      throw new Error(`IPFS upload failed: ${error.message}`);
    }
  }

  // Retrieve metadata from IPFS
  static async getJSON(cid: string): Promise<object>
    - Tries multiple IPFS gateways
    - Returns parsed JSON metadata
}
```

### 2.4 Blockchain Minting (Contract Service)

**File**: [backend/src/services/contract.ts](backend/src/services/contract.ts)

```typescript
class ContractService {
  // Called to mint credential on-chain
  async issueCredential(
    studentAddress: string,
    ipfsCid: string,
    expiresOn: number = 0
  ): Promise<string> {
    // Validates student address
    if (!ethers.isAddress(studentAddress)) {
      throw new Error("Invalid student address");
    }

    // Generates student hash
    const studentHash = ethers.id(`${studentAddress}-${Date.now()}`);
    const issuedOn = Math.floor(Date.now() / 1000);

    // ✅ Uses ethers.js v6 with async/await
    const tx = await this.contract.mint(
      studentAddress,
      ipfsCid,
      issuedOn,
      expiresOn
    );

    // ✅ Waits for transaction receipt
    const receipt = await tx.wait();
    console.log(`Credential minted. Transaction: ${receipt.hash}`);

    return receipt.hash;
  }
}
```

### 2.5 Data Available After Minting

```typescript
{
  id: "cuid-string",
  tokenId: BigInt(12345),
  studentAddress: "0x...",
  studentHash: "0x...",
  ipfsCid: "QmXxxx...",
  institutionId: "cuid-string",
  issuedOn: Date,
  expiresOn: Date | null,
  revoked: false,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 3. Credential Verification Flow

### 3.1 Single Verification Endpoint

**File**: [backend/src/routes/verify.ts](backend/src/routes/verify.ts)  
**Route**: `POST /api/verify`

```typescript
router.post('/', async (req: Request, res: Response) => {
  try {
    const { tokenId, verifierAddress } = req.body;

    const tokenIdBigInt = BigInt(tokenId);

    // ✅ Calls contract to get credential status
    const status = await contract.verify(tokenIdBigInt);
    const credentialStatus = await contract.getCredentialStatus(tokenIdBigInt);

    // Maps status enum to string
    const statusMap: Record<number, string> = {
      0: 'valid',
      1: 'revoked',
      2: 'expired',
      3: 'invalid',
    };
    const statusString = statusMap[Number(status)] || 'unknown';

    // ✅ Logs to VerificationLog table
    if (credential) {
      await prisma.verificationLog.create({
        data: {
          verifierAddress: verifierAddress.toLowerCase(),
          tokenId: tokenIdBigInt,
          credentialId: credential.id,
          institutionId: credential.institutionId,
          status: statusString,
          revoked: statusString === 'revoked',
        },
      });
    }

    // Fraud detection
    if (statusString !== 'valid' && req.body.expectedStatus === 'valid') {
      await prisma.fraudAttempt.create({
        data: {
          tokenId: tokenIdBigInt,
          verifierAddress: verifierAddress.toLowerCase(),
          attemptedStatus: 'valid',
          actualStatus: statusString,
        },
      });
    }

    res.json({
      tokenId: tokenId.toString(),
      status: statusString,
      revoked: credentialStatus.revoked,
      expiresOn: credentialStatus.expiresOn
        ? new Date(Number(credentialStatus.expiresOn) * 1000).toISOString()
        : null,
      institution: institution?.name || 'Unknown',
      institutionAddress: credentialStatus.institution,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Verification error:', error);
    res.status(500).json({ error: error.message || 'Verification failed' });
  }
});
```

### 3.2 Bulk Verification Endpoint

**File**: [backend/src/routes/bulk-verify.ts](backend/src/routes/bulk-verify.ts)  
**Route**: `POST /api/bulk-verify/start`

```typescript
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { tokenIds, verifierAddress } = req.body;

    // Creates job in memory (not persisted)
    const jobId = crypto.randomUUID();
    activeJobs.set(jobId, {
      jobId,
      status: 'pending',
      tokenIds,
      verifierAddress,
      results: [],
    });

    // Process asynchronously
    processJob(jobId, contract, prisma);

    res.json({ jobId, status: 'started' });
  } catch (error: any) {
    console.error('Bulk verification start error:', error);
    res.status(500).json({ error: error.message || 'Failed to start bulk verification' });
  }
});
```

### 3.3 Verification Logging to Database

**VerificationLog Table Structure** (from Prisma schema):

```prisma
model VerificationLog {
  id              String      @id @default(cuid())
  verifierAddress String      // Employer/verifier blockchain address
  tokenId         BigInt      // NFT token ID
  credentialId    String      // Foreign key to Credential
  institutionId   String      // Foreign key to Institution
  
  timestamp       DateTime    @default(now())
  status          String      // "valid", "revoked", "expired", "invalid"
  revoked         Boolean     @default(false)
  blockchainTxHash String?    // Optional: Transaction hash if logged on-chain
  
  @@index([verifierAddress])
  @@index([tokenId])
  @@index([timestamp])
  @@index([status])
}
```

### 3.4 Verification Process Flow

```
1. POST /api/verify with { tokenId, verifierAddress }
   ↓
2. Call contract.getCredentialStatus(tokenId)
   ↓
3. Determine status: valid/revoked/expired/invalid
   ↓
4. Create VerificationLog entry
   ↓
5. Check for fraud attempts (if expectedStatus != actualStatus)
   ↓
6. Return verification result with timestamp
```

---

## 4. Database Schema Analysis

### 4.1 Credential Table

```prisma
model Credential {
  id            String    @id @default(cuid())
  tokenId       BigInt    @unique // NFT token ID
  studentAddress String   // Blockchain address
  studentHash   String    // SHA256 hash for privacy
  ipfsCid       String
  institutionId String
  institution   Institution @relation(fields: [institutionId], references: [id])
  
  issuedOn      DateTime
  expiresOn     DateTime?
  revoked       Boolean   @default(false)
  revocationReason String?
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  verificationLogs VerificationLog[]
  claimTokens      ClaimToken[]
  accessTokens     AccessToken[]
  
  @@index([tokenId])
  @@index([studentAddress])
  @@index([institutionId])
}
```

### 4.2 Token Reward Tables STATUS

**TokenReward Table**: ❌ **DOES NOT EXIST**  
**RewardLog Table**: ❌ **DOES NOT EXIST**

### Required for Token Distribution

```prisma
model TokenReward {
  id              String    @id @default(cuid())
  recipientAddress String  // Wallet address receiving tokens
  amount          BigInt    // Amount in wei (10^18 = 1 token)
  reason          String    // "CREDENTIAL_MINTED", "VERIFICATION_COMPLETED", etc.
  
  credentialId    String?   // Optional: Link to credential
  credential      Credential? @relation(fields: [credentialId], references: [id])
  
  transactionHash String?   // Blockchain transaction hash
  status          String    @default("pending") // "pending", "success", "failed"
  
  createdAt       DateTime  @default(now())
  
  @@index([recipientAddress])
  @@index([reason])
  @@index([status])
}

model RewardDistribution {
  id                String    @id @default(cuid())
  institutionId     String
  institution       Institution @relation(fields: [institutionId], references: [id])
  
  totalMinted       BigInt    @default(0)
  totalDistributed  BigInt    @default(0)
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

### 4.3 Existing Related Tables for Logging

**AuditLog Table**: ✅ Used for credential minting audit
**VerificationLog Table**: ✅ Used for credential verification audit
**Analytics Table**: ✅ Tracks daily statistics (credentials, verifications, etc.)

---

## 5. Smart Contract Interaction

### 5.1 Contract Service Utility

**File**: [backend/src/services/contract.ts](backend/src/services/contract.ts)

```typescript
class ContractService {
  private contract: ethers.Contract | null = null;
  private wallet: ethers.Wallet | null = null;

  constructor() {
    this.initializeContract();
  }

  private initializeContract() {
    try {
      const network = process.env.NETWORK || "amoy";
      const rpcUrl = process.env.RPC_URL;
      const privateKey = process.env.PRIVATE_KEY;

      // Loads deployment from deployments/{network}.json
      const deployment = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, `../../deployments/${network}.json`),
          "utf-8"
        )
      );
      const contractAddress = deployment.contractAddress;

      // Creates ethers.js provider and wallet
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, provider);

      // Loads EduChain ABI from artifacts
      const contractArtifact = JSON.parse(
        fs.readFileSync(
          path.join(
            __dirname,
            "../../artifacts/contracts/EduChain.sol/EduChain.json"
          ),
          "utf-8"
        )
      );

      // Creates contract instance with wallet (signer)
      this.contract = new ethers.Contract(
        contractAddress,
        contractArtifact.abi,
        this.wallet
      );
    } catch (error) {
      console.error("Failed to initialize contract service:", error);
    }
  }

  // Public method to get contract instance
  getContract(): ethers.Contract | null {
    return this.contract;
  }
}

export default new ContractService();
```

### 5.2 ethers.js Version

**Package**: `ethers@^6.15.0` in [backend/package.json](backend/package.json)

**Key Features Used**:
- `ethers.JsonRpcProvider` - Connect to RPC endpoint
- `ethers.Wallet` - Sign transactions with private key
- `ethers.Contract` - Interact with smart contracts
- `ethers.isAddress()` - Validate Ethereum addresses
- `ethers.id()` - Hash strings (for student identity)

### 5.3 Contract Interaction Pattern

```typescript
// 1. Get contract instance
const contract = ContractService.getContract();

// 2. Call read functions (view/pure)
const status = await contract.getCredentialStatus(tokenId);

// 3. Call write functions (state-changing)
const tx = await contract.mint(
  studentAddress,
  ipfsCid,
  issuedOn,
  expiresOn
);

// 4. Wait for transaction confirmation
const receipt = await tx.wait();
console.log(receipt.hash); // Transaction hash
```

### 5.4 EduChain Smart Contract Functions

**File**: [contracts/EduChain.sol](contracts/EduChain.sol)

```solidity
// Mint a new credential
function mint(
  address to,
  string calldata ipfsCid,
  uint64 issuedOn,
  uint64 expiresOn,
  bytes32 studentHash
) external onlyRole(INSTITUTION_ADMIN_ROLE) returns (uint256)

// Get credential status
function getCredentialStatus(uint256 tokenId) 
  external view returns (CredentialStatus memory)

// Verify a credential (emits event)
function verify(uint256 tokenId) 
  external returns (VerificationStatus)

// Revoke a credential
function revoke(uint256 tokenId, string calldata reason) 
  external onlyRole(INSTITUTION_ADMIN_ROLE)

// Onboard an institution
function onboardInstitution(
  address institutionAddress,
  address adminAddress,
  string calldata name,
  string calldata metadataURI
) external onlyOwner
```

---

## 6. Integration Points for Token Rewards

### 6.1 Where Token Calls Should Be Inserted

#### 🎯 Point 1: After Credential Minting

**File**: [backend/src/routes/credentials.ts](backend/src/routes/credentials.ts) - `POST /api/credentials/record`

```typescript
// After credential creation (around line 46)
const credential = await prisma.credential.create({...});

// ❌ INSERT TOKEN REWARD HERE ❌
// Award tokens to student for receiving credential
const rewardAmount = ethers.parseEther("10"); // 10 EDU tokens
await rewardTokenService.mintReward(
  credential.studentAddress,
  rewardAmount,
  "CREDENTIAL_MINTED"
);

// Log the distribution
await prisma.tokenReward.create({
  data: {
    recipientAddress: credential.studentAddress,
    amount: rewardAmount.toString(),
    reason: "CREDENTIAL_MINTED",
    credentialId: credential.id,
    status: "success",
  },
});
```

#### 🎯 Point 2: After Verification (Single)

**File**: [backend/src/routes/verify.ts](backend/src/routes/verify.ts) - `POST /api/verify`

```typescript
// After verification log creation (around line 65)
if (credential) {
  await prisma.verificationLog.create({...});

  // ❌ INSERT TOKEN REWARD HERE ❌
  // Award tokens to institution for verification
  if (statusString === 'valid') {
    const rewardAmount = ethers.parseEther("1"); // 1 EDU token
    await rewardTokenService.mintReward(
      credential.institution.address,
      rewardAmount,
      "CREDENTIAL_VERIFIED"
    );

    // Log the distribution
    await prisma.tokenReward.create({
      data: {
        recipientAddress: credential.institution.address,
        amount: rewardAmount.toString(),
        reason: "CREDENTIAL_VERIFIED",
        credentialId: credential.id,
        transactionHash: receipt.hash, // If minted on-chain
        status: "success",
      },
    });
  }
}
```

#### 🎯 Point 3: After Bulk Verification

**File**: [backend/src/routes/bulk-verify.ts](backend/src/routes/bulk-verify.ts) - `processJob()`

```typescript
// After creating each VerificationLog (around line 236)
if (credential) {
  await prisma.verificationLog.create({...});

  // ❌ INSERT TOKEN REWARD HERE ❌
  // Award tokens for valid verifications only
  if (status === 'valid') {
    const rewardAmount = ethers.parseEther("1");
    await rewardTokenService.mintReward(
      job.verifierAddress,
      rewardAmount,
      "BULK_VERIFICATION_VERIFIED"
    );
  }
}
```

### 6.2 Required Service Class

Create new file: `backend/src/services/rewardTokenService.ts`

```typescript
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

class RewardTokenService {
  private contract: ethers.Contract | null = null;
  private wallet: ethers.Wallet | null = null;

  constructor() {
    this.initializeToken();
  }

  private initializeToken() {
    try {
      const network = process.env.NETWORK || 'amoy';
      const rpcUrl = process.env.RPC_URL;
      const privateKey = process.env.PRIVATE_KEY;
      const tokenAddress = process.env.EDU_REWARD_TOKEN_ADDRESS;

      if (!tokenAddress) {
        console.warn('EDU_REWARD_TOKEN_ADDRESS not configured');
        return;
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, provider);

      // Minimal ABI for EduRewardToken
      const ABI = [
        'function mintReward(address to, uint256 amount) external onlyOwner',
        'function balanceOf(address account) external view returns (uint256)',
        'function totalSupply() external view returns (uint256)',
      ];

      this.contract = new ethers.Contract(
        tokenAddress,
        ABI,
        this.wallet
      );
    } catch (error) {
      console.error('Failed to initialize reward token service:', error);
    }
  }

  async mintReward(
    recipientAddress: string,
    amount: bigint,
    reason: string
  ): Promise<string> {
    if (!this.contract || !this.wallet) {
      throw new Error('Reward token service not initialized');
    }

    if (!ethers.isAddress(recipientAddress)) {
      throw new Error('Invalid recipient address');
    }

    console.log(`Minting ${ethers.formatEther(amount)} EDU to ${recipientAddress} (${reason})`);

    const tx = await this.contract.mintReward(recipientAddress, amount);
    const receipt = await tx.wait();

    console.log(`Reward minted. Transaction: ${receipt.hash}`);
    return receipt.hash;
  }

  async getBalance(address: string): Promise<bigint> {
    if (!this.contract) {
      throw new Error('Reward token service not initialized');
    }

    return await this.contract.balanceOf(address);
  }
}

export default new RewardTokenService();
```

---

## 7. Summary Table: Integration Readiness

| Component | Status | File | Notes |
|-----------|--------|------|-------|
| **EduRewardToken Contract** | ✅ Deployed | contracts/EduRewardToken.sol | Ready to call - needs backend integration |
| **Credential Minting** | ✅ Ready | backend/src/routes/credentials.ts | Async/await + try-catch ✓ |
| **Credential Verification** | ✅ Ready | backend/src/routes/verify.ts | Logs to VerificationLog ✓ |
| **Bulk Verification** | ✅ Ready | backend/src/routes/bulk-verify.ts | Async processing ✓ |
| **Contract Service** | ✅ Ready | backend/src/services/contract.ts | Uses ethers.js v6 ✓ |
| **IPFS Integration** | ✅ Ready | backend/src/services/ipfs.ts | web3.storage + fallback ✓ |
| **Database Schema** | ⚠️ Partial | backend/db/schema.prisma | Missing TokenReward/RewardLog tables |
| **Reward Token Service** | ❌ Missing | - | Needs to be created |
| **Reward Distribution Code** | ❌ Missing | - | Needs to be integrated at 3 points |
| **ethers.js Integration** | ✅ Ready | package.json | v6.15.0 installed |

---

## 8. Environment Variables Needed

```bash
# For Contract Service (existing)
CONTRACT_ADDRESS=0x22a8B017A0060432C0FFf6414431a303BEDBDbb9
RPC_URL=https://rpc-amoy.polygon.technology
PRIVATE_KEY=<institution_admin_private_key>
NETWORK=amoy

# For Reward Token Service (NEW)
EDU_REWARD_TOKEN_ADDRESS=0x22a8B017A0060432C0FFf6414431a303BEDBDbb9
EDU_REWARD_TOKEN_OWNER_KEY=<owner_private_key>

# For IPFS (existing)
WEB3_STORAGE_TOKEN=<your_web3_storage_token>
IPFS_GATEWAY_URL=https://gateway.pinata.cloud/ipfs/

# For Database (existing)
DATABASE_URL=file:./prisma/dev.db
```

---

## Next Steps for Implementation

1. ✅ Create `backend/db/schema.prisma` additions for TokenReward and RewardLog tables
2. ✅ Create `backend/src/services/rewardTokenService.ts` class
3. ✅ Update `.env` with EDU_REWARD_TOKEN_ADDRESS and token owner private key
4. ✅ Integrate reward minting calls in credentials.ts
5. ✅ Integrate reward minting calls in verify.ts
6. ✅ Integrate reward minting calls in bulk-verify.ts
7. ✅ Update AuditLog to include reward distribution events
8. ✅ Test reward distribution with test wallets

---

**Last Updated**: April 4, 2026

