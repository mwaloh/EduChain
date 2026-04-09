/**
 * Test Data Generator for EduChain
 * Creates demo users, institutions, credentials, and verification records
 * 
 * Usage: npx ts-node scripts/create-test-users.ts
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Test data configuration
const TEST_STUDENTS = [
  { email: 'student1@gmail.com', name: 'Alice Johnson', role: 'student' },
  { email: 'student2@gmail.com', name: 'Bob Smith', role: 'student' },
  { email: 'student3@gmail.com', name: 'Carol White', role: 'student' },
];

const TEST_EMPLOYERS = [
  { email: 'recruiter@techcorp.com', name: 'John Recruiter', role: 'employer' },
  { email: 'hr@finance.com', name: 'Sarah HR', role: 'employer' },
];

const TEST_INSTITUTIONS = [
  {
    name: 'Harvard University',
    adminEmail: 'admin@harvard.edu',
    adminName: 'Dr. Harvard Admin',
    domain: 'harvard.edu',
  },
  {
    name: 'MIT',
    adminEmail: 'admin@mit.edu',
    adminName: 'Dr. MIT Admin',
    domain: 'mit.edu',
  },
  {
    name: 'Stanford University',
    adminEmail: 'admin@stanford.edu',
    adminName: 'Dr. Stanford Admin',
    domain: 'stanford.edu',
  },
];

/**
 * Generate deterministic wallet from email (for testing)
 */
function generateWalletFromEmail(email: string) {
  const hash = crypto.createHash('sha256').update(email).digest('hex');
  return '0x' + hash.substring(0, 40);
}

/**
 * Create test student users
 */
async function createTestStudents() {
  console.log('\n📚 Creating test students...');
  
  for (const student of TEST_STUDENTS) {
    const existingUser = await prisma.user.findUnique({
      where: { email: student.email },
    });

    if (existingUser) {
      console.log(`  ✓ ${student.email} already exists (ID: ${existingUser.id})`);
      continue;
    }

    const wallet = generateWalletFromEmail(student.email);
    const user = await prisma.user.create({
      data: {
        email: student.email,
        name: student.name,
        role: student.role,
        walletAddress: wallet,
        googleId: `google_${Math.random().toString(36).substr(2, 9)}`,
      },
    });

    console.log(`  ✓ Created: ${student.email}`);
    console.log(`    Wallet: ${wallet}`);
    console.log(`    Role: ${user.role}`);
  }
}

/**
 * Create test employer users
 */
async function createTestEmployers() {
  console.log('\n💼 Creating test employers...');
  
  for (const employer of TEST_EMPLOYERS) {
    const existingUser = await prisma.user.findUnique({
      where: { email: employer.email },
    });

    if (existingUser) {
      console.log(`  ✓ ${employer.email} already exists (ID: ${existingUser.id})`);
      continue;
    }

    const wallet = generateWalletFromEmail(employer.email);
    const user = await prisma.user.create({
      data: {
        email: employer.email,
        name: employer.name,
        role: employer.role,
        walletAddress: wallet,
        googleId: `google_${Math.random().toString(36).substr(2, 9)}`,
      },
    });

    console.log(`  ✓ Created: ${employer.email}`);
    console.log(`    Wallet: ${wallet}`);
    console.log(`    Role: ${user.role}`);
  }
}

/**
 * Create test institution signup requests
 */
async function createTestInstitutions() {
  console.log('\n🏫 Creating test institution signups...');
  
  for (const inst of TEST_INSTITUTIONS) {
    const existingSignup = await prisma.institutionSignup.findUnique({
      where: { adminEmail: inst.adminEmail },
    });

    if (existingSignup) {
      console.log(`  ✓ ${inst.name} already exists`);
      console.log(`    Status: ${existingSignup.status}`);
      console.log(`    Verification Token: ${existingSignup.verificationToken}`);
      continue;
    }

    const passwordHash = crypto
      .createHash('sha256')
      .update(`test_password_${inst.domain}`)
      .digest('hex');

    const verificationToken = crypto.randomUUID();

    const signup = await prisma.institutionSignup.create({
      data: {
        institutionName: inst.name,
        adminEmail: inst.adminEmail,
        adminName: inst.adminName,
        domain: inst.domain,
        passwordHash,
        verificationToken,
        status: 'verified', // Auto-verify for testing
      },
    });

    console.log(`  ✓ Created: ${inst.name}`);
    console.log(`    Admin: ${inst.adminEmail}`);
    console.log(`    Domain: ${inst.domain}`);
    console.log(`    Status: ${signup.status}`);
    console.log(`    Verify Token: ${verificationToken}`);
  }
}

/**
 * Create approved institutions
 */
