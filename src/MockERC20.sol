// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/token/ERC20/ERC20.sol";
import "@openzeppelin/access/Ownable.sol";
import "@openzeppelin/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title MockERC20
 * @dev Mock ERC-20 token for testing purposes with minting capability.
 *
 * This contract is for testing only and should never be used in production.
 * It inherits OpenZeppelin's ERC20, ERC20Permit, and Ownable to provide a
 * fully compliant ERC-20 with EIP-2612 permit support and owner-controlled
 * minting/burning.
 *
 * NOTE: Decimals are configured by overriding the virtual `decimals()`
 * function rather than using the removed `_setupDecimals` helper from
 * older OpenZeppelin versions.
 */
contract MockERC20 is ERC20, ERC20Permit, Ownable {
    /// @dev Configured number of decimals for this token.
    uint8 private _tokenDecimals;

    /**
     * @dev Creates a new mock token.
     * @param name_ The token name.
     * @param symbol_ The token symbol.
     * @param decimals_ The number of decimals (commonly 6 for USD-pegged
     *        tokens, 18 for ETH-pegged tokens).
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) ERC20(name_, symbol_) ERC20Permit(name_) Ownable(msg.sender) {
        _tokenDecimals = decimals_;
    }

    /**
     * @notice Returns the number of decimals used by the token.
     */
    function decimals() public view virtual override returns (uint8) {
        return _tokenDecimals;
    }

    /**
     * @notice Mints new tokens to the specified account.
     * @dev Only callable by the owner (test-only functionality).
     * @param to The address to receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "MockERC20: mint to zero address");
        require(amount > 0, "MockERC20: mint zero amount");
        _mint(to, amount);
    }

    /**
     * @notice Burns tokens from the specified account.
     * @dev Only callable by the owner (test-only functionality).
     * @param from The address to burn tokens from.
     * @param amount The amount of tokens to burn.
     */
    function burn(address from, uint256 amount) external onlyOwner {
        require(from != address(0), "MockERC20: burn from zero address");
        require(amount > 0, "MockERC20: burn zero amount");
        _burn(from, amount);
    }
}
