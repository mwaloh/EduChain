// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title EduChain
 * @notice Decentralized academic credential management and verification platform
 * @dev Soulbound NFTs for academic credentials with multi-institution support
 */
contract EduChain is ERC721, AccessControl, Ownable, Pausable, ReentrancyGuard {
    using Strings for uint256;

    // Role definitions
    bytes32 public constant INSTITUTION_ADMIN_ROLE = keccak256("INSTITUTION_ADMIN_ROLE");
    bytes32 public constant EMPLOYER_VERIFIER_ROLE = keccak256("EMPLOYER_VERIFIER_ROLE");
    
    // Credential status structure
    struct CredentialStatus {
        bool revoked;
        uint64 issuedOn;
        uint64 expiresOn; // 0 if no expiry
        string ipfsCid;   // IPFS metadata CID
        string revocationReason; // Reason for revocation (if applicable)
        address institution; // Issuing institution address
    }

    // Institution metadata
    struct InstitutionInfo {
        string name;
        string metadataURI; // IPFS URI for institution metadata
        bool active;
        uint256 credentialCount; // Total credentials issued by this institution
    }

    // Zero-knowledge privacy fields
    struct StudentIdentity {
        bytes32 studentHash; // SHA256 hash of student identity
        bool revealConsent; // Student consent to reveal personal data
        mapping(string => bool) selectiveDisclosure; // Field-level disclosure permissions
    }

    // Token ID to credential status
    mapping(uint256 => CredentialStatus) private _credentialStatus;
    
    // Token ID to student identity (privacy layer)
    mapping(uint256 => StudentIdentity) private _studentIdentity;
    
    // Institution address to metadata
    mapping(address => InstitutionInfo) public institutions;
    
    // Address to institution mapping (admin addresses)
    mapping(address => address) public adminToInstitution;
    
    // Tracking
    uint256 public totalIssued;
    uint256 private _nextTokenId = 1;

    // Events
    event CredentialMinted(
        address indexed to,
        uint256 indexed tokenId,
        address indexed institution,
        string ipfsCid,
        uint64 issuedOn,
        uint64 expiresOn
    );

    event CredentialRevoked(
        uint256 indexed tokenId,
        address indexed institution,
        string reason,
        uint256 timestamp
    );

    event CredentialVerified(
        address indexed verifier,
        uint256 indexed tokenId,
        address indexed institution,
        uint256 timestamp,
        VerificationStatus status
    );

    event InstitutionOnboarded(
        address indexed institutionAddress,
        address indexed adminAddress,
        string name,
        uint256 timestamp
    );

    event InstitutionRevoked(
        address indexed institutionAddress,
        uint256 timestamp
    );

    enum VerificationStatus {
        Valid,
        Revoked,
        Expired,
        Invalid
    }

    // Errors
    error Soulbound();
    error UnauthorizedInstitution();
    error CredentialNotFound();
    error InvalidTokenId();
    error InstitutionNotActive();
    error RateLimitExceeded();

    // Rate limiting for verification (per address per day)
    mapping(address => mapping(uint256 => uint256)) private _verificationCount;
    uint256 public constant MAX_VERIFICATIONS_PER_DAY = 1000;
    uint256 private constant DAY_IN_SECONDS = 86400;

    constructor(address initialOwner) 
        ERC721("EduChain Credentials", "EDUCHAIN") 
        Ownable(initialOwner)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(INSTITUTION_ADMIN_ROLE, initialOwner);
        _grantRole(EMPLOYER_VERIFIER_ROLE, initialOwner);
    }

    /**
     * @notice Mint a new academic credential (Soulbound NFT)
     * @dev Only callable by authorized institution admins
     * @param to Student address to receive the credential
     * @param ipfsCid IPFS CID containing credential metadata
     * @param issuedOn Unix timestamp of issuance
     * @param expiresOn Unix timestamp of expiry (0 for no expiry)
     * @param studentHash SHA256 hash of student identity (for privacy)
     */
    function mint(
        address to,
        string calldata ipfsCid,
        uint64 issuedOn,
        uint64 expiresOn,
        bytes32 studentHash
    ) external onlyRole(INSTITUTION_ADMIN_ROLE) whenNotPaused nonReentrant returns (uint256) {
        address institution = adminToInstitution[msg.sender];
        require(institution != address(0), "Unauthorized: Not linked to institution");
        require(institutions[institution].active, "Institution not active");

        uint256 tokenId = _nextTokenId++;
        
        _safeMint(to, tokenId);
        
        _credentialStatus[tokenId] = CredentialStatus({
            revoked: false,
            issuedOn: issuedOn,
            expiresOn: expiresOn,
            ipfsCid: ipfsCid,
            revocationReason: "",
            institution: institution
        });

        _studentIdentity[tokenId].studentHash = studentHash;
        _studentIdentity[tokenId].revealConsent = false; // Default: no consent

        institutions[institution].credentialCount++;
        totalIssued++;

        emit CredentialMinted(to, tokenId, institution, ipfsCid, issuedOn, expiresOn);
        
        return tokenId;
    }

    /**
     * @notice Revoke a credential (for fraud/misconduct)
     * @dev Only callable by the issuing institution
     * @param tokenId Token ID of credential to revoke
     * @param reason Reason for revocation
     */
    function revoke(
        uint256 tokenId,
        string calldata reason
    ) external onlyRole(INSTITUTION_ADMIN_ROLE) whenNotPaused {
        CredentialStatus storage cred = _credentialStatus[tokenId];
        require(_ownerOf(tokenId) != address(0), "Credential not found");
        
        address institution = adminToInstitution[msg.sender];
        require(cred.institution == institution, "Unauthorized: Not issuing institution");
        require(!cred.revoked, "Credential already revoked");

        cred.revoked = true;
        cred.revocationReason = reason;

        emit CredentialRevoked(tokenId, institution, reason, block.timestamp);
    }

    /**
     * @notice Verify a credential's authenticity
     * @dev Emits verification event for analytics
     * @param tokenId Token ID to verify
     * @return status Verification status
     */
    function verify(
        uint256 tokenId
    ) external whenNotPaused nonReentrant returns (VerificationStatus) {
        // Rate limiting check
        uint256 today = block.timestamp / DAY_IN_SECONDS;
        require(
            _verificationCount[msg.sender][today] < MAX_VERIFICATIONS_PER_DAY,
            "Rate limit exceeded"
        );
        _verificationCount[msg.sender][today]++;

        if (_ownerOf(tokenId) == address(0)) {
            emit CredentialVerified(msg.sender, tokenId, address(0), block.timestamp, VerificationStatus.Invalid);
            return VerificationStatus.Invalid;
        }

        CredentialStatus memory cred = _credentialStatus[tokenId];
        VerificationStatus status;

        if (cred.revoked) {
            status = VerificationStatus.Revoked;
        } else if (cred.expiresOn > 0 && block.timestamp > cred.expiresOn) {
            status = VerificationStatus.Expired;
        } else {
            status = VerificationStatus.Valid;
        }

        emit CredentialVerified(
            msg.sender,
            tokenId,
            cred.institution,
            block.timestamp,
            status
        );

        return status;
    }

    /**
     * @notice Get credential status
     * @param tokenId Token ID to query
     * @return status Credential status struct
     */
    function getCredentialStatus(uint256 tokenId) external view returns (CredentialStatus memory) {
        require(_ownerOf(tokenId) != address(0), "Credential not found");
        return _credentialStatus[tokenId];
    }

    /**
     * @notice Get student identity hash (for privacy)
     * @param tokenId Token ID to query
     * @return studentHash SHA256 hash of student identity
     */
    function getStudentHash(uint256 tokenId) external view returns (bytes32) {
        require(_ownerOf(tokenId) != address(0), "Credential not found");
        return _studentIdentity[tokenId].studentHash;
    }

    /**
     * @notice Update student reveal consent
     * @dev Only token owner can update consent
     * @param tokenId Token ID
     * @param consent Whether to allow data revelation
     */
    function setRevealConsent(uint256 tokenId, bool consent) external {
        require(_ownerOf(tokenId) == msg.sender, "Not token owner");
        _studentIdentity[tokenId].revealConsent = consent;
    }

    /**
     * @notice Toggle selective disclosure for a field
     * @dev Only token owner can update disclosure
     * @param tokenId Token ID
     * @param field Field name (e.g., "name", "idNumber")
     * @param allowed Whether to allow disclosure
     */
    function setSelectiveDisclosure(
        uint256 tokenId,
        string calldata field,
        bool allowed
    ) external {
        require(_ownerOf(tokenId) == msg.sender, "Not token owner");
        _studentIdentity[tokenId].selectiveDisclosure[field] = allowed;
    }

    /**
     * @notice Onboard a new institution
     * @dev Only platform owner can onboard institutions
     * @param institutionAddress Institution contract/wallet address
     * @param adminAddress Admin address for this institution
     * @param name Institution name
     * @param metadataURI IPFS URI for institution metadata
     */
    function onboardInstitution(
        address institutionAddress,
        address adminAddress,
        string calldata name,
        string calldata metadataURI
    ) external onlyOwner {
        require(institutionAddress != address(0) && adminAddress != address(0), "Invalid address");
        require(!institutions[institutionAddress].active, "Institution already onboarded");

        institutions[institutionAddress] = InstitutionInfo({
            name: name,
            metadataURI: metadataURI,
            active: true,
            credentialCount: 0
        });

        adminToInstitution[adminAddress] = institutionAddress;
        _grantRole(INSTITUTION_ADMIN_ROLE, adminAddress);

        emit InstitutionOnboarded(institutionAddress, adminAddress, name, block.timestamp);
    }

    /**
     * @notice Revoke institution's issuance rights
     * @dev Only platform owner can revoke
     * @param institutionAddress Institution address to revoke
     */
    function revokeInstitution(address institutionAddress) external onlyOwner {
        require(institutions[institutionAddress].active, "Institution not active");
        
        institutions[institutionAddress].active = false;
        
        // Find and revoke admin role
        // Note: In production, maintain a mapping of admins per institution for easier revocation
        emit InstitutionRevoked(institutionAddress, block.timestamp);
    }

    /**
     * @notice Update institution metadata
     * @dev Only institution admin can update
     * @param metadataURI New IPFS URI
     */
    function updateInstitutionMetadata(string calldata metadataURI) external onlyRole(INSTITUTION_ADMIN_ROLE) {
        address institution = adminToInstitution[msg.sender];
        require(institution != address(0), "Unauthorized");
        require(institutions[institution].active, "Institution not active");
        
        institutions[institution].metadataURI = metadataURI;
    }

    /**
     * @notice Grant employer verifier role
     * @dev Only owner can grant
     * @param verifier Verifier address
     */
    function grantEmployerVerifier(address verifier) external onlyOwner {
        _grantRole(EMPLOYER_VERIFIER_ROLE, verifier);
    }

    /**
     * @notice Revoke employer verifier role
     * @dev Only owner can revoke
     * @param verifier Verifier address
     */
    function revokeEmployerVerifier(address verifier) external onlyOwner {
        _revokeRole(EMPLOYER_VERIFIER_ROLE, verifier);
    }

    /**
     * @notice Pause contract (emergency stop)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Get token URI (IPFS)
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return string(abi.encodePacked("ipfs://", _credentialStatus[tokenId].ipfsCid));
    }

    /**
     * @notice Total supply
     */
    function totalSupply() external view returns (uint256) {
        return totalIssued;
    }

    /**
     * @notice Soulbound: disable transfers except mint/burn
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        // Allow mint (from == address(0)) and burn (to == address(0))
        // Disallow all transfers
        if (from != address(0) && to != address(0)) {
            revert Soulbound();
        }
        return super._update(to, tokenId, auth);
    }

    /**
     * @notice Support interfaces
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

