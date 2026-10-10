// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/LendingPool.sol";
import "../src/MockERC20.sol";

contract LendingPoolTest is Test {
    MockERC20 internal collateralToken;
    MockERC20 internal borrowToken;
    LendingPool internal pool;
    address internal user;
    function setUp() public {
        user = address(0x1);
        collateralToken = new MockERC20("WETH", "WETH", 18);
        borrowToken = new MockERC20("USDC", "USDC", 18);
        pool = new LendingPool(address(collateralToken), address(borrowToken));
        collateralToken.mint(user, 1000 ether);
        borrowToken.mint(user, 1000000 ether);
        borrowToken.mint(address(pool), 1000000 ether);
        vm.prank(user);
        collateralToken.approve(address(pool), type(uint256).max);
        vm.prank(user);
        borrowToken.approve(address(pool), type(uint256).max);
    }
    function testDeposit() public {
        vm.prank(user);
        pool.deposit(10 ether);
        assertEq(pool.collateralBalance(user), 10 ether);
    }

    function testDeployment() public {
        assertEq(address(pool.collateralToken()), address(collateralToken));
        assertEq(address(pool.borrowToken()), address(borrowToken));
        assertEq(pool.exchangeRate(), 2000 * 1e18);
        assertFalse(pool.paused());
    }

    function testWithdraw() public {
        vm.prank(user);
        pool.deposit(10 ether);
        vm.prank(user);
        pool.withdraw(5 ether);
        assertEq(pool.collateralBalance(user), 5 ether);
    }
    
    function testBorrow() public {
        vm.prank(user);
        pool.deposit(10 ether);
        vm.prank(user);
        pool.borrow(1000 ether);
        assertEq(pool.debtBalance(user), 1000 ether);
    }
    
    function testRepay() public {
        vm.prank(user);
        pool.deposit(10 ether);
        vm.prank(user);
        pool.borrow(1000 ether);
        vm.prank(user);
        pool.repay(500 ether);
        assertEq(pool.debtBalance(user), 500 ether);
    }
    
    function testBorrowExceedsLimit() public {
        vm.prank(user);
        pool.deposit(10 ether);
        vm.prank(user);
        vm.expectRevert(LendingPool.ExceedsBorrowLimit.selector);
        pool.borrow(20000 ether);
    }
    
    function testZeroAmount() public {
        vm.prank(user);
        vm.expectRevert(LendingPool.ZeroAmount.selector);
        pool.deposit(0);
    }
    
    function testPause() public {
        pool.setPaused(true);
        vm.prank(user);
        vm.expectRevert(LendingPool.PoolPausedError.selector);
        pool.deposit(10 ether);
    }
}