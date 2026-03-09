# Quick Fix: Invalid Private Key Error

## Problem
You're seeing: `Expected a hex-encoded private key or a Configuration Variable`

This means your `.env` file still has placeholder values.

## Solution

### Step 1: Edit `.env` file

Open `.env` in your editor and replace:

**Before (placeholder):**
```env
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
```

**After (real key):**
```env
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

### Step 2: Get Your Private Key

**Option A: From MetaMask (Recommended for Testing)**
1. Open MetaMask
2. Click account icon (top right)
3. Go to **Settings**
4. Click **Advanced**
5. Scroll to **Show Private Key**
6. Enter password
7. Copy the key (starts with `0x`, 66 characters total)

**Option B: Generate a New Test Wallet**
```bash
# Using Node.js
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Format Requirements

Your private key must be:
- ✅ Starts with `0x`
- ✅ Exactly 66 characters total (`0x` + 64 hex characters)
- ✅ No quotes around it
- ✅ No spaces before or after

**Correct:**
```
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

**Wrong:**
```
PRIVATE_KEY="0x123..."  # No quotes
PRIVATE_KEY= 0x123...   # No spaces
PRIVATE_KEY=0xYOUR...   # No placeholders
```

### Step 4: Get Testnet MATIC

Before deploying, fund your wallet with testnet MATIC:
- https://faucet.polygon.technology/
- Select "Polygon Amoy Testnet"
- Enter your wallet address
- Request tokens

### Step 5: Try Again

```bash
npm run deploy:educhain
```

## Security Reminder

⚠️ **NEVER commit your `.env` file to git!**
- The `.gitignore` already excludes it
- Only use a test wallet for development
- Never use your main wallet's private key

## Still Having Issues?

1. Check `.env` has no extra quotes or spaces
2. Verify the key is exactly 66 characters
3. Make sure your wallet has testnet MATIC
4. Check your RPC_URL is correct from Alchemy

