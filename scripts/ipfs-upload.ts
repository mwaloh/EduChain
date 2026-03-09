/**
 * IPFS Upload Utility for EduChain Metadata
 * 
 * Uploads credential metadata JSON to IPFS using web3.storage or Pinata
 */

import { create } from 'ipfs-http-client';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Initialize IPFS client
// Option 1: Using web3.storage (via IPFS gateway)
const ipfsClient = create({
  host: 'ipfs.infura.io',
  port: 5001,
  protocol: 'https',
  headers: {
    authorization: process.env.INFURA_IPFS_AUTH || '',
  },
});

// Option 2: Using Pinata (alternative)
// const pinataSDK = require('@pinata/sdk');
// const pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_KEY);

interface CredentialMetadata {
  name: string;
  description: string;
  image?: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  properties: {
    degree: string;
    grade: string;
    institution: string;
    studentHash: string;
    issuedDate: string;
    ipfsCid?: string;
  };
}

/**
 * Upload credential metadata to IPFS
 */
export async function uploadCredentialMetadata(
  metadata: CredentialMetadata
): Promise<string> {
  try {
    const metadataJson = JSON.stringify(metadata, null, 2);
    const result = await ipfsClient.add(metadataJson);
    const cid = result.cid.toString();
    
    console.log(`✅ Metadata uploaded to IPFS: ${cid}`);
    console.log(`🔗 IPFS URL: ipfs://${cid}`);
    console.log(`🌐 Gateway URL: https://ipfs.io/ipfs/${cid}`);
    
    return cid;
  } catch (error) {
    console.error('❌ Error uploading to IPFS:', error);
    throw error;
  }
}

/**
 * Generate credential metadata from input
 */
export function generateCredentialMetadata(input: {
  degree: string;
  grade: string;
  institution: string;
  studentHash: string;
  issuedDate: string;
  imageCid?: string;
}): CredentialMetadata {
  return {
    name: `${input.degree} - ${input.institution}`,
    description: `Academic credential issued by ${input.institution}`,
    image: input.imageCid ? `ipfs://${input.imageCid}` : undefined,
    attributes: [
      { trait_type: 'Degree', value: input.degree },
      { trait_type: 'Grade', value: input.grade },
      { trait_type: 'Institution', value: input.institution },
      { trait_type: 'Issued Date', value: input.issuedDate },
    ],
    properties: {
      degree: input.degree,
      grade: input.grade,
      institution: input.institution,
      studentHash: input.studentHash,
      issuedDate: input.issuedDate,
    },
  };
}

/**
 * CLI script entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: ts-node scripts/ipfs-upload.ts <metadata-file> OR interactive mode

Examples:
  ts-node scripts/ipfs-upload.ts metadata/example.json
    `);
    process.exit(1);
  }

  const metadataPath = args[0];
  
  if (!fs.existsSync(metadataPath)) {
    console.error(`❌ File not found: ${metadataPath}`);
    process.exit(1);
  }

  const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
  const metadata: CredentialMetadata = JSON.parse(metadataContent);

  const cid = await uploadCredentialMetadata(metadata);
  
  // Update metadata with CID
  metadata.properties.ipfsCid = cid;
  
  // Save updated metadata
  const outputPath = metadataPath.replace('.json', '-uploaded.json');
  fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2));
  console.log(`💾 Updated metadata saved to: ${outputPath}`);
  console.log(`\n📋 Use this CID in your mint function: ${cid}`);
}

if (require.main === module) {
  main().catch(console.error);
}

export { main };

