import { formatHealthFactor, healthStatus } from '../utils';

const SCALE_MAX = 3; // gauge displays HF from 0 to 3x

export default function HealthGauge({ healthFactorScaled }) {
  const { display, numeric, hasDebt } = formatHealthFactor(healthFactorScaled);
  const status = healthStatus(healthFactorScaled);

  const labels = {
    nodebt: 'No debt',
    safe: 'Healthy',
    warning: 'Watch out',
    danger: 'At risk',
    liquidated: 'Undercollateralized',
    unknown: 'Unknown',
  };

  // Position of the marker on the 0..SCALE_MAX track.
  const ratio =
    !hasDebt || numeric === null || !isFinite(numeric)
      ? 1
      : Math.min(Math.max(numeric, 0) / SCALE_MAX, 1);
  const markerPct = ratio * 100;
  // Liquidation threshold (HF = 1.0) marker position.
  const thresholdPct = (1 / SCALE_MAX) * 100;

  return (
    <div className={`health-gauge hf-${status}`}>
      <div className="hf-top">
        <span className="hf-label">Health Factor</span>
        <span className="hf-value">{display}</span>
      </div>

      <div className="hf-track">
        <div className="hf-zone hf-zone-safe" style={{ left: `${thresholdPct}%`, right: 0 }} />
        <div className="hf-zone hf-zone-risk" style={{ left: 0, width: `${thresholdPct}%` }} />
        <div className="hf-threshold" style={{ left: `${thresholdPct}%` }} />
        <div
          className={`hf-marker hf-marker-${status}`}
          style={{ left: `${markerPct}%` }}
        />
      </div>

      <div className="hf-bottom">
        <span>0</span>
        <span className="hf-threshold-label">1.0 (liquidation)</span>
        <span>{SCALE_MAX}+</span>
      </div>

      <div className={`hf-status hf-status-${status}`}>{labels[status]}</div>
    </div>
  );
}
