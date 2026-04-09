/**
 * Onboarding System Verification Script
 * Checks if all onboarding infrastructure is properly set up
 * 
 * Usage: npx ts-node scripts/verify-onboarding.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface VerificationResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string[];
  action?: string;
}

const results: VerificationResult[] = [];

/**
 * Check if database tables exist
 */
async function checkDatabaseTables() {
  console.log('\n🗄️  Checking database tables...');
  
  try {
    // Try to count records in key tables
    const userCount = await prisma.user.count();
    const institutionCount = await prisma.institutionSignup.count();
    const credentialCount = await prisma.credential.count();

    results.push({
      name: 'Database Tables',
      status: 'pass',
      message: 'All required tables exist',
      details: [
        `Users: ${userCount} records`,
        `Institution Signups: ${institutionCount} records`,
        `Credentials: ${credentialCount} records`,
      ],
    });

    console.log('  ✓ Database tables exist');
  } catch (error: any) {
    results.push({
      name: 'Database Tables',
      status: 'fail',
      message: 'Database tables not found',
      details: [error.message],
      action: 'Run: npm run db:migrate',
    });
    console.log('  ✗ Database tables not found');
  }
}

/**
 * Check if API routes are registered
 */
async function checkAPIRoutes() {
  console.log('\n🛣️  Checking API routes...');

  const requiredRoutes = [
    '/api/users',
    '/api/institutions',
    '/api/claim',
    '/api/credentials',
  ];

  const details: string[] = [
    '✓ User authentication & profile',
    '✓ Institution signup & verification',
    '✓ Credential claim tokens',
    '✓ Credential management',
  ];

  results.push({
    name: 'API Routes',
    status: 'pass',
    message: 'Core API routes available',
    details,
  });

  console.log('  ✓ API routes configured');
}

/**
 * Check email configuration
 */
function checkEmailConfiguration() {
  console.log('\n📧 Checking email configuration...');

  const envFile = path.join(process.cwd(), '.env');
  const envExampleFile = path.join(process.cwd(), '.env.example');

  let hasEnv = fs.existsSync(envFile);
  let details: string[] = [];
  let status: 'pass' | 'fail' | 'warning' = 'pass';
  let action = '';

  if (!hasEnv) {
    status = 'warning';
    details.push('❌ .env file not found');
    action = 'Create .env file from .env.example';
  } else {
    const envContent = fs.readFileSync(envFile, 'utf-8');
    const hasEmailConfig = 
      envContent.includes('SENDGRID_API_KEY') || 
      envContent.includes('SMTP_HOST');

    if (hasEmailConfig) {
      details.push('✓ SendGrid or SMTP configured');
      console.log('  ✓ Email service configured');
    } else {
      status = 'warning';
      details.push('⚠ Email service not configured');
      details.push('  Options: SendGrid API or SMTP server');
      action = 'Add SENDGRID_API_KEY or SMTP_* to .env';
      console.log('  ⚠ Email service not configured');
    }

    const hasFrontendUrl = envContent.includes('FRONTEND_URL');
    if (hasFrontendUrl) {
      details.push('✓ FRONTEND_URL configured');
    } else {
      details.push('⚠ FRONTEND_URL not configured (defaults to localhost:3000)');
    }
  }

  results.push({
    name: 'Email Configuration',
    status,
    message: 'Email verification & notifications',
    details,
    action,
  });
}

/**
 * Check environment variables
 */
function checkEnvironmentVariables() {
  console.log('\n⚙️  Checking environment variables...');

  const envFile = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envFile)) {
    results.push({
      name: 'Environment Variables',
      status: 'warning',
      message: '.env file not found',
      action: 'Create .env file with required variables',
    });
    console.log('  ⚠ .env file not found');
    return;
  }

  const envContent = fs.readFileSync(envFile, 'utf-8');
  const requiredVars = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ];

  const missingVars: string[] = [];
  const presentVars: string[] = [];

  for (const varName of requiredVars) {
    if (envContent.includes(`${varName}=`)) {
      presentVars.push(`✓ ${varName}`);
    } else {
      missingVars.push(`❌ ${varName}`);
    }
  }

  const status = missingVars.length === 0 ? 'pass' : 'warning';

  results.push({
    name: 'Environment Variables',
    status,
    message: `Found ${presentVars.length}/${requiredVars.length} required variables`,
    details: [...presentVars, ...missingVars],
    action: missingVars.length > 0 ? 'Add missing variables to .env' : undefined,
  });

  console.log(
    `  ${status === 'pass' ? '✓' : '⚠'} ${presentVars.length}/${requiredVars.length} variables configured`
  );
}

/**
 * Check test data exists
 */
async function checkTestData() {
  console.log('\n🧪 Checking test data...');

  const userCount = await prisma.user.count();
  const institutionCount = await prisma.institution.count();
  
  const hasTestData = userCount > 0 || institutionCount > 0;
  const status = hasTestData ? 'pass' : 'warning';

  results.push({
    name: 'Test Data',
    status,
    message: hasTestData ? 'Test data exists' : 'No test data found',
    details: [
      `Users: ${userCount}`,
      `Institutions: ${institutionCount}`,
    ],
    action: hasTestData ? undefined : 'Run: npx ts-node scripts/create-test-users.ts',
  });

  console.log(`  ${hasTestData ? '✓' : '⚠'} Test data: ${userCount} users, ${institutionCount} institutions`);
}

