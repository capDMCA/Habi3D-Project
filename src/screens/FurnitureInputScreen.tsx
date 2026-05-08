import { useSessionStore } from '../stores/sessionStore';

export default function FurnitureInputScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const roomDimensions = useSessionStore((s) => s.roomDimensions);

  return (
    <div className="screen">
      {/* Header */}
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigateTo('unitSetup')} aria-label="Go back">
          ←
        </button>
        <div className="screen-header-info">
          <span className="step-label">Step 3 of 7</span>
          <h2>Map Your Furniture</h2>
        </div>
      </div>

      {/* Progress */}
      <div className="progress-bar">
        <div className="progress-step completed" />
        <div className="progress-step completed" />
        <div className="progress-step active" />
        <div className="progress-step" />
        <div className="progress-step" />
        <div className="progress-step" />
        <div className="progress-step" />
      </div>

      {/* Room dims summary */}
      {roomDimensions && (
        <div className="card card-sm">
          <div className="card-header" style={{ marginBottom: 0 }}>
            <div className="card-icon card-icon-success">✓</div>
            <div>
              <p className="card-title">Unit Confirmed</p>
              <p className="card-subtitle">
                Living {roomDimensions.livingWidthCm}×{roomDimensions.livingDepthCm}cm
                {' · '}
                Dining {roomDimensions.diningWidthCm}×{roomDimensions.diningDepthCm}cm
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder */}
      <div className="placeholder-content">
        <div className="placeholder-icon">🪑</div>
        <h3 style={{ marginBottom: 'var(--space-sm)' }}>Coming Soon</h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)', maxWidth: 280 }}>
          This screen will let you add furniture items from the shape library
          (rectangle, L-shape, round, oval) and specify their dimensions.
        </p>
      </div>

      <button
        className="btn btn-secondary"
        onClick={() => navigateTo('dimensionVerification')}
        style={{ marginTop: 'auto' }}
      >
        Continue to Room Scan →
      </button>
    </div>
  );
}
