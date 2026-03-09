# Legacy Scripts

This directory contains deprecated deployment and operation scripts.

## Scripts

### deploy.ts / deploy.js
**Status:** ⚠️ DEPRECATED

Deploys the old `AcademicCredential` contract.

**Replaced by:** `scripts/deploy-educhain.ts`

**Usage (old):**
```bash
npm run deploy:amoy  # Used deploy.ts
```

**Usage (new):**
```bash
npm run deploy:educhain  # Uses deploy-educhain.ts
```

---

### mint.ts
**Status:** ⚠️ DEPRECATED

Mints credentials using the old `AcademicCredential` contract.

**Replaced by:** `scripts/operations/mint-credential.ts`

**Differences:**
- Old script required manual `TOKEN_ID` in env
- Old contract signature: `mint(to, tokenId, ipfsCid, issuedOn, expiresOn)`
- New contract auto-generates tokenId: `mint(to, ipfsCid, issuedOn, expiresOn, studentHash)`

---

## Migration Notes

All legacy scripts reference the old `AcademicCredential` contract which has been replaced by `EduChain`.

**Do not use these scripts for new deployments.**

