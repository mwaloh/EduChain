import { ethers } from 'ethers';
import artifact from '../../../artifacts/contracts/EduChain.sol/EduChain.json';

const RPC_URL = process.env.RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

if (!RPC_URL) {
  throw new Error('RPC_URL not set in env');
}

// Validate CONTRACT_ADDRESS before using it to avoid ENS resolution attempts
if (!CONTRACT_ADDRESS || !ethers.isAddress(CONTRACT_ADDRESS)) {
  throw new Error('CONTRACT_ADDRESS is missing or not a valid hex address (0x...). Set CONTRACT_ADDRESS in backend/.env to the deployed contract address.');
}

export const provider = new ethers.JsonRpcProvider(RPC_URL);
export const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, provider);

export function getSigner() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error('PRIVATE_KEY missing in env for signing');
  return new ethers.Wallet(pk, provider);
}

export function getContractWithSigner() {
  return contract.connect(getSigner());
}