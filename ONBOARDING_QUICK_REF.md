# 🎯 Onboarding Quick Reference

## One-Command Setup

```bash
cd backend
npm run test:onboarding    # Verifies system + creates test users
```

---

## Test User Accounts (Auto-Created)

### Students 👤
```
student1@gmail.com     (Alice Johnson)     Role: Student
student2@gmail.com     (Bob Smith)         Role: Student
student3@gmail.com     (Carol White)       Role: Student
```

### Institutions 🏫
```
harvard.edu        Admin: admin@harvard.edu      Status: Approved ✅
mit.edu            Admin: admin@mit.edu          Status: Approved ✅
stanford.edu       Admin: admin@stanford.edu     Status: Approved ✅
```

### Employers 💼
```
recruiter@techcorp.com    (John Recruiter)    Role: Employer
hr@finance.com            (Sarah HR)          Role: Employer
```

---

## Three Onboarding Flows

### 1️⃣ Student Onboarding (2 minutes)
```
Browser: http://localhost:3000/login
  ↓
Click: "Sign In as Student"
  ↓
Enter: student1@gmail.com
  ↓
See: Student Dashboard with:
  • My Credentials (see issued certs)
  • Your Wallet (see EDU tokens)
  • Rewards Earned (track earnings)
```

### 2️⃣ Institution Onboarding (5 minutes)
```
Browser: http://localhost:3000/institution/signup
  ↓
Fill Form:
  • Name: Harvard University
  • Email: admin@test.edu
  • Admin: Dr. Admin
  • Domain: test.edu
  • Password: TestPass123
  ↓
Check Email: Find verification link
  ↓
Click Link: Verify domain
  ↓
Status: "Pending Admin Approval"
  ↓
Admin Approves: Via API /api/admin/approve
  ↓
Result: Can now issue credentials
```

**Test without email?**
```bash
# Check verification token in database
npx prisma studio → InstitutionSignup table
# Manually set status = 'verified'
# Call approve endpoint
```

### 3️⃣ Employer Onboarding (2 minutes)
```
Browser: http://localhost:3000/login
  ↓
Click: "Sign In as Employer"
  ↓
Enter: recruiter@techcorp.com
  ↓
See: Employer Dashboard with:
  • Verification Search
  • Credential Verification
  • Verification History
  • Analytics
```

---

## Quick Commands

| Command | Purpose |
|---------|---------|
| `npm run test:setup` | Verify system is ready |
| `npm run test:users` | Create test data |
| `npm run db:studio` | View database (Prisma Studio) |
| `npm run dev` | Start backend server |
| `npm run db:migrate` | Run database migrations |

---

## Network Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Backend | 3001 | http://localhost:3001 |
| Prisma Studio | 5555 | http://localhost:5555 |

---

## Database Tables (Prisma Studio)

View all tables at: `npx prisma studio`

| Table | Purpose | Records |
|-------|---------|---------|
| User | All users (students, employers) | 5 |
| InstitutionSignup | Institution registration | 3 |
| Institution | Approved institutions | 3 |
| Credential | Issued credentials | 1+ |
| TokenReward | EDU token rewards | 1+ |
| VerificationLog | Verification history | 0+ |

---

## Key API Endpoints

```
# Users
GET  /api/users/me
POST /api/users/google

# Institutions
POST /api/institutions/signup
GET  /api/institutions/verify/:token

# Credentials  
POST /api/credentials/issue
GET  /api/credentials/:id

# Rewards
GET  /api/rewards/earned/:address
GET  /api/rewards/statistics
```

---

## Frontend Pages

| Path | Purpose | Status |
|------|---------|--------|
| `/` | Home page | ✅ Works |
| `/login` | Google OAuth signin | ✅ Works |
| `/role-selection` | Choose role | ✅ Works |
| `/student` | Student dashboard | ✅ Works |
| `/institution/signup` | Reg form | ✅ Works |
| `/institution/verify/[token]` | Email verification | ✅ Works |
| `/employer` | Employer dashboard | ✅ Works |
| `/claim/[token]` | Claim credential | ✅ Works |
| `/analytics` | Platform metrics | ✅ Works |
| `/whitepaper` | System documentation | ✅ Works |
| `/contact` | Sales inquiry form | ✅ Works |

---

## Testing Checklist

- [ ] Run `npm run test:setup` - System verification
- [ ] Run `npm run test:users` - Create test data
- [ ] Start backend: `npm run dev`
- [ ] Start frontend: `npm run dev`
- [ ] Test Student: Visit `/login` → student1@gmail.com
- [ ] Test Institution: Visit `/institution/signup` → Fill form
- [ ] Test Employer: Visit `/login` → recruiter@techcorp.com
- [ ] Check Rewards: View `/analytics` page
- [ ] View Data: Run `npm run db:studio`

---

## Troubleshooting

**Backend won't start?**
```bash
npm run db:migrate      # Ensure tables exist
npm run db:generate     # Regenerate Prisma client
npm run dev
```

**Can't see test users?**
```bash
npm run test:users      # Create test data
npm run db:studio       # View in Prisma Studio
```

**Frontend hangs?**
```bash
# Check backend is running on :3001
# Check NEXT_PUBLIC_BACKEND_URL in .env
lsof -i :3001          # See what's on port 3001
```

**Email not working?**
- Optional - system works without email
- To enable: Add SENDGRID_API_KEY to .env
- Or: Add SMTP_* settings to .env

---

## What's Included ✅

✅ Student signup + auto wallet  
✅ Institution registration + email verification  
✅ Credential issuance + claiming  
✅ Employer verification system  
✅ Rewards dashboard + analytics  
✅ Test data generator  
✅ System verification script  
✅ 3 test institutions pre-approved  
✅ 5 test users ready to use  

---

## Next Steps 🚀

1. **Immediate**: `npm run test:onboarding` (5 min)
2. **Test Flows**: Try all 3 user journeys (10 min)
3. **Verify Email**: Add SendGrid/SMTP (optional, 5 min)
4. **View Data**: Use Prisma Studio (2 min)
5. **Deploy**: Ready for production

---

**Everything is ready!** Start with:
```bash
cd backend && npm run test:onboarding
```

Then open http://localhost:3000 🎉
