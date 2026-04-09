# EduChain Token Rewards System

**Status**: ✅ Fully Implemented | April 4, 2026

This document describes the automated EDU token reward system that incentivizes participation in the EduChain platform.

---

## Overview

The Token Rewards System automatically distributes EDU tokens to platform participants for:
- **Students** receiving new credentials
- **Institutions** issuing credentials
- **Employers** verifying credentials
- **Early adopters** joining the platform

Rewards are issued automatically via smart contract when certain platform events occur, tracked in the database, and fully auditable on the blockchain.

---

## Architecture

### Components

1. **RewardTokenService** (`src/services/RewardTokenService.ts`)
   - Core service managing token distribution
   - Interfaces with EduRewardToken smart contract
   - Tracks rewards in database
   - Handles error cases gracefully

2. **Reward Configuration** (`src/config/rewardConfig.ts`)
   - Defines reward amounts for all event types
   - Categorizes rewards (student, institution, employer, ecosystem)
   - Calculates volume-based bonuses
   - Enable/disable specific reward types

3. **Reward Routes** (`src/routes/rewards.ts`)
   - Public APIs for reward information
   - Admin endpoints for manual distribution
   - Statistics and history endpoints

4. **Database Models**
   - `TokenReward`: Track individual reward distributions
   - `RewardLog`: Aggregate reward statistics

---

## Reward Categories

### Student Rewards

| Event | Amount | Description |
|-------|--------|-------------|
| CREDENTIAL_ISSUED_STUDENT | 10 EDU | Received a new academic credential |
| CREDENTIAL_SHARED | 2 EDU | Shared credential with employer |

### Institution Rewards

| Event | Amount | Description |
|-------|--------|-------------|
| CREDENTIAL_ISSUED_INSTITUTION | 5 EDU | Issued an academic credential |
| BULK_MINT_COMPLETED | 50 EDU | Completed bulk import (per 100 credentials) |
| INSTITUTION_JOINED | 500 EDU | Institution onboarded to platform |

### Employer/Verifier Rewards

| Event | Amount | Description |
|-------|--------|-------------|
| CREDENTIAL_VERIFIED_VALID | 0.5 EDU | Verified a valid credential |
| VERIFICATION_MILESTONE_10 | 5 EDU | Completed 10 verifications |
| VERIFICATION_MILESTONE_100 | 50 EDU | Completed 100 verifications |
| BULK_VERIFICATION_COMPLETED | 2 EDU | Completed bulk verification job |

### Ecosystem Rewards

| Event | Amount | Description |
|-------|--------|-------------|
| EARLY_ADOPTER_BONUS | 100 EDU | Early platform adopter |
| REFERRAL_BONUS | 25 EDU | Referred new institution (disabled) |

---

## API Endpoints

### Get Earned Rewards
```
GET /api/rewards/earned/:address
```

Returns all rewards earned by a specific wallet address.

**Example:**
```bash
curl http://localhost:3001/api/rewards/earned/0x1234567890abcdef...
```

**Response:**
```json
{
  "address": "0x1234567890abcdef...",
  "totalEarned": "125.5",
  "rewardsCount": 15,
  "rewards": [
    {
      "id": "reward-123",
      "amount": "10",
      "reason": "CREDENTIAL_ISSUED_STUDENT",
      "status": "confirmed",
      "createdAt": "2026-04-04T10:30:00Z",
      "credentialId": "cred-456"
    }
  ]
}
```

### Get Reward Statistics
```
GET /api/rewards/statistics
```

Returns platform-wide reward distribution statistics.

**Response:**
```json
{
  "totalDistributed": "15000.5",
  "byReason": [
    {
      "reason": "CREDENTIAL_ISSUED_STUDENT",
      "count": 1000,
      "total": "10000"
    }
  ],
  "topRecipients": [
    {
      "address": "0xabc123...",
      "totalEarned": "500",
      "rewardCount": 50
    }
  ]
}
```

### Get Reward Configuration
```
GET /api/rewards/config
```

Returns current enabled reward configuration.

**Response:**
```json
{
  "enabled": [
    {
      "reason": "CREDENTIAL_ISSUED_STUDENT",
      "amount": 10,
      "description": "Received a new academic credential",
      "category": "student"
    }
  ],
  "categories": ["student", "institution", "employer", "ecosystem"]
}
```

### Get Reward History
```
GET /api/rewards/history?page=1&limit=50
```

Returns paginated history of all reward distributions.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 500)

### Manual Reward Distribution (Admin Only)
```
POST /api/rewards/manual
```

Admin endpoint to manually issue rewards.

**Headers:**
```
x-admin-email: admin@educhain.io
x-admin-password: [ADMIN_REWARD_PASSWORD]
```

**Body:**
```json
{
  "recipientAddress": "0x1234567890abcdef...",
  "reason": "EARLY_ADOPTER_BONUS",
  "customAmount": 100  // Optional override
}
```

---

## Integration Points

### 1. Credential Issuance

**File**: `backend/src/routes/credentials.ts`

When a credential is recorded:
1. Student wallet receives CREDENTIAL_ISSUED_STUDENT tokens
2. Institution wallet receives CREDENTIAL_ISSUED_INSTITUTION tokens
3. Both rewards logged to database with credential reference

### 2. Credential Verification

**File**: `backend/src/routes/verify.ts`

