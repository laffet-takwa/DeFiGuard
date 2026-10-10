import { CONFIG } from '../config';
import { formatTokenAmount, shortAddress } from '../utils';

export default function PoolStats({ poolStats, tokens, poolAddress }) {
  if (!poolStats || !tokens) return <CardSkeleton title="Pool Overview" />;

  const colSymbol = tokens.collateral.symbol;
  const borSymbol = tokens.borrow.symbol;
  const exchangeRate = Number(
    formatTokenAmount(poolStats.exchangeRate, 18, 2),
  );
  const collateralFactorPct =
    Number(formatTokenAmount(poolStats.collateralFactor, 18, 4)) * 100;
  const liquidationThresholdPct =
    Number(formatTokenAmount(poolStats.liquidationThreshold, 18, 4)) * 100;

  return (
    <section className="card">
      <div className="card-header">
        <h2>Pool Overview</h2>
        <span className={`status-pill ${poolStats.paused ? 'paused' : 'active'}`}>
          {poolStats.paused ? 'Paused' : 'Active'}
        </span>
      </div>

      <div className="stat-grid">
        <Stat
          label="Total Collateral"
          value={formatTokenAmount(poolStats.totalCollateral, tokens.collateral.decimals)}
          sub={colSymbol}
        />
        <Stat
          label="Total Debt"
          value={formatTokenAmount(poolStats.totalDebt, tokens.borrow.decimals)}
          sub={borSymbol}
        />
        <Stat
          label="Exchange Rate"
          value={`${exchangeRate.toLocaleString()}`}
          sub={`${borSymbol} per ${colSymbol}`}
        />
        <Stat
          label="Collateral Factor"
          value={`${collateralFactorPct.toFixed(0)}%`}
          sub="max LTV"
        />
        <Stat
          label="Liquidation Threshold"
          value={`${liquidationThresholdPct.toFixed(0)}%`}
          sub="health factor floor"
        />
        <Stat
          label="Pool Contract"
          value={shortAddress(poolAddress)}
          sub="LendingPool"
        />
      </div>

      <div className="token-addresses">
        <div>
          <span className="muted">{colSymbol} collateral token:</span>{' '}
          <code title={CONFIG.collateralTokenAddress}>
            {shortAddress(CONFIG.collateralTokenAddress)}
          </code>
        </div>
        <div>
          <span className="muted">{borSymbol} borrow token:</span>{' '}
          <code title={CONFIG.borrowTokenAddress}>
            {shortAddress(CONFIG.borrowTokenAddress)}
          </code>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

export function CardSkeleton({ title }) {
  return (
    <section className="card">
      <div className="card-header">
        <h2>{title}</h2>
      </div>
      <div className="skeleton-lines">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    </section>
  );
}
