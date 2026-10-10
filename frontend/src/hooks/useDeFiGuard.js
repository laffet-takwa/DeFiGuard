import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserProvider, Contract, formatUnits } from 'ethers';
import { CONFIG, isConfigured } from '../config';
import { LENDING_POOL_ABI, ERC20_ABI } from '../abis';
import { decodeError, parseTokenAmount } from '../utils';

const LOCAL_CHAIN_IDS = new Set([31337, 1337]);

/**
 * Central hook: wallet connection, contract reads, position data,
 * token metadata/allowances, transaction orchestration and event log.
 */
export function useDeFiGuard() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [hasWallet, setHasWallet] = useState(Boolean(window.ethereum));

  const [position, setPosition] = useState(null);
  const [poolStats, setPoolStats] = useState(null);
  const [tokens, setTokens] = useState({ collateral: null, borrow: null });
  const [events, setEvents] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState(null);
  const [tx, setTx] = useState({ status: 'idle', message: '' });

  const refreshTimer = useRef(null);
  const refreshCounter = useRef(0);

  // ---------- wallet ----------

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setDataError('No Ethereum wallet detected. Install MetaMask or a compatible wallet.');
      return;
    }
    try {
      const bp = new BrowserProvider(window.ethereum);
      await bp.send('eth_requestAccounts', []);
      const s = await bp.getSigner();
      const network = await bp.getNetwork();
      setProvider(bp);
      setSigner(s);
      setAccount(await s.getAddress());
      setChainId(Number(network.chainId));
      setDataError(null);
    } catch (err) {
      setDataError(decodeError(err));
    }
  }, []);

  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
    setPosition(null);
    setPoolStats(null);
    setTokens({ collateral: null, borrow: null });
    setEvents([]);
  }, []);

  // Listen for wallet account / chain changes.
  useEffect(() => {
    if (!window.ethereum) return;
    const onAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setAccount(accounts[0]);
      }
    };
    const onChainChanged = (chainIdHex) => {
      const id = parseInt(chainIdHex, 16);
      setChainId(id);
      // ethers recommends recreating the provider on chain change.
      const bp = new BrowserProvider(window.ethereum);
      bp.getSigner().then((s) => {
        setProvider(bp);
        setSigner(s);
      });
    };
    window.ethereum.on('accountsChanged', onAccountsChanged);
    window.ethereum.on('chainChanged', onChainChanged);
    return () => {
      window.ethereum.removeListener('accountsChanged', onAccountsChanged);
      window.ethereum.removeListener('chainChanged', onChainChanged);
    };
  }, [disconnect]);

  // ---------- data ----------

  const refresh = useCallback(async () => {
    if (!provider || !account || !isConfigured) return;
    const token = ++refreshCounter.current;
    setDataLoading(true);
    setDataError(null);
    try {
      const pool = new Contract(CONFIG.lendingPoolAddress, LENDING_POOL_ABI, provider);
      const colToken = new Contract(CONFIG.collateralTokenAddress, ERC20_ABI, provider);
      const borToken = new Contract(CONFIG.borrowTokenAddress, ERC20_ABI, provider);

      const [
        pos,
        totalCollateral,
        totalDebt,
        exchangeRate,
        paused,
        collateralFactor,
        liquidationThreshold,
        precision,
        colMeta,
        borMeta,
        colBalance,
        borBalance,
        colAllowance,
        borAllowance,
      ] = await Promise.all([
        pool.getPosition(account),
        pool.totalCollateral(),
        pool.totalDebt(),
        pool.exchangeRate(),
        pool.paused(),
        pool.COLLATERAL_FACTOR(),
        pool.LIQUIDATION_THRESHOLD(),
        pool.PRECISION(),
        Promise.all([colToken.name(), colToken.symbol(), colToken.decimals()]),
        Promise.all([borToken.name(), borToken.symbol(), borToken.decimals()]),
        colToken.balanceOf(account),
        borToken.balanceOf(account),
        colToken.allowance(account, CONFIG.lendingPoolAddress),
        borToken.allowance(account, CONFIG.lendingPoolAddress),
      ]);

      // Guard against stale responses after account/chain switch.
      if (token !== refreshCounter.current) return;

      setPosition({
        collateral: pos.collateral,
        debt: pos.debt,
        collateralValue: pos.collateralValue,
        maxBorrow: pos.maxBorrow,
        availableBorrow: pos.availableBorrow,
        healthFactor: pos.healthFactor,
        healthy: pos.healthy,
      });
      setPoolStats({
        totalCollateral,
        totalDebt,
        exchangeRate,
        paused,
        collateralFactor,
        liquidationThreshold,
        precision,
      });
      setTokens({
        collateral: {
          address: CONFIG.collateralTokenAddress,
          name: colMeta[0],
          symbol: colMeta[1],
          decimals: Number(colMeta[2]),
          balance: colBalance,
          allowance: colAllowance,
        },
        borrow: {
          address: CONFIG.borrowTokenAddress,
          name: borMeta[0],
          symbol: borMeta[1],
          decimals: Number(borMeta[2]),
          balance: borBalance,
          allowance: borAllowance,
        },
      });

      await fetchEvents(pool, provider);
    } catch (err) {
      if (token === refreshCounter.current) {
        setDataError(decodeError(err));
      }
    } finally {
      if (token === refreshCounter.current) setDataLoading(false);
    }
  }, [provider, account]);

  const fetchEvents = async (pool, prov) => {
    try {
      const currentBlock = await prov.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - CONFIG.eventQueryBlocks);
      const userEvents = await Promise.all(
        ['Deposited', 'Withdrawn', 'Borrowed', 'Repaid'].map((name) =>
          pool.queryFilter(pool.filters[name](account), fromBlock),
        ),
      );
      const poolEvents = await Promise.all([
        pool.queryFilter(pool.filters.PoolPaused(), fromBlock),
        pool.queryFilter(pool.filters.ExchangeRateUpdated(), fromBlock),
      ]);

      const mapped = [
        ...userEvents.flat().map((log) => mapEvent(log, 'user')),
        ...poolEvents.flat().map((log) => mapEvent(log, 'pool')),
      ].sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);

      setEvents(mapped.slice(0, 50));
    } catch (err) {
      console.warn('Failed to load events:', err);
    }
  };

  // Refresh on connect/account change, then poll.
  useEffect(() => {
    refresh();
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    refreshTimer.current = setInterval(refresh, CONFIG.refreshIntervalMs);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [refresh]);

  // ---------- transactions ----------

  const runTx = useCallback(
    async (label, build) => {
      if (!signer) throw new Error('Wallet not connected.');
      setTx({ status: 'pending', message: `Confirm “${label}” in your wallet…` });
      try {
        const txResponse = await build();
        setTx({
          status: 'pending',
          message: `${label} submitted (${txResponse.hash.slice(0, 10)}…). Waiting for confirmation…`,
        });
        await txResponse.wait();
        setTx({ status: 'success', message: `${label} confirmed.` });
        await refresh();
        return true;
      } catch (err) {
        const message = decodeError(err);
        setTx({ status: 'error', message });
        return false;
      }
    },
    [signer, refresh],
  );

  const needsApproval = useCallback(
    (tokenInfo, amount) => Boolean(tokenInfo && tokenInfo.allowance < amount),
    [],
  );

  const approve = useCallback(
    async (tokenInfo, amount) => {
      const tokenContract = new Contract(
        tokenInfo.address,
        ERC20_ABI,
        signer,
      );
      return runTx(`Approve ${tokenInfo.symbol}`, () =>
        tokenContract.approve(CONFIG.lendingPoolAddress, amount),
      );
    },
    [signer, runTx],
  );

  const deposit = useCallback(
    async (amountInput) => {
      const amount = parseTokenAmount(amountInput, tokens.collateral.decimals);
      if (amount === null || amount <= 0n) {
        setTx({ status: 'error', message: 'Enter a valid deposit amount.' });
        return false;
      }
      if (tokens.collateral.allowance < amount) {
        const ok = await approve(
          { ...tokens.collateral, address: CONFIG.collateralTokenAddress },
          amount,
        );
        if (!ok) return false;
      }
      const pool = new Contract(CONFIG.lendingPoolAddress, LENDING_POOL_ABI, signer);
      return runTx('Deposit collateral', () => pool.deposit(amount));
    },
    [signer, tokens, approve, runTx],
  );

  const withdraw = useCallback(
    async (amountInput) => {
      const amount = parseTokenAmount(amountInput, tokens.collateral.decimals);
      if (amount === null || amount <= 0n) {
        setTx({ status: 'error', message: 'Enter a valid withdrawal amount.' });
        return false;
      }
      const pool = new Contract(CONFIG.lendingPoolAddress, LENDING_POOL_ABI, signer);
      return runTx('Withdraw collateral', () => pool.withdraw(amount));
    },
    [signer, tokens, runTx],
  );

  const borrow = useCallback(
    async (amountInput) => {
      const amount = parseTokenAmount(amountInput, tokens.borrow.decimals);
      if (amount === null || amount <= 0n) {
        setTx({ status: 'error', message: 'Enter a valid borrow amount.' });
        return false;
      }
      const pool = new Contract(CONFIG.lendingPoolAddress, LENDING_POOL_ABI, signer);
      return runTx('Borrow', () => pool.borrow(amount));
    },
    [signer, tokens, runTx],
  );

  const repay = useCallback(
    async (amountInput, all = false) => {
      const pool = new Contract(CONFIG.lendingPoolAddress, LENDING_POOL_ABI, signer);
      if (all) {
        if (tokens.borrow.allowance < position.debt) {
          const ok = await approve(
            { ...tokens.borrow, address: CONFIG.borrowTokenAddress },
            position.debt,
          );
          if (!ok) return false;
        }
        return runTx('Repay all debt', () => pool.repayAll());
      }
      const amount = parseTokenAmount(amountInput, tokens.borrow.decimals);
      if (amount === null || amount <= 0n) {
        setTx({ status: 'error', message: 'Enter a valid repay amount.' });
        return false;
      }
      if (tokens.borrow.allowance < amount) {
        const ok = await approve(
          { ...tokens.borrow, address: CONFIG.borrowTokenAddress },
          amount,
        );
        if (!ok) return false;
      }
      return runTx('Repay debt', () => pool.repay(amount));
    },
    [signer, tokens, position, approve, runTx],
  );

  // Test-only helper: mints mock tokens when the connected account owns them.
  const mintTestTokens = useCallback(async () => {
    const col = new Contract(CONFIG.collateralTokenAddress, ERC20_ABI, signer);
    const bor = new Contract(CONFIG.borrowTokenAddress, ERC20_ABI, signer);
    setTx({ status: 'pending', message: 'Minting test tokens…' });
    try {
      const colAmount = 10n * 10n ** BigInt(tokens?.collateral?.decimals ?? 18);
      const borDecimals = tokens?.borrow?.decimals ?? 6;
      const borAmount = 10_000n * 10n ** BigInt(borDecimals);
      const tx1 = await col.mint(account, colAmount);
      await tx1.wait();
      const tx2 = await bor.mint(account, borAmount);
      await tx2.wait();
      setTx({ status: 'success', message: 'Test tokens minted.' });
      await refresh();
      return true;
    } catch (err) {
      setTx({ status: 'error', message: decodeError(err) });
      return false;
    }
  }, [signer, account, tokens, refresh]);

  return {
    // wallet
    account,
    chainId,
    hasWallet,
    connect,
    disconnect,
    isConnected: Boolean(account),
    wrongNetwork: isConfigured && chainId !== null && chainId !== CONFIG.expectedChainId,
    isLocalChain: chainId !== null && LOCAL_CHAIN_IDS.has(chainId),
    // data
    position,
    poolStats,
    tokens,
    events,
    dataLoading,
    dataError,
    configured: isConfigured,
    // tx
    tx,
    needsApproval,
    deposit,
    withdraw,
    borrow,
    repay,
    mintTestTokens,
    refresh,
    // formatting helpers
    exchangeRateDisplay: poolStats ? formatUnits(poolStats.exchangeRate, 18) : null,
  };
}

function mapEvent(log, scope) {
  const args = log.args || {};
  return {
    name: log.eventName,
    scope,
    user: args.user ?? null,
    amount: args.amount ?? null,
    newValue: args.newBalance ?? args.newDebt ?? null,
    paused: args.paused ?? null,
    oldRate: args.oldRate ?? null,
    newRate: args.newRate ?? null,
    blockNumber: log.blockNumber,
    logIndex: log.index,
    txHash: log.transactionHash,
  };
}
