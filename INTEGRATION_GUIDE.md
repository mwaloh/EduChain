# EduChain Integration - Complete Flow & Testing Guide

## Overview
The complete integration connects Frontend → Backend IPFS API → Smart Contract → Event Listener → Database → Analytics Dashboard.

---

## 📋 Complete Data Flow

### Step 1️⃣: Admin Issues Credential (Frontend → Backend → Blockchain)
```
Admin Dashboard
  ├─ Fills credential form (student name, course, institution, expiry)
  ├─ Clicks "Mint Credential"
  └─ Frontend calls uploadToIPFS(metadata)
      ├─ URL: POST http://localhost:3001/api/ipfs/upload
      ├─ Body: { name: "John Doe", course: "CS", institution: "...", issuedOn: "...", ... }
      └─ Response: { cid: "Qm...", gateway: "https://...", provider: "web3.storage" }
      
  ├─ Gets CID back (e.g., QmX1Y2Z3...)
  └─ Calls contract.mint(studentAddress, cid, issuedOn, expiresOn, studentHash)
      └─ Smart Contract on Polygon Amoy
          ├─ Validates institution admin role
          ├─ Mints NFT with IPFS CID
          └─ Emits CredentialMinted event
```

### Step 2️⃣: Backend Listens & Logs (Event → Database)
```
Backend Event Listener (services/eventListener.ts)
  ├─ Detects CredentialMinted event from blockchain
  ├─ Extracts: tokenId, institution, ipfsCid, studentAddress
  └─ Creates Credential record in SQLite
      ├─ tokenId: BigInt(1)
      ├─ studentAddress: 0x...
      ├─ ipfsCid: "Qm..."
      ├─ institutionId: 1
      └─ createdAt: 2026-03-11...
```

### Step 3️⃣: Employer Verifies (On-Chain Still)
```
Employer Dashboard
  ├─ Enters token ID to verify
  ├─ Frontend calls contract.verify(tokenId)
  │  └─ On-chain verification (no backend intermediary - as configured)
  └─ Smart Contract checks:
      ├─ Is token minted?
      ├─ Is it revoked?
      └─ Has it expired?
      
      └─ Emits CredentialVerified event
         └─ Backend listens & logs to VerificationLog table
```

### Step 4️⃣: Analytics Display (Database → Frontend)
```
Dashboard Page
  ├─ Calls fetchAnalytics()
  │  └─ URL: GET http://localhost:3001/api/analytics/overview
  ├─ Backend queries database:
  │  ├─ COUNT(Credential) → totalCredentials
  │  ├─ COUNT(VerificationLog) → totalVerifications
  │  ├─ COUNT(DISTINCT Institution) → totalInstitutions
  │  └─ COUNT(FraudAttempt) → totalFraudAttempts
  └─ Returns: { totalCredentials: 5, totalVerifications: 3, ... }
  
  └─ Frontend displays StatCards with values
```

---

## 🧪 Testing Checklist

### Prerequisites
- [ ] Backend running: `npm run dev` in `/backend` folder
- [ ] Frontend running: `npm run dev` in `/frontend` folder
- [ ] Wallet connected with Admin role (or Owner role)
- [ ] Test account has funds on Polygon Amoy testnet

### Test 1: Backend IPFS Endpoint
```bash
# Terminal: Test IPFS upload endpoint
curl -X POST http://localhost:3001/api/ipfs/upload \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Student",
    "course": "Computer Science",
    "institution": "Test University"
  }'

# Expected Response:
# {
#   "cid": "Qm...",
#   "ipfsUrl": "ipfs://Qm...",
#   "gateway": "https://gateway.pinata.cloud/ipfs/Qm...",
#   "provider": "mock" (or "web3.storage" if token configured)
# }
```

