/**
 * Event Listener Service
 * Uses polling-based log scans (eth_getLogs via queryFilter) instead of live filter subscriptions.
 * This avoids unstable eth_getFilterChanges behavior on some Amoy RPC providers.
 */

import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import { ensureCanonicalMeruInstitution } from '../utils/institutionDefaults';

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const POLL_INTERVAL_MS = Number(process.env.EVENT_POLL_INTERVAL_MS || 15_000);
const BLOCK_CONFIRMATIONS = Number(process.env.EVENT_BLOCK_CONFIRMATIONS || 2);
const DEFAULT_MAX_BLOCK_SPAN = Number(process.env.EVENT_MAX_BLOCK_SPAN || 10);
const FREE_TIER_SAFE_BLOCK_SPAN = 10;

export async function eventListenerService(
  prisma: PrismaClient,
  contractAddress: string,
  rpcUrl: string
) {
  console.log('Starting event listener service (polling mode)...');

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const CONTRACT_ABI = [
    'event CredentialMinted(address indexed to, uint256 indexed tokenId, address indexed institution, string ipfsCid, uint64 issuedOn, uint64 expiresOn)',
    'event CredentialRevoked(uint256 indexed tokenId, address indexed institution, string reason, uint256 timestamp)',
    'event CredentialVerified(address indexed verifier, uint256 indexed tokenId, address indexed institution, uint256 timestamp, uint8 status)',
    'event InstitutionOnboarded(address indexed institutionAddress, address indexed adminAddress, string name, uint256 timestamp)',
  ];

  const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);

  const logAuditEvent = async (
    action: string,
    userAddress: string,
    userRole: string,
    details: any,
    status: 'success' | 'failed' = 'success',
    relatedCredentialId?: bigint,
    relatedVerificationId?: number
  ) => {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          userAddress: userAddress.toLowerCase(),
          userRole,
          details: JSON.stringify(details),
          status,
          relatedCredentialId,
          relatedVerificationId,
        },
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  };

  const processCredentialMinted = async (event: ethers.EventLog) => {
    const { to, tokenId, institution, ipfsCid, issuedOn, expiresOn } = event.args as any;

    try {
      console.log(`Credential minted: Token ${tokenId} to ${to}`);

      const existingCredential = await prisma.credential.findUnique({
        where: { tokenId: BigInt(tokenId.toString()) },
      });

      let institutionRecord = await prisma.institution.findUnique({
        where: { address: institution.toLowerCase() },
      });

      if (!institutionRecord) {
        institutionRecord =
          existingCredential?.institutionId
            ? await prisma.institution.findUnique({
                where: { id: existingCredential.institutionId },
              })
            : null;
      }

      if (!institutionRecord) {
        const canonicalMeru = await prisma.institution.findFirst({
          where: {
            deletedAt: null,
            OR: [{ code: 'MERU001' }, { name: 'Meru University of Science and Technology' }, { name: 'Meru University' }],
          },
        });

        if (canonicalMeru && !canonicalMeru.address) {
          institutionRecord = await ensureCanonicalMeruInstitution(prisma, {
            address: institution.toLowerCase(),
          });
        }
      }

      if (!institutionRecord) {
        institutionRecord = await prisma.institution.create({
          data: {
            address: institution.toLowerCase(),
            name: 'Unknown Institution',
            active: true,
          },
        });
      }

      await prisma.credential.upsert({
        where: { tokenId: BigInt(tokenId.toString()) },
        create: {
          tokenId: BigInt(tokenId.toString()),
          studentAddress: to.toLowerCase(),
          studentHash: '',
          ipfsCid,
          institutionId: institutionRecord.id,
          issuedOn: new Date(Number(issuedOn) * 1000),
          expiresOn: Number(expiresOn) > 0 ? new Date(Number(expiresOn) * 1000) : null,
          revoked: false,
        },
        update: {
          studentAddress: to.toLowerCase(),
          ipfsCid,
          institutionId: existingCredential?.institutionId || institutionRecord.id,
          issuedOn: new Date(Number(issuedOn) * 1000),
          expiresOn: Number(expiresOn) > 0 ? new Date(Number(expiresOn) * 1000) : null,
          revoked: false,
        },
      });

      await logAuditEvent(
        'CREDENTIAL_MINTED',
        to.toLowerCase(),
        'student',
        {
          tokenId: tokenId.toString(),
          institution: institution.toLowerCase(),
          ipfsCid,
          issuedOn: new Date(Number(issuedOn) * 1000).toISOString(),
          expiresOn: Number(expiresOn) > 0 ? new Date(Number(expiresOn) * 1000).toISOString() : null,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
        },
        'success',
        BigInt(tokenId.toString())
      );
    } catch (error) {
      console.error('Error processing CredentialMinted event:', error);
      await logAuditEvent(
        'CREDENTIAL_MINTED',
        (to || 'unknown').toLowerCase(),
        'student',
        { error: toErrorMessage(error), tokenId: tokenId?.toString() },
        'failed'
      );
    }
  };

  const processCredentialRevoked = async (event: ethers.EventLog) => {
    const { tokenId, institution, reason, timestamp } = event.args as any;

    try {
      console.log(`Credential revoked: Token ${tokenId}`);

      const credential = await prisma.credential.findUnique({
        where: { tokenId: BigInt(tokenId.toString()) },
      });

      if (credential) {
        await prisma.credential.update({
          where: { id: credential.id },
          data: {
            revoked: true,
            revocationReason: reason,
          },
        });
      }

      await logAuditEvent(
        'CREDENTIAL_REVOKED',
        institution.toLowerCase(),
        'institution_admin',
        {
          tokenId: tokenId.toString(),
          reason,
          timestamp: new Date(Number(timestamp) * 1000).toISOString(),
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
        },
        'success',
        BigInt(tokenId.toString())
      );
    } catch (error) {
      console.error('Error processing CredentialRevoked event:', error);
      await logAuditEvent(
        'CREDENTIAL_REVOKED',
        (institution || 'unknown').toLowerCase(),
        'institution_admin',
        { error: toErrorMessage(error), tokenId: tokenId?.toString() },
        'failed'
      );
    }
  };

  const processCredentialVerified = async (event: ethers.EventLog) => {
    const { verifier, tokenId, institution, timestamp, status } = event.args as any;

    try {
      console.log(`Credential verified: Token ${tokenId} by ${verifier}`);

      const credential = await prisma.credential.findUnique({
        where: { tokenId: BigInt(tokenId.toString()) },
      });

      if (!credential) {
        return;
      }

      const existingLog = await prisma.verificationLog.findFirst({
        where: {
          blockchainTxHash: event.transactionHash,
          tokenId: BigInt(tokenId.toString()),
          verifierAddress: verifier.toLowerCase(),
        },
      });

      if (existingLog) {
        return;
      }

      const statusMap: Record<number, string> = {
        0: 'valid',
        1: 'revoked',
        2: 'expired',
        3: 'invalid',
      };

      await prisma.verificationLog.create({
        data: {
          verifierAddress: verifier.toLowerCase(),
          tokenId: BigInt(tokenId.toString()),
          credentialId: credential.id,
          institutionId: credential.institutionId,
          status: statusMap[Number(status)] || 'unknown',
          revoked: Number(status) === 1,
          blockchainTxHash: event.transactionHash,
        },
      });

      await logAuditEvent(
        'CREDENTIAL_VERIFIED',
        verifier.toLowerCase(),
        'verifier',
        {
          tokenId: tokenId.toString(),
          status: statusMap[Number(status)] || 'unknown',
          institution: institution.toLowerCase(),
          timestamp: new Date(Number(timestamp) * 1000).toISOString(),
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
        },
        'success',
        BigInt(tokenId.toString())
      );
    } catch (error) {
      console.error('Error processing CredentialVerified event:', error);
      await logAuditEvent(
        'CREDENTIAL_VERIFIED',
        (verifier || 'unknown').toLowerCase(),
        'verifier',
        { error: toErrorMessage(error), tokenId: tokenId?.toString() },
        'failed'
      );
    }
  };

  const processInstitutionOnboarded = async (event: ethers.EventLog) => {
    const { institutionAddress, adminAddress, name, timestamp } = event.args as any;

    try {
      console.log(`Institution onboarded: ${name} at ${institutionAddress}`);

      await prisma.institution.upsert({
        where: { address: institutionAddress.toLowerCase() },
        create: {
          address: institutionAddress.toLowerCase(),
          name,
          active: true,
        },
        update: {
          name,
          active: true,
        },
      });

      await logAuditEvent(
        'INSTITUTION_ONBOARDED',
        adminAddress.toLowerCase(),
        'owner',
        {
          institutionAddress: institutionAddress.toLowerCase(),
          adminAddress: adminAddress.toLowerCase(),
          name,
          timestamp: new Date(Number(timestamp) * 1000).toISOString(),
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
        },
        'success'
      );
    } catch (error) {
      console.error('Error processing InstitutionOnboarded event:', error);
      await logAuditEvent(
        'INSTITUTION_ONBOARDED',
        (adminAddress || 'unknown').toLowerCase(),
        'owner',
        { error: toErrorMessage(error), institutionAddress: institutionAddress?.toLowerCase() },
        'failed'
      );
    }
  };

  let isPolling = false;
  let currentMaxBlockSpan = Math.max(1, DEFAULT_MAX_BLOCK_SPAN);
  let lastProcessedBlock = Math.max(0, (await provider.getBlockNumber()) - BLOCK_CONFIRMATIONS);

  const processRange = async (fromBlock: number, toBlock: number) => {
    const mintedEvents = await contract.queryFilter(contract.filters.CredentialMinted(), fromBlock, toBlock);
    for (const event of mintedEvents) {
      await processCredentialMinted(event as ethers.EventLog);
    }

    const revokedEvents = await contract.queryFilter(contract.filters.CredentialRevoked(), fromBlock, toBlock);
    for (const event of revokedEvents) {
      await processCredentialRevoked(event as ethers.EventLog);
    }

    const verifiedEvents = await contract.queryFilter(contract.filters.CredentialVerified(), fromBlock, toBlock);
    for (const event of verifiedEvents) {
      await processCredentialVerified(event as ethers.EventLog);
    }

    const onboardedEvents = await contract.queryFilter(contract.filters.InstitutionOnboarded(), fromBlock, toBlock);
    for (const event of onboardedEvents) {
      await processInstitutionOnboarded(event as ethers.EventLog);
    }
  };

  const poll = async () => {
    if (isPolling) {
      return;
    }
    isPolling = true;

    try {
      const latestBlock = await provider.getBlockNumber();
      const safeLatest = Math.max(0, latestBlock - BLOCK_CONFIRMATIONS);

      if (safeLatest <= lastProcessedBlock) {
        return;
      }

      let fromBlock = lastProcessedBlock + 1;
      while (fromBlock <= safeLatest) {
        const toBlock = Math.min(fromBlock + currentMaxBlockSpan - 1, safeLatest);
        try {
          await processRange(fromBlock, toBlock);
          lastProcessedBlock = toBlock;
          fromBlock = toBlock + 1;
        } catch (error) {
          const message = toErrorMessage(error);
          const isRangeLimitError =
            message.includes('eth_getLogs requests with up to a 10 block range') ||
            message.includes('invalid block range') ||
            message.includes('invalid block range params');

          if (isRangeLimitError && currentMaxBlockSpan > FREE_TIER_SAFE_BLOCK_SPAN) {
            currentMaxBlockSpan = FREE_TIER_SAFE_BLOCK_SPAN;
            console.warn(
              `Event listener adjusted block span to ${currentMaxBlockSpan} due to provider range limits.`
            );
            continue;
          }

          throw error;
        }
      }
    } catch (error) {
      console.error('Event listener polling error:', toErrorMessage(error));
    } finally {
      isPolling = false;
    }
  };

  await poll();
  setInterval(poll, POLL_INTERVAL_MS);

  const configuredSpan = Number(process.env.EVENT_MAX_BLOCK_SPAN || DEFAULT_MAX_BLOCK_SPAN);
  const mode =
    configuredSpan <= FREE_TIER_SAFE_BLOCK_SPAN
      ? "free-tier-safe"
      : "custom";

  console.log(
    `Event listener started: polling every ${POLL_INTERVAL_MS}ms, chunk=${currentMaxBlockSpan} blocks`
  );
  console.log(
    `Event listener mode: ${mode} (configured span=${configuredSpan}, confirmations=${BLOCK_CONFIRMATIONS})`
  );
}
