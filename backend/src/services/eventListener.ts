/**
 * Event Listener Service
 * Listens to blockchain events and syncs to database
 */

import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

export async function eventListenerService(
  prisma: PrismaClient,
  contractAddress: string,
  rpcUrl: string
) {
  console.log('👂 Starting event listener service...');

  // Helper function to log audit events
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

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  const CONTRACT_ABI = [
    'event CredentialMinted(address indexed to, uint256 indexed tokenId, address indexed institution, string ipfsCid, uint64 issuedOn, uint64 expiresOn)',
    'event CredentialRevoked(uint256 indexed tokenId, address indexed institution, string reason, uint256 timestamp)',
    'event CredentialVerified(address indexed verifier, uint256 indexed tokenId, address indexed institution, uint256 timestamp, uint8 status)',
    'event InstitutionOnboarded(address indexed institutionAddress, address indexed adminAddress, string name, uint256 timestamp)',
  ];

  const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);

  // Listen to CredentialMinted events
  contract.on('CredentialMinted', async (to, tokenId, institution, ipfsCid, issuedOn, expiresOn, event) => {
    try {
      console.log(`📜 Credential minted: Token ${tokenId} to ${to}`);

      // Ensure institution exists
      let institutionRecord = await prisma.institution.findUnique({
        where: { address: institution.toLowerCase() },
      });

      if (!institutionRecord) {
        // Create institution if it doesn't exist
        institutionRecord = await prisma.institution.create({
          data: {
            address: institution.toLowerCase(),
            name: 'Unknown Institution',
            active: true,
          },
        });
      }

      // Create credential record
      await prisma.credential.create({
        data: {
          tokenId: BigInt(tokenId.toString()),
          studentAddress: to.toLowerCase(),
          studentHash: '', // Would need to fetch from contract
          ipfsCid,
          institutionId: institutionRecord.id,
          issuedOn: new Date(Number(issuedOn) * 1000),
          expiresOn: expiresOn > 0 ? new Date(Number(expiresOn) * 1000) : null,
          revoked: false,
        },
      });

      // Update institution credential count
      await prisma.institution.update({
        where: { id: institutionRecord.id },
        data: { credentialCount: { increment: 1 } },
      });

      // Log audit event
      await logAuditEvent(
        'CREDENTIAL_MINTED',
        to.toLowerCase(),
        'student',
        {
          tokenId: tokenId.toString(),
          institution: institution.toLowerCase(),
          ipfsCid,
          issuedOn: new Date(Number(issuedOn) * 1000).toISOString(),
          expiresOn: expiresOn > 0 ? new Date(Number(expiresOn) * 1000).toISOString() : null,
          transactionHash: event.transactionHash,
        },
        'success',
        BigInt(tokenId.toString())
      );
    } catch (error) {
      console.error('Error processing CredentialMinted event:', error);
      
      // Log failed audit event
      await logAuditEvent(
        'CREDENTIAL_MINTED',
        to?.toLowerCase() || 'unknown',
        'student',
        { error: error.message, tokenId: tokenId?.toString() },
        'failed'
      );
    }
  });

  // Listen to CredentialRevoked events
  contract.on('CredentialRevoked', async (tokenId, institution, reason, timestamp, event) => {
    try {
      console.log(`❌ Credential revoked: Token ${tokenId}`);

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

        // Log audit event
        await logAuditEvent(
          'CREDENTIAL_REVOKED',
          institution.toLowerCase(),
          'institution_admin',
          {
            tokenId: tokenId.toString(),
            reason,
            timestamp: new Date(Number(timestamp) * 1000).toISOString(),
            transactionHash: event.transactionHash,
          },
          'success',
          BigInt(tokenId.toString())
        );
      }
    } catch (error) {
      console.error('Error processing CredentialRevoked event:', error);
      
      // Log failed audit event
      await logAuditEvent(
        'CREDENTIAL_REVOKED',
        institution?.toLowerCase() || 'unknown',
        'institution_admin',
        { error: error.message, tokenId: tokenId?.toString() },
        'failed'
      );
    }
  });

  // Listen to CredentialVerified events
  contract.on('CredentialVerified', async (verifier, tokenId, institution, timestamp, status, event) => {
    try {
      console.log(`🔍 Credential verified: Token ${tokenId} by ${verifier}`);

      const credential = await prisma.credential.findUnique({
        where: { tokenId: BigInt(tokenId.toString()) },
      });

      if (credential) {
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

        // Log audit event
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
          },
          'success',
          BigInt(tokenId.toString()),
          undefined // verificationId will be set after creation
        );
      }
    } catch (error) {
      console.error('Error processing CredentialVerified event:', error);
      
      // Log failed audit event
      await logAuditEvent(
        'CREDENTIAL_VERIFIED',
        verifier?.toLowerCase() || 'unknown',
        'verifier',
        { error: error.message, tokenId: tokenId?.toString() },
        'failed'
      );
    }
  });

  // Listen to InstitutionOnboarded events
  contract.on('InstitutionOnboarded', async (institutionAddress, adminAddress, name, timestamp, event) => {
    try {
      console.log(`🏛️  Institution onboarded: ${name} at ${institutionAddress}`);

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

      // Log audit event
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
        },
        'success'
      );
    } catch (error) {
      console.error('Error processing InstitutionOnboarded event:', error);
      
      // Log failed audit event
      await logAuditEvent(
        'INSTITUTION_ONBOARDED',
        adminAddress?.toLowerCase() || 'unknown',
        'owner',
        { error: error.message, institutionAddress: institutionAddress?.toLowerCase() },
        'failed'
      );
    }
  });

  console.log('✅ Event listener service started');
}

