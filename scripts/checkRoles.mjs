import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

const rpc = 'https://polygon-amoy.g.alchemy.com/v2/LSBIxhmd93aO1Z7kwOYDo';
const provider = new ethers.JsonRpcProvider(rpc);
const contractAddress = '0x22a8B017A0060432C0FFf6414431a303BEDBDbb9';
const artifact = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'artifacts/contracts/EduChain.sol/EduChain.json'), 'utf-8'));
const contract = new ethers.Contract(contractAddress, artifact.abi, provider);

const main = async () => {
  const owner = await contract.owner();
  console.log('owner:', owner);

  const role = await contract.INSTITUTION_ADMIN_ROLE();
  const hasRole = await contract.hasRole(role, '0x7eA4D92561e367880c02a2F996E89607492d91d7');
  console.log('institution admin role for your wallet:', hasRole);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
