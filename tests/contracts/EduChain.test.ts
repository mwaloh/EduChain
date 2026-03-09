/**
 * Comprehensive test suite for EduChain contract
 */

import { expect } from 'chai';
import { ethers } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import hre from 'hardhat';

describe('EduChain', function () {
  async function deployEduChainFixture() {
    const [owner, institutionAdmin, student, employer, attacker] = await hre.ethers.getSigners();

    const EduChain = await hre.ethers.getContractFactory('EduChain');
    const contract = await EduChain.deploy(owner.address);

    return {
      contract,
      owner,
      institutionAdmin,
      student,
      employer,
      attacker,
    };
  }

  describe('Deployment', function () {
    it('Should set the right owner', async function () {
      const { contract, owner } = await loadFixture(deployEduChainFixture);
      expect(await contract.owner()).to.equal(owner.address);
    });

    it('Should grant owner DEFAULT_ADMIN_ROLE', async function () {
      const { contract, owner } = await loadFixture(deployEduChainFixture);
      const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
      expect(await contract.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });
  });

  describe('Institution Onboarding', function () {
    it('Should onboard a new institution', async function () {
      const { contract, owner, institutionAdmin } = await loadFixture(deployEduChainFixture);

      const institutionAddress = institutionAdmin.address;
      const institutionName = 'Meru University';
      const metadataURI = 'ipfs://QmTest';

      const tx = await contract.connect(owner).onboardInstitution(
        institutionAddress,
        institutionAdmin.address,
        institutionName,
        metadataURI
      );
      
      await expect(tx)
        .to.emit(contract, 'InstitutionOnboarded')
        .withArgs(institutionAddress, institutionAdmin.address, institutionName);

      const institution = await contract.institutions(institutionAddress);
      expect(institution.name).to.equal(institutionName);
      expect(institution.active).to.be.true;
    });

    it('Should revert if non-owner tries to onboard', async function () {
      const { contract, attacker, institutionAdmin } = await loadFixture(deployEduChainFixture);

      await expect(
        contract.connect(attacker).onboardInstitution(
          institutionAdmin.address,
          institutionAdmin.address,
          'Test University',
          ''
        )
      ).to.be.revertedWithCustomError(contract, 'OwnableUnauthorizedAccount');
    });
  });

  describe('Credential Minting', function () {
    it('Should mint a credential', async function () {
      const { contract, owner, institutionAdmin, student } = await loadFixture(deployEduChainFixture);

      // Onboard institution first
      await contract.connect(owner).onboardInstitution(
        institutionAdmin.address,
        institutionAdmin.address,
        'Test University',
        ''
      );

      const ipfsCid = 'QmTest123';
      const issuedOn = Math.floor(Date.now() / 1000);
      const expiresOn = 0;
      const studentHash = ethers.id('student-test-data');

      const mintTx = await contract.connect(institutionAdmin).mint(
        student.address,
        ipfsCid,
        issuedOn,
        expiresOn,
        studentHash
      );
      
      await expect(mintTx)
        .to.emit(contract, 'CredentialMinted');

      expect(await contract.balanceOf(student.address)).to.equal(1);
      expect(await contract.totalSupply()).to.equal(1);
    });

    it('Should revert if unauthorized user tries to mint', async function () {
      const { contract, attacker, student } = await loadFixture(deployEduChainFixture);

      await expect(
        contract.connect(attacker).mint(
          student.address,
          'QmTest',
          Math.floor(Date.now() / 1000),
          0,
          ethers.id('test')
        )
      ).to.be.revertedWithCustomError(contract, 'AccessControlUnauthorizedAccount');
    });

    it('Should revert if institution is not active', async function () {
      const { contract, owner, institutionAdmin, student } = await loadFixture(deployEduChainFixture);

      // Onboard then revoke
      await contract.connect(owner).onboardInstitution(
        institutionAdmin.address,
        institutionAdmin.address,
        'Test University',
        ''
      );
      await contract.connect(owner).revokeInstitution(institutionAdmin.address);

      await expect(
        contract.connect(institutionAdmin).mint(
          student.address,
          'QmTest',
          Math.floor(Date.now() / 1000),
          0,
          ethers.id('test')
        )
      ).to.be.reverted;
    });
  });

  describe('Soulbound Logic', function () {
    it('Should prevent transfers', async function () {
      const { contract, owner, institutionAdmin, student, attacker } = await loadFixture(deployEduChainFixture);

      // Setup and mint
      await contract.connect(owner).onboardInstitution(
        institutionAdmin.address,
        institutionAdmin.address,
        'Test University',
        ''
      );

      const tokenId = await contract.connect(institutionAdmin).mint.staticCall(
        student.address,
        'QmTest',
        Math.floor(Date.now() / 1000),
        0,
        ethers.id('test')
      );

      await contract.connect(institutionAdmin).mint(
        student.address,
        'QmTest',
        Math.floor(Date.now() / 1000),
        0,
        ethers.id('test')
      );

      // Attempt transfer
      await expect(
        contract.connect(student).transferFrom(student.address, attacker.address, tokenId)
      ).to.be.revertedWithCustomError(contract, 'Soulbound');
    });
  });

  describe('Revocation', function () {
    it('Should revoke a credential', async function () {
      const { contract, owner, institutionAdmin, student } = await loadFixture(deployEduChainFixture);

      // Setup and mint
      await contract.connect(owner).onboardInstitution(
        institutionAdmin.address,
        institutionAdmin.address,
        'Test University',
        ''
      );

      const mintTx = await contract.connect(institutionAdmin).mint(
        student.address,
        'QmTest',
        Math.floor(Date.now() / 1000),
        0,
        ethers.id('test')
      );

      const receipt = await mintTx.wait();
      const mintEvent = receipt?.logs.find((log: any) => {
        try {
          return contract.interface.parseLog(log)?.name === 'CredentialMinted';
        } catch {
          return false;
        }
      });
      const tokenId = contract.interface.parseLog(mintEvent!).args[1];

      const reason = 'Academic misconduct';

      await expect(
        contract.connect(institutionAdmin).revoke(tokenId, reason)
      )
        .to.emit(contract, 'CredentialRevoked');

      const status = await contract.getCredentialStatus(tokenId);
      expect(status.revoked).to.be.true;
      expect(status.revocationReason).to.equal(reason);
    });

    it('Should revert if non-issuing institution tries to revoke', async function () {
      const { contract, owner, institutionAdmin, student, attacker } = await loadFixture(deployEduChainFixture);

      await contract.connect(owner).onboardInstitution(
        institutionAdmin.address,
        institutionAdmin.address,
        'Test University',
        ''
      );

      const mintTx = await contract.connect(institutionAdmin).mint(
        student.address,
        'QmTest',
        Math.floor(Date.now() / 1000),
        0,
        ethers.id('test')
      );

      const receipt = await mintTx.wait();
      const mintEvent = receipt?.logs.find((log: any) => {
        try {
          return contract.interface.parseLog(log)?.name === 'CredentialMinted';
        } catch {
          return false;
        }
      });
      const tokenId = contract.interface.parseLog(mintEvent!).args[1];

      // Onboard different institution
      await contract.connect(owner).onboardInstitution(
        attacker.address,
        attacker.address,
        'Other University',
        ''
      );

      await expect(
        contract.connect(attacker).revoke(tokenId, 'reason')
      ).to.be.reverted;
    });
  });

  describe('Verification', function () {
    it('Should verify a valid credential', async function () {
      const { contract, owner, institutionAdmin, student, employer } = await loadFixture(deployEduChainFixture);

      await contract.connect(owner).onboardInstitution(
        institutionAdmin.address,
        institutionAdmin.address,
        'Test University',
        ''
      );

      const mintTx = await contract.connect(institutionAdmin).mint(
        student.address,
        'QmTest',
        Math.floor(Date.now() / 1000),
        0,
        ethers.id('test')
      );

      const receipt = await mintTx.wait();
      const mintEvent = receipt?.logs.find((log: any) => {
        try {
          return contract.interface.parseLog(log)?.name === 'CredentialMinted';
        } catch {
          return false;
        }
      });
      const tokenId = contract.interface.parseLog(mintEvent!).args[1];

      await expect(
        contract.connect(employer).verify(tokenId)
      )
        .to.emit(contract, 'CredentialVerified');

      const status = await contract.getCredentialStatus(tokenId);
      expect(status.revoked).to.be.false;
    });

    it('Should return revoked status for revoked credential', async function () {
      const { contract, owner, institutionAdmin, student, employer } = await loadFixture(deployEduChainFixture);

      await contract.connect(owner).onboardInstitution(
        institutionAdmin.address,
        institutionAdmin.address,
        'Test University',
        ''
      );

      const mintTx = await contract.connect(institutionAdmin).mint(
        student.address,
        'QmTest',
        Math.floor(Date.now() / 1000),
        0,
        ethers.id('test')
      );

      const receipt = await mintTx.wait();
      const mintEvent = receipt?.logs.find((log: any) => {
        try {
          return contract.interface.parseLog(log)?.name === 'CredentialMinted';
        } catch {
          return false;
        }
      });
      const tokenId = contract.interface.parseLog(mintEvent!).args[1];

      await contract.connect(institutionAdmin).revoke(tokenId, 'reason');

      const verifyTx = await contract.connect(employer).verify(tokenId);
      const verifyReceipt = await verifyTx.wait();
      
      const verifyEvent = verifyReceipt?.logs.find((log: any) => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed?.name === 'CredentialVerified';
        } catch {
          return false;
        }
      });

      const parsed = contract.interface.parseLog(verifyEvent!);
      expect(Number(parsed.args[4])).to.equal(1); // 1 = Revoked
    });
  });

  describe('Pausable', function () {
    it('Should pause the contract', async function () {
      const { contract, owner } = await loadFixture(deployEduChainFixture);

      await contract.connect(owner).pause();
      expect(await contract.paused()).to.be.true;
    });

    it('Should prevent operations when paused', async function () {
      const { contract, owner, institutionAdmin, student } = await loadFixture(deployEduChainFixture);

      await contract.connect(owner).onboardInstitution(
        institutionAdmin.address,
        institutionAdmin.address,
        'Test University',
        ''
      );

      await contract.connect(owner).pause();

      await expect(
        contract.connect(institutionAdmin).mint(
          student.address,
          'QmTest',
          Math.floor(Date.now() / 1000),
          0,
          ethers.id('test')
        )
      ).to.be.revertedWithCustomError(contract, 'EnforcedPause');
    });
  });

  describe('Privacy Features', function () {
    it('Should allow student to set reveal consent', async function () {
      const { contract, owner, institutionAdmin, student } = await loadFixture(deployEduChainFixture);

      await contract.connect(owner).onboardInstitution(
        institutionAdmin.address,
        institutionAdmin.address,
        'Test University',
        ''
      );

      const mintTx = await contract.connect(institutionAdmin).mint(
        student.address,
        'QmTest',
        Math.floor(Date.now() / 1000),
        0,
        ethers.id('test')
      );

      const receipt = await mintTx.wait();
      const mintEvent = receipt?.logs.find((log: any) => {
        try {
          return contract.interface.parseLog(log)?.name === 'CredentialMinted';
        } catch {
          return false;
        }
      });
      const tokenId = contract.interface.parseLog(mintEvent!).args[1];

      await contract.connect(student).setRevealConsent(tokenId, true);
      // Note: No direct getter for revealConsent in current contract design
      // This would need to be added or accessed via events
    });
  });

});

