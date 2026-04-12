import { HDNodeWallet, Wallet } from 'ethers';
import crypto from 'crypto';

/**
 * Generates a deterministic wallet from an email address
 * Uses the email as a seed for reproducible wallet creation
 */
export function generateWalletFromEmail(email: string): {
  address: string;
  privateKey: string;
  mnemonic: string;
} {
  // Create a deterministic seed from the email
  const seed = crypto
    .createHash('sha256')
    .update(email)
    .digest();

  // ethers v6 exposes deterministic seed derivation via HDNodeWallet
  const wallet = HDNodeWallet.fromSeed(seed);

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic?.phrase || '',
  };
}

/**
 * Validates if a wallet address is valid Ethereum format
 */
export function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Creates a user wallet mapping
 * In production, you might want to:
 * - Store the private key encrypted in a secure key management service
 * - Never store unencrypted private keys
 * - Use account abstraction or key management systems
 */
export function createUserWallet(email: string) {
  try {
    const wallet = generateWalletFromEmail(email);

    return {
      address: wallet.address,
      // Note: In production, encrypt this before storing
      privateKey: wallet.privateKey,
      email: email,
    };
  } catch (error) {
    // Fallback keeps auth flow available even if deterministic derivation fails.
    const fallback = Wallet.createRandom();
    return {
      address: fallback.address,
      privateKey: fallback.privateKey,
      email: email,
    };
  }
}
