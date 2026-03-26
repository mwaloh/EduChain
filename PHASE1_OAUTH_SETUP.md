# Phase 1: Google OAuth - Environment Setup Guide

## Frontend Environment Variables

Create `.env.local` in the `frontend/` directory with the following variables:

```env
# Google OAuth Configuration
# Get these from: https://console.cloud.google.com/
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# NextAuth Configuration
NEXTAUTH_SECRET=your-random-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# Backend API
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

## Backend Environment Variables

Add to your existing `backend/.env` file:

```env
# Database (existing)
DATABASE_URL="file:./dev.db"

# Email Service (existing)
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_FROM=noreply@educhain.io

# OAuth Callback
FRONTEND_URL=http://localhost:3000

# Blockchain (existing)
PRIVATE_KEY=your_private_key
CONTRACT_ADDRESS=your_contract_address
RPC_URL=your_rpc_url
INSTITUTION_ROLE=INSTITUTION_ADMIN
```

## Google OAuth Setup Steps

1. **Go to Google Cloud Console:**
   - Visit https://console.cloud.google.com/
   - Create a new project (e.g., "EduChain")

2. **Enable Google+ API:**
   - In the search bar, search for "Google+ API"
   - Click "Enable"

3. **Create OAuth 2.0 Credentials:**
   - Go to "Credentials" in the left sidebar
   - Click "Create Credentials" → "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback` (backup)
     - For production: `https://your-domain.com/api/auth/callback/google`

4. **Copy Client ID and Secret:**
   - Copy the `Client ID` → paste to `GOOGLE_CLIENT_ID` in `.env.local`
   - Copy the `Client Secret` → paste to `GOOGLE_CLIENT_SECRET` in `.env.local`

5. **Generate NEXTAUTH_SECRET:**
   ```bash
   cd frontend
   npx auth secret
   # This will generate a random secret and add it to .env.local
   ```

## Database Migration

After updating `schema.prisma`, run the migration:

```bash
cd backend
npm run prisma:migrate
# or: npx prisma migrate dev --name add_user_auth
```

## Dependencies Installation

```bash
# Frontend
cd frontend
npm install

# Backend
cd backend
npm install
```

## Running the Application

### Terminal 1 - Backend:
```bash
cd backend
npm run dev
# Should print: 🚀 EduChain Analytics Backend running on port 3001
```

### Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
# Should print: ▲ Next.js 14.2.15
```

### Browser:
- Visit: http://localhost:3000
- Should see the new login page with Google OAuth button
- You can still use MetaMask by clicking "Connect MetaMask Instead"

## Testing the Flow

1. Click "Sign In as Student" on the login page
2. You'll be redirected to Google Sign-In
3. After signing in, you should be redirected to role selection
4. Choose a role and you'll see the dashboard
5. Check that your email and wallet address are stored in the database

## Next Steps (Phase 2)

Once Phase 1 is complete:
- Implement institution `.edu` verification
- Add bulk upload email delivery
- Create institution approval workflow
