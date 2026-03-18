require('dotenv').config();
const { ethers } = require('ethers');
const artifact = require('../artifacts/contracts/EduChain.sol/EduChain.json');

(async () => {
  const rpc = process.env.RPC_URL;
  const addr = process.env.CONTRACT_ADDRESS;
  const wallet = process.argv[2];
  if (!wallet) { console.error('Usage: node scripts/check-role.js 0x...'); process.exit(1); }

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const contract = new ethers.Contract(addr, artifact.abi, provider);

  const role = await contract.INSTITUTION_ADMIN_ROLE();
  const has = await contract.hasRole(role, wallet);
  console.log('INSTITUTION_ADMIN_ROLE:', role);
  console.log(`${wallet} has role? ${has}`);
})();
```  

Run:
- node scripts/check-role.js 0x786d...0184

2) Grant role (must run with owner/admin PRIVATE_KEY in backend/.env)
````javascript
// filepath: e:\desktop\desktop3\final year project\scripts\grant-role.js
require('dotenv').config();
const { ethers } = require('ethers');
const artifact = require('../artifacts/contracts/EduChain.sol/EduChain.json');

(async () => {
  const rpc = process.env.RPC_URL;
  const addr = process.env.CONTRACT_ADDRESS;
  const pk = process.env.PRIVATE_KEY; // owner/admin key required
  const to = process.argv[2];
  if (!pk) { console.error('Set PRIVATE_KEY in backend/.env'); process.exit(1); }
  if (!to) { console.error('Usage: node scripts/grant-role.js 0x...'); process.exit(1); }

  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const signer = new ethers.Wallet(pk, provider);
  const contract = new ethers.Contract(addr, artifact.abi, signer);

  const role = await contract.INSTITUTION_ADMIN_ROLE();
  const tx = await contract.grantRole(role, to);
  console.log('tx hash:', tx.hash);
  await tx.wait();
  console.log('Granted INSTITUTION_ADMIN_ROLE to', to);
})();
```

Run:
- node scripts/grant-role.js 0x786d...0184

Notes
- PRIVATE_KEY used to grant must be the contract owner or an account with ADMIN role; keep it secret.
- After granting, re-run the check script or retry the frontend action.
- If you prefer a Hardhat/TS grant script, tell me and I’ll provide it.Run:
- node scripts/grant-role.js 0x786d...0184

Notes
- PRIVATE_KEY used to grant must be the contract owner or an account with ADMIN role; keep it secret.
- After granting, re-run the check script or retry the frontend action.
- If you prefer a Hardhat/TS grant script, tell me and I’ll provide it.