// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EduRewardToken
 * @notice Simple ERC20 token used to incentivize learning activities
 * @dev The contract owner can mint rewards to learners, institutions, or content creators.
 *
 * Example uses:
 * - Reward students when a new credential is issued
 * - Reward employers/institutions that frequently verify credentials
 * - Reward educators who publish verified learning content
 */
contract EduRewardToken is ERC20, Ownable {
    uint8 private constant DECIMALS = 18;

    constructor(address initialOwner) ERC20("EduReward Token", "EDU") Ownable(initialOwner) {
        // Optional: mint an initial supply to the owner for distribution
        _mint(initialOwner, 1_000_000 * (10 ** uint256(DECIMALS)));
    }

    /**
     * @notice Mint rewards to an address
     * @dev Only the owner (platform admin) can mint new tokens
     * @param to Recipient address
     * @param amount Amount of tokens to mint (in wei, 10^18 = 1 EDU)
     */
    function mintReward(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }
}

