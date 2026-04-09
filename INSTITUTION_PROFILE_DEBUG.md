# Institution Profile Loading: Troubleshooting & Debug Guide

## Error: "Database profile: Failed to load institution profile"

This error typically appears when:
1. You just onboarded your institution
2. You completed email verification
3. You're waiting for super-admin approval
4. OR you've been approved but the profile still won't load

---

## 🔍 Root Cause Analysis

The main issue is **case-sensitive email matching** between the institution signup process and Google OAuth login.

### What Happens:
```
Step 1: Admin signs up with email "Admin@Company.edu"
        → InstitutionSignup record created with that email
        → Email verification sent

Step 2: Super-admin approves institution
        → Institution record created
        → User record created with "Admin@Company.edu"
        → User.institutionId = Institution.id

Step 3: Admin logs in via Google OAuth
        → Google returns email as "admin@company.edu" (lowercase)
        → System SHOULD find existing user by email
        → BUT if email matching is case-sensitive, a NEW duplicate User is created
        → New User has institutionId = null
        → Profile endpoint returns error
```

---

## ✅ Fixes Applied (April 4, 2026)

The following fixes have been implemented:

### 1. **Case-Insensitive Email Lookup in OAuth**
**File:** `backend/src/routes/users.ts`

```typescript
// BEFORE (Case-sensitive):
let user = await prisma.user.findUnique({
  where: { email },
});

// AFTER (Case-insensitive, normalized):
let user = await prisma.user.findFirst({
  where: { 
    email: email.toLowerCase(),
    deletedAt: null 
  },
});

// And when creating/updating:
email: email.toLowerCase() // Store in lowercase
```

**Impact:** Google OAuth now always stores emails in lowercase, preventing duplicate User records.

### 2. **Email Normalization in Admin Approval**
**File:** `backend/src/routes/admin.ts`

```typescript
// BEFORE:
where: { email: signup.adminEmail }

// AFTER:
where: { email: signup.adminEmail.toLowerCase() }

// And when creating:
email: signup.adminEmail.toLowerCase()
```

**Impact:** Approved institutions use lowercase emails, matching OAuth records.

### 3. **Email Normalization in Signup**
**File:** `backend/src/routes/institution.ts`

```typescript
// Signup form stores email in lowercase:
adminEmail: adminEmail.toLowerCase()
```

**Impact:** All signup records use consistent lowercase email format.

### 4. **Better Error Messages**
**File:** `backend/src/routes/institution.ts`

```typescript
if (!user) {
  console.warn(`[INSTITUTION PROFILE] User not found with email: ${emailRaw}`);
  return res.status(404).json({ 
    error: 'User not found. Please ensure you are logged in with the correct email.' 
  });
}

if (!user.institution) {
  console.warn(`[INSTITUTION PROFILE] User ${user.email} has no institution assigned.`);
  return res.status(404).json({ 
    error: 'Institution profile not yet assigned. If you just onboarded, please complete email verification and wait for super admin approval.' 
  });
}
```

**Impact:** Clear, actionable error messages help diagnose the actual problem.

### 5. **Improved Debug Logging**
**File:** `backend/src/routes/users.ts`

```typescript
console.log(`[GOOGLE AUTH] New user created: ${email}`);
console.log(`[GOOGLE AUTH] User updated: ${email} (institutionId: ${user.institutionId || 'none'})`);
```

**Impact:** Backend logs show exactly what's happening during OAuth login.

---

## 🔧 How to Fix Existing Data

If you have duplicate User records from the old case-sensitive matching, follow these steps:

### Step 1: Identify Duplicate Users

Run this query in your database:

```sql
-- SQLite
SELECT email, COUNT(*) as count FROM User GROUP BY lower(email) HAVING count > 1;
```

or check server logs for pattern like:

```
[GOOGLE AUTH] New user created: admin@company.edu
[INSTITUTION PROFILE] User not found with email: Admin@Company.edu
```

### Step 2: Merge Duplicate Records

If you have duplicates, the lower-case version (created by OAuth) is correct. You should:

1. **Option A: Manual Fix via Database**

```sql
-- Find the correct user (lowercase email, has institutionId)
SELECT * FROM User 
WHERE email = 'admin@company.edu' AND institutionId IS NOT NULL;

-- Delete the old mixed-case record
DELETE FROM User 
WHERE email = 'Admin@Company.edu';
-- OR soft-delete:
-- UPDATE User SET deletedAt = CURRENT_TIMESTAMP 
-- WHERE email = 'Admin@Company.edu';
```

2. **Option B: Contact Super Admin**
   - Provide your email address
   - Let them re-approve your institution
   - System will use lowercase email going forward

### Step 3: Test the Fix

