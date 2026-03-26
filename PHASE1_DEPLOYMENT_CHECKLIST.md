# Phase 1 Deployment Checklist

Use this checklist to ensure Phase 1 is properly deployed and tested.

## Pre-Deployment Setup

### Google Cloud Console Setup
- [ ] Go to https://console.cloud.google.com/
- [ ] Create new project "EduChain"
- [ ] Enable Google+ API
- [ ] Create OAuth 2.0 Web Application credentials
- [ ] Add redirect URI: `http://localhost:3000/api/auth/callback/google`
- [ ] Note: Client ID and Client Secret (needed below)

### Environment Variables

#### Frontend (.env.local)
```bash
cd frontend
```
- [ ] Create `.env.local` file
- [ ] Add `GOOGLE_CLIENT_ID=<from Google Cloud>`
- [ ] Add `GOOGLE_CLIENT_SECRET=<from Google Cloud>`
- [ ] Add `NEXTAUTH_URL=http://localhost:3000`
- [ ] Run `npx auth secret` to generate NEXTAUTH_SECRET

#### Backend (.env)
```bash
cd backend
```
- [ ] Ensure `DATABASE_URL="file:./dev.db"` exists
- [ ] Ensure `CONTRACT_ADDRESS` is set
- [ ] Ensure `RPC_URL` is set
- [ ] Ensure `PRIVATE_KEY` is set

### Installation

- [ ] Backend: `cd backend && npm install`
- [ ] Frontend: `cd frontend && npm install`

## Database Setup

```bash
cd backend
```
- [ ] Run `npm run db:migrate` to create User/Account/Session tables
- [ ] Verify tables created: `npm run db:studio` (should show new models)

## Running the Application

### Start Backend
```bash
cd backend
npm run dev
```
- [ ] Should see: `🚀 EduChain Analytics Backend running on port 3001`
- [ ] Should see: `📊 Health check: http://localhost:3001/health`
- [ ] Test health: Open http://localhost:3001/health (should return `{"status":"ok",...}`)

### Start Frontend
```bash
cd frontend
npm run dev
```
- [ ] Should see: `▲ Next.js 14.2.15 ... ready`
- [ ] Should see URLs like `http://localhost:3000`

## Testing the OAuth Flow

### Test 1: Google Sign-In
1. [ ] Open http://localhost:3000
2. [ ] Click "Login" button (or navigate to `/login`)
3. [ ] Click "Sign In as Student"
4. [ ] You'll be redirected to Google Sign-In
5. [ ] Sign in with a Google account
6. [ ] Should be redirected to `/role-selection`
7. [ ] Click "Choose" on the Student card
8. [ ] Should see student dashboard
9. [ ] Check database: verify User record was created with:
   - Email address
   - `walletAddress` (should be a 0x... address)
   - `role = 'student'`

### Test 2: Different Roles
1. [ ] Go back to `/login`
2. [ ] Try "Sign In as Employer"  
3. [ ] Complete OAuth flow
4. [ ] Verify dashboard shows employer view
5. [ ] Repeat for "Sign In as Institution"

### Test 3: Multiple Login with Same Email
1. [ ] Sign in as Student with email@google.com
2. [ ] Logout
3. [ ] Sign in as Employer with email@google.com
4. [ ] Role should change to "employer" in database
5. [ ] Verify `Account` table has multiple rows for same email

### Test 4: MetaMask Fallback
1. [ ] Go to `/` (home page using role selector)
2. [ ] Should see MetaMask connect option
3. [ ] Connect MetaMask wallet
4. [ ] Should still work as before

### Test 5: User Profile Hook
1. [ ] Logged in, open browser dev tools
2. [ ] Check that `useUser()` hook returns user data:
   ```
   {
     id: "...",
     email: "user@gmail.com",
     walletAddress: "0x...",
     role: "student",
     ...
   }
   ```

### Test 6: Link Wallet (Later Feature)
1. [ ] Logged in as email
2. [ ] API call to `POST /api/users/link-wallet` with MetaMask address
3. [ ] Should update user record with linked wallet

## Database Verification

Open Prisma Studio to verify data:
```bash
cd backend
npm run db:studio
```

In Prisma Studio:
- [ ] Check `User` table has new records with:
  - `email` (Google email)
  - `googleId` (unique ID from Google)
  - `walletAddress` (auto-generated 0x address)
  - `role` (student/employer/institution_admin)
  - `createdAt` timestamp

- [ ] Check `Account` table has records with:
  - `provider = "google"`
  - `providerAccountId` (Google ID)
  - `type = "oauth"`

- [ ] Check `Session` table has active sessions

## Troubleshooting

### "Google provides an invalid client_id"
- [ ] Wrong GOOGLE_CLIENT_ID in .env.local
- [ ] Verify in Google Cloud Console it matches
- [ ] Make sure redirect URI is registered correctly

### "Cannot find module 'next-auth'"
- [ ] Run `npm install` in frontend directory
- [ ] Delete `node_modules/` and `.next/` and try again

### Wallet address not being generated
- [ ] Check `walletService.ts` is in backend/src/services/
- [ ] Check `users.ts` route imports walletService correctly
- [ ] Look at backend console logs for errors

### User not appearing in database
- [ ] Check backend is running (`npm run dev`)
- [ ] Check database file exists at `backend/db/dev.db`
- [ ] Check Prisma migration ran successfully

### NextAuth secret error
- [ ] Run `npx auth secret` in frontend directory
- [ ] Should add to `.env.local` automatically

## Post-Deployment

- [ ] Document any custom configuration used
- [ ] Save Google OAuth credentials securely
- [ ] Test on another browser/device if possible
- [ ] Test with different Google accounts

## Performance Check

- [ ] Login time < 5 seconds
- [ ] Dashboard loads within 2 seconds
- [ ] No console errors in browser
- [ ] Backend logs show clean startup with no errors

## Production Deployment (Later)

When deploying to production:
- [ ] Change `NEXTAUTH_URL` to production domain
- [ ] Create OAuth credentials for production URL in Google Cloud
- [ ] Set strong `NEXTAUTH_SECRET` (use `npx auth secret`)
- [ ] Configure `NEXT_PUBLIC_BACKEND_URL` to production API
- [ ] Use PostgreSQL instead of SQLite
- [ ] Implement secure key management for wallet private keys
- [ ] Enable HTTPS
- [ ] Set up CI/CD pipeline

---

**Phase 1 is complete when all tests pass! ✅**

Next: Proceed to Phase 2 - Institution Verification & Bulk Workflows
