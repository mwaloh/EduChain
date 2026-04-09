# Google OAuth Setup Guide

## Overview
Your EduChain application already has Google OAuth authentication implemented! You just need to configure it with your Google Cloud Console credentials.

## Current Status ✅
- ✅ NextAuth.js configured with Google Provider
- ✅ Backend endpoint `/api/users/google` ready
- ✅ Frontend login flow implemented
- ✅ Institution admin auto-detection working

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API" and enable it

### 2. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Configure OAuth consent screen if prompted:
   - User Type: External
   - App name: EduChain
   - User support email: your-email@example.com
   - Developer contact: your-email@example.com
4. For application type, select "Web application"
5. **Authorized JavaScript origins** (IMPORTANT: No paths allowed!):
   - `http://localhost:3001` (development)
   - `https://yourdomain.com` (production)
6. **Authorized redirect URIs** (Full paths allowed):
   - `http://localhost:3001/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)
7. Copy the Client ID and Client Secret

### 3. Update Environment Variables

Replace the placeholder values in `frontend/.env.local`:

```env
GOOGLE_CLIENT_ID=your_actual_google_client_id
GOOGLE_CLIENT_SECRET=your_actual_google_client_secret
```

### 4. Test the Login

1. Start your frontend: `npm run dev`
2. Go to `/login` page
3. Click "Sign in with Google"
4. You should be redirected to Google for authentication
5. After authentication, you'll be redirected back to EduChain

## How It Works

1. **User clicks "Sign in with Google"** → NextAuth redirects to Google
2. **Google authenticates user** → Returns OAuth token to EduChain
3. **NextAuth callback** → Calls `/api/users/google` with user data
4. **Backend creates/updates user** → Stores in database with wallet
5. **Session created** → User logged in with role detection

## Role Detection

- **Students**: Default role for new Google users
- **Institution Admins**: Auto-detected if email matches institution domain
- **Employers**: Can be manually assigned by admins

## Troubleshooting

### Common Issues:

1. **"Invalid Origin: URIs must not contain a path or end with '/'"**
   - **Solution**: For "Authorized JavaScript origins", use only the domain: `http://localhost:3001`
   - For "Authorized redirect URIs", use the full path: `http://localhost:3001/api/auth/callback/google`

2. **"Invalid OAuth access token"**
   - Check your Google Client ID and Secret are correct
   - Ensure redirect URI matches exactly

3. **"Failed to create/update user in backend"**
   - Check backend is running on port 3001
   - Verify database connection

4. **"User not authorized"**
   - Check if user email is in allowed domains
   - For institution admins, ensure email domain matches institution

### Debug Mode:
Add to your `.env.local`:
```env
NEXTAUTH_DEBUG=true
```

## Production Deployment

For production, update these environment variables:
- `NEXTAUTH_URL=https://yourdomain.com`
- Add production redirect URI to Google Cloud Console
- Set secure `NEXTAUTH_SECRET` (32+ characters)

## Security Notes

- ✅ OAuth tokens are handled securely by NextAuth
- ✅ User data is encrypted in JWT tokens
- ✅ Backend validates all user creation/update requests
- ✅ CORS protection via NextAuth configuration

Your Google OAuth is ready to go! Just add your credentials and test it out.