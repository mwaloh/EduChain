# EduCredChain

Decentralized academic credential issuance and verification using Polygon Amoy, Solidity, IPFS, and a Next.js frontend.

## Deploy (Polygon Amoy)
1) Create `.env` in project root:
```
RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```
2) Compile:
```
npm run build
```
3) Deploy:
```
npm run deploy:amoy
```
Copy the printed contract address.

## Wire frontend
1) In `frontend/.env.local` set:
```
NEXT_PUBLIC_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_CONTRACT_ADDRESS=0xDEPLOYED_ADDRESS
```
2) Start the app:
```
cd frontend
npm run dev
```
3) Verify
- Open `/verify`, enter a `tokenId`, it will read `status` and `tokenURI`.

## Notes
- Contract: `contracts/AcademicCredential.sol` (ERC-721 soulbound: revoke/expiry/status).
- Issuer is deployer (granted `ISSUER_ROLE`).
- Store PII off-chain; only hashes in metadata on IPFS.