### Test 2: Backend IPFS Retrieval
```bash
# Retrieve metadata (replace CID with actual from Test 1)
curl -X GET http://localhost:3001/api/ipfs/Qm... \
  -H "Content-Type: application/json"

# Expected Response:
# {
#   "cid": "Qm...",
#   "data": { "name": "Test Student", ... },
#   "available": true
# }
```

### Test 3: Backend Analytics Endpoint
```bash
# Check analytics (initially should be zeros if no credentials issued)
curl -X GET http://localhost:3001/api/analytics/overview

# Expected Response:
# {
#   "totalCredentials": 0,
#   "totalInstitutions": 0,
#   "totalVerifications": 0,
#   "totalFraudAttempts": 0
# }
```

### Test 4: End-to-End Credential Minting
**In Frontend Admin Page:**
1. Connect wallet (must have Admin role)
2. Fill form:
   - Student Name: "John Doe"
   - Student Address: `0x...` (valid Polygon Amoy address)
   - Course: "Computer Science"
   - Institution: (auto-filled)
   - Expiry Date: Pick a future date
3. Click "Mint Credential"
   - Should upload metadata to `/api/ipfs/upload` ✅
   - Should get CID back
   - Should submit contract.mint() transaction
   - Should wait for confirmation
   - Should show success toast

**Verify in Backend:**
```bash
# Check database record
sqlite3 backend/dev.db "SELECT tokenId, studentAddress, ipfsCid FROM Credential LIMIT 1;"

# Should return: 1|0x...|Qm...
```

### Test 5: Verify Credential
**In Frontend Employer Page:**
1. Enter token ID: `1` (from minted credential)
2. Click "Verify"
3. Should show credential status (Valid/Revoked/Expired)

**Verify in Backend:**
```bash
# Check verification log
sqlite3 backend/dev.db "SELECT * FROM VerificationLog LIMIT 1;"

# Should show: verifierAddress, tokenId=1, status='valid', etc.
```

### Test 6: Dashboard Analytics
**In Frontend Dashboard Page:**
1. Click "Refresh" button
2. Should call `/api/analytics/overview`
3. Cards should display:
   - Total Certificates Issued: 1+ (from your minting)
   - Verified Certificates: 1+ (from your verification)
   - Active Institutions: 1+
   - Pending Verifications: 0
4. No errors in browser console

**Verify in Network Tab:**
- Should see `GET http://localhost:3001/api/analytics/overview` request
- Response status: 200
- Response body: `{ totalCredentials: 1, totalVerifications: 1, ... }`

---

## 🔧 Configuration Reference

### Backend (.env)
```env
DATABASE_URL="file:./dev.db"
RPC_URL=https://polygon-amoy.g.alchemy.com/v2/[YOUR_KEY]
CONTRACT_ADDRESS=0xA4ab2F860e405ac9f716F83c0a10F7fACb960218
WEB3_STORAGE_TOKEN="your_token_here"  # Optional: Get from https://web3.storage
IPFS_GATEWAY_URL="https://gateway.pinata.cloud/ipfs/"
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/[YOUR_KEY]
NEXT_PUBLIC_CONTRACT_ADDRESS=0xA4ab2F860e405ac9f716F83c0a10F7fACb960218
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

---

## 📁 Files Modified

```
backend/
├── src/
│   ├── routes/
│   │   └── ipfs.ts ✅ (complete IPFS endpoint implementation)
│   └── index.ts (already imports & mounts ipfsRoute)
└── .env ✅ (added WEB3_STORAGE_TOKEN, IPFS_GATEWAY_URL)

