# Phase 4 Testing & Deployment Guide

## 🧪 End-to-End Testing Checklist

### Pre-Testing Setup

**Requirements:**
- Backend running on `http://localhost:3001`
- Frontend running on `http://localhost:3000`
- Database with migrations applied
- Google OAuth configured (for NextAuth)
- Polygon Amoy RPC endpoint configured

### Test Scenario 1: Institution Admin Mints and Records Credential

**Prerequisites:**
- Institution exists and approved
- At least one student profile created in database
- Institution admin logged in

**Steps:**

1. **Navigate to Institution Portal**
   ```
   URL: http://localhost:3000/institution/dashboard
   Verify: Blue sidebar with student/minting/analytics tabs visible
   ```

2. **Go to Student Minting Form**
   ```
   Click: "Mint Credential" tab
   Verify: StudentSelector component shows active students
   ```

3. **Select Student from Database**
   ```
   Click: "Select from your students" dropdown
   Search: Type student email (e.g., "john@uni.edu")
   Select: Click on the student
   Verify: 
     - StudentSelector closes
     - Email auto-filled
     - Wallet address auto-filled (green highlight)
   ```

4. **Fill Minting Form**
   ```
   Student Name: [auto-filled from student email]
   Course: "Computer Science"
   Degree: "Bachelor of Science"
   Grade: "A"
   Graduation Date: [select past date]
   Expiry Date: [optional, select 3-4 years from now]
   
   Click: "Mint Credential"
   ```

5. **Blockchain Transaction**
   ```
   Verify: Transaction modal opens
   Wait: "Minting credential on blockchain..." message
   Wait: "Recording credential in database..." message
   Result: "Credential minted successfully!" toast
   Verify: "Credential recorded to database!" toast
   ```

6. **Test Result - Student Dashboard**
   ```
   URL: http://localhost:3000/student/credentials
   Verify: Credential appears with:
     - Status badge: "Active" (green)
     - Issue date
     - Expiry date
     - Degree and program info
     - Token ID visible
   ```

**cURL Test Alternative:**

```bash
# 1. Create student
curl -X POST http://localhost:3001/api/students \
  -H "x-user-email: admin@uni.edu" \
  -H "x-institution-id: {institution_id}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.student@uni.edu",
    "program": "Computer Science",
    "yearOfStudy": 3,
    "admissionNo": "2021001"
  }'

# 2. Record credential after blockchain mint
curl -X POST http://localhost:3001/api/credentials/record \
  -H "x-user-email: admin@uni.edu" \
  -H "x-institution-id: {institution_id}" \
  -H "Content-Type: application/json" \
  -d '{
    "studentEmail": "test.student@uni.edu",
    "tokenId": "1",
    "institutionId": "{institution_id}",
    "ipfsCid": "QmAbcd1234...",
    "degree": "Bachelor of Science",
    "program": "Computer Science",
    "issuedOn": 1701302400,
    "expiresOn": 1732838400
  }'

# 3. Verify student can fetch credentials
curl http://localhost:3001/api/credentials/student/test.student@uni.edu \
  -H "x-user-email: test.student@uni.edu"
```

---

### Test Scenario 2: Public Credential Verification

**Steps:**

1. **Get Credential ID from Student Dashboard**
   ```
   Copy: Token ID from any credential card
   Example: "1"
   ```

2. **Visit Verification Page**
   ```
   URL: http://localhost:3000/verify/1
   Verify: Page loads with:
     - Green "Active" status badge
     - Institution name
     - Degree info
     - Issue and expiry dates
     - Student email (verified recipient)
     - Token ID
     - IPFS hash
   ```

3. **Test Verification Form**
   ```
   Click: "Log Verification" button
   Fill: 
     - Your Email: "hr@company.com"
     - Your Company: "Tech Company Inc"
   Click: "Log Verification"
   
   Verify: 
     - Toast: "Verification logged successfully!"
     - Verification entry appears in logs list
     - Shows company name, email, timestamp
   ```

4. **Test Share Link**
   ```
   Click: "Share Link" button
   Verify: Toast "Copied to clipboard!"
   Paste URL and visit - should show same credential
   ```

**cURL Test:**

```bash
# Fetch credential for verification page (requires token ID from earlier)
curl http://localhost:3001/api/credentials/{credential_id}

# Log verification (public endpoint)
curl -X POST http://localhost:3001/api/credentials/{credential_id}/verify \
  -H "Content-Type: application/json" \
  -d '{
    "verifierEmail": "hr@company.com",
    "verifierCompany": "Tech Company Inc",
    "notes": "Verified for hiring purposes"
  }'
```

---

### Test Scenario 3: Employer Signup & Approval

**Steps:**

