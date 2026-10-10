import { formatTokenAmount } from '../utils';
import HealthGauge from './HealthGauge';
import { CardSkeleton } from './PoolStats';

export default function PositionCard({ position, tokens }) {
  if (!position || !tokens) return <CardSkeleton title="Your Position" />;

  const hasPosition = position.collateral > 0n || position.debt > 0n;

  return (
    <section className="card">
      <div className="card-header">
        <h2>Your Position</h2>
        <span className={`status-pill ${position.healthy ? 'active' : 'paused'}`}>
          {position.healthy ? 'Healthy' : 'Unhealthy'}
        </span>
      </div>

      {!hasPosition ? (
        <p className="empty-state">
          No position yet. Deposit {tokens.collateral.symbol} collateral to start
          borrowing {tokens.borrow.symbol}.
        </p>
      ) : (
        <div className="stat-grid">
          <div className="stat">
            <div className="stat-label">Collateral Deposited</div>
            <div className="stat-value">
              {formatTokenAmount(position.collateral, tokens.collateral.decimals)}
            </div>
            <div className="stat-sub">{tokens.collateral.symbol}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Collateral Value</div>
            <div className="stat-value">
              {formatTokenAmount(position.collateralValue, tokens.borrow.decimals)}
            </div>
            <div className="stat-sub">{tokens.borrow.symbol} equivalent</div>
          </div>
          <div className="stat">
            <div className="stat-label">Outstanding Debt</div>
            <div className="stat-value">
              {formatTokenAmount(position.debt, tokens.borrow.decimals)}
            </div>
            <div className="stat-sub">{tokens.borrow.symbol}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Max Borrow</div>
            <div className="stat-value">
              {formatTokenAmount(position.maxBorrow, tokens.borrow.decimals)}
            </div>
            <div className="stat-sub">{tokens.borrow.symbol} (75% LTV)</div>
          </div>
          <div className="stat">
            <div className="stat-label">Available to Borrow</div>
            <div className="stat-value">
              {formatTokenAmount(position.availableBorrow, tokens.borrow.decimals)}
            </div>
            <div className="stat-sub">{tokens.borrow.symbol}</div>
          </div>
        </div>
      )}

      <HealthGauge healthFactorScaled={position.healthFactor} />
    </section>
  );
}
