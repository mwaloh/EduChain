// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract AcademicCredential is ERC721, AccessControl {
    using Strings for uint256;

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct CredentialStatus {
        bool revoked;
        uint64 issuedOn;
        uint64 expiresOn; // 0 if no expiry
        string ipfsCid;   // metadata CID
    }

    // Add totalIssued for supply tracking
    uint256 public totalIssued;

    mapping(uint256 => CredentialStatus) private _status;

    error Soulbound();

    constructor(address admin) ERC721("EduCredChain", "EDUCRD") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
    }

    function mint(
        address to,
        uint256 tokenId,
        string calldata ipfsCid,
        uint64 issuedOn,
        uint64 expiresOn
    ) external onlyRole(ISSUER_ROLE) {
        _safeMint(to, tokenId);
        _status[tokenId] = CredentialStatus(false, issuedOn, expiresOn, ipfsCid);
        totalIssued += 1;
    }

    function revoke(uint256 tokenId, bool value) external onlyRole(ISSUER_ROLE) {
        _requireOwned(tokenId);
        _status[tokenId].revoked = value;
    }

    function status(uint256 tokenId) external view returns (CredentialStatus memory) {
        _requireOwned(tokenId);
        return _status[tokenId];
    }

    // Native supply function for frontend/statistics
    function totalSupply() external view returns (uint256) {
        return totalIssued;
    }

    // Non-transferable (soulbound)
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string(abi.encodePacked("ipfs://", _status[tokenId].ipfsCid));
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}


