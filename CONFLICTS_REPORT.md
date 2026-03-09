# Project Conflicts & Issues Report

## 🔍 Identified Conflicts

### 1. **Duplicate Contracts** ⚠️

**Found:**
- `contracts/AcademicCredential.sol` (OLD - Legacy contract)
- `contracts/EduChain.sol` (NEW - Current contract)

**Issue:** Both contracts exist, but only `EduChain.sol` is the new implementation with full features.

**Recommendation:** Keep `EduChain.sol` and mark `AcademicCredential.sol` as deprecated or remove it after migration.

---

### 2. **Duplicate Deployment Scripts** ⚠️

**Found:**
- `scripts/deploy.ts` - Deploys OLD `AcademicCredential` contract
- `scripts/deploy.js` - JavaScript version (duplicate of deploy.ts)
- `scripts/deploy-educhain.ts` - Deploys NEW `EduChain` contract ✅

**Issue:** Old scripts still reference the legacy contract, which can cause confusion.

**Recommendation:** 
- Keep `deploy-educhain.ts` as primary
- Consider renaming or removing old scripts

---

### 3. **Legacy Mint Script** ⚠️

**Found:**
- `scripts/mint.ts` - Uses old `AcademicCredential` contract

**Issue:** This script won't work with the new `EduChain` contract.

**Recommendation:** Use `scripts/operations/mint-credential.ts` instead, which uses the new contract.

---

### 4. **Unused `blockchain/` Folder** ⚠️

**Found:**
- `blockchain/package.json` - Empty package.json with no dependencies
- `blockchain/node_modules/` - Installed but unused

**Issue:** This folder seems to be leftover from earlier project structure.

**Recommendation:** Remove the `blockchain/` folder if not needed.

---

### 5. **Frontend Contract Reference** ⚠️

**Found:**
- `frontend/src/lib/contract.ts` - Contains ABI for OLD `AcademicCredential`

**Issue:** Frontend is still configured to use the legacy contract.

**Recommendation:** Update to use `EduChain` contract ABI.

---

### 6. **Package Version Conflicts** ⚠️

#### Ethers.js Versions:
- **Root:** `ethers ^6.15.0` ✅
- **Frontend:** `ethers ^6.13.4` (slightly older)
- **Backend:** `ethers ^6.15.0` ✅

**Recommendation:** Update frontend to `^6.15.0` for consistency.

#### TypeScript Versions:
- **Root:** `typescript ^5.9.3`
- **Frontend:** `typescript ^5` (no patch version)
- **Backend:** `typescript ^5.7.2`

**Recommendation:** Align versions for consistency (minor differences usually okay).

#### @types/node Versions:
- **Root:** `@types/node ^24.7.1`
- **Frontend:** `@types/node ^20`
- **Backend:** `@types/node ^22.10.1`

**Recommendation:** This is okay - different projects can use different Node versions.

---

### 7. **Empty `backend/src/models/` Folder** ℹ️

**Found:**
- `backend/src/models/` exists but is empty

**Issue:** No issue, just noting it's unused.

---

## ✅ Recommendations

### High Priority:
1. ✅ Update `frontend/src/lib/contract.ts` to use `EduChain` ABI
2. ✅ Update frontend `ethers` version to `^6.15.0`
3. ⚠️ Decide whether to keep or remove `AcademicCredential.sol`

### Medium Priority:
4. 📝 Document that old scripts (`deploy.ts`, `deploy.js`, `mint.ts`) are deprecated
5. 🗑️ Consider removing `blockchain/` folder if unused

### Low Priority:
6. 🔄 Align TypeScript versions (optional - minor differences are usually fine)

---

## 🛠️ Quick Fix Commands

### Remove unused blockchain folder:
```bash
Remove-Item -Recurse -Force blockchain
```

### Update frontend ethers:
```bash
cd frontend
npm install ethers@^6.15.0
cd ..
```

### Remove old deploy scripts (after confirming):
```bash
# Backup first!
Move-Item scripts/deploy.ts scripts/deploy.ts.old
Move-Item scripts/deploy.js scripts/deploy.js.old
Move-Item scripts/mint.ts scripts/mint.ts.old
```

---

## 📊 Summary

| Issue | Severity | Action Needed |
|-------|----------|---------------|
| Duplicate contracts | Medium | Document/remove old contract |
| Duplicate scripts | Low | Mark as deprecated |
| Frontend contract ABI | High | Update to EduChain |
| Ethers version mismatch | Low | Update frontend |
| Unused blockchain folder | Low | Remove if unused |
| TypeScript versions | Info | Optional alignment |

---

**Generated:** $(Get-Date)
**Status:** Needs attention on frontend contract.ts

