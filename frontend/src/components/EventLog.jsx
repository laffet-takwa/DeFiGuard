import { formatTokenAmount, shortAddress } from '../utils';

const EVENT_META = {
  Deposited: { icon: '↓', className: 'ev-deposit', label: 'Deposit' },
  Withdrawn: { icon: '↑', className: 'ev-withdraw', label: 'Withdraw' },
  Borrowed: { icon: '⇄', className: 'ev-borrow', label: 'Borrow' },
  Repaid: { icon: '✓', className: 'ev-repay', label: 'Repay' },
  PoolPaused: { icon: '⏸', className: 'ev-pool', label: 'Pool Paused' },
  ExchangeRateUpdated: { icon: '⚡', className: 'ev-pool', label: 'Rate Update' },
};

export default function EventLog({ events, tokens }) {
  if (!events) return null;

  return (
    <section className="card">
      <div className="card-header">
        <h2>Recent Activity</h2>
        <span className="muted">last 10,000 blocks</span>
      </div>

      {events.length === 0 ? (
        <p className="empty-state">No events found for this account yet.</p>
      ) : (
        <ul className="event-list">
          {events.map((ev, i) => (
            <EventRow key={`${ev.txHash}-${ev.logIndex}-${i}`} ev={ev} tokens={tokens} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EventRow({ ev, tokens }) {
  const meta = EVENT_META[ev.name] || { icon: '•', className: 'ev-pool', label: ev.name };
  const isCollateralEvent = ev.name === 'Deposited' || ev.name === 'Withdrawn';
  const decimals = isCollateralEvent
    ? tokens?.collateral?.decimals ?? 18
    : tokens?.borrow?.decimals ?? 18;
  const symbol = isCollateralEvent
    ? tokens?.collateral?.symbol ?? ''
    : tokens?.borrow?.symbol ?? '';

  let detail = '';
  if (ev.amount !== null && ev.amount !== undefined) {
    detail = `${formatTokenAmount(ev.amount, decimals)} ${symbol}`;
  } else if (ev.name === 'PoolPaused') {
    detail = ev.paused ? 'Pool paused' : 'Pool unpaused';
  } else if (ev.name === 'ExchangeRateUpdated') {
    detail = `${formatTokenAmount(ev.oldRate, 18, 2)} → ${formatTokenAmount(ev.newRate, 18, 2)}`;
  }

  return (
    <li className="event-row">
      <span className={`event-icon ${meta.className}`}>{meta.icon}</span>
      <div className="event-body">
        <div className="event-title">
          {meta.label}
          {ev.scope === 'pool' && <span className="scope-badge">pool</span>}
        </div>
        <div className="event-detail">{detail}</div>
      </div>
      <div className="event-meta">
        <span className="event-block">#{ev.blockNumber}</span>
        <span className="event-tx" title={ev.txHash}>
          {shortAddress(ev.txHash)}
        </span>
      </div>
    </li>
  );
}
