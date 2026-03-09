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
    } catch (error) {
      console.error('Error processing CredentialMinted event:', error);
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
      }
    } catch (error) {
      console.error('Error processing CredentialRevoked event:', error);
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
      }
    } catch (error) {
      console.error('Error processing CredentialVerified event:', error);
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
    } catch (error) {
      console.error('Error processing InstitutionOnboarded event:', error);
    }
  });

  console.log('✅ Event listener service started');
}

