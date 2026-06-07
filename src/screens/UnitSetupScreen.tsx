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
  const username = useSessionStore((s) => s.username);

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
        <button className="back-btn" onClick={() => navigateTo('auth')} aria-label="Go back">
          ←
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

      {username && username !== 'admin' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'linear-gradient(135deg, #1F3864 0%, #2B4E8C 100%)',
          borderRadius: 14,
          padding: '14px 16px',
          marginBottom: 'var(--space-md)',
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 16,
            fontWeight: 800,
            color: '#ffffff',
          }}>
            {username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>
              Welcome, {username}!
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.65)', fontWeight: 400 }}>
              Let's get your unit set up for analysis.
            </p>
          </div>
        </div>
      )}

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
  const lW = dims.livingWidthCm;
  const lD = dims.livingDepthCm;
  const dW = dims.diningWidthCm;
  const dD = dims.diningDepthCm;

  const zoneW = Math.max(lW, dW);
  const ENTRY_D = 80;
  const PAD = 24;

  const unitW = zoneW;
  const unitD = lD + dD + ENTRY_D;

  const vbW = unitW + PAD * 2;
  const vbH = unitD + PAD * 2;

  const OX = PAD;
  const OY = PAD;

  const yLivBot = OY + lD;
  const yDinBot = yLivBot + dD;
  const yEntBot = yDinBot + ENTRY_D;

  const W = 6;   // wall stroke
  const FL = 42; // living/dining label
  const FM = 30; // entry label
  const FS = 26; // dimension text

  const midX = OX + unitW / 2;

  return (
    <div className="floor-plan-container">
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Floor plan preview"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {/* ── LIVING ROOM ── */}
        <rect x={OX} y={OY} width={unitW} height={lD}
          fill="#e8eef8" stroke="#1F3864" strokeWidth={W} rx={4} />
        <text x={midX} y={OY + lD * 0.38}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={FL} fontWeight="700" fill="#1F3864"
          fontFamily="system-ui,-apple-system,sans-serif">
          Living Room
        </text>
        <text x={midX} y={OY + lD * 0.58}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={FS} fill="#4B6BAD"
          fontFamily="system-ui,-apple-system,sans-serif">
          {lW} × {lD} cm
        </text>

        {/* ── DINING AREA ── */}
        <rect x={OX + (zoneW - dW) / 2} y={yLivBot} width={dW} height={dD}
          fill="#e6f4ec" stroke="#1F3864" strokeWidth={W} rx={4} />
        {/* open-plan dashed divider */}
        <line x1={OX} y1={yLivBot} x2={OX + unitW} y2={yLivBot}
          stroke="#1F3864" strokeWidth={W * 0.5}
          strokeDasharray={`${W * 3} ${W * 2}`} />
        <text x={OX + (zoneW - dW) / 2 + dW / 2} y={yLivBot + dD * 0.38}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={FL} fontWeight="700" fill="#166534"
          fontFamily="system-ui,-apple-system,sans-serif">
          Dining Area
        </text>
        <text x={OX + (zoneW - dW) / 2 + dW / 2} y={yLivBot + dD * 0.58}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={FS} fill="#15803d"
          fontFamily="system-ui,-apple-system,sans-serif">
          {dW} × {dD} cm
        </text>

        {/* ── ENTRY / FOYER ── */}
        <rect x={OX} y={yDinBot} width={unitW} height={ENTRY_D}
          fill="#f1f5f9" stroke="#1F3864" strokeWidth={W} rx={4} />
        <text x={midX} y={yDinBot + ENTRY_D / 2}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={FM} fontWeight="600" fill="#475569"
          fontFamily="system-ui,-apple-system,sans-serif">
          Entry / Foyer
        </text>

        {/* ── ENTRY DOOR (bottom wall gap + swing arc) ── */}
        <rect x={midX - 35} y={yEntBot - W * 0.6}
          width={70} height={W * 1.2} fill="#f1f5f9" />
        <line x1={midX - 35} y1={yEntBot}
          x2={midX - 35} y2={yEntBot - 70}
          stroke="#94a3b8" strokeWidth={2.5} />
        <path
          d={`M ${midX - 35} ${yEntBot} A 70 70 0 0 0 ${midX + 35} ${yEntBot}`}
          fill="none" stroke="#94a3b8" strokeWidth={2}
          strokeDasharray="6 4" />

        {/* ── OUTER WALL (on top) ── */}
        <rect x={OX} y={OY} width={unitW} height={unitD}
          fill="none" stroke="#1F3864" strokeWidth={W} rx={4} />
      </svg>
    </div>
  );
}
