# Step 2: W3C Verifiable Credentials Implementation Roadmap

**Current Status**: Ready to Start  
**Estimated Duration**: 2-3 days (code + testing)  
**Complexity**: Medium  
**Impact**: High (institutional standards compliance)

---

## 🎯 Objective

Wrap EduChain credentials in W3C Verifiable Credential (VC) format to:
- ✅ Enable institutional systems integration
- ✅ Support legacy credential verification systems
- ✅ Gain recognition from accreditation bodies
- ✅ Facilitate cross-border credential portability

---

## 📋 What is a W3C Verifiable Credential?

### Standard Structure
```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://www.w3.org/2018/credentials/examples/v1"
  ],
  "type": ["VerifiableCredential", "AcademicCredential"],
  "issuer": "did:educhain:institution-id",
  "issuanceDate": "2026-04-04T10:00:00Z",
  "credentialSubject": {
    "id": "did:educhain:student-wallet",
    "name": "John Doe",
    "degree": "Bachelor of Science",
    "program": "Computer Science",
    "graduationDate": "2026-05-15"
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "2026-04-04T10:00:00Z",
    "proofPurpose": "assertionMethod",
    "verificationMethod": "did:educhain:institution-id#keys-1",
    "signatureValue": "eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNydCI6ZmFsc2V9"
  }
}
```

### Benefits
- **Portable**: Works across institutions globally
- **Verifiable**: Contains cryptographic proof
- **Privacy-Preserving**: Selective disclosure possible
- **Machine-Readable**: JSON-LD format
- **Standards-Based**: W3C recommendation

---

## 🏗️ Architecture Design

### Component Diagram
```
EduChain Smart Contract (on-chain data)
    ↓
    └─→ EduChain Credential (blockchain)
            ↓
            ├─→ IPFS Metadata (student name, program, GPA)
            └─→ Revocation Status
    ↓
W3C VC Wrapper Service (NEW)
    ├─→ VerifiableCredentialService.ts (200 lines)
    ├─→ vcConfig.ts (150 lines)
    ├─→ vc.ts API Routes (200 lines)
    └─→ JSON-LD Context Definitions
    ↓
Database Tracking
    ├─→ CredentialVC model (store VC metadata)
    └─→ VCIssuance model (track VC exports)
    ↓
API Endpoints
    ├─→ GET /api/vc/:credentialId → Export as VC
    ├─→ POST /api/vc/verify → Verify VC signature
    ├─→ POST /api/vc/import → Import VC
    └─→ GET /api/vc/context → JSON-LD contexts
```

---

## 📝 Implementation Plan

### Phase 2.1: Core VC Service (Day 1)

**Create**: `backend/src/services/VerifiableCredentialService.ts`

```typescript
export class VerifiableCredentialService {
  // Core Methods:
  
  async createVC(credential: Credential): Promise<VerifiableCredential>
  // Wraps EduChain credential in VC format
  
  async signVC(vc: VerifiableCredential, issuerKey: string): Promise<SignedVC>
  // Signs VC with institution's keypair
  
  async verifyVC(signedVC: SignedVC): Promise<boolean>
  // Validates VC signature and structure
  
  async getSelectiveDisclosure(vc: VC, fields: string[]): Promise<VC>
  // Returns only specified credential fields
  
  async exportAsJSON(vc: VC): Promise<string>
  async exportAsJWT(vc: VC): Promise<string>
  // Multiple export formats
}
```

**Responsibility**:
- Transform Credential → VC format
- Handle signing/verification
- Support selective disclosure
- Multiple export formats

**Dependencies**:
- `jsonld` library (JSON-LD processing)
- `node-jose` or similar for signing
- Existing RewardTokenService patterns

### Phase 2.2: VC Configuration (Day 1)

**Create**: `backend/src/config/vcConfig.ts`

```typescript
// JSON-LD Context Definitions
export const JSON_LD_CONTEXTS = {
  CORE: "https://www.w3.org/2018/credentials/v1",
  ACADEMIC: "https://purl.org/ctdl/terms/vocab/1",
  EDUCHAIN_CUSTOM: "https://educhain.io/credentials/v1"
};

// VC Type Map
export const VC_TYPES = {
  ACADEMIC_CREDENTIAL: "AcademicCredential",
  BACHELOR_DEGREE: "BachelorDegree",
  MASTER_DEGREE: "MasterDegree",
  ASSOCIATE_DEGREE: "AssociateDegree"
};

// Field Mappings (EduChain → VC)
export const FIELD_MAPPINGS = {
  "studentAddress": "id",
  "degree": "degree",
  "program": "specialization",
  "issuedOn": "issuanceDate",
  "expiresOn": "expirationDate"
};
```

**Responsibility**:
- Define JSON-LD contexts
- Map credential fields to VC format
- Support multiple credential types
- Custom EduChain extensions

### Phase 2.3: VC Routes (Day 1)

**Create**: `backend/src/routes/vc.ts`

