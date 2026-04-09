import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Test data
const TEST_STUDENTS = [
  { email: 'student1@example.com', name: 'Alice Johnson' },
  { email: 'student2@example.com', name: 'Bob Smith' },
  { email: 'student3@example.com', name: 'Carol White' },
];

const TEST_EMPLOYERS = [
  { email: 'recruiter@techcorp.com', name: 'John Recruiter', company: 'Tech Corp' },
  { email: 'hr@finance.com', name: 'Sarah HR', company: 'Finance Inc' },
];

const TEST_INSTITUTIONS = [
  {
    name: 'Harvard University',
    address: '0xHarvard123456789012345678901234567890',
    adminEmail: 'admin@harvard.edu',
    domain: 'harvard.edu',
  },
  {
    name: 'MIT',
    address: '0xMIT1234567890123456789012345678901234',
    adminEmail: 'admin@mit.edu',
    domain: 'mit.edu',
  },
  {
    name: 'Stanford University',
    address: '0xStanford123456789012345678901234567890',
    adminEmail: 'admin@stanford.edu',
    domain: 'stanford.edu',
  },
];

// Helper function to generate deterministic wallet from email
function generateWalletFromEmail(email: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(email)
    .digest('hex');
  return '0x' + hash.substring(0, 40);
}

// Color helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
};

async function createTestStudents() {
  console.log(`\n${colors.cyan}Creating student accounts...${colors.reset}`);

  for (const student of TEST_STUDENTS) {
    const wallet = generateWalletFromEmail(student.email);

    try {
      const user = await prisma.user.upsert({
        where: { email: student.email },
        update: {
          name: student.name,
          role: 'student',
          walletAddress: wallet,
        },
        create: {
          email: student.email,
          name: student.name,
          role: 'student',
          walletAddress: wallet,
        },
      });

      console.log(
        `  ${colors.green}✓${colors.reset} ${student.name} (${student.email})`
      );
      console.log(`    Wallet: ${wallet}`);
    } catch (error) {
      console.error(`  Error creating student: ${error}`);
    }
  }
}

async function createTestEmployers() {
  console.log(`\n${colors.cyan}Creating employer accounts...${colors.reset}`);

  for (const employer of TEST_EMPLOYERS) {
    const wallet = generateWalletFromEmail(employer.email);

    try {
      const user = await prisma.user.upsert({
        where: { email: employer.email },
        update: {
          name: employer.name,
          role: 'employer',
          walletAddress: wallet,
        },
        create: {
          email: employer.email,
          name: employer.name,
          role: 'employer',
          walletAddress: wallet,
        },
      });

      console.log(`  ${colors.green}✓${colors.reset} ${employer.name} (${employer.email})`);
      console.log(`    Company: ${employer.company}`);
      console.log(`    Wallet: ${wallet}`);
    } catch (error) {
      console.error(`  Error creating employer: ${error}`);
    }
  }
}

async function createTestInstitutions() {
  console.log(`\n${colors.cyan}Creating institutions...${colors.reset}`);

  for (const inst of TEST_INSTITUTIONS) {
    try {
      // Only set fields that exist in the schema
      const institution = await prisma.institution.upsert({
        where: { address: inst.address },
        update: {
          name: inst.name,
        },
        create: {
          name: inst.name,
          address: inst.address,
          status: 'approved',
          active: true,
        },
      });

      console.log(`  ${colors.green}✓${colors.reset} ${inst.name}`);
      console.log(`    Address: ${inst.address}`);
      console.log(`    Status: approved`);
    } catch (error) {
      console.error(`  Error creating institution: ${error}`);
    }
  }
}

async function createTestInstitutionSignups() {
  console.log(`\n${colors.cyan}Creating institution signups...${colors.reset}`);

  for (const inst of TEST_INSTITUTIONS) {
    try {
      // Only set fields that exist in the schema (no institutionCode)
      const signup = await prisma.institutionSignup.upsert({
        where: { adminEmail: inst.adminEmail },
        update: {
          institutionName: inst.name,
          domain: inst.domain,
          status: 'verified',
        },
        create: {
          institutionName: inst.name,
          adminEmail: inst.adminEmail,
          adminName: inst.name + ' Admin',
          domain: inst.domain,
          passwordHash: 'hashed_test_password',
          verificationToken: crypto.randomUUID(),
          status: 'verified',
        },
      });

      console.log(`  ${colors.green}✓${colors.reset} ${inst.name} signup recorded`);
      console.log(`    Email: ${inst.adminEmail}`);
      console.log(`    Status: verified`);
    } catch (error) {
      console.error(`  Error creating institution signup: ${error}`);
    }
  }
}

