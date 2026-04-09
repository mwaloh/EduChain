# 🎯 EduChain Onboarding - Complete User Flows

## Complete Flow Diagram

```
                         ┌─────────────────────────────────────────────┐
                         │       EduChain Onboarding Platform          │
                         │          (http://localhost:3000)            │
                         └─────────────────────────────────────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
            ┌───────▼─────────┐   ┌─────────▼──────────┐   ┌───────▼──────────┐
            │   STUDENT       │   │   INSTITUTION     │   │   EMPLOYER       │
            │   ONBOARDING    │   │   ONBOARDING      │   │   ONBOARDING     │
            └───────┬─────────┘   └─────────┬──────────┘   └───────┬──────────┘
                    │                       │                       │
```

---

## 1️⃣ STUDENT ONBOARDING FLOW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STUDENT JOURNEY (5 minutes)                         │
└─────────────────────────────────────────────────────────────────────────────┘

    START: http://localhost:3000
      │
      ▼
   ┌──────────────────────────┐
   │  Click "Login"           │
   │  or "Sign In as Student" │
   └────────────┬─────────────┘
                │
                ▼
   ┌──────────────────────────┐
   │  Google OAuth OR         │
   │  Use Test Email:         │
   │  student1@gmail.com      │
   └────────────┬─────────────┘
                │
                ▼
   ┌──────────────────────────┐
   │  Database Activity:      │
   │  ✓ User created/updated  │
   │  ✓ Wallet auto-generated │
   │  ✓ Role = 'student'      │
   └────────────┬─────────────┘
                │
                ▼
   ┌────────────────────────────────┐
   │  Redirect to               │
   │  /role-selection           │
   │  (shows Student card)      │
   └────────────┬─────────────────┘
                │
                ▼
   ┌────────────────────────────────┐
   │  Click Student Card            │
   │  or "I'm a Student"            │
   └────────────┬─────────────────────┘
                │
                ▼
   ┌──────────────────────────────────┐
   │  STUDENT DASHBOARD               │
   │  ✅ Now Showing:                 │
   │  • My Credentials section        │
   │  • Your Wallet widget            │
   │  • Rewards Earned section        │
   │  • Transaction history           │
   │  • Share credential buttons      │
   │                                  │
   │  Database:                       │
   │  • User.role = 'student'         │
   │  • User.walletAddress populated  │
   │  • Can see credentials issued    │
   │  • Can see earned EDU tokens     │
   └──────────────────────────────────┘

                    FLOW COMPLETE ✅
```

### Test It Now:
```bash
# Terminal 1: Start backend
cd backend && npm run dev

# Terminal 2: Start frontend
cd frontend && npm run dev

# Browser: Visit http://localhost:3000/login
# Email: student1@gmail.com (or student2, student3)
# Password: (not needed for test)
# Watch: Dashboard appears with credentials & rewards
```

---

## 2️⃣ INSTITUTION ONBOARDING FLOW

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     INSTITUTION JOURNEY (10 minutes)                          │
└──────────────────────────────────────────────────────────────────────────────┘

    START: http://localhost:3000/institution/signup
      │
      ▼
   ┌─────────────────────────────────┐
   │  Registration Form              │
   │  Fields:                        │
   │  • Institution Name (required) │
   │  • Admin Email (.edu)          │
   │  • Admin Name (required)       │
   │  • Domain (required)           │
   │  • Password (required)         │
   └──────────────┬──────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────┐
   │  Form Validation:                    │
   │  ✓ All fields required               │
   │  ✓ Email must be unique              │
   │  ✓ Domain stored for verification    │
   │  ✓ Password hashed (SHA256)          │
   └──────────────┬───────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────┐
   │  Database: InstitutionSignup         │
   │  Created with:                       │
   │  • institutionName                   │
   │  • adminEmail                        │
   │  • adminName                         │
   │  • domain                            │
   │  • passwordHash                      │
   │  • verificationToken (UUID)          │
   │  • status = 'pending'                │
   └──────────────┬───────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────┐
   │  Email Service:                      │
   │  ✉️ Verification email sent to:      │
   │     admin@harvard.edu                │
   │                                      │
   │  Email contains:                     │
   │  • Verification link with token      │
   │  • Link: /institution/verify/[token] │
   │  • Expires in: 24 hours              │
   └──────────────┬───────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────┐
   │  User sees: "Pending Verification"   │
   │  Page: /institution/signup/pending   │
   │  Message: "Check your email"         │
   │  Status: Can't proceed until verified│
   └──────────────┬───────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────┐
   │  ✉️ CHECK EMAIL:                     │
   │  Click verification link             │
   │  Link goes to:                       │
   │  /institution/verify/[token]         │
   └──────────────┬───────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────┐
   │  Email Verification Page:            │
   │  • Confirms domain ownership         │
   │  • Validates token from database     │
   │  • Updates status = 'verified'       │
   │  • Shows: "Email verified!"          │
   │  • Next: "Waiting for admin approval"│
   └──────────────┬───────────────────────┘
                  │
                  ▼
   ┌──────────────────────────────────────┐
   │  ADMIN APPROVAL (Backend):           │
   │  Admin calls API:                    │
   │  POST /api/admin/institutions/:id... │
   │    /approve                          │
   │                                      │
   │  System does:                        │
   │  1. Creates Institution record       │
   │  2. Sets signup status = 'approved'  │
   │  3. Sends approval email             │
   │  4. Ready for credential issuance    │
   └──────────────┬───────────────────────┘
                  │
                  ▼
   ┌───────────────────────────────────────┐
   │  INSTITUTION DASHBOARD                │
   │  ✅ Now Showing:                      │
   │  • Mint Credential tab                │
   │  • Credentials list                   │
   │  • Analytics view                     │
   │  • Settings panel                     │
   │  • Rewards Earned section             │
   │  • Wallet balance (EDU tokens)        │
   │                                       │
   │  Can Now:                             │
   │  • Issue credentials to students      │
   │  • Upload CSV for bulk issuance       │
   │  • View verification history          │
   │  • Track earned rewards               │
   └───────────────────────────────────────┘

                    FLOW COMPLETE ✅
```

