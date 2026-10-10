// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/token/ERC20/IERC20.sol";
import "@openzeppelin/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/utils/ReentrancyGuard.sol";
import "@openzeppelin/access/Ownable.sol";

/**
 * @title LendingPool
 * @dev Simplified single-collateral, single-borrow lending pool for educational purposes.
 *
 * ACCOUNTING MODEL
 * ================
 * - One collateral token (e.g. WETH) and one borrow token (e.g. USDC).
 * - Users deposit collateral, borrow against it, repay debt, and withdraw
 *   collateral while the position stays healthy.
 * - The pool must be pre-funded with the borrow token; borrowed funds are
 *   transferred from the pool's own borrow-token balance. In a production
 *   protocol, borrowed funds would come from lender deposits and interest
 *   would accrue over time. This MVP implements a 0% interest model.
 *
 * RISK PARAMETERS (fixed for this MVP)
 * ====================================
 * - Collateral factor:      75%  (max debt = 75% of collateral value)
 * - Liquidation threshold:  80%  (position healthy while
 *                                   collateralValue * 80% > debt)
 * - Exchange rate:          fixed, owner-settable (TESTING ONLY)
 *
 * HEALTH FACTOR
 * =============
 *   HF = (collateralValue * LIQUIDATION_THRESHOLD) / debt
 *   HF > 1e18  -> healthy
 *   HF = 1e18  -> exactly at the liquidation threshold
 *   HF < 1e18  -> undercollateralized
 *
 * SECURITY NOTES
 * ==============
 * - Uses OpenZeppelin ReentrancyGuard, SafeERC20 and Ownable.
 * - Follows Checks-Effects-Interactions on every state-changing function.
 * - Solidity 0.8.x checked arithmetic (no unchecked blocks).
 * - Custom errors on every revert path.
 * - Because COLLATERAL_FACTOR (75%) < LIQUIDATION_THRESHOLD (80%), any
 *   undercollateralized position automatically has zero available borrow,
 *   so `borrow` cannot increase an already-unsafe position.
 *
 * WARNING: The fixed exchange rate is for LOCAL TESTING ONLY. Do NOT deploy
 * to production without integrating a validated price oracle. This contract
 * has NOT been audited and is for educational purposes only.
 */
