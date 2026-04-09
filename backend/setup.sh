#!/bin/bash
# EduChain Phase 2 Setup Script
# Runs database migrations and initializes the development environment

set -e  # Exit on error

echo "🚀 EduChain Phase 2 Database Setup"
echo "===================================="

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Run this script from the backend directory"
  echo "   cd backend && bash setup.sh"
  exit 1
fi

echo ""
echo "📦 Step 1: Installing dependencies..."
npm install

echo ""
echo "🔧 Step 2: Generating Prisma client..."
npx prisma generate

echo ""
echo "📊 Step 3: Running database migrations..."
if [ "$1" = "--fresh" ]; then
  echo "⚠️  Fresh migration detected - resetting database..."
  npx prisma migrate reset --force
else
  npx prisma migrate dev --name init
fi

echo ""
echo "✅ Step 4: Database setup complete!"
echo ""
echo "🎯 Next steps:"
echo "   1. Start backend:  npm run dev"
echo "   2. Start frontend: cd ../frontend && npm run dev"
echo "   3. Visit:          http://localhost:3000"
echo ""
echo "📋 To view database contents:"
echo "   npx prisma studio"
echo ""

