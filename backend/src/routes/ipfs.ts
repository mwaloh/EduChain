/**
 * IPFS Upload Routes
 * Handles credential metadata uploads to IPFS
 */

import { Router, Request, Response } from 'express';

export function ipfsRoute() {
  const router = Router();

  const IPFS_GATEWAY_URL = process.env.IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs/';
  const WEB3_STORAGE_TOKEN = process.env.WEB3_STORAGE_TOKEN;

  /**
   * POST /api/ipfs/upload
   * Upload JSON metadata to IPFS and pin it
   * Body: { credentialData: object } OR raw metadata fields
   * Returns: { cid: string, ipfsUrl: string, gateway: string }
   */
  router.post('/upload', async (req: Request, res: Response) => {
    try {
      const metadata = req.body;

      if (!metadata) {
        return res.status(400).json({ error: 'Request body is required' });
      }

      // Validate required fields for credential metadata
      if (!metadata.name && !metadata.course) {
        return res.status(400).json({
          error: 'Metadata must contain at least name or course field',
        });
      }

      // Use web3.storage if token is available
      if (WEB3_STORAGE_TOKEN) {
        try {
          const cid = await uploadToWeb3Storage(metadata, WEB3_STORAGE_TOKEN);
          const ipfsUrl = `ipfs://${cid}`;
          return res.status(200).json({
            cid,
            ipfsUrl,
            gateway: `${IPFS_GATEWAY_URL}${cid}`,
            provider: 'web3.storage',
          });
        } catch (web3Error: any) {
          console.error('web3.storage upload failed:', web3Error);
          // Fall back to mock IPFS for development
        }
      }

      // Fallback: Mock IPFS response (for development without web3.storage)
      const mockCid = generateMockCID(metadata);
      console.warn('⚠️ Using mock IPFS CID (WEB3_STORAGE_TOKEN not configured):', mockCid);

      res.status(200).json({
        cid: mockCid,
        ipfsUrl: `ipfs://${mockCid}`,
        gateway: `${IPFS_GATEWAY_URL}${mockCid}`,
        provider: 'mock',
        warning: 'Using mock IPFS - configure WEB3_STORAGE_TOKEN for production',
      });
    } catch (error: any) {
      console.error('IPFS upload error:', error);
      res.status(500).json({ error: error.message || 'IPFS upload failed' });
    }
  });

  /**
   * GET /api/ipfs/:cid
   * Retrieve and verify pinned content from IPFS
   * Params: cid (string)
   * Returns: { data: object, cid: string, available: boolean }
   */
  router.get('/:cid', async (req: Request, res: Response) => {
    try {
      const { cid } = req.params;

      if (!cid || cid.length < 10) {
        return res.status(400).json({ error: 'Invalid CID format' });
      }

      // Try to fetch from IPFS gateway
      const gateways = [
        `${IPFS_GATEWAY_URL}${cid}`,
        `https://ipfs.io/ipfs/${cid}`,
        `https://${cid}.ipfs.nft.storage/`,
      ];

      let data;
      for (const gateway of gateways) {
        try {
          const response = await fetch(gateway, { signal: AbortSignal.timeout(5000) });

          if (response.ok) {
            data = await response.json();
            break;
          }
        } catch (e) {
          // Try next gateway
          continue;
        }
      }

      if (!data) {
        return res.status(404).json({
          error: 'Content not found on IPFS',
          cid,
          available: false,
        });
      }

      res.status(200).json({
        cid,
        data,
        available: true,
      });
    } catch (error: any) {
      console.error('IPFS retrieval error:', error);
      res.status(500).json({ error: error.message || 'IPFS retrieval failed' });
    }
  });

  return router;
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
