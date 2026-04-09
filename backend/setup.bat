@echo off
REM EduChain Phase 2 Setup Script (Windows)
REM Runs database migrations and initializes the development environment

setlocal enabledelayedexpansion

echo.
echo 🚀 EduChain Phase 2 Database Setup
echo ====================================

REM Check if we're in the backend directory
if not exist "package.json" (
  echo ❌ Error: Run this script from the backend directory
  echo    cd backend ^&^& setup.bat
  exit /b 1
)

echo.
echo 📦 Step 1: Installing dependencies...
call npm install

if !ERRORLEVEL! neq 0 (
  echo ❌ Error: npm install failed
  exit /b 1
)

echo.
echo 🔧 Step 2: Generating Prisma client...
call npx prisma generate

if !ERRORLEVEL! neq 0 (
  echo ❌ Error: Prisma generate failed
  exit /b 1
)

echo.
echo 📊 Step 3: Running database migrations...

if "%1"=="--fresh" (
  echo ⚠️  Fresh migration detected - resetting database...
  call npx prisma migrate reset --force
) else (
  call npx prisma migrate dev --name init
)

if !ERRORLEVEL! neq 0 (
  echo ❌ Error: Migration failed
  echo Troubleshooting:
  echo   - Check if DATABASE_URL is set correctly in .env
  echo   - Ensure your database is running
  echo   - Try with --fresh flag: setup.bat --fresh
  exit /b 1
)

echo.
echo ✅ Step 4: Database setup complete!
echo.
echo 🎯 Next steps:
echo    1. Start backend:  npm run dev
echo    2. Start frontend: cd ..\frontend ^&^& npm run dev
echo    3. Visit:          http://localhost:3000
echo.
echo 📋 To view database contents:
echo    npx prisma studio
echo.

pause