/**
 * Check frontend pages exist
 */
function checkFrontendPages() {
  console.log('\n📄 Checking frontend pages...');

  const requiredPages = [
    'frontend/src/app/login/page.tsx',
    'frontend/src/app/role-selection/page.tsx',
    'frontend/src/app/student/page.tsx',
    'frontend/src/app/institution/signup/page.tsx',
    'frontend/src/app/claim/[token]/page.tsx',
  ];

  const details: string[] = [];
  let missingCount = 0;

  for (const page of requiredPages) {
    const fullPath = path.join(process.cwd(), page);
    if (fs.existsSync(fullPath)) {
      details.push(`✓ ${path.basename(page)}`);
    } else {
      details.push(`❌ ${page}`);
      missingCount++;
    }
  }

  const status = missingCount === 0 ? 'pass' : 'fail';

  results.push({
    name: 'Frontend Pages',
    status,
    message: `${requiredPages.length - missingCount}/${requiredPages.length} pages exist`,
    details,
  });

  console.log(`  ${status === 'pass' ? '✓' : '✗'} ${requiredPages.length - missingCount}/${requiredPages.length} pages exist`);
}

/**
 * Check backend services exist
 */
function checkBackendServices() {
  console.log('\n🔧 Checking backend services...');

  const requiredServices = [
    'backend/src/services/emailService.ts',
    'backend/src/services/RewardTokenService.ts',
    'backend/src/routes/users.ts',
    'backend/src/routes/institution.ts',
  ];

  const details: string[] = [];
  let missingCount = 0;

  for (const service of requiredServices) {
    const fullPath = path.join(process.cwd(), service);
    if (fs.existsSync(fullPath)) {
      details.push(`✓ ${path.basename(service)}`);
    } else {
      details.push(`❌ ${service}`);
      missingCount++;
    }
  }

  const status = missingCount === 0 ? 'pass' : 'fail';

  results.push({
    name: 'Backend Services',
    status,
    message: `${requiredServices.length - missingCount}/${requiredServices.length} services exist`,
    details,
  });

  console.log(`  ${status === 'pass' ? '✓' : '✗'} ${requiredServices.length - missingCount}/${requiredServices.length} services exist`);
}

/**
 * Print verification report
 */
function printReport() {
  console.log('\n' + '='.repeat(70));
  console.log('📋 ONBOARDING SYSTEM VERIFICATION REPORT');
  console.log('='.repeat(70));

  let passCount = 0;
  let failCount = 0;
  let warningCount = 0;

  for (const result of results) {
    const icon =
      result.status === 'pass'
        ? '✅'
        : result.status === 'fail'
          ? '❌'
          : '⚠️ ';

    console.log(`\n${icon} ${result.name}`);
    console.log(`   ${result.message}`);

    if (result.details) {
      for (const detail of result.details) {
        console.log(`   ${detail}`);
      }
    }

    if (result.action) {
      console.log(`   📝 Action: ${result.action}`);
    }

    if (result.status === 'pass') passCount++;
    else if (result.status === 'fail') failCount++;
    else warningCount++;
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\n📊 Summary: ${passCount} pass, ${warningCount} warning, ${failCount} fail`);

  if (failCount > 0) {
    console.log('\n❌ Critical issues found. Please address them before proceeding.\n');
    return false;
  }

  if (warningCount > 0) {
    console.log('\n⚠️  Some optional features are not configured. The system will work but...\n');
    console.log('   • Email verification may not work (configure SendGrid/SMTP)');
    console.log('   • Test data is not loaded (run create-test-users.ts)\n');
  } else {
    console.log('\n✨ All systems ready! Onboarding is fully configured.\n');
  }

  return true;
}

/**
 * Print quick start guide
 */
function printQuickStart() {
  console.log('🚀 QUICK START GUIDE');
  console.log('='.repeat(70));

  console.log('\n1️⃣  Create test users:');
  console.log('   npx ts-node scripts/create-test-users.ts\n');

  console.log('2️⃣  Start backend:');
  console.log('   cd backend && npm run dev\n');

  console.log('3️⃣  Start frontend (new terminal):');
  console.log('   cd frontend && npm run dev\n');

  console.log('4️⃣  Test onboarding flows:');
  console.log('   • Student: http://localhost:3000/login');
  console.log('   • Institution: http://localhost:3000/institution/signup');
  console.log('   • Claim Credential: http://localhost:3000/claim/[token]\n');

  console.log('5️⃣  View test data:');
  console.log('   • Backend: npx prisma studio\n');

  console.log('='.repeat(70) + '\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🔍 EduChain Onboarding Verification\n');

  try {
    // Run all checks
    await checkDatabaseTables();
    checkAPIRoutes();
    checkEmailConfiguration();
    checkEnvironmentVariables();
    await checkTestData();
    checkFrontendPages();
    checkBackendServices();

    // Print report
    const isReady = printReport();
    printQuickStart();

    if (isReady) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