1. **Visit Employer Signup Page**
   ```
   URL: http://localhost:3000/employer-signup
   Verify: Form displays with:
     - Company Information section
     - Contact Information section
     - Business Details section
     - Submit button
   ```

2. **Fill Employer Signup Form**
   ```
   Company Name: "DataTech Solutions"
   Company Email: "contact@datatech.com"
   Contact Name: "Jane Smith"
   Contact Phone: "+1 (555) 123-4567"
   Industry: "Technology"
   Location: "San Francisco, USA"
   Website: "https://datatech.com"
   Description: "We hire fresh graduates"
   
   Click: "Submit Application"
   ```

3. **Verify Submission**
   ```
   Verify: Success message
     - "Thank you! Your signup has been submitted for review."
     - "Our team will review your application within 24-48 hours."
   
   Auto-redirect to home after 3 seconds
   ```

4. **Super-Admin Approval**
   ```
   URL: http://localhost:3000/super-admin/dashboard
   Tab: "Pending Approvals"
   Verify: "DataTech Solutions" request appears
   
   Actions:
     - Click "Approve" → Status changes to approved
     - Or "Reject" → Request removed
   ```

**cURL Test:**

```bash
# Submit employer signup
curl -X POST http://localhost:3001/api/employers/signup \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "TechCorp",
    "companyEmail": "jobs@techcorp.com",
    "contactName": "Mike Johnson",
    "contactPhone": "+1 (555) 987-6543",
    "industry": "Technology",
    "location": "New York, USA",
    "website": "https://techcorp.com",
    "description": "Leading tech hiring platform"
  }'

# Get pending employers (super-admin)
curl http://localhost:3001/api/employers/pending \
  -H "x-user-email: admin@educhain.com"

# Approve employer
curl -X POST http://localhost:3001/api/employers/{employer_id}/approve \
  -H "x-user-email: admin@educhain.com" \
  -H "Content-Type: application/json"
```

---

### Test Scenario 4: Credential Revocation

**Steps:**

1. **Institution Admin Portal**
   ```
   URL: http://localhost:3000/institution/students
   Tab: "Credentials" or history view
   Find: Any minted credential
   ```

2. **Revoke Credential**
   ```
   Click: Credential → "Revoke" button
   Modal: "Confirm Revocation"
   Reason: "Student failed academic integrity review"
   Click: "Revoke"
   ```

3. **Verify in Student Dashboard**
   ```
   URL: http://localhost:3000/student/credentials
   Verify: Revoked credential now shows:
     - Red "Revoked" status badge
     - Revocation reason displayed
     - No longer counted in "Active" stats
   ```

4. **Verify on Public Verification Page**
   ```
   URL: http://localhost:3000/verify/{token_id}
   Verify: Red "Revoked" status
   Warning: "This credential has been revoked"
   Reason: Shows revocation reason
   ```

**cURL Test:**

```bash
# Revoke credential (institution admin)
curl -X PUT http://localhost:3001/api/credentials/{credential_id}/revoke \
  -H "x-user-email: admin@uni.edu" \
  -H "x-institution-id: {institution_id}" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Student failed academic integrity review"
  }'
```

---

### Test Scenario 5: Credential Expiry

**Steps:**

1. **Create Credential with Past Expiry**
   ```
   During minting, set:
   - Graduation Date: 1 year ago
   - Expiry Date: 6 months ago
   ```

2. **View in Student Dashboard**
   ```
   Verify: Credential shows:
     - Yellow "Expired" status badge
     - Past expiry date in red
   ```

3. **View on Verification Page**
   ```
   Verify: Yellow "Expired" status
   No verification new form shown (optional: prevent verification of expired creds)
   ```

---

## 📊 API Testing Commands

### Health Check
```bash
curl http://localhost:3001/health
# Response: {"status":"ok","timestamp":"..."}
```

### Credential Analytics
```bash
# Get institution credential analytics
curl http://localhost:3001/api/credentials/institution/{institution_id}/history \
  -H "x-user-email: admin@uni.edu" \
  -H "x-institution-id: {institution_id}" \
  -H "Content-Type: application/json"
```

### Audit Logs
```bash
# Check audit trail
curl http://localhost:3001/api/audit/logs \
  -H "x-user-email: admin@educhain.com"
```

---

## 🚀 Staging Environment Setup