async function createTestRewards() {
  console.log(`\n${colors.cyan}Creating sample reward records...${colors.reset}`);

  try {
    // Institution earning for issuance
    const harvard = await prisma.institution.findFirst({
      where: { name: 'Harvard University' },
    });

    if (harvard && harvard.address) {
      const institutionReward = await prisma.tokenReward.upsert({
        where: {
          recipientAddress_reason: {
            recipientAddress: harvard.address,
            reason: 'CREDENTIAL_ISSUED',
          },
        },
        update: {},
        create: {
          recipientAddress: harvard.address,
          amount: 5,
          reason: 'CREDENTIAL_ISSUED',
          status: 'pending',
        },
      });

      console.log(
        `  ${colors.green}✓${colors.reset} Harvard: 5 EDU tokens for issuing`
      );
    }

    // Student earning for participation
    for (const student of TEST_STUDENTS) {
      const wallet = generateWalletFromEmail(student.email);
      const studentReward = await prisma.tokenReward.upsert({
        where: {
          recipientAddress_reason: {
            recipientAddress: wallet,
            reason: 'CREDENTIAL_VERIFIED',
          },
        },
        update: {},
        create: {
          recipientAddress: wallet,
          amount: 3,
          reason: 'CREDENTIAL_VERIFIED',
          status: 'pending',
        },
      });

      console.log(
        `  ${colors.green}✓${colors.reset} ${student.name}: 3 EDU tokens for participation`
      );
    }
  } catch (error) {
    console.error(`  Error creating rewards: ${error}`);
  }
}

async function printSummaryReport() {
  console.log(`\n${colors.cyan}════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}   TEST DATA GENERATION COMPLETE${colors.reset}`);
  console.log(`${colors.cyan}════════════════════════════════════════${colors.reset}\n`);

  try {
    const userCount = await prisma.user.count();
    const institutionCount = await prisma.institution.count();
    const signupCount = await prisma.institutionSignup.count();
    const rewardCount = await prisma.tokenReward.count();

    console.log(`${colors.green}Database Summary:${colors.reset}`);
    console.log(`  Users created: ${userCount}`);
    console.log(`  Institutions: ${institutionCount}`);
    console.log(`  Institution signups: ${signupCount}`);
    console.log(`  Reward records: ${rewardCount}`);

    console.log(`\n${colors.green}Test Credentials:${colors.reset}`);
    console.log(`\n  ${colors.yellow}Students:${colors.reset}`);
    for (const student of TEST_STUDENTS) {
      console.log(`    • ${student.name}`);
      console.log(`      Email: ${student.email}`);
      console.log(`      Wallet: ${generateWalletFromEmail(student.email)}`);
    }

    console.log(`\n  ${colors.yellow}Employers:${colors.reset}`);
    for (const employer of TEST_EMPLOYERS) {
      console.log(`    • ${employer.name}`);
      console.log(`      Email: ${employer.email}`);
      console.log(`      Company: ${employer.company}`);
      console.log(`      Wallet: ${generateWalletFromEmail(employer.email)}`);
    }

    console.log(`\n  ${colors.yellow}Institutions (Pre-Approved):${colors.reset}`);
    for (const inst of TEST_INSTITUTIONS) {
      console.log(`    • ${inst.name}`);
      console.log(`      Email: ${inst.adminEmail}`);
      console.log(`      Address: ${inst.address}`);
    }

    console.log(`\n${colors.green}Next Steps:${colors.reset}`);
    console.log(`  1. Start backend: npm run dev`);
    console.log(`  2. Start frontend: cd ../frontend && npm run dev`);
    console.log(`  3. Visit http://localhost:3000`);
    console.log(`  4. Test student login: ${TEST_STUDENTS[0].email}`);
    console.log(`  5. Test employer login: ${TEST_EMPLOYERS[0].email}`);
    console.log(`  6. Check database: npm run db:studio`);

    console.log(`\n${colors.cyan}════════════════════════════════════════${colors.reset}\n`);
  } catch (error) {
    console.error(`Error generating report: ${error}`);
  }
}

async function main() {
  try {
    console.log(`\n${colors.cyan}🎯 CREATING ONBOARDING TEST DATA${colors.reset}\n`);

    await createTestStudents();
    await createTestEmployers();
    await createTestInstitutions();
    await createTestInstitutionSignups();
    await createTestRewards();
    await printSummaryReport();

    console.log(`${colors.green}✓ Test data created successfully!${colors.reset}\n`);
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
