/**
 * EduChain Analytics Backend Server
 * Handles verification logs, analytics, and API endpoints
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import rateLimit from 'express-rate-limit';

import { verifyRoute } from './routes/verify';
import { analyticsRoute } from './routes/analytics';
import { ipfsRoute } from './routes/ipfs';
import { auditRoute } from './routes/audit';
import { claimRoute } from './routes/claim';
import { institutionRoute } from './routes/institution';
import { shareRoute } from './routes/share';
import { bulkImportRoute } from './routes/bulk-import';
import { adminRoute } from './routes/admin';
import usersRouter from './routes/users';
import { eventListenerService } from './services/eventListener';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/verify', verifyRoute(prisma));
app.use('/api/analytics', analyticsRoute(prisma));
app.use('/api/ipfs', ipfsRoute());
app.use('/api/audit', auditRoute(prisma));
app.use('/api/claim', claimRoute(prisma));
app.use('/api/institutions', institutionRoute(prisma));
app.use('/api/share', shareRoute(prisma));
app.use('/api/bulk-import', bulkImportRoute(prisma));
app.use('/api/users', usersRouter);
app.use('/api/admin', adminRoute(prisma));

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start event listener service
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL;

if (CONTRACT_ADDRESS && RPC_URL) {
  eventListenerService(prisma, CONTRACT_ADDRESS, RPC_URL).catch(console.error);
} else {
  console.warn('⚠️  Contract address or RPC URL not set. Event listener disabled.');
}

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 EduChain Analytics Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Verify API: http://localhost:${PORT}/api/verify`);
  console.log(`📦 IPFS API: http://localhost:${PORT}/api/ipfs`);
  console.log(`📈 Analytics API: http://localhost:${PORT}/api/analytics`);
  console.log(`📋 Audit API: http://localhost:${PORT}/api/audit`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await prisma.$disconnect();
  process.exit(0);
});

export default app;

