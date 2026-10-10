export const CONFIG = {
  lendingPoolAddress: import.meta.env.VITE_LENDING_POOL_ADDRESS || '',
  collateralTokenAddress: import.meta.env.VITE_COLLATERAL_TOKEN_ADDRESS || '',
  borrowTokenAddress: import.meta.env.VITE_BORROW_TOKEN_ADDRESS || '',
  expectedChainId: Number(import.meta.env.VITE_CHAIN_ID || 31337),
  refreshIntervalMs: 15_000,
  eventQueryBlocks: 10_000,
};

export const isConfigured = Boolean(
  CONFIG.lendingPoolAddress &&
    CONFIG.collateralTokenAddress &&
    CONFIG.borrowTokenAddress,
);

export const CHAIN_NAMES = {
  1: 'Ethereum Mainnet',
  5: 'Goerli',
  11155111: 'Sepolia',
  31337: 'Anvil / Hardhat (local)',
  1337: 'Localhost',
};

export function chainName(chainId) {
  return CHAIN_NAMES[chainId] || `Chain ${chainId}`;
}