frontend/
├── src/
│   ├── lib/
│   │   ├── api.ts ✅ (new API client with fetchAnalytics, uploadCredentialMetadataToIPFS)
│   │   └── ipfs.ts ✅ (updated to use backend API)
│   └── app/
│       ├── dashboard/page.tsx ✅ (updated to call fetchAnalytics)
│       └── admin/page.tsx (already uses uploadToIPFS)
└── .env.local ✅ (added NEXT_PUBLIC_BACKEND_URL)
```

---

## 🚀 Next Steps

1. **Configure IPFS Provider (Optional but Recommended)**
   - Get free token from https://web3.storage
   - Set `WEB3_STORAGE_TOKEN` in backend .env
   - Without this, mock CID will be generated (still works for testing)

2. **Add CORS Configuration**
   - If frontend/backend on different ports (not issue in local dev, but needed for prod)
   - Backend already has `cors()` middleware enabled

3. **Set Up Database Migrations**
   ```bash
   cd backend
   npm run db:migrate
   ```

4. **Monitor Event Listener**
   - Check backend console for event logs
   - Should see: "CredentialMinted detected" for each minted credential

5. **Verify Database Integrity**
   - Use `npm run db:studio` in backend to open Prisma Studio
   - Browse Credential, VerificationLog, Analytics tables

---

## 🐛 Troubleshooting

### Frontend: "Failed to upload to IPFS"
- **Cause**: Backend not running or wrong NEXT_PUBLIC_BACKEND_URL
- **Fix**: 
  1. Check backend is running: `npm run dev` in backend/
  2. Verify NEXT_PUBLIC_BACKEND_URL=http://localhost:3001 in .env.local
  3. Check browser console Network tab for /api/ipfs/upload request

### Frontend: Dashboard shows "Failed to load analytics"
- **Cause**: Backend API error or not running
- **Fix**:
  1. Check backend is running
  2. Try: `curl http://localhost:3001/api/analytics/overview`
  3. Verify database has Credential records: `sqlite3 backend/dev.db "SELECT COUNT(*) FROM Credential;"`

### Backend: Event listener not detecting events
- **Cause**: Contract address or RPC_URL mismatch
- **Fix**:
  1. Verify CONTRACT_ADDRESS in .env is correct
  2. Verify RPC_URL is valid Polygon Amoy endpoint
  3. Check console logs for "Listening to events" message on startup

### IPFS CID: Getting mock CID instead of real
- **Cause**: WEB3_STORAGE_TOKEN not configured
- **Fix**: 
  1. Get token from https://web3.storage
  2. Set in backend .env: `WEB3_STORAGE_TOKEN="your_token"`
  3. Restart backend

---

## 📊 Database Schema Reference

```sql
-- credentials table
CREATE TABLE Credential (
  id INTEGER PRIMARY KEY,
  tokenId BIGINT UNIQUE,
  studentAddress TEXT LOWERCASE,
  ipfsCid TEXT,  -- ← Stored from uploadToIPFS response
  institutionId INTEGER,
  createdAt DATETIME,
  FOREIGN KEY (institutionId) REFERENCES Institution(id)
);

-- verification logs
CREATE TABLE VerificationLog (
  id INTEGER PRIMARY KEY,
  verifierAddress TEXT LOWERCASE,
  tokenId BIGINT,
  status TEXT, -- 'valid', 'revoked', 'expired', 'invalid'
  revoked BOOLEAN,
  createdAt DATETIME
);

-- analytics aggregation
CREATE TABLE Analytics (
  id INTEGER PRIMARY KEY,
  date DATE UNIQUE,
  credentialsIssued INTEGER,
  verifications INTEGER,
  fraudAttempts INTEGER
);

-- fraud tracking
CREATE TABLE FraudAttempt (
  id INTEGER PRIMARY KEY,
  tokenId BIGINT,
  verifierAddress TEXT LOWERCASE,
  attemptedStatus TEXT,
  actualStatus TEXT,
  createdAt DATETIME
);
```

---

## Summary

✅ **Frontend → Backend IPFS API**: Credential metadata uploaded before minting
✅ **Backend → Smart Contract**: Event listener syncs blockchain events to database
✅ **Frontend → Backend Analytics**: Dashboard displays database aggregated stats
✅ **On-Chain Verification**: Stays on-blockchain (unchanged architecture)
✅ **End-to-End Flow**: Minting → Event Sync → Analytics Display complete