contract LendingPool is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ==================== Constants ====================

    /// @notice Maximum borrowable value as a fraction of collateral value (75%).
    uint256 public constant COLLATERAL_FACTOR = 750_000_000_000_000_000; // 0.75e18

    /// @notice Liquidation threshold (80%). A position is healthy while
    ///         collateralValue * LIQUIDATION_THRESHOLD > debt * PRECISION.
    uint256 public constant LIQUIDATION_THRESHOLD = 800_000_000_000_000_000; // 0.80e18

    /// @notice Fixed-point precision used for all ratio math.
    uint256 public constant PRECISION = 1e18;

    /// @notice Default exchange rate: 1 collateral unit = 2000 borrow units
    ///         (assumes both tokens use 18 decimals; adjust for other configs).
    uint256 public constant DEFAULT_EXCHANGE_RATE = 2000 * 1e18;

    // ==================== State ====================

    /// @notice Collateral token (e.g. WETH).
    IERC20 public immutable collateralToken;

    /// @notice Borrow token (e.g. USDC).
    IERC20 public immutable borrowToken;

    /// @notice Exchange rate: borrow units per collateral unit, scaled by PRECISION.
    ///         TESTING ONLY — replace with a price oracle for production.
    uint256 public exchangeRate;

    /// @notice User's deposited collateral balance.
    mapping(address => uint256) public collateralBalance;

    /// @notice User's outstanding debt (principal only; no interest in this MVP).
    mapping(address => uint256) public debtBalance;

    /// @notice Total collateral held by the pool.
    uint256 public totalCollateral;

    /// @notice Total outstanding debt across all users.
    uint256 public totalDebt;

    /// @notice Emergency pause flag. When true, all user-facing functions revert.
    bool public paused;

    // ==================== Events ====================

    /// @notice Emitted when a user deposits collateral.
    event Deposited(address indexed user, uint256 amount, uint256 newBalance);

    /// @notice Emitted when a user withdraws collateral.
    event Withdrawn(address indexed user, uint256 amount, uint256 newBalance);

    /// @notice Emitted when a user borrows tokens.
    event Borrowed(address indexed user, uint256 amount, uint256 newDebt);

    /// @notice Emitted when a user repays debt.
    event Repaid(address indexed user, uint256 amount, uint256 newDebt);

    /// @notice Emitted when the pool is paused or unpaused.
    event PoolPaused(bool paused);

    /// @notice Emitted when the exchange rate is updated (testing only).
    event ExchangeRateUpdated(uint256 oldRate, uint256 newRate);

    // ==================== Custom errors ====================

    error ZeroAddress();
    error ZeroAmount();
    error SameTokenAddress();
    error ZeroExchangeRate();
    error InsufficientCollateral();
    error InsufficientBalance();
    error ExceedsBorrowLimit();
    error PositionUndercollateralized();
    error PoolPausedError();
    error NoDebtToRepay();
    error InvalidOperation();

    // ==================== Constructor ====================

    /**
     * @notice Creates a new lending pool.
     * @param _collateralToken Address of the collateral token.
     * @param _borrowToken Address of the borrow token.
     */
    constructor(address _collateralToken, address _borrowToken) Ownable(msg.sender) {
        if (_collateralToken == address(0)) revert ZeroAddress();
        if (_borrowToken == address(0)) revert ZeroAddress();
        if (_collateralToken == _borrowToken) revert SameTokenAddress();

        collateralToken = IERC20(_collateralToken);
        borrowToken = IERC20(_borrowToken);
        exchangeRate = DEFAULT_EXCHANGE_RATE;
    }

    // ==================== View functions ====================

    /**
     * @notice Returns the user's collateral value denominated in borrow-token units.
     * @param user The user address.
     * @return Collateral value in borrow-token units.
     */
    function getCollateralValue(address user) public view returns (uint256) {
        return (collateralBalance[user] * exchangeRate) / PRECISION;
    }

    /**
     * @notice Returns the maximum debt the user may hold.
     * @param user The user address.
     * @return Maximum borrow amount in borrow-token units.
     */
    function getMaxBorrow(address user) public view returns (uint256) {
        return (getCollateralValue(user) * COLLATERAL_FACTOR) / PRECISION;
    }

    /**
     * @notice Returns the user's outstanding debt.
     * @param user The user address.
     * @return Current debt in borrow-token units.
     */
    function getDebt(address user) public view returns (uint256) {
        return debtBalance[user];
    }

    /**
     * @notice Returns the user's health factor, scaled by PRECISION.
     *         HF > PRECISION is healthy; HF < PRECISION is undercollateralized.
     *         Returns type(uint256).max when the user has no debt.
     * @param user The user address.
     * @return Health factor scaled by PRECISION.
     */
    function getHealthFactor(address user) public view returns (uint256) {
        uint256 debt = debtBalance[user];
        if (debt == 0) return type(uint256).max;
        uint256 collateralValue = getCollateralValue(user);
        return (collateralValue * LIQUIDATION_THRESHOLD) / debt;
    }

    /**
     * @notice Returns true if the user's position is healthy (or has no debt).
     * @dev Uses the exact health condition (no intermediate division):
     *      collateral * exchangeRate * LIQUIDATION_THRESHOLD > debt * PRECISION^2
     * @param user The user address.
     * @return True if the position is healthy.
     */
    function isPositionHealthy(address user) public view returns (bool) {
        uint256 debt = debtBalance[user];
        if (debt == 0) return true;
        uint256 collateral = collateralBalance[user];
        return (collateral * exchangeRate * LIQUIDATION_THRESHOLD) > (debt * PRECISION * PRECISION);
    }

    /**
     * @notice Returns the additional amount the user may borrow.
     * @param user The user address.
     * @return Available borrow amount in borrow-token units.
     */
    function getAvailableBorrow(address user) public view returns (uint256) {
        uint256 maxBorrow = getMaxBorrow(user);
        uint256 currentDebt = debtBalance[user];
        if (maxBorrow <= currentDebt) return 0;
        return maxBorrow - currentDebt;
    }

    /**
     * @notice Returns a summary of the user's position.
     * @param user The user address.
     * @return collateral Deposited collateral (collateral-token units).
     * @return debt Outstanding debt (borrow-token units).
     * @return collateralValue Collateral value (borrow-token units).
     * @return maxBorrow Maximum allowed debt (borrow-token units).
     * @return availableBorrow Remaining borrow capacity (borrow-token units).
     * @return healthFactor Health factor scaled by PRECISION.
     * @return healthy Whether the position is currently healthy.
     */
    function getPosition(address user)
        external
        view
        returns (
            uint256 collateral,
            uint256 debt,
            uint256 collateralValue,
            uint256 maxBorrow,
            uint256 availableBorrow,
            uint256 healthFactor,
            bool healthy
        )
    {
        collateral = collateralBalance[user];
        debt = debtBalance[user];
        collateralValue = getCollateralValue(user);
        maxBorrow = getMaxBorrow(user);
        availableBorrow = getAvailableBorrow(user);
        healthFactor = getHealthFactor(user);
        healthy = isPositionHealthy(user);
    }

    // ==================== Core functions ====================

    /**
     * @notice Deposits collateral into the pool.
     * @dev Caller must have approved the pool to spend at least `amount`.
     *      Follows Checks-Effects-Interactions.
     * @param amount Amount of collateral tokens to deposit.
     */
    function deposit(uint256 amount) external nonReentrant {
        _requireNotPaused();
        _requireNonZeroAmount(amount);

        // Effects
        collateralBalance[msg.sender] += amount;
        totalCollateral += amount;

        // Interactions
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Deposited(msg.sender, amount, collateralBalance[msg.sender]);
    }

    /**
     * @notice Withdraws collateral from the pool.
     * @dev Reverts if the withdrawal would leave the position undercollateralized.
     *      Follows Checks-Effects-Interactions.
     * @param amount Amount of collateral tokens to withdraw.
     */
    function withdraw(uint256 amount) external nonReentrant {
        _requireNotPaused();
        _requireNonZeroAmount(amount);

        uint256 userCollateral = collateralBalance[msg.sender];
        if (userCollateral < amount) revert InsufficientCollateral();

        uint256 newCollateral = userCollateral - amount;
        uint256 debt = debtBalance[msg.sender];

        // If the user has debt, the remaining position must stay healthy.
        // Health condition: newCollateralValue * LIQUIDATION_THRESHOLD > debt * PRECISION
        // where newCollateralValue = newCollateral * exchangeRate / PRECISION.
        // Rearranged into an exact form that avoids the intermediate
        // division (which would lose precision to truncation):
        //   newCollateral * exchangeRate * LIQUIDATION_THRESHOLD > debt * PRECISION^2
        if (debt > 0) {
            if (newCollateral * exchangeRate * LIQUIDATION_THRESHOLD <= debt * PRECISION * PRECISION) {
                revert PositionUndercollateralized();
            }
        }

        // Effects
        collateralBalance[msg.sender] = newCollateral;
        totalCollateral -= amount;

        // Interactions
        collateralToken.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount, newCollateral);
    }

    /**
     * @notice Borrows tokens against deposited collateral.
     * @dev Reverts if the new debt would exceed the user's borrow limit.
     *      Because COLLATERAL_FACTOR < LIQUIDATION_THRESHOLD, an
     *      undercollateralized position always has zero available borrow,
     *      so this function cannot increase an already-unsafe position.
     *      Follows Checks-Effects-Interactions.
     * @param amount Amount of borrow tokens to borrow.
     */
    function borrow(uint256 amount) external nonReentrant {
        _requireNotPaused();
        _requireNonZeroAmount(amount);

        uint256 availableBorrow = getAvailableBorrow(msg.sender);
        if (amount > availableBorrow) revert ExceedsBorrowLimit();

        // Effects
        debtBalance[msg.sender] += amount;
        totalDebt += amount;

        // Interactions
        borrowToken.safeTransfer(msg.sender, amount);

        emit Borrowed(msg.sender, amount, debtBalance[msg.sender]);
    }

    /**
     * @notice Repays part of the user's debt.
     * @dev Caller must have approved the pool to spend at least `amount`.
     *      Follows Checks-Effects-Interactions.
     * @param amount Amount of borrow tokens to repay.
     */
    function repay(uint256 amount) external nonReentrant {
        _requireNotPaused();
        _requireNonZeroAmount(amount);

        uint256 currentDebt = debtBalance[msg.sender];
        if (currentDebt < amount) revert InsufficientBalance();

        // Effects
        debtBalance[msg.sender] = currentDebt - amount;
        totalDebt -= amount;

        // Interactions
        borrowToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Repaid(msg.sender, amount, debtBalance[msg.sender]);
    }

    /**
     * @notice Repays the user's entire debt.
     * @dev Caller must have approved the pool to spend at least the full debt.
     *      Follows Checks-Effects-Interactions.
     */
    function repayAll() external nonReentrant {
        _requireNotPaused();

        uint256 currentDebt = debtBalance[msg.sender];
        if (currentDebt == 0) revert NoDebtToRepay();

        // Effects
        debtBalance[msg.sender] = 0;
        totalDebt -= currentDebt;

        // Interactions
        borrowToken.safeTransferFrom(msg.sender, address(this), currentDebt);

        emit Repaid(msg.sender, currentDebt, 0);
    }

    // ==================== Admin functions ====================

    /**
     * @notice Pauses or unpauses the pool. When paused, all user-facing
     *         functions revert. Only callable by the owner.
     * @param _paused New paused state.
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PoolPaused(_paused);
    }

    /**
     * @notice Updates the exchange rate. TESTING ONLY — in production this
     *         value must come from a validated price oracle, not an owner.
     * @param newRate New exchange rate (borrow units per collateral unit,
     *                scaled by PRECISION). Must be non-zero.
     */
    function setExchangeRate(uint256 newRate) external onlyOwner {
        if (newRate == 0) revert ZeroExchangeRate();
        uint256 oldRate = exchangeRate;
        exchangeRate = newRate;
        emit ExchangeRateUpdated(oldRate, newRate);
    }

    /**
     * @notice Emergency withdrawal of an arbitrary token from the pool.
     * @dev CENTRALIZATION RISK: the owner can drain any token held by the
     *      pool, including user collateral. In production this should be
     *      protected by a timelock/multisig or removed entirely.
     * @param token Token to withdraw.
     * @param to Recipient address.
     * @param amount Amount to withdraw.
     */
    function emergencyWithdraw(IERC20 token, address to, uint256 amount) external onlyOwner {
        if (address(token) == address(0)) revert ZeroAddress();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        token.safeTransfer(to, amount);
    }

    // ==================== Internal helpers ====================

    /**
     * @dev Reverts if the pool is paused.
     */
    function _requireNotPaused() internal view {
        if (paused) revert PoolPausedError();
    }

    /**
     * @dev Reverts if the amount is zero.
     */
    function _requireNonZeroAmount(uint256 amount) internal pure {
        if (amount == 0) revert ZeroAmount();
    }

    /**
     * @dev Prevents accidental ETH transfers. This pool only handles ERC-20 tokens.
     */
    receive() external payable {
        revert InvalidOperation();
    }
}
