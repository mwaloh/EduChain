# Access-Based Interaction System

## Overview

EduChain now has a complete **blockchain-based access control system** that verifies user permissions on-chain before allowing actions. This bridges the gap between frontend UI roles and actual blockchain permissions.

## Architecture

### Two-Layer Role System

1. **UI Roles** (RoleContext) - For navigation and UI state
   - `student` - View credentials
   - `employer` - Verify credentials  
   - `institution` - Manage credentials

2. **Blockchain Roles** (AccessControl) - Actual permissions on-chain
   - `INSTITUTION_ADMIN_ROLE` - Can mint and revoke credentials
   - `EMPLOYER_VERIFIER_ROLE` - Can verify credentials (optional, anyone can verify)
   - `OWNER` - Contract owner (can onboard institutions, grant roles)

## Implementation

### 1. Contract ABI Updates (`frontend/src/lib/contract.ts`)

Added AccessControl functions to the contract ABI:
- `hasRole(bytes32, address)` - Check if address has a role
- `INSTITUTION_ADMIN_ROLE()` - Get role constant
- `EMPLOYER_VERIFIER_ROLE()` - Get role constant
- `owner()` - Get contract owner
- `adminToInstitution(address)` - Get institution for admin
- `institutions(address)` - Get institution info

### 2. Access Control Hook (`frontend/src/hooks/useAccessControl.ts`)

New hook that:
- Checks blockchain roles for connected wallet
- Returns permission state (isInstitutionAdmin, isEmployerVerifier, isOwner)
- Provides institution information
- Suggests UI role based on blockchain permissions
- Auto-refreshes when wallet connects/disconnects

### 3. Updated Pages

#### Admin Page (`/admin`)
- ✅ Checks `INSTITUTION_ADMIN_ROLE` before allowing mint
- ✅ Shows permission status (Authorized/Denied)
- ✅ Displays institution name if admin
- ✅ Fixed mint function signature (auto-generates tokenId)
- ✅ Uses Web Crypto API for student hash generation

#### Institution Page (`/institution`)
- ✅ Checks permissions before showing management features
- ✅ Shows access status banner
- ✅ Displays institution information

#### Home Page (`/`)
- ✅ Shows detected blockchain roles when wallet connected
- ✅ Suggests appropriate UI role based on permissions
- ✅ Warns if wallet has no blockchain roles

## User Flow

### For Institution Admins

1. **Connect Wallet** → System checks blockchain roles
2. **If has INSTITUTION_ADMIN_ROLE**:
   - ✅ Green banner: "Authorized: You have permission"
   - ✅ Can mint credentials
   - ✅ Can revoke credentials
   - ✅ Institution name displayed

3. **If doesn't have role**:
   - ❌ Red banner: "Access Denied"
   - ❌ Mint/Revoke buttons disabled
   - ℹ️ Message: "Contact contract owner to be onboarded"

### For Students

- No blockchain role needed
- Can view their own credentials (NFTs they own)
- Can manage privacy settings
- UI role selection is manual (for navigation)

### For Employers

- Can verify credentials (no role required, but can be granted EMPLOYER_VERIFIER_ROLE)
- Verification is rate-limited (1000 per day per address)

## Key Features

### ✅ Permission Verification
- All admin actions check blockchain roles before execution
- Prevents unauthorized minting attempts
- Clear error messages when permissions are missing

### ✅ Real-Time Role Detection
- Automatically detects roles when wallet connects
- Updates UI based on actual permissions
- Shows institution information for admins

### ✅ User-Friendly Feedback
- Color-coded banners (Green = Authorized, Red = Denied, Yellow = Warning)
- Loading states while checking permissions
- Clear instructions for getting roles

### ✅ Security
- Frontend checks prevent unnecessary transaction attempts
- Blockchain enforces permissions (double protection)
- Role changes require contract owner approval

## Usage Examples

### Check if user has permission:
```typescript
import { useAccessControl } from '../hooks/useAccessControl';

function MyComponent() {
  const { isInstitutionAdmin, isLoading } = useAccessControl();
  
  if (isLoading) return <div>Checking permissions...</div>;
  if (!isInstitutionAdmin) return <div>Access Denied</div>;
  
  return <div>Admin Features</div>;
}
```

### Get suggested UI role:
```typescript
const { getSuggestedRole } = useAccessControl();
const suggestedRole = getSuggestedRole(); // 'institution' | 'employer' | null
```

### Check specific role:
```typescript
import { checkRole } from '../lib/contract';

const hasRole = await checkRole(address, 'INSTITUTION_ADMIN');
```

## Onboarding Flow

To grant INSTITUTION_ADMIN_ROLE to a new institution:

1. Contract owner calls `onboardInstitution()`:
   ```solidity
   onboardInstitution(
     institutionAddress,  // Institution wallet address
     adminAddress,        // Admin wallet address
     "Meru University",   // Institution name
     "ipfs://..."        // Institution metadata URI
   )
   ```

2. This automatically:
   - Grants `INSTITUTION_ADMIN_ROLE` to admin address
   - Links admin to institution
   - Creates institution record

3. Admin can now:
   - Mint credentials
   - Revoke credentials
   - Update institution metadata

## Testing

To test access control:

1. **Deploy contract** (owner gets all roles by default)
2. **Connect owner wallet** → Should see "Authorized" banner
3. **Try minting** → Should work
4. **Connect different wallet** → Should see "Access Denied"
5. **Onboard new institution** → New admin can now mint

## Next Steps

- [ ] Add role revocation UI for contract owner
- [ ] Add institution onboarding UI (for contract owner)
- [ ] Add employer verifier role management
- [ ] Add role history/audit log
- [ ] Add multi-admin support per institution

---

**Status:** ✅ Complete and Ready for Testing

All access control features are implemented and ready. The system now properly verifies blockchain permissions before allowing actions, providing a secure and user-friendly experience.