async function approveInstitutions() {
  console.log('\n✅ Approving institutions...');
  
  for (const inst of TEST_INSTITUTIONS) {
    const signup = await prisma.institutionSignup.findUnique({
      where: { adminEmail: inst.adminEmail },
    });

    if (!signup) {
      console.log(`  ⚠ ${inst.name} signup not found`);
      continue;
    }

    const existingInstitution = await prisma.institution.findFirst({
      where: { name: inst.name },
    });

    if (existingInstitution) {
      console.log(`  ✓ ${inst.name} already approved`);
      console.log(`    On-chain ready: Yes`);
      continue;
    }

    const institution = await prisma.institution.create({
      data: {
        name: inst.name,
        metadataURI: `https://${inst.domain}`,
        active: true,
      },
    });

    await prisma.institutionSignup.update({
      where: { id: signup.id },
      data: { status: 'approved' },
    });

    console.log(`  ✓ Approved: ${inst.name}`);
    console.log(`    Database ID: ${institution.id}`);
    console.log(`    Ready for credentials: Yes`);
  }
}

/**
 * Create test credentials
 */
async function createTestCredentials() {
  console.log('\n🎓 Creating test credentials...');

  const institution = await prisma.institution.findFirst({
    where: { name: 'Harvard University' },
  });

  const student = await prisma.user.findUnique({
    where: { email: 'student1@gmail.com' },
  });

  if (!institution || !student) {
    console.log('  ⚠ Institution or student not found - skipping credentials');
    return;
  }

  // Create a credential record
  const credential = await prisma.credential.create({
    data: {
      institutionId: institution.id,
      studentEmail: student.email,
      credentialType: 'Bachelor of Science',
      credentialField: 'Computer Science',
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      description: 'Bachelor of Science in Computer Science',
      ipfsCid: 'QmTestCredential123456',
    },
  });

  console.log(`  ✓ Created credential for ${student.name}`);
  console.log(`    Type: ${credential.credentialType}`);
  console.log(`    Field: ${credential.credentialField}`);
  console.log(`    Issued: ${credential.issuedAt.toLocaleDateString()}`);
}

/**
 * Create test reward records
 */
async function createTestRewards() {
  console.log('\n🎁 Creating test reward records...');

  const student = await prisma.user.findUnique({
    where: { email: 'student1@gmail.com' },
  });

  if (!student) {
    console.log('  ⚠ Student not found - skipping rewards');
    return;
  }

  const reward = await prisma.tokenReward.create({
    data: {
      address: student.walletAddress || '',
      amount: '10',
      reason: 'SHARE_CREDENTIAL',
      status: 'confirmed',
    },
  });

  console.log(`  ✓ Created reward for ${student.email}`);
  console.log(`    Amount: 10 EDU`);
  console.log(`    Reason: SHARE_CREDENTIAL`);
  console.log(`    Status: ${reward.status}`);
}

/**
 * Print summary report
 */
async function printSummaryReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST DATA SUMMARY');
  console.log('='.repeat(60));

  const userCount = await prisma.user.count();
  const institutionCount = await prisma.institutionSignup.count();
  const credentialCount = await prisma.credential.count();
  const rewardCount = await prisma.tokenReward.count();

  console.log(`\n📈 Database Stats:`);
  console.log(`  • Total Users: ${userCount}`);
  console.log(`  • Institution Signups: ${institutionCount}`);
  console.log(`  • Credentials: ${credentialCount}`);
  console.log(`  • Token Rewards: ${rewardCount}`);

  console.log(`\n👥 Test Users:`);
  const users = await prisma.user.findMany({
    take: 10,
    select: { email: true, role: true, walletAddress: true },
  });
  for (const user of users) {
    console.log(`  • ${user.email} (${user.role})`);
    console.log(`    └─ Wallet: ${user.walletAddress}`);
  }

  console.log(`\n🏫 Test Institutions:`);
  const institutions = await prisma.institutionSignup.findMany({
    take: 5,
    select: { institutionName: true, status: true, adminEmail: true },
  });
  for (const inst of institutions) {
    console.log(`  • ${inst.institutionName}`);
    console.log(`    └─ Status: ${inst.status}`);
    console.log(`    └─ Admin: ${inst.adminEmail}`);
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🚀 EduChain Test Data Generator');
  console.log('================================\n');

  try {
    // Create test users
    await createTestStudents();
    await createTestEmployers();
    
    // Create institution signups
    await createTestInstitutions();
    
    // Approve institutions
    await approveInstitutions();
    
    // Create credentials and rewards
    await createTestCredentials();
    await createTestRewards();
    
    // Print summary
    await printSummaryReport();

    console.log('\n✅ Test data created successfully!\n');
    console.log('🧪 Next steps:');
    console.log('  1. Start backend: npm run dev');
    console.log('  2. Start frontend: npm run dev');
    console.log('  3. Visit http://localhost:3000/login');
    console.log('  4. Try logging in with test emails (no Google OAuth needed)');
    console.log('  5. Check dashboards for test data\n');

  } catch (error) {
    console.error('\n❌ Error creating test data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
