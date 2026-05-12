import { useState } from 'react';
import { MULBERRY_PLACE_2BR } from '../data/roomData';
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
const STEP = 10;
const MIN_DIM = 200;
const MAX_DIM = 1000;

function clamp(value: number) {
  return Math.max(MIN_DIM, Math.min(MAX_DIM, value));
}

function formatSqm(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export default function UnitSetupScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const setRoomDimensions = useSessionStore((s) => s.setRoomDimensions);

  const [selectedUnitId, setSelectedUnitId] = useState(UNIT_OPTIONS[0].id);
  const [dims, setDims] = useState<RoomDimensions>({
    ...MULBERRY_PLACE_2BR.defaultDimensions,
  });

  const selectedUnit = UNIT_OPTIONS.find((unit) => unit.id === selectedUnitId) ?? UNIT_OPTIONS[0];

  const livingAreaSqm = ((dims.livingWidthCm * dims.livingDepthCm) / 10000).toFixed(1);
  const diningAreaSqm = ((dims.diningWidthCm * dims.diningDepthCm) / 10000).toFixed(1);
  const totalSqm = (
    (dims.livingWidthCm * dims.livingDepthCm +
      dims.diningWidthCm * dims.diningDepthCm) /
    10000
  ).toFixed(1);
  const evaluatedPercent = Math.min(
    100,
    Math.round((Number(totalSqm) / selectedUnit.grossAreaSqm) * 100),
  );

  function adjust(key: keyof RoomDimensions, delta: number) {
    setDims((prev) => ({
      ...prev,
      [key]: clamp(prev[key] + delta),
    }));
  }

  function handleConfirm() {
    setRoomDimensions(dims);
    navigateTo('furnitureInput');
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigateTo('entry')} aria-label="Go back">
          &lt;
        </button>
        <div className="screen-header-info">
          <span className="step-label">Step 1 of 6</span>
          <h2>Confirm Your Unit</h2>
        </div>
      </div>

      <div className="progress-bar">
        <div className="progress-step active" />
        <div className="progress-step" />
        <div className="progress-step" />
        <div className="progress-step" />
        <div className="progress-step" />
        <div className="progress-step" />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-icon card-icon-primary">1</div>
          <div>
            <p className="card-title">What type of 2 bedroom unit do you live in?</p>
            <p className="card-subtitle">Choose the closest Mulberry Place unit type</p>
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
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'rgba(31, 56, 100, 0.04)',
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
            <p className="card-subtitle">Living/dining area compared with selected gross floor area</p>
          </div>
        </div>

        <div className="info-row">
          <span className="info-label">Gross Floor Area</span>
          <span className="info-value">{formatSqm(selectedUnit.grossAreaSqm)} sqm</span>
        </div>
        <div className="info-row">
          <span className="info-label">Living/Dining Area</span>
          <span className="info-value">{totalSqm} sqm</span>
        </div>
        <div
          style={{
            height: 12,
            borderRadius: 999,
            background: 'var(--border)',
            overflow: 'hidden',
            marginTop: 12,
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
          The AR analysis focuses on approximately {evaluatedPercent}% of this unit's gross floor area.
        </p>
      </div>

      <DimensionCard
        title="Living Area"
        areaSqm={livingAreaSqm}
        widthCm={dims.livingWidthCm}
        depthCm={dims.livingDepthCm}
        onWidthChange={(delta) => adjust('livingWidthCm', delta)}
        onDepthChange={(delta) => adjust('livingDepthCm', delta)}
      />

      <DimensionCard
        title="Dining Area"
        areaSqm={diningAreaSqm}
        widthCm={dims.diningWidthCm}
        depthCm={dims.diningDepthCm}
        onWidthChange={(delta) => adjust('diningWidthCm', delta)}
        onDepthChange={(delta) => adjust('diningDepthCm', delta)}
      />

      <div className="card">
        <div className="card-header">
          <div className="card-icon card-icon-success">2D</div>
          <div>
            <p className="card-title">Floor Plan Preview</p>
            <p className="card-subtitle">Proportional layout of your living/dining areas</p>
          </div>
        </div>
        <FloorPlanSVG dims={dims} />
      </div>

      <button
        id="confirm-unit-btn"
        className="btn btn-primary"
        onClick={handleConfirm}
        style={{ marginTop: 'var(--space-sm)' }}
      >
        Confirm Dimensions and Continue
      </button>
    </div>
  );
}

function DimensionCard({
  title,
  areaSqm,
  widthCm,
  depthCm,
  onWidthChange,
  onDepthChange,
}: {
  title: string;
  areaSqm: string;
  widthCm: number;
  depthCm: number;
  onWidthChange: (delta: number) => void;
  onDepthChange: (delta: number) => void;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon card-icon-primary">{title.slice(0, 1)}</div>
        <div>
          <p className="card-title">{title}</p>
          <p className="card-subtitle">{areaSqm} sqm</p>
        </div>
      </div>

      <DimensionRow label="Width" valueCm={widthCm} onChange={onWidthChange} />
      <DimensionRow label="Depth" valueCm={depthCm} onChange={onDepthChange} />
    </div>
  );
}

function DimensionRow({
  label,
  valueCm,
  onChange,
}: {
  label: string;
  valueCm: number;
  onChange: (delta: number) => void;
}) {
  return (
    <div className="dim-row">
      <span className="dim-label">{label}</span>
      <div className="dim-control">
        <button className="dim-btn" onClick={() => onChange(-STEP)} aria-label={`Decrease ${label.toLowerCase()}`}>
          -
        </button>
        <span className="dim-value">{valueCm} cm</span>
        <button className="dim-btn" onClick={() => onChange(STEP)} aria-label={`Increase ${label.toLowerCase()}`}>
          +
        </button>
      </div>
    </div>
  );
}

function FloorPlanSVG({ dims }: { dims: RoomDimensions }) {
  const pad = 28;
  const maxRealWidth = Math.max(dims.livingWidthCm, dims.diningWidthCm);
  const totalRealDepth = dims.livingDepthCm + dims.diningDepthCm;
  const scale = Math.min(300 / maxRealWidth, 260 / totalRealDepth);

  const livingW = dims.livingWidthCm * scale;
  const livingH = dims.livingDepthCm * scale;
  const diningW = dims.diningWidthCm * scale;
  const diningH = dims.diningDepthCm * scale;
  const mapW = Math.max(livingW, diningW);
  const mapH = livingH + diningH;
  const livingX = pad + (mapW - livingW) / 2;
  const diningX = pad + (mapW - diningW) / 2;

  return (
    <div className="floor-plan-container">
      <svg
        viewBox={`0 0 ${mapW + pad * 2} ${mapH + pad * 2}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Floor plan preview"
      >
        <rect
          x={livingX}
          y={pad}
          width={livingW}
          height={livingH}
          fill="#EBF0F7"
          stroke="#1F3864"
          strokeWidth="2"
          rx="6"
        />
        <rect
          x={diningX}
          y={pad + livingH}
          width={diningW}
          height={diningH}
          fill="#F0F7EB"
          stroke="#639922"
          strokeWidth="2"
          rx="6"
        />
        <text x={livingX + livingW / 2} y={pad + livingH / 2 - 8} textAnchor="middle" fill="#1F3864" fontSize="12" fontWeight="700">
          Living
        </text>
        <text x={livingX + livingW / 2} y={pad + livingH / 2 + 10} textAnchor="middle" fill="#475569" fontSize="10">
          {dims.livingWidthCm} x {dims.livingDepthCm} cm
        </text>
        <text x={diningX + diningW / 2} y={pad + livingH + diningH / 2 - 8} textAnchor="middle" fill="#3F6F17" fontSize="12" fontWeight="700">
          Dining
        </text>
        <text x={diningX + diningW / 2} y={pad + livingH + diningH / 2 + 10} textAnchor="middle" fill="#475569" fontSize="10">
          {dims.diningWidthCm} x {dims.diningDepthCm} cm
        </text>
      </svg>
    </div>
  );
}