### Prerequisites
- Ubuntu/Linux server (or Windows Subsystem for Linux)
- Node.js 18+ installed
- PostgreSQL 13+ installed
- Nginx configured
- SSL certificate (Let's Encrypt)
- Environment variables configured

### 1. Database Setup

```bash
# Install and start PostgreSQL
sudo apt update && sudo apt install postgresql

# Create database
createdb educhain_staging

# Create readonly user for analytics
createuser educhain_readonly
psql -c "ALTER USER educhain_readonly WITH PASSWORD 'secure_password'"
```

### 2. Backend Deployment

```bash
# Clone repository
git clone https://github.com/yourorg/educhain.git
cd educhain/backend

# Install dependencies
npm install

# Create .env.staging
cp .env.example .env.staging

# Edit .env.staging with staging values:
```

**.env.staging template:**
```bash
# Database
DATABASE_URL="postgresql://user:password@stagingdb.com/educhain_staging"

# Blockchain
CONTRACT_ADDRESS="0x..." # Deployed contract on Amoy
RPC_URL="https://rpc-amoy.polygon.technology"
PRIVATE_KEY="0x..." # Deployer wallet private key

# IPFS
IPFS_API="https://ipfs.io"

# Server
PORT=3001
NODE_ENV='staging'

# OAuth
NEXTAUTH_SECRET="your-secret-here"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# SMTP (for notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="..."
SMTP_PASS="..."
```

### 3. Run Migrations

```bash
# Install Prisma CLI
npm install -g prisma

# Run migrations
DATABASE_URL=postgresql://user:pass@db/educhain_staging npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

### 4. Start Backend

```bash
# Development mode (with hot reload)
npm run dev

# Or production mode
npm run build
npm run start
```

### 5. Frontend Deployment

```bash
cd ../frontend

# Create .env.staging
NEXT_PUBLIC_BACKEND_URL="https://api.staging.educhain.com"
NEXTAUTH_URL="https://staging.educhain.com"
NEXTAUTH_SECRET="same-secret-as-backend"
```

### 6. Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name staging.educhain.com api.staging.educhain.com;

    ssl_certificate /etc/letsencrypt/live/staging.educhain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staging.educhain.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 7. SSL & Security

```bash
# Get SSL certificate
sudo certbot certonly --nginx -d staging.educhain.com

# Set up auto-renewal
sudo systemctl enable certbot.timer
```

### 8. Process Management

```bash
# Install PM2
npm install -g pm2

# Create ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'educhain-backend',
      script: './dist/index.js',
      cwd: './backend',
      env: {
        NODE_ENV: 'staging'
      }
    },
    {
      name: 'educhain-frontend',
      script: 'npm start',
      cwd: './frontend'
    }
  ]
};
EOF

# Start services
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 9. Monitoring & Logging

```bash
# Check service status
pm2 status
pm2 logs

# Monitor resources
pm2 monitor

# Setup log rotation
sudo apt install logrotate
```

### 10. Backup Strategy

```bash
# Daily database backup
0 2 * * * pg_dump -h localhost -U user educhain_staging | gzip > /backups/educhain_$(date +\%F).sql.gz

# Keep 30 days of backups
find /backups -name 'educhain_*.sql.gz' -mtime +30 -delete
```

---

## Post-Deployment Testing Checklist

- [ ] Health check responds
- [ ] Database migrations completed successfully
- [ ] Users can sign up with Google OAuth
- [ ] Institution onboarding works
- [ ] Student creation and listing works
- [ ] Minting form displays students from database
- [ ] Blockchain transaction succeeds and records to DB
- [ ] Credentials appear in student dashboard
- [ ] Public verification page loads credentials
- [ ] Verification logging works
- [ ] Employer signup works
- [ ] Super-admin can approve/reject employers
- [ ] Credential revocation works
- [ ] Audit logs capture all actions
- [ ] Rate limiting active
- [ ] CORS properly configured
- [ ] Environment variables loaded correctly

---

## Troubleshooting

### Issue: "Student not found" when recording credential

**Solution:**
- Verify student email matches exactly (case-sensitive)
- Check student status is "active"
- Confirm institution ID matches

### Issue: Gas estimation failed

**Solution:**
- Ensure wallet has sufficient Amoy test MATIC
- Check contract is deployed at specified address
- Verify RPC endpoint is accessible

### Issue: Credentials not appearing in student dashboard

**Solution:**
- Check student email in credential record matches student profile
- Verify database migration completed: `npx prisma migrate status`
- Check NEXT_PUBLIC_BACKEND_URL is correct in frontend .env

### Issue: CORS errors on frontend

**Solution:**
- Add frontend URL to CORS whitelist in backend
- Check Origin header in request
- Verify credentials:true in fetch requests

---

## Monitoring & Health Checks

```javascript
// Add to cron job - Daily health check
fetch('https://api.staging.educhain.com/health')
  .then(r => r.json())
  .then(d => {
    if (d.status !== 'ok') {
      // Send alert
      sendAlert(`Backend health check failed: ${d.status}`);
    }
  })
  .catch(e => sendAlert(`Backend unreachable: ${e.message}`));
```

---

## Next Steps

1. Run through all test scenarios on staging
2. Performance testing with load balancer
3. Security audit (OWASP top 10)
4. User acceptance testing with institution partners
5. Production deployment

