# Legacy Contracts

This directory contains deprecated contracts from earlier versions of the project.

## AcademicCredential.sol

**Status:** ⚠️ DEPRECATED

**Replaced by:** `contracts/EduChain.sol`

**Differences:**
- Old contract had simpler structure
- No multi-institution support
- No verification events
- No pause functionality
- No privacy controls
- Different mint/revoke signatures

**Migration Notes:**
- Old `status()` function → New `getCredentialStatus()`
- Old `revoke(tokenId, bool)` → New `revoke(tokenId, string reason)`
- Old `mint(to, tokenId, ...)` → New `mint(to, ipfsCid, ..., studentHash)` (auto tokenId)

**When to Use:**
- Reference only for understanding evolution
- Do not deploy or use in production