When a valid credential is verified:
1. Verifier wallet receives CREDENTIAL_VERIFIED_VALID tokens
2. Reward logged with verification reference
3. Invalid/revoked credentials do NOT trigger rewards

---

## Database Schema

### TokenReward Model
```prisma
model TokenReward {
  id                    String    @id @default(cuid())
  recipientAddress      String    // Wallet receiving tokens
  amount                Decimal   // EDU token amount
  reason                String    // Event type (e.g., CREDENTIAL_ISSUED_STUDENT)
  transactionHash       String?   // Blockchain TX hash
  credentialId          String?   // Reference to credential
  verificationLogId     String?   // Reference to verification
  metadata              String?   // JSON metadata
  status                String    // "pending", "confirmed", "failed"
  createdAt             DateTime
  confirmedAt           DateTime?
}
```

### RewardLog Model
```prisma
model RewardLog {
  id                        String   @id @default(cuid())
  totalRewardsDistributed   Decimal  // Running total
  credentialsIssuedCount    Int      // Cumulative count
  verificationsCount        Int      // Cumulative count
  periodStart              DateTime
  periodEnd                DateTime?
  createdAt                DateTime
}
```

---

## Environment Variables

Ensure these variables are set:

```env
# Smart Contract
CONTRACT_ADDRESS=0x...          # EduChain contract address
RPC_URL=https://rpc.amoy...    # Polygon Amoy RPC endpoint
NETWORK=amoy                   # Network name (amoy, localhost, etc)
PRIVATE_KEY=0x...              # Institution wallet private key

# Rewards (Optional)
ADMIN_REWARD_PASSWORD=secure_password  # For manual reward distribution
```

---

## Reward Lifecycle

### Flow Diagram
```
Event Triggered (Credential Issued/Verified)
    ↓
Check Wallet Address Valid
    ↓
Database: Create TokenReward (status: pending)
    ↓
Call Smart Contract: mintReward()
    ↓
Blockchain: Mint tokens to wallet
    ↓
Get Transaction Receipt
    ↓
Database: Update TokenReward (status: confirmed, txHash)
    ↓
Done ✅
```

### Error Handling
- **Invalid Wallet Address**: Skipped silently, logged
- **Smart Contract Call Fails**: Recorded as "failed" in DB
- **Network Error**: Recorded as "pending", can be retried
- **Reward System Down**: Credential issuance/verification continues (non-blocking)

---

## Configuration & Customization

### Change Reward Amounts

Edit `backend/src/config/rewardConfig.ts`:

```typescript
CREDENTIAL_ISSUED_STUDENT: {
  amount: 15,  // Changed from 10
  description: "Received a new academic credential",
  category: "student",
  enabled: true,
}
```

### Enable/Disable Reward Types

```typescript
REFERRAL_BONUS: {
  amount: 25,
  description: "Referred new institution to platform",
  category: "ecosystem",
  enabled: true,  // Change to enable
}
```

### Volume-Based Bonuses

The system automatically scales rewards:
- 10-49 items: 1.5x multiplier
- 50-99 items: 2x multiplier
- 100-499 items: 3x multiplier
- 500+ items: 5x multiplier

Calculate in `backend/src/config/rewardConfig.ts`:
```typescript
export function calculateBulkReward(itemCount: number): number {
  // Existing logic
}
```

---

## Monitoring & Analytics

### View Top Earners
```sql
SELECT 
  recipientAddress,
  SUM(amount) as total_earned,
  COUNT(*) as reward_count
FROM TokenReward
WHERE status = 'confirmed'
GROUP BY recipientAddress
ORDER BY total_earned DESC
LIMIT 10;
```

### View Rewards by Category
```sql
SELECT 
  reason,
  COUNT(*) as count,
  SUM(amount) as total,
  AVG(amount) as avg_amount
FROM TokenReward
WHERE status = 'confirmed'
GROUP BY reason;
```

### View Failed Rewards
```sql
SELECT *
FROM TokenReward
WHERE status = 'failed'
ORDER BY createdAt DESC;
```

---

## Testing

### Manual Test: Issue Reward
```bash
curl -X POST http://localhost:3001/api/rewards/manual \
  -H "Content-Type: application/json" \
  -H "x-admin-email: admin@educhain.io" \
  -H "x-admin-password: your_password" \
  -d '{
    "recipientAddress": "0x1234567890abcdef...",
    "reason": "EARLY_ADOPTER_BONUS",
    "customAmount": 50
  }'
```

### Check Rewards Earned
```bash
curl http://localhost:3001/api/rewards/earned/0x1234567890abcdef...
```

---

## Troubleshooting

### "RewardTokenService not initialized"
**Solution**: Ensure EduRewardToken contract is deployed and RPC_URL is set.

### Rewards showing as "pending"
**Solution**: Check if wallet has sufficient balance to mint tokens. Check blockchain logs.

### High gas fees for rewards
**Solution**: Consider batch minting rewards instead of individual transactions.

---

## RoadMap

- ✅ Basic reward distribution
- ✅ Database tracking
- ✅ Statistics API
- 🔄 Automated batch minting (gas optimization)
- 🔄 Staking mechanisms
- 🔄 DAO governance
- 🔄 Yield farming pools

---

## Support

For issues or questions:
1. Check blockchain transaction hashes in TokenReward.transactionHash
2. Review logs in console output
3. Query database TokenReward table for status
4. Contact system administrator with tx hash for investigation

---

**Last Updated**: April 4, 2026  
**System Status**: Production Ready ✅