### Test It Now:

**Without Email Verification (Quick Test)**:
```bash
# 1. Create test data
cd backend && npm run test:users

# 2. Open Prisma Studio
npm run db:studio

# 3. Navigate to InstitutionSignup table
# 4. View the 3 test institutions
# 5. They are already marked as 'verified' and 'approved'!

# 6. Start backend and frontend
npm run dev
cd ../frontend && npm run dev

# 7. Test institution login at:
http://localhost:3000 (after setup)
# Use one of the auto-approved institutions
```

**With Email Verification (Real Test)**:
```bash
# 1. Set up SendGrid or SMTP in .env
SENDGRID_API_KEY=sk_xxxx
# OR
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password

# 2. Visit http://localhost:3000/institution/signup
# 3. Fill form with test data
# 4. Check email inbox for verification link
# 5. Click link to verify
# 6. Admin approves via API
# 7. Institution dashboard opens
```

---

## 3️⃣ EMPLOYER ONBOARDING FLOW

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      EMPLOYER JOURNEY (5 minutes)                             │
└──────────────────────────────────────────────────────────────────────────────┘

    START: http://localhost:3000/login
      │
      ▼
   ┌──────────────────────────────┐
   │  Click "Sign In as Employer" │
   │  or "I'm an Employer"        │
   └────────────┬─────────────────┘
                │
                ▼
   ┌──────────────────────────────┐
   │  Google OAuth OR             │
   │  Use Test Email:             │
   │  recruiter@techcorp.com      │
   │  or hr@finance.com           │
   └────────────┬─────────────────┘
                │
                ▼
   ┌──────────────────────────────┐
   │  Database Activity:          │
   │  ✓ User created/updated      │
   │  ✓ Wallet auto-generated     │
   │  ✓ Role = 'employer'         │
   └────────────┬─────────────────┘
                │
                ▼
   ┌────────────────────────────────────┐
   │  Redirect to /role-selection       │
   │  (shows Employer card)             │
   └────────────┬────────────────────────┘
                │
                ▼
   ┌────────────────────────────────────┐
   │  Click Employer Card               │
   │  or "I'm an Employer"              │
   └────────────┬────────────────────────┘
                │
                ▼
   ┌──────────────────────────────────────────┐
   │  EMPLOYER DASHBOARD                      │
   │  ✅ Now Showing:                         │
   │  • Search/Verify section                 │
   │  • Enter student email to verify         │
   │  • See credential verification results   │
   │  • View verification history             │
   │  • Download verification reports         │
   │  • Rewards Earned section (if any)       │
   │                                          │
   │  Database:                               │
   │  • User.role = 'employer'                │
   │  • User.walletAddress populated          │
   │  • Can verify credentials on-chain       │
   │                                          │
   │  Available Actions:                      │
   │  • Search student by email               │
   │  • View their credential details         │
   │  • Verify authenticity on blockchain     │
   │  • Download verification proof           │
   │  • View institutional accreditation      │
   └──────────────────────────────────────────┘

                    FLOW COMPLETE ✅
```

### Test It Now:
```bash
# Backend & frontend already running

