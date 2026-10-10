import { Interface, formatUnits, MaxUint256 } from 'ethers';
import { LENDING_POOL_ABI } from './abis';

export const POOL_INTERFACE = new Interface(LENDING_POOL_ABI);

/** Format a raw token amount, trimming trailing zeros. */
export function formatTokenAmount(value, decimals, maxDecimals = 4) {
  if (value === null || value === undefined) return '0';
  try {
    const formatted = formatUnits(value, decimals);
    const [intPart, fracPart = ''] = formatted.split('.');
    const trimmed = fracPart.slice(0, maxDecimals).replace(/0+$/, '');
    return trimmed ? `${intPart}.${trimmed}` : intPart;
  } catch {
    return '0';
  }
}

/** Parse a user-entered decimal string into a BigInt. Returns null on invalid input. */
export function parseTokenAmount(input, decimals) {
  if (typeof input !== 'string' || !/^\d*\.?\d*$/.test(input.trim()) || input.trim() === '') {
    return null;
  }
  try {
    const [intPart, fracPart = ''] = input.trim().split('.');
    if (fracPart.length > decimals) return null;
    const normalized = fracPart.padEnd(decimals, '0').slice(0, decimals);
    const int = intPart === '' ? '0' : intPart;
    return BigInt(int) * 10n ** BigInt(decimals) + BigInt(normalized === '' ? '0' : normalized);
  } catch {
    return null;
  }
}

/**
 * Health factor is returned scaled by 1e18.
 * Returns { display, numeric, hasDebt }.
 */
export function formatHealthFactor(hfScaled) {
  if (hfScaled === null || hfScaled === undefined) {
    return { display: '—', numeric: null, hasDebt: true };
  }
  // No debt -> contract returns type(uint256).max
  if (hfScaled > MaxUint256 / 2n) {
    return { display: '∞', numeric: Infinity, hasDebt: false };
  }
  const numeric = Number(formatUnits(hfScaled, 18));
  return { display: numeric.toFixed(2), numeric, hasDebt: true };
}

/** Health status bucket used for gauge coloring. */
export function healthStatus(hfScaled) {
  const { numeric, hasDebt } = formatHealthFactor(hfScaled);
  if (!hasDebt) return 'nodebt';
  if (numeric === null) return 'unknown';
  if (numeric >= 2) return 'safe';
  if (numeric >= 1.2) return 'warning';
  if (numeric >= 1) return 'danger';
  return 'liquidated';
}

export function shortAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Extract a human-readable message from an ethers v6 error,
 * decoding LendingPool / ERC20 custom errors when possible.
 */
export function decodeError(err, iface = POOL_INTERFACE) {
  if (err?.code === 'ACTION_REJECTED') return 'Transaction rejected in wallet.';

  const candidates = [
    err?.data,
    err?.info?.error?.data,
    err?.error?.data,
    err?.cause?.data,
    err?.cause?.info?.error?.data,
  ];
  for (const data of candidates) {
    if (typeof data === 'string' && data.startsWith('0x')) {
      try {
        const parsed = iface.parseError(data);
        if (parsed) {
          const args = parsed.args.length ? `: ${parsed.args.join(', ')}` : '';
          return `Reverted with custom error ${parsed.name}${args}.`;
        }
      } catch {
        /* not a known custom error */
      }
    }
  }

  const reason =
    err?.reason ||
    err?.info?.error?.message ||
    err?.shortMessage ||
    err?.cause?.shortMessage ||
    err?.message;
  if (reason) {
    return reason.length > 220 ? `${reason.slice(0, 220)}…` : reason;
  }
  return 'Transaction failed.';
}
