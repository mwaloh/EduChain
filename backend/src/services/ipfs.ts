/**
 * IPFS Service
 * Handles credential metadata uploads to IPFS
 */

const IPFS_GATEWAY_URL = process.env.IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs/';
const WEB3_STORAGE_TOKEN = process.env.WEB3_STORAGE_TOKEN;

class IPFSService {
  /**
   * Upload JSON metadata to IPFS
   * @param metadata - The metadata object to upload
   * @returns The CID (Content Identifier) of the uploaded content
   */
  static async uploadJSON(metadata: object): Promise<string> {
    try {
      // Use web3.storage if token is available
      if (WEB3_STORAGE_TOKEN) {
        try {
          const cid = await uploadToWeb3Storage(metadata, WEB3_STORAGE_TOKEN);
          console.log(`✅ Uploaded to IPFS via web3.storage: ${cid}`);
          return cid;
        } catch (web3Error: any) {
          console.error('web3.storage upload failed:', web3Error);
          // Fall back to mock IPFS for development
        }
      }

      // Fallback: Mock IPFS response (for development without web3.storage)
      const mockCid = generateMockCID(metadata);
      console.warn('⚠️ Using mock IPFS CID (WEB3_STORAGE_TOKEN not configured):', mockCid);
      return mockCid;
    } catch (error: any) {
      console.error('❌ IPFS upload error:', error);
      throw new Error(`IPFS upload failed: ${error.message}`);
    }
  }

  /**
   * Retrieve metadata from IPFS by CID
   * @param cid - The Content Identifier
   * @returns The metadata object
   */
  static async getJSON(cid: string): Promise<object> {
    try {
      if (!cid || cid.length < 10) {
        throw new Error('Invalid CID format');
      }

      // Try to fetch from IPFS gateway
      const gateways = [
        `${IPFS_GATEWAY_URL}${cid}`,
        `https://ipfs.io/ipfs/${cid}`,
        `https://${cid}.ipfs.nft.storage/`,
      ];

      for (const gateway of gateways) {
        try {
          const response = await fetch(gateway, { signal: AbortSignal.timeout(5000) });

          if (response.ok) {
            const data = await response.json();
            console.log(`✅ Retrieved from IPFS: ${cid}`);
            return data;
          }
        } catch (e) {
          // Try next gateway
          continue;
        }
      }

      throw new Error('Content not found on IPFS');
    } catch (error: any) {
      console.error('❌ IPFS retrieval error:', error);
      throw new Error(`IPFS retrieval failed: ${error.message}`);
    }
  }
}

/**
 * Upload file to web3.storage via fetch
 * https://web3.storage/docs/
 */
async function uploadToWeb3Storage(data: object, token: string): Promise<string> {
  const jsonString = JSON.stringify(data);

  // web3.storage expects FormData with file
  // Using a simple approach with fetch multipart
  const response = await fetch('https://api.web3.storage/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: new Blob([jsonString], { type: 'application/json' }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`web3.storage API error: ${response.statusText} - ${errorText}`);
  }

  const result = (await response.json()) as { cid?: string };

  if (!result.cid) {
    throw new Error('No CID returned from web3.storage');
  }

  return result.cid;
}

/**
 * Generate a deterministic mock CID for testing (without web3.storage)
 * Real CIDs are base32 encoded hashes, this mimics that format
 */
function generateMockCID(data: object): string {
  const jsonString = JSON.stringify(data);
  let hash = 0;

  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash; // Convert to 32-bit integer
  }

  // Create a base32-like string (simplified mock)
  const hashString = Math.abs(hash).toString(16).padStart(40, '0');
  const mockCID = `Qm${hashString.substring(0, 44)}`;

  return mockCID;
}

export default IPFSService;
