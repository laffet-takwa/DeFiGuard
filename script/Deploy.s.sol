// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MockERC20.sol";
import "../src/LendingPool.sol";

/**
 * @title Deploy
 * @dev Deployment script for DeFiGuard lending protocol.
 */
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        
        // Deploy mock tokens
        MockERC20 weth = new MockERC20("Wrapped Ether", "WETH", 18);
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        
        // Deploy lending pool
        LendingPool pool = new LendingPool(address(weth), address(usdc));
        
        // Mint test tokens to deployer for testing
        weth.mint(msg.sender, 1000 ether);
        usdc.mint(msg.sender, 2_000_000 * 1e6);
        
        // Approve pool to spend tokens
        weth.approve(address(pool), type(uint256).max);
        usdc.approve(address(pool), type(uint256).max);
        
        vm.stopBroadcast();
        
        // Log addresses
        console.log("WETH deployed at:", address(weth));
        console.log("USDC deployed at:", address(usdc));
        console.log("LendingPool deployed at:", address(pool));
        console.log("Deployer:", msg.sender);
    }
}