1. Log out completely
2. Clear browser cookies (or use private/incognito window)
3. Log back in via Google OAuth
4. Check that you can now access `/institution/dashboard`

---

## 🐛 How to Diagnose Issues

### Check 1: View Backend Logs

When you log in, you should see something like:

```
[GOOGLE AUTH] User updated: admin@company.edu (institutionId: clx1abc2def3ghi456)
```

**If you see:** `(institutionId: none)` - Your institution hasn't been approved yet.

**If you see:** Error lines - There's a database issue.

### Check 2: Verify Database Records

Use Prisma Studio:

```bash
cd backend
npm run db:studio
```

Then check:

1. **User Table**
   - Find your email (should be lowercase)
   - Check `institutionId` field (should not be empty)
   - Check `role` field (should be 'institution_admin')

2. **Institution Table**
   - Should exist with `status = 'approved'`
   - Should have your name and details

3. **InstitutionAdmin Table**
   - Should link your User.id to Institution.id
   - Should have matching email

4. **InstitutionSignup Table**
   - Should show `status = 'approved'`
   - Should have your details

### Check 3: Run Test Endpoint

```bash
curl -X GET "http://localhost:3001/api/institutions/profile?email=admin@company.edu" \
  -H "Content-Type: application/json"
```

**Success (200):**
```json
{
  "success": true,
  "institution": {
    "id": "...",
    "name": "Your University",
    "status": "approved",
    ...
  },
  "user": {
    "email": "admin@company.edu",
    "role": "institution_admin",
    ...
  }
}
```

**Error (404):**
```json
{
  "error": "Institution profile not yet assigned..."
}
```

**Error (500):**
Check backend console logs for detailed error.

---

## 📋 Checklist: What to Verify

If your institution profile still isn't loading, verify:

- [ ] You're logged in with the correct Google account
- [ ] The email you're using matches the email in the signup form
- [ ] Your institution signup has `status = "verified"` in database
- [ ] A super-admin has approved your institution
- [ ] Your User record has `institutionId` (not null) in database
- [ ] Your `Institution` record has `status = "approved"` in database
- [ ] There are no duplicate User records with different email cases
- [ ] Backend is running and accessible at `NEXT_PUBLIC_BACKEND_URL`

---

## 🔄 Email Consistency Across System

**Key Principle:** All emails are now stored and matched in **lowercase**.

This applies to:
1. Google OAuth login (`/api/users/google`)
2. Institution signup (`/api/institutions/signup`)
3. Admin approval process (`/api/institutions/:signupId/approve`)
4. Profile lookup (`/api/institutions/profile`)
5. Institution Admin table (`InstitutionAdmin.email`)

---

## 🚀 Resolution Steps for Users

If you're seeing the institution profile error:

### For Standard Users:
1. Check that you completed email verification (should show success page)
2. Wait 24 hours for super-admin review (normal SLA)
3. Check server logs by asking admin to look for your email in logs
4. Try logging out and back in with Google

### For Super-Admins:
1. Go to `/super-admin` dashboard
2. Go to "Pending Signups" or "Institutions" tab
3. Search for the institution by email (try both cases if needed)
4. Click "Approve" to complete the process
5. (Note: Lowercase emails will display correctly in all lookups)

### For Developers:
1. Set `DEBUG=*` environment variable
2. Restart backend with `npm run dev`
3. Check full logs for `[INSTITUTION PROFILE]` and `[GOOGLE AUTH]` messages
4. Use Prisma Studio to inspect exact database state
5. Run the test endpoint curl command above

---

## 🎯 Future Improvements

Planned enhancements to prevent this issue:

1. **Email Verification Webhook** - Automatically approve approved institutions on verified domains
2. **Institution Code Lookup** - Allow login with institution code if email is ambiguous
3. **Unique Email Case-Insensitive Constraint** - Database-level enforcement (requires migration)
4. **Institution Approval Notification** - Email sent when super-admin approves
5. **Onboarding Progress Dashboard** - Show where you are in the approval process

---

## 📞 Getting Help

If this guide didn't resolve your issue:

1. **Contact your institution super-admin:**
   - Share your Google email address
   - Ask them to check `/super-admin` for your pending approval

2. **Check backend logs:**
   - Look for your email in the logs
   - Share the exact error message and time

3. **Gather this information:**
   - Your Google email address
   - The email you used to sign up (might be different case)
   - Whether you completed email verification
   - Screenshot of the error message
   - Backend logs (last 20 lines with your email)

---

**Last Updated:** April 4, 2026  
**Fixed Issues:** Case-sensitive email matching in OAuth and approval workflows  
**Related Files:** [institution.ts](backend/src/routes/institution.ts), [users.ts](backend/src/routes/users.ts), [admin.ts](backend/src/routes/admin.ts)

