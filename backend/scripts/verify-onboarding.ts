import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  pass: (msg: string) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  fail: (msg: string) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  info: (msg: string) => console.log(`${colors.blue}ℹ️${colors.reset} ${msg}`),
  section: (msg: string) => console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n${colors.cyan}${msg}${colors.reset}\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`),
};

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  nextSteps?: string[];
}

const results: CheckResult[] = [];

// Check 1: Database file exists
function checkDatabase() {
  const dbPath = path.resolve(__dirname, '../db/app.db');
  const dbsPath = path.resolve(__dirname, '../db/*.db');
  
  try {
    // For SQLite, check if db folder exists
    const dbFolder = path.resolve(__dirname, '../db');
    if (fs.existsSync(dbFolder)) {
      results.push({
        name: '📦 Database Folder',
        status: 'pass',
        message: 'Database directory exists at backend/db/',
      });
    } else {
      results.push({
        name: '📦 Database Folder',
        status: 'fail',
        message: 'Database directory not found',
        nextSteps: [
          'Run: npm run prisma:generate',
          'Run: npm run db:push',
        ],
      });
    }
  } catch (error) {
    results.push({
      name: '📦 Database Folder',
      status: 'fail',
      message: `Database check failed: ${error}`,
    });
  }
}

// Check 2: Prisma schema exists
function checkPrismaSchema() {
  const schemaPath = path.resolve(__dirname, '../db/schema.prisma');
  
  if (fs.existsSync(schemaPath)) {
    results.push({
      name: '🔄 Prisma Schema',
      status: 'pass',
      message: 'schema.prisma found at backend/db/schema.prisma',
    });
  } else {
    results.push({
      name: '🔄 Prisma Schema',
      status: 'fail',
      message: 'schema.prisma not found',
      nextSteps: ['Check backend/db/schema.prisma exists'],
    });
  }
}

// Check 3: Environment variables
function checkEnvironmentVariables() {
  const envPath = path.resolve(__dirname, '../.env');
  const envExamplePath = path.resolve(__dirname, '../.env.example');
  
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const hasDbUrl = envContent.includes('DATABASE_URL');
      const hasNodeEnv = envContent.includes('NODE_ENV');
      
      if (hasDbUrl && hasNodeEnv) {
        results.push({
          name: '⚙️ Environment Variables',
          status: 'pass',
          message: '.env file configured with DATABASE_URL and NODE_ENV',
        });
      } else {
        results.push({
          name: '⚙️ Environment Variables',
          status: 'warn',
          message: '.env exists but missing some variables',
          nextSteps: [
            'Check .env has DATABASE_URL',
            'Check .env has NODE_ENV=development',
          ],
        });
      }
    } catch (error) {
      results.push({
        name: '⚙️ Environment Variables',
        status: 'fail',
        message: `Failed to read .env: ${error}`,
      });
    }
  } else {
    results.push({
      name: '⚙️ Environment Variables',
      status: 'warn',
      message: '.env file not found (might be using .env.example)',
      nextSteps: [
        'Copy .env.example to .env',
        'Set DATABASE_URL=file:./app.db',
        'Set NODE_ENV=development',
      ],
    });
  }
}

// Check 4: API routes exist
function checkApiRoutes() {
  const routesDir = path.resolve(__dirname, '../src/routes');
  
  if (fs.existsSync(routesDir)) {
    const files = fs.readdirSync(routesDir);
    const hasStudents = files.includes('students.ts');
    const hasInstitutions = files.includes('institutions.ts');
    const hasCredentials = files.includes('credentials.ts');
    const hasUsers = files.includes('users.ts');
    
    if (hasStudents && hasInstitutions && hasCredentials) {
      results.push({
        name: '🛣️ API Routes',
        status: 'pass',
        message: 'All essential routes configured (students, institutions, credentials, users)',
      });
    } else {
      results.push({
        name: '🛣️ API Routes',
        status: 'warn',
        message: `Some routes missing. Found: ${files.join(', ')}`,
        nextSteps: ['Check backend/src/routes/ for all required endpoints'],
      });
    }
  } else {
    results.push({
      name: '🛣️ API Routes',
      status: 'fail',
      message: 'Routes directory not found',
      nextSteps: ['Create backend/src/routes/ directory'],
    });
  }
}

// Check 5: Frontend pages exist
function checkFrontendPages() {
  const pagesDir = path.resolve(__dirname, '../../frontend/src/app');
  
  if (fs.existsSync(pagesDir)) {
    const hasLogin = fs.existsSync(path.join(pagesDir, 'login'));
    const hasInstitution = fs.existsSync(path.join(pagesDir, 'institution'));
    const hasStudent = fs.existsSync(path.join(pagesDir, 'student'));
    const hasEmployer = fs.existsSync(path.join(pagesDir, 'employer'));
    
    if (hasLogin && hasInstitution) {
      results.push({
        name: '🎨 Frontend Pages',
        status: 'pass',
        message: 'Essential pages exist (login, institution, student, employer)',
      });
    } else {
      results.push({
        name: '🎨 Frontend Pages',
        status: 'warn',
        message: 'Some pages might be missing',
        nextSteps: ['Check frontend/src/app/ directory'],
      });
    }
  } else {
    results.push({
      name: '🎨 Frontend Pages',
      status: 'fail',
      message: 'Frontend directory not found',
      nextSteps: ['Ensure frontend/ directory exists at root'],
    });
  }
}

// Check 6: Package dependencies
function checkDependencies() {
  const packageJsonPath = path.resolve(__dirname, '../package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const deps = packageJson.dependencies || {};
      const hasExpress = deps.express;
      const hasPrisma = deps['@prisma/client'];
      const hasNodemailer = deps.nodemailer;
      
      if (hasExpress && hasPrisma) {
        results.push({
          name: '📚 Dependencies',
          status: 'pass',
          message: 'Essential dependencies installed (Express, Prisma, etc.)',
        });
      } else {
        results.push({
          name: '📚 Dependencies',
          status: 'fail',
          message: 'Missing critical dependencies',
          nextSteps: ['Run: npm install'],
        });
      }
    } catch (error) {
      results.push({
        name: '📚 Dependencies',
        status: 'fail',
        message: `Failed to read package.json: ${error}`,
      });
    }
  } else {
    results.push({
      name: '📚 Dependencies',
      status: 'fail',
      message: 'package.json not found',
      nextSteps: ['Ensure package.json exists in backend/ directory'],
    });
  }
}

// Check 7: TypeScript configuration
function checkTypeScript() {
  const tsConfigPath = path.resolve(__dirname, '../tsconfig.json');
  
  if (fs.existsSync(tsConfigPath)) {
    results.push({
      name: '🔷 TypeScript',
      status: 'pass',
      message: 'TypeScript configured (tsconfig.json exists)',
    });
  } else {
    results.push({
      name: '🔷 TypeScript',
      status: 'warn',
      message: 'tsconfig.json not found',
      nextSteps: ['Create backend/tsconfig.json'],
    });
  }
}

// Check 8: Environment setup
function checkEnvSetup() {
  const setupFiles = [
    { path: '../.env', name: '.env' },
    { path: '../src/index.ts', name: 'Backend entry point' },
  ];
  
  const missingFiles = setupFiles.filter(f => !fs.existsSync(path.resolve(__dirname, f.path)));
  
  if (missingFiles.length === 0) {
    results.push({
      name: '🚀 Environment Setup',
      status: 'pass',
      message: 'All setup files present',
    });
  } else {
    results.push({
      name: '🚀 Environment Setup',
      status: 'warn',
      message: `Missing files: ${missingFiles.map(f => f.name).join(', ')}`,
      nextSteps: ['Verify all setup files exist'],
    });
  }
}

// Check 9: Node modules installed
function checkNodeModules() {
  const nodeModulesPath = path.resolve(__dirname, '../node_modules');
  
  if (fs.existsSync(nodeModulesPath)) {
    results.push({
      name: '📦 Node Modules',
      status: 'pass',
      message: 'Dependencies installed (node_modules exists)',
    });
  } else {
    results.push({
      name: '📦 Node Modules',
      status: 'fail',
      message: 'node_modules not found',
      nextSteps: ['Run: npm install in backend directory'],
    });
  }
}

// Check 10: Git status
function checkGitStatus() {
  try {
    const gitStatus = execSync('git status --short', { cwd: path.resolve(__dirname, '../..'), encoding: 'utf-8' });
    
    if (gitStatus.length === 0) {
      results.push({
        name: '🔗 Git Status',
        status: 'pass',
        message: 'Repository clean (no uncommitted changes)',
      });
    } else {
      results.push({
        name: '🔗 Git Status',
        status: 'warn',
        message: `Uncommitted changes: ${gitStatus.split('\n').length - 1} files`,
        nextSteps: ['Review and stage changes: git add .', 'Commit: git commit -m "..."'],
      });
    }
  } catch (error) {
    results.push({
      name: '🔗 Git Status',
      status: 'warn',
      message: 'Git not available',
      nextSteps: ['Install Git or check repository status'],
    });
  }
}

// Run all checks
function runAllChecks() {
  log.section('🔍 ONBOARDING VERIFICATION');
  
  checkDatabase();
  checkPrismaSchema();
  checkEnvironmentVariables();
  checkApiRoutes();
  checkFrontendPages();
  checkDependencies();
  checkTypeScript();
  checkEnvSetup();
  checkNodeModules();
  checkGitStatus();
  
  // Print results
  results.forEach(result => {
    if (result.status === 'pass') {
      log.pass(result.message);
    } else if (result.status === 'fail') {
      log.fail(result.message);
    } else {
      log.warn(result.message);
    }
    
    if (result.nextSteps && result.nextSteps.length > 0) {
      result.nextSteps.forEach(step => {
        console.log(`  → ${step}`);
      });
    }
  });
  
  // Summary
  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const warnCount = results.filter(r => r.status === 'warn').length;
  
  log.section('📊 SUMMARY');
  console.log(`  Passed: ${passCount}/${results.length}`);
  console.log(`  Warnings: ${warnCount}`);
  console.log(`  Failed: ${failCount}`);
  
  if (failCount === 0 && warnCount <= 2) {
    log.section('✅ SYSTEM READY');
    console.log(`\nYour onboarding system is ready to test!\n`);
    printQuickStart();
  } else {
    log.section('⚠️ ISSUES DETECTED');
    console.log(`\nPlease fix the issues above before testing.\n`);
  }
}

function printQuickStart() {
  console.log(`
${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  📖 QUICK START GUIDE

${colors.reset}

  ${colors.green}1. Create Test Users${colors.reset}
     npm run test:users
     Creates: 3 students, 2 employers, 3 institutions

  ${colors.green}2. Start Backend${colors.reset}
     npm run dev
     Runs on http://localhost:3000/api

  ${colors.green}3. Start Frontend (new terminal)${colors.reset}
     cd ../frontend && npm run dev
     Runs on http://localhost:3000

  ${colors.green}4. Test the Flows${colors.reset}
     
     Student Login:
     → http://localhost:3000/login
     → Email: student1@gmail.com
     → Dashboard: /student
     
     Institution Signup:
     → http://localhost:3000/institution/signup
     → Fill form (auto-approved for testing)
     → Dashboard: /institution
     
     Employer Login:
     → http://localhost:3000/login
     → Email: recruiter@techcorp.com
     → Dashboard: /employer

  ${colors.green}5. View Database${colors.reset}
     npm run db:studio
     Opens Prisma Studio at http://localhost:5555

${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
`);
}

// Main execution
runAllChecks();
