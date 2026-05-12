import { useMemo, useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import type { RoomDimensions } from '../types';

interface UnitOption {
  id: string;
  group: 'Mid Unit' | 'Inner Unit' | 'Lettered Inner Unit';
  label: string;
  grossAreaSqm: number;
}

const UNIT_OPTIONS: UnitOption[] = [
  { id: 'mid-65', group: 'Mid Unit', label: '2 Bedroom Mid Unit', grossAreaSqm: 65 },
  { id: 'mid-60', group: 'Mid Unit', label: '2 Bedroom Mid Unit', grossAreaSqm: 60 },
  { id: 'mid-57-5', group: 'Mid Unit', label: '2 Bedroom Mid Unit', grossAreaSqm: 57.5 },
  { id: 'inner-65', group: 'Inner Unit', label: '2 Bedroom Inner Unit', grossAreaSqm: 65 },
  { id: 'inner-60', group: 'Inner Unit', label: '2 Bedroom Inner Unit', grossAreaSqm: 60 },
  { id: 'inner-57-5', group: 'Inner Unit', label: '2 Bedroom Inner Unit', grossAreaSqm: 57.5 },
  { id: 'a-inner-64-5', group: 'Lettered Inner Unit', label: '2 Bedroom A Inner Unit', grossAreaSqm: 64.5 },
  { id: 'b-inner-67', group: 'Lettered Inner Unit', label: '2 Bedroom B Inner Unit', grossAreaSqm: 67 },
  { id: 'd-inner-69', group: 'Lettered Inner Unit', label: '2 Bedroom D Inner Unit', grossAreaSqm: 69 },
  { id: 'e-inner-67', group: 'Lettered Inner Unit', label: '2 Bedroom E Inner Unit', grossAreaSqm: 67 },
  { id: 'f-inner-69', group: 'Lettered Inner Unit', label: '2 Bedroom F Inner Unit', grossAreaSqm: 69 },
  { id: 'g-inner-69', group: 'Lettered Inner Unit', label: '2 Bedroom G Inner Unit', grossAreaSqm: 69 },
  { id: 'h-inner-67', group: 'Lettered Inner Unit', label: '2 Bedroom H Inner Unit', grossAreaSqm: 67 },
  { id: 'i-inner-67', group: 'Lettered Inner Unit', label: '2 Bedroom I Inner Unit', grossAreaSqm: 67 },
  { id: 'j-inner-73', group: 'Lettered Inner Unit', label: '2 Bedroom J Inner Unit', grossAreaSqm: 73 },
];

const UNIT_GROUPS: UnitOption['group'][] = ['Mid Unit', 'Inner Unit', 'Lettered Inner Unit'];

function formatSqm(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

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
  const [selectedUnitId, setSelectedUnitId] = useState(UNIT_OPTIONS[0].id);

  const selectedUnit = useMemo(
    () => UNIT_OPTIONS.find((unit) => unit.id === selectedUnitId) ?? UNIT_OPTIONS[0],
    [selectedUnitId],
  );

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
  const evaluatedPercent = Math.min(
    100,
    Math.round((evaluatedAreaSqm / selectedUnit.grossAreaSqm) * 100),
  );

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
          <div className="card-icon card-icon-primary">1</div>
          <div>
            <p className="card-title">What type of 2 bedroom unit do you live in?</p>
            <p className="card-subtitle">Choose the closest unit type and gross floor area</p>
          </div>
        </div>

        <label className="form-label" htmlFor="unit-type">
          2 bedroom unit type
        </label>
        <select
          id="unit-type"
          className="form-input form-select"
          value={selectedUnitId}
          onChange={(event) => setSelectedUnitId(event.target.value)}
        >
          {UNIT_GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {UNIT_OPTIONS.filter((unit) => unit.group === group).map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label} - {formatSqm(unit.grossAreaSqm)} sqm
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 8,
            background: 'rgba(31, 56, 100, 0.04)',
            border: '1px solid var(--border)',
          }}
        >
          <p className="card-title" style={{ fontSize: '0.95rem' }}>
            {selectedUnit.label}
          </p>
          <p className="card-subtitle">
            {selectedUnit.group} type with {formatSqm(selectedUnit.grossAreaSqm)} sqm gross floor area
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-icon card-icon-primary">m2</div>
          <div>
            <p className="card-title">Area Reference</p>
            <p className="card-subtitle">
              Evaluated living/dining area compared with total gross floor area
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <AreaStat label="Gross Floor Area" value={`${formatSqm(selectedUnit.grossAreaSqm)} sqm`} />
          <AreaStat label="Evaluated Area" value={`${evaluatedAreaSqm.toFixed(2)} sqm`} />
        </div>

        <div
          style={{
            height: 12,
            borderRadius: 999,
            background: 'var(--border)',
            overflow: 'hidden',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: `${evaluatedPercent}%`,
              height: '100%',
              background: 'var(--primary-gradient)',
            }}
          />
        </div>
        <p className="card-subtitle">
          The AR analysis focuses on approximately {evaluatedPercent}% of the selected unit gross area.
        </p>
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

function AreaStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 12,
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'rgba(31, 56, 100, 0.03)',
      }}
    >
      <p className="info-label" style={{ marginBottom: 4 }}>
        {label}
      </p>
      <p className="info-value" style={{ fontSize: '1.05rem' }}>
        {value}
      </p>
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
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '8px 0 18px',
      }}
    >
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
          <text
            x={livingX + livingW / 2}
            y={livingH / 2 - 8}
            textAnchor="middle"
            fill="#1F3864"
            fontSize="12"
            fontWeight="700"
          >
            Living
          </text>
          <text
            x={livingX + livingW / 2}
            y={livingH / 2 + 10}
            textAnchor="middle"
            fill="#475569"
            fontSize="10"
          >
            {dims.livingWidthCm} x {dims.livingDepthCm} cm
          </text>
          <text
            x={diningX + diningW / 2}
            y={livingH + diningH / 2 - 8}
            textAnchor="middle"
            fill="#3F6F17"
            fontSize="12"
            fontWeight="700"
          >
            Dining
          </text>
          <text
            x={diningX + diningW / 2}
            y={livingH + diningH / 2 + 10}
            textAnchor="middle"
            fill="#475569"
            fontSize="10"
          >
            {dims.diningWidthCm} x {dims.diningDepthCm} cm
          </text>
        </g>
      </svg>
    </div>
  );
}