# Browser: Visit http://localhost:3000/login
# Email: recruiter@techcorp.com (or hr@finance.com)
# Watch: Employer dashboard appears
# Try: Search for student1@gmail.com to verify
```

---

## 4️⃣ COMPLETE USER JOURNEY

```
                    ┌─────────────────────────────┐
                    │   WEEK 1: REGISTRATION      │
                    └──────────────┬───────────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            │                      │                      │
   ┌────────▼──────────┐  ┌────────▼──────────┐  ┌───────▼───────────┐
   │ REGISTRAR SIGNUP  │  │ STUDENT SIGNUP    │  │ EMPLOYER SIGNUP   │
   │ (Institution)     │  │ (Google/Email)    │  │ (Google/Email)    │
   │                   │  │                   │  │                   │
   │ • Email verify    │  │ • Auto wallet     │  │ • Auto wallet     │
   │ • Admin approve   │  │ • Role select     │  │ • Role select     │
   │ • Set up creds    │  │ • Dashboard       │  │ • Dashboard       │
   └────────┬──────────┘  └────────┬──────────┘  └───────┬───────────┘
            │                      │                      │
            │                      │                      │
            ▼                      ▼                      ▼
       ┌────────────────────────────────────────────────┐
       │     WEEK 2-3: ACTIVE PARTICIPATION            │
       │                                                │
       │  1. Institution issues credentials (CSV)       │
       │  2. System sends emails to students           │
       │  3. Students claim credentials                │
       │  4. Credentials added to profiles             │
       │  5. Students earn EDU rewards                 │
       │  6. Students share with employers             │
       │  7. Employers search and verify               │
       │  8. All parties earn rewards                  │
       └────────────────────────────────────────────────┘
            │                      │                      │
            ▼                      ▼                      ▼
       ┌──────────┐           ┌──────────┐           ┌──────────┐
       │ Rewards: │           │ Rewards: │           │ Rewards: │
       │ 5 EDU    │           │ 10 EDU   │           │ 0.5 EDU  │
       │ Issued   │           │ Claimed  │           │ Verified │
       └──────────┘           └──────────┘           └──────────┘
```

---

## 📊 Database Schema (Simplified)

```
         ┌─────────────────┐
         │      User       │
         ├─────────────────┤
         │ id              │
         │ email           │◄────┐
         │ role            │     │
         │ walletAddress   │     │
         │ createdAt       │     │
         └─────────────────┘     │
                                  │
         ┌─────────────────┐      │
         │ InstitutionSignup     │
         ├─────────────────┤      │
         │ id              │      │
         │ institutionName │      │
         │ adminEmail      │──────┘
         │ verificationToken
         │ status          │
         │ createdAt       │
         └────────┬────────┘
                  │
                  │ (on approval)
                  │
         ┌────────▼────────┐
         │  Institution    │
         ├─────────────────┤
         │ id              │
         │ name            │
         │ metadataURI     │
         │ active          │
         └────────┬────────┘
                  │
                  │ 1:N
                  │
         ┌────────▼────────┐
         │  Credential     │
         ├─────────────────┤
         │ id              │
         │ institutionId   │
         │ studentEmail    │◄─────┐
         │ credentialType  │      │
         │ issuedAt        │      │
         │ ipfsCid         │      │
         └────────┬────────┘      │
                  │               │
                  │ 1:1           │
                  │               │
         ┌────────▼────────┐      │
         │  ClaimToken     │      │
         ├─────────────────┤      │
         │ token           │      │
         │ credentialId    │      │
         │ studentEmail    │──────┘
         │ claimed         │
         └─────────────────┘

         ┌─────────────────┐
         │  TokenReward    │
         ├─────────────────┤
         │ id              │
         │ address         │
         │ amount          │
         │ reason          │
         │ status          │
         │ createdAt       │
         └─────────────────┘
```

---

## 🎯 Key Integration Points

### 1. OAuth Flow
```
Frontend → GitHub OAuth
  ↓
NextAuth callback
  ↓
Backend POST /api/users/google
  ↓
Create User + Wallet
  ↓
Store in database
  ↓
User session created
```

### 2. Email Verification
```
Institution submits signup
  ↓
Generate UUID token
  ↓
Save to InstitutionSignup
  ↓
Send email with link
  ↓
User clicks link
  ↓
Verify token in database
  ↓
Update status = 'verified'
  ↓
Admin approval
  ↓
Create Institution record
```

### 3. Reward Generation
```
Credential issued
  ↓
Institution gains 5 EDU
  ↓
Student gains 10 EDU
  ↓
Employer verifies
  ↓
Employer gains 0.5 EDU
  ↓
Create TokenReward record
  ↓
Update /api/rewards endpoints
```

---

## ✅ What's Ready to Test

| Component | Status | Test URL |
|-----------|--------|----------|
| Student signup | ✅ | http://localhost:3000/login |
| Institution signup | ✅ | http://localhost:3000/institution/signup |
| Student dashboard | ✅ | http://localhost:3000/student |
| Institution dashboard | ✅ | http://localhost:3000/institution |
| Employer dashboard | ✅ | http://localhost:3000/employer |
| Credential claim | ✅ | http://localhost:3000/claim/[token] |
| Analytics | ✅ | http://localhost:3000/analytics |
| Whitepaper | ✅ | http://localhost:3000/whitepaper |
| Contact | ✅ | http://localhost:3000/contact |

---

## 🚀 Start Testing Now

```bash
# 1. Verify system
cd backend && npm run test:setup

# 2. Create test users
npm run test:users

# 3. Start backend
npm run dev

# 4. Start frontend (new terminal)
cd ../frontend && npm run dev

# 5. Open browser
http://localhost:3000

# 6. Try flows:
# - Student: /login → student1@gmail.com
# - Institution: /institution/signup
# - Employer: /login → recruiter@techcorp.com
```

Done! 🎉
