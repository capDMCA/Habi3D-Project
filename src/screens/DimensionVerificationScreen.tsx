import { useSessionStore } from '../stores/sessionStore';

export default function DimensionVerificationScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const roomDimensions = useSessionStore((s) => s.roomDimensions);

  if (!roomDimensions) {
    return (
      <div className="screen">
        <div className="placeholder-content">
          <h3>No dimensions found</h3>
          <button className="btn btn-secondary" onClick={() => navigateTo('unitSetup')}>
            Back to Setup
          </button>
        </div>
      </div>
    );
  }

  const livingAreaSqm = ((roomDimensions.livingWidthCm * roomDimensions.livingDepthCm) / 10000).toFixed(2);
  const diningAreaSqm = ((roomDimensions.diningWidthCm * roomDimensions.diningDepthCm) / 10000).toFixed(2);
  const totalAreaSqm = (
    (roomDimensions.livingWidthCm * roomDimensions.livingDepthCm +
      roomDimensions.diningWidthCm * roomDimensions.diningDepthCm) /
    10000
  ).toFixed(2);

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigateTo('furnitureInput')} aria-label="Go back">
          ←
        </button>
        <div className="screen-header-info">
          <span className="step-label">Step 3 of 7</span>
          <h2>Verify Dimensions</h2>
        </div>
      </div>

      <div className="progress-bar">
        <div className="progress-step completed" />
        <div className="progress-step completed" />
        <div className="progress-step completed" />
        <div className="progress-step active" />
        <div className="progress-step" />
        <div className="progress-step" />
        <div className="progress-step" />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-icon card-icon-primary">📏</div>
          <div>
            <p className="card-title">Spatial Verification</p>
            <p className="card-subtitle">Confirm these values before AR scanning</p>
          </div>
        </div>

        <div className="info-row">
          <span className="info-label">Living Area</span>
          <span className="info-value">
            {roomDimensions.livingWidthCm}×{roomDimensions.livingDepthCm} cm ({livingAreaSqm} sqm)
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Dining Area</span>
          <span className="info-value">
            {roomDimensions.diningWidthCm}×{roomDimensions.diningDepthCm} cm ({diningAreaSqm} sqm)
          </span>
        </div>
        <div className="info-row" style={{ borderTop: '2px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
          <span className="info-label" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total Evaluated Area</span>
          <span className="info-value" style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.125rem' }}>
            {totalAreaSqm} sqm
          </span>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--success-bg)', borderColor: 'var(--success-border)' }}>
        <p className="text-sm" style={{ color: 'var(--success)', fontWeight: 500 }}>
          💡 These dimensions define the boundaries for the AR clearance analysis. Ensure they match your actual room measurements for accurate results.
        </p>
      </div>

      <div className="spacer" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        <button
          className="btn btn-primary"
          onClick={() => navigateTo('roomScan')}
        >
          Confirm & Proceed to AR Scan →
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => navigateTo('unitSetup')}
        >
          Edit Dimensions
        </button>
      </div>
    </div>
  );
}
