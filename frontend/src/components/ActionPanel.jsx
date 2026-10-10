import { useMemo, useState } from 'react';
import { formatTokenAmount, parseTokenAmount } from '../utils';

const TABS = [
  { id: 'deposit', label: 'Deposit' },
  { id: 'withdraw', label: 'Withdraw' },
  { id: 'borrow', label: 'Borrow' },
  { id: 'repay', label: 'Repay' },
];

export default function ActionPanel({
  position,
  poolStats,
  tokens,
  tx,
  deposit,
  withdraw,
  borrow,
  repay,
  approve,
  busy,
}) {
  const [tab, setTab] = useState('deposit');
  const [amount, setAmount] = useState('');

  const col = tokens?.collateral;
  const bor = tokens?.borrow;

  const amountParsed = useMemo(() => {
    if (!amount || !col || !bor) return null;
    const decimals = tab === 'deposit' || tab === 'withdraw' ? col.decimals : bor.decimals;
    return parseTokenAmount(amount, decimals);
  }, [amount, col, bor, tab]);

  const maxAmount = useMemo(() => {
    if (!position || !col || !bor) return null;
    switch (tab) {
      case 'deposit':
        return { value: col.balance, decimals: col.decimals };
      case 'withdraw':
        return { value: position.collateral, decimals: col.decimals };
      case 'borrow':
        return { value: position.availableBorrow, decimals: bor.decimals };
      case 'repay': {
        const max = position.debt < bor.balance ? position.debt : bor.balance;
        return { value: max, decimals: bor.decimals };
      }
      default:
        return null;
    }
  }, [tab, position, col, bor]);

  // ---- validation ----
  const validation = useMemo(() => {
    if (amountParsed === null) return { ok: false, message: '' };
    if (amountParsed <= 0n) return { ok: false, message: 'Amount must be greater than zero.' };
    switch (tab) {
      case 'deposit':
        if (amountParsed > col.balance)
          return { ok: false, message: `Insufficient ${col.symbol} balance.` };
        break;
      case 'withdraw':
        if (amountParsed > position.collateral)
          return { ok: false, message: 'Amount exceeds deposited collateral.' };
        break;
      case 'borrow':
        if (amountParsed > position.availableBorrow)
          return { ok: false, message: 'Exceeds available borrow capacity.' };
        break;
      case 'repay':
        if (amountParsed > position.debt)
          return { ok: false, message: 'Amount exceeds outstanding debt.' };
        if (amountParsed > bor.balance)
          return { ok: false, message: `Insufficient ${bor.symbol} balance to repay.` };
        break;
    }
    return { ok: true, message: '' };
  }, [tab, amountParsed, col, bor, position]);

  // ---- withdraw health pre-check (mirrors the on-chain condition) ----
  const withdrawWarning = useMemo(() => {
    if (tab !== 'withdraw' || !position || !poolStats || amountParsed === null) return null;
    if (position.debt === 0n) return null;
    const newCollateral = position.collateral - amountParsed;
    if (newCollateral < 0n) return null;
    const healthy =
      newCollateral * poolStats.exchangeRate * poolStats.liquidationThreshold >
      position.debt * poolStats.precision * poolStats.precision;
    return healthy
      ? null
      : 'This withdrawal would make your position undercollateralized and will revert on-chain.';
  }, [tab, position, poolStats, amountParsed]);

  // ---- approval requirements ----
  const approvalNeeded = useMemo(() => {
    if (amountParsed === null || amountParsed <= 0n) return null;
    if (tab === 'deposit' && col && col.allowance < amountParsed) {
      return { token: col, amount: amountParsed };
    }
    if (tab === 'repay' && bor && bor.allowance < amountParsed) {
      return { token: bor, amount: amountParsed };
    }
    return null;
  }, [tab, amountParsed, col, bor]);

  if (!position || !poolStats || !col || !bor) {
    return (
      <section className="card">
        <div className="card-header">
          <h2>Actions</h2>
        </div>
        <p className="empty-state">Connect your wallet to manage your position.</p>
      </section>
    );
  }

  const contextLine = {
    deposit: `Wallet balance: ${formatTokenAmount(col.balance, col.decimals)} ${col.symbol}`,
    withdraw: `Deposited: ${formatTokenAmount(position.collateral, col.decimals)} ${col.symbol}`,
    borrow: `Available: ${formatTokenAmount(position.availableBorrow, bor.decimals)} ${bor.symbol}`,
    repay: `Debt: ${formatTokenAmount(position.debt, bor.decimals)} ${bor.symbol} · Balance: ${formatTokenAmount(bor.balance, bor.decimals)} ${bor.symbol}`,
  }[tab];

  const canSubmit =
    validation.ok && !withdrawWarning && !approvalNeeded && !busy && !poolStats.paused;

  const handleSubmit = async () => {
    switch (tab) {
      case 'deposit':
        await deposit(amount);
        break;
      case 'withdraw':
        await withdraw(amount);
        break;
      case 'borrow':
        await borrow(amount);
        break;
      case 'repay':
        await repay(amount);
        break;
    }
    setAmount('');
  };

  const handleApprove = async () => {
    if (!approvalNeeded) return;
    await approve(approvalNeeded.token, approvalNeeded.amount);
  };

  return (
    <section className="card">
      <div className="card-header">
        <h2>Actions</h2>
        {poolStats.paused && <span className="status-pill paused">Pool paused</span>}
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'tab-active' : ''}`}
            onClick={() => {
              setTab(t.id);
              setAmount('');
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="action-context">{contextLine}</div>

      <div className="amount-row">
        <input
          className="amount-input"
          type="text"
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={busy || poolStats.paused}
        />
        <button
          className="btn btn-max"
          onClick={() =>
            setAmount(
              maxAmount
                ? formatTokenAmount(maxAmount.value, maxAmount.decimals, 18)
                : '',
            )
          }
          disabled={busy || poolStats.paused}
        >
          MAX
        </button>
      </div>

      {validation.message && <div className="field-error">{validation.message}</div>}
      {withdrawWarning && <div className="field-warning">{withdrawWarning}</div>}

      {approvalNeeded ? (
        <button
          className="btn btn-primary btn-block"
          onClick={handleApprove}
          disabled={busy || poolStats.paused}
        >
          {busy ? 'Processing…' : `Approve ${approvalNeeded.token.symbol}`}
        </button>
      ) : (
        <button
          className="btn btn-primary btn-block"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {busy ? 'Processing…' : TABS.find((t) => t.id === tab).label}
        </button>
      )}

      {tab === 'repay' && position.debt > 0n && (
        <button
          className="btn btn-outline btn-block"
          onClick={async () => {
            await repay('', true);
            setAmount('');
          }}
          disabled={busy || poolStats.paused}
        >
          Repay All Debt
        </button>
      )}

      {tx.status !== 'idle' && (
        <div className={`tx-status tx-${tx.status}`}>
          {tx.status === 'pending' && <span className="spinner" />}
          {tx.message}
        </div>
      )}
    </section>
  );
}