```typescript
// 5 Core Endpoints

1. POST /api/vc/create
   // Create VC from credential
   // Input: credentialId
   // Output: Signed VC JSON

2. GET /api/vc/:credentialId/export
   // Export credential as VC
   // Query params: format=json|jwt, fields=selective

3. POST /api/vc/verify
   // Verify VC signature and proof
   // Input: signed VC
   // Output: isValid boolean + proof details

4. GET /api/vc/:credentialId/contexts
   // Retrieve JSON-LD contexts
   // Used by verifiers for processing

5. POST /api/vc/import
   // Import external VC (future compatibility)
   // Input: signed VC
   // Output: stored credential reference
```

### Phase 2.4: Database Schema Update (Day 1)

**Update**: `backend/db/schema.prisma`

```prisma
model CredentialVC {
  id                String    @id @default(cuid())
  credentialId      String    @unique
  credential        Credential @relation(fields: [credentialId], references: [id])
  
  // VC Metadata
  vcJson            String    // Full VC JSON
  signature         String    // Proof signature
  signatureAlgorithm String   // Ed25519Signature2020, etc.
  signedAt          DateTime
  expiresAt         DateTime?
  
  // Revocation Support
  revoked           Boolean   @default(false)
  revokedAt         DateTime?
  revocationReason  String?
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([credentialId])
  @@index([signedAt])
}

model VCIssuance {
  id                String    @id @default(cuid())
  credentialId      String
  issuedToEmail     String
  exportFormat      String    // "json" or "jwt"
  metadata          String?   // JSON: {requestedFields, timestamp, etc}
  createdAt         DateTime  @default(now())
  
  @@index([credentialId])
  @@index([issuedToEmail])
  @@index([createdAt])
}
```

### Phase 2.5: Integration & Testing (Days 2-3)

**Integration Points**:
1. Update `credentials.ts` to auto-generate VC on creation
2. Update `verify.ts` to accept VC format verification
3. Create `VCService` initialization similar to RewardTokenService
4. Register routes in `index.ts`

**Testing**:
1. Unit tests for VC generation
2. Integration tests for signing/verification
3. Cross-compatibility tests with standard validators
4. End-to-end tests with actual institutions

---

## 🛠️ Implementation Checklist

### Core Implementation
- [ ] Create `VerifiableCredentialService.ts` (200 lines)
  - [ ] Transform credential to VC structure
  - [ ] Implement signing mechanism
  - [ ] Implement verification logic
  - [ ] Selective disclosure support
  - [ ] Multiple export formats

- [ ] Create `vcConfig.ts` (150 lines)
  - [ ] JSON-LD contexts
  - [ ] Field mappings
  - [ ] Type definitions
  - [ ] Custom extensions

- [ ] Create `vc.ts` routes (200 lines)
  - [ ] POST /api/vc/create
  - [ ] GET /api/vc/:credentialId/export
  - [ ] POST /api/vc/verify
  - [ ] GET /api/vc/:credentialId/contexts
  - [ ] POST /api/vc/import

### Database & Integration
- [ ] Update Prisma schema (add `CredentialVC`, `VCIssuance`)
- [ ] Create database migration
- [ ] Update `credentials.ts` for auto-VC generation
- [ ] Update `verify.ts` to accept VC format
- [ ] Create `vcServiceInit.ts`
- [ ] Update `index.ts` to register routes

### Testing & Documentation
- [ ] Unit tests for VC service
- [ ] Integration tests for endpoints
- [ ] Validator compatibility tests
- [ ] Create `VC_INTEGRATION_GUIDE.md` (300+ lines)
- [ ] Update `OBJECTIVES_ACHIEVEMENT_ANALYSIS.md`

---

## 📚 Key Libraries to Add

```json
{
  "dependencies": {
    "jsonld": "^8.0.0",
    "jsonld-cli": "^2.6.0",
    "node-jose": "^2.2.0",
    "jose": "^5.0.0",
    "did-resolver": "^4.1.0"
  }
}
```

---

## 🎯 Success Criteria

