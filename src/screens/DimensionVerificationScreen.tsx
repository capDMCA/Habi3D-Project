import { useSessionStore } from '../stores/sessionStore';
import type { RoomDimensions } from '../types';

function getAreas(roomDimensions: RoomDimensions) {
  const livingAreaSqm =
    (roomDimensions.livingWidthCm * roomDimensions.livingDepthCm) / 10000;
  const diningAreaSqm =
    (roomDimensions.diningWidthCm * roomDimensions.diningDepthCm) / 10000;
  const evaluatedAreaSqm = livingAreaSqm + diningAreaSqm;

  return {
    livingAreaSqm,
    diningAreaSqm,
    evaluatedAreaSqm,
  };
}

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

  const { livingAreaSqm, diningAreaSqm, evaluatedAreaSqm } = getAreas(roomDimensions);

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigateTo('furnitureInput')} aria-label="Go back">
          &lt;
        </button>
        <div className="screen-header-info">
          <span className="step-label">Step 3 of 6</span>
          <h2>Verify Dimensions</h2>
        </div>
      </div>

      <div className="progress-bar">
        <div className="progress-step completed" />
        <div className="progress-step completed" />
        <div className="progress-step active" />
        <div className="progress-step" />
        <div className="progress-step" />
        <div className="progress-step" />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-icon card-icon-success">OK</div>
          <div>
            <p className="card-title">Living and Dining Dimensions</p>
            <p className="card-subtitle">These values define the AR room boundary</p>
          </div>
        </div>

        <DimensionMap dims={roomDimensions} />

        <div className="info-row">
          <span className="info-label">Living Area</span>
          <span className="info-value">
            {roomDimensions.livingWidthCm} x {roomDimensions.livingDepthCm} cm ({livingAreaSqm.toFixed(2)} sqm)
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Dining Area</span>
          <span className="info-value">
            {roomDimensions.diningWidthCm} x {roomDimensions.diningDepthCm} cm ({diningAreaSqm.toFixed(2)} sqm)
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Total Evaluated Area</span>
          <span className="info-value">{evaluatedAreaSqm.toFixed(2)} sqm</span>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--success-bg)', borderColor: 'var(--success-border)' }}>
        <p className="text-sm" style={{ color: 'var(--success)', fontWeight: 500, margin: 0 }}>
          These dimensions define the boundaries for AR clearance analysis. Edit them if they do not match the actual living and dining area.
        </p>
      </div>

      <div className="spacer" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        <button className="btn btn-primary" onClick={() => navigateTo('roomScan')}>
          Confirm and Proceed to AR Scan
        </button>
        <button className="btn btn-secondary" onClick={() => navigateTo('unitSetup')}>
          Edit Dimensions
        </button>
      </div>
    </div>
  );
}

function DimensionMap({ dims }: { dims: RoomDimensions }) {
  const maxWidth = Math.max(dims.livingWidthCm, dims.diningWidthCm);
  const totalDepth = dims.livingDepthCm + dims.diningDepthCm;
  const scale = Math.min(280 / maxWidth, 220 / totalDepth);
  const livingW = dims.livingWidthCm * scale;
  const livingH = dims.livingDepthCm * scale;
  const diningW = dims.diningWidthCm * scale;
  const diningH = dims.diningDepthCm * scale;
  const mapW = Math.max(livingW, diningW);
  const mapH = livingH + diningH;
  const livingX = (mapW - livingW) / 2;
  const diningX = (mapW - diningW) / 2;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 18px' }}>
      <svg
        viewBox={`0 0 ${mapW + 32} ${mapH + 32}`}
        style={{ width: '100%', maxWidth: 340, height: 'auto' }}
        role="img"
        aria-label="Living and dining area map"
      >
        <g transform="translate(16 16)">
          <rect
            x={livingX}
            y={0}
            width={livingW}
            height={livingH}
            rx="6"
            fill="#E8EEF8"
            stroke="#1F3864"
            strokeWidth="2"
          />
          <rect
            x={diningX}
            y={livingH}
            width={diningW}
            height={diningH}
            rx="6"
            fill="#EAF5E6"
            stroke="#639922"
            strokeWidth="2"
          />
          <text x={livingX + livingW / 2} y={livingH / 2 - 8} textAnchor="middle" fill="#1F3864" fontSize="12" fontWeight="700">
            Living
          </text>
          <text x={livingX + livingW / 2} y={livingH / 2 + 10} textAnchor="middle" fill="#475569" fontSize="10">
            {dims.livingWidthCm} x {dims.livingDepthCm} cm
          </text>
          <text x={diningX + diningW / 2} y={livingH + diningH / 2 - 8} textAnchor="middle" fill="#3F6F17" fontSize="12" fontWeight="700">
            Dining
          </text>
          <text x={diningX + diningW / 2} y={livingH + diningH / 2 + 10} textAnchor="middle" fill="#475569" fontSize="10">
            {dims.diningWidthCm} x {dims.diningDepthCm} cm
          </text>
        </g>
      </svg>
    </div>
  );
}
