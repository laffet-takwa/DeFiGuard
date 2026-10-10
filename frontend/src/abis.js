// Human-readable ABIs covering everything the frontend uses.
// Kept in sync with src/LendingPool.sol and src/MockERC20.sol.

export const LENDING_POOL_ABI = [
  // ---- views ----
  'function collateralToken() view returns (address)',
  'function borrowToken() view returns (address)',
  'function exchangeRate() view returns (uint256)',
  'function collateralBalance(address) view returns (uint256)',
  'function debtBalance(address) view returns (uint256)',
  'function totalCollateral() view returns (uint256)',
  'function totalDebt() view returns (uint256)',
  'function paused() view returns (bool)',
  'function COLLATERAL_FACTOR() view returns (uint256)',
  'function LIQUIDATION_THRESHOLD() view returns (uint256)',
  'function PRECISION() view returns (uint256)',
  'function getCollateralValue(address) view returns (uint256)',
  'function getMaxBorrow(address) view returns (uint256)',
  'function getDebt(address) view returns (uint256)',
  'function getHealthFactor(address) view returns (uint256)',
  'function isPositionHealthy(address) view returns (bool)',
  'function getAvailableBorrow(address) view returns (uint256)',
  'function getPosition(address) view returns (uint256 collateral, uint256 debt, uint256 collateralValue, uint256 maxBorrow, uint256 availableBorrow, uint256 healthFactor, bool healthy)',

  // ---- core ----
  'function deposit(uint256 amount)',
  'function withdraw(uint256 amount)',
  'function borrow(uint256 amount)',
  'function repay(uint256 amount)',
  'function repayAll()',

  // ---- admin (owner-gated on-chain) ----
  'function setPaused(bool _paused)',
  'function setExchangeRate(uint256 newRate)',

  // ---- events ----
  'event Deposited(address indexed user, uint256 amount, uint256 newBalance)',
  'event Withdrawn(address indexed user, uint256 amount, uint256 newBalance)',
  'event Borrowed(address indexed user, uint256 amount, uint256 newDebt)',
  'event Repaid(address indexed user, uint256 amount, uint256 newDebt)',
  'event PoolPaused(bool paused)',
  'event ExchangeRateUpdated(uint256 oldRate, uint256 newRate)',

  // ---- custom errors (for revert decoding) ----
  'error ZeroAddress()',
  'error ZeroAmount()',
  'error SameTokenAddress()',
  'error ZeroExchangeRate()',
  'error InsufficientCollateral()',
  'error InsufficientBalance()',
  'error ExceedsBorrowLimit()',
  'error PositionUndercollateralized()',
  'error PoolPausedError()',
  'error NoDebtToRepay()',
  'error InvalidOperation()',
];

export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function mint(address to, uint256 amount)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
];