### Technical
- ✅ All EduChain credentials exportable as W3C VC
- ✅ VC signatures verifiable by external tools
- ✅ Selective disclosure working correctly
- ✅ Compatible with VC validators (https://vc.unbleeded.id/)

### Business
- ✅ Institutions can integrate with legacy systems
- ✅ Students can share credentials with employers
- ✅ Cross-border credential portability enabled
- ✅ Compliance with W3C standards achieved

### Documentation
- ✅ Clear examples for developers
- ✅ Integration guide for institutions
- ✅ API documentation complete
- ✅ Troubleshooting guide included

---

## 🔗 Example: Complete VC Workflow

### 1. Student Receives Credential
```
Institution Admin → POST /api/credentials/record
  ↓
EduChain.mint(studentAddress, ipfsCid)
  ↓
Database: Credential created, Token rewards issued
  ↓
VCService: Automatically create VC from credential
  ↓
Database: CredentialVC record with signature
```

### 2. Student Exports as W3C VC
```
Student → GET /api/vc/:credentialId/export
  ↓
VCService: Retrieve credential + VC metadata
  ↓
Format as JSON-LD with proper contexts
  ↓
Return signed VC to student
```

### 3. Employer Verifies VC
```
Employer → POST /api/vc/verify
  Request Body: {signed VC}
  ↓
VCService: Verify signature against institution's DID
  ↓
Check credential not revoked in EduChain
  ↓
Return: {isValid: true, proof: {...}}
```

---

## 🚀 Performance Considerations

### Optimization Strategies
1. **Caching**: Store generated VCs with 24h TTL
2. **Lazy Generation**: Create VC only when requested
3. **Batch Operations**: Support bulk VC export
4. **JSON-LD Compaction**: Pre-compute common contexts

### Expected Performance
- Generate VC from credential: **100-200ms**
- Sign VC: **50-100ms**
- Verify signature: **10-50ms**
- Export to JSON/JWT: **1-10ms**

---

## 🔐 Security Considerations

### Key Management
- [ ] Institution keypair stored securely (not in database)
- [ ] Signing key rotatable
- [ ] Private keys protected via environment variables
- [ ] Key backup/recovery mechanism

### Verification
- [ ] Signature algorithm clearly specified
- [ ] Timestamp validation (not too old)
- [ ] Revocation status checked
- [ ] Proof format validation

### Privacy
- [ ] Selective disclosure prevents over-sharing
- [ ] Credential holder controls visibility
- [ ] No correlation attacks possible
- [ ] GDPR compliance maintained

---

## 📊 Expected Impact

### Adoption
- **Week 1**: 5-10 institutions adopt VC export
- **Month 1**: 30-50% of credentials exported as VC
- **Quarter 1**: Market leadership in institutional integration

### Compliance
- **W3C Compliance**: ✅ Full VC Data Model
- **Regulatory**: ✅ GDPR-compliant (selective disclosure)
- **Standards**: ✅ JSON-LD, JWT, multiple formats

---

## 🎓 Example Implementation: Create VC

```typescript
// Example from VerifiableCredentialService

async createVC(credential: Credential): Promise<VerifiableCredential> {
  // 1. Fetch credential metadata from IPFS
  const metadata = await fetchFromIPFS(credential.ipfsCid);
  
  // 2. Map to VC structure
  const vc = {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://educhain.io/credentials/v1"
    ],
    "type": ["VerifiableCredential", "AcademicCredential"],
    "issuer": `did:educhain:${credential.institutionId}`,
    "issuanceDate": credential.issuedOn.toISOString(),
    "expirationDate": credential.expiresOn?.toISOString(),
    "credentialSubject": {
      "id": `did:educhain:${credential.studentAddress}`,
      "name": metadata.studentName,
      "degree": metadata.degree,
      "program": metadata.program,
      "gpa": metadata.gpa,
      "graduationDate": metadata.graduationDate
    }
  };
  
  // 3. Sign with institution keypair
  const signed = await this.signVC(vc, institutionPrivateKey);
  
  // 4. Store in database
  await this.prisma.credentialVC.create({
    data: {
      credentialId: credential.id,
      vcJson: JSON.stringify(signed),
      signature: signed.proof.signatureValue,
      signatureAlgorithm: signed.proof.type,
      signedAt: new Date()
    }
  });
  
  return signed;
}
```

---

## 🔄 Timeline

| Phase | Task | Duration | Completion |
|-------|------|----------|------------|
| 2.1 | Core VC Service | 1 day | Day 1 |
| 2.2 | VC Configuration | 3 hours | Day 1 |
| 2.3 | API Routes | 4 hours | Day 1 |
| 2.4 | Database Schema | 2 hours | Day 1 |
| 2.5 | Integration | 1 day | Day 2 |
| 2.6 | Testing | 1 day | Day 2-3 |
| 2.7 | Documentation | Half day | Day 3 |

**Total**: **2-3 days** (including testing & documentation)

---

## ✅ Pre-Requisites

Before starting Step 2, ensure:
- [ ] Step 1 (Token Rewards) fully deployed
- [ ] All backend tests passing
- [ ] Database migrations applied
- [ ] EduChain contract verified on blockchain
- [ ] IPFS metadata retrieval working

---

## 📞 Support & Questions

If you have questions during Step 2 implementation:
1. Refer to [OBJECTIVES_ACHIEVEMENT_ANALYSIS.md](OBJECTIVES_ACHIEVEMENT_ANALYSIS.md)
2. Check W3C VC specification: https://www.w3.org/TR/vc-data-model/
3. Review similar implementations in other blockchain projects
4. Consult with institutional partners on specific requirements

---

## 📈 Post-Implementation Success Metrics

- ✅ 100% of credentials exportable as W3C VC format
- ✅ VC signatures verifiable by external validators
- ✅ 10+ institutions testing VC integration
- ✅ Zero compatibility issues reported
- ✅ Documentation rated clear by external developers

---

**Ready to start Step 2?** 🚀

Proceed with this roadmap when:
1. Step 1 (Token Rewards) is fully deployed & tested
2. All backend services running smoothly
3. Team wants to accelerate institutional adoption

Estimated completion: **Early next week** with focused effort.

---

*Document created: April 4, 2026*  
*Next review: After Step 2 implementation*  
*Status: Ready to Implement ✅*
