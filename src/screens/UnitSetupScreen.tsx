import { useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { MULBERRY_PLACE_2BR } from '../data/roomData';
import type { RoomDimensions } from '../types';

const STEP = 10; // adjustment step in cm
const MIN_DIM = 200;
const MAX_DIM = 1000;

function clamp(val: number) {
  return Math.max(MIN_DIM, Math.min(MAX_DIM, val));
}

export default function UnitSetupScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const setRoomDimensions = useSessionStore((s) => s.setRoomDimensions);

  const [dims, setDims] = useState<RoomDimensions>({
    ...MULBERRY_PLACE_2BR.defaultDimensions,
  });

  function adjust(key: keyof RoomDimensions, delta: number) {
    setDims((prev) => ({
      ...prev,
      [key]: clamp(prev[key] + delta),
    }));
  }

  const livingAreaSqm = ((dims.livingWidthCm * dims.livingDepthCm) / 10000).toFixed(1);
  const diningAreaSqm = ((dims.diningWidthCm * dims.diningDepthCm) / 10000).toFixed(1);
  const totalSqm = (
    (dims.livingWidthCm * dims.livingDepthCm +
      dims.diningWidthCm * dims.diningDepthCm) /
    10000
  ).toFixed(1);

  function handleConfirm() {
    setRoomDimensions(dims);
    navigateTo('furnitureInput');
  }

  return (
    <div className="screen">
      {/* Header */}
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigateTo('preSurvey')} aria-label="Go back">
          ←
        </button>
        <div className="screen-header-info">
          <span className="step-label">Step 2 of 7</span>
          <h2>Confirm Your Unit</h2>
        </div>
      </div>

      {/* Progress */}
      <div className="progress-bar">
        <div className="progress-step completed" />
        <div className="progress-step active" />
        <div className="progress-step" />
        <div className="progress-step" />
        <div className="progress-step" />
        <div className="progress-step" />
        <div className="progress-step" />
      </div>

      {/* Unit Info Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon card-icon-primary">🏢</div>
          <div>
            <p className="card-title">{MULBERRY_PLACE_2BR.name}</p>
            <p className="card-subtitle">{MULBERRY_PLACE_2BR.unitType}</p>
          </div>
        </div>
        <div className="info-row">
          <span className="info-label">Total Floor Area</span>
          <span className="info-value">{MULBERRY_PLACE_2BR.totalFloorAreaSqm} sqm</span>
        </div>
        <div className="info-row">
          <span className="info-label">Living/Dining Area</span>
          <span className="info-value">{totalSqm} sqm</span>
        </div>
      </div>

      {/* Living Area Dimensions */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon card-icon-primary">🛋️</div>
          <div>
            <p className="card-title">Living Area</p>
            <p className="card-subtitle">{livingAreaSqm} sqm</p>
          </div>
        </div>

        <div className="dim-row">
          <span className="dim-label">Width</span>
          <div className="dim-control">
            <button
              className="dim-btn"
              onClick={() => adjust('livingWidthCm', -STEP)}
              aria-label="Decrease living width"
            >
              −
            </button>
            <span className="dim-value">{dims.livingWidthCm} cm</span>
            <button
              className="dim-btn"
              onClick={() => adjust('livingWidthCm', STEP)}
              aria-label="Increase living width"
            >
              +
            </button>
          </div>
        </div>

        <div className="dim-row">
          <span className="dim-label">Depth</span>
          <div className="dim-control">
            <button
              className="dim-btn"
              onClick={() => adjust('livingDepthCm', -STEP)}
              aria-label="Decrease living depth"
            >
              −
            </button>
            <span className="dim-value">{dims.livingDepthCm} cm</span>
            <button
              className="dim-btn"
              onClick={() => adjust('livingDepthCm', STEP)}
              aria-label="Increase living depth"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Dining Area Dimensions */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon card-icon-primary">🍽️</div>
          <div>
            <p className="card-title">Dining Area</p>
            <p className="card-subtitle">{diningAreaSqm} sqm</p>
          </div>
        </div>

        <div className="dim-row">
          <span className="dim-label">Width</span>
          <div className="dim-control">
            <button
              className="dim-btn"
              onClick={() => adjust('diningWidthCm', -STEP)}
              aria-label="Decrease dining width"
            >
              −
            </button>
            <span className="dim-value">{dims.diningWidthCm} cm</span>
            <button
              className="dim-btn"
              onClick={() => adjust('diningWidthCm', STEP)}
              aria-label="Increase dining width"
            >
              +
            </button>
          </div>
        </div>

        <div className="dim-row">
          <span className="dim-label">Depth</span>
          <div className="dim-control">
            <button
              className="dim-btn"
              onClick={() => adjust('diningDepthCm', -STEP)}
              aria-label="Decrease dining depth"
            >
              −
            </button>
            <span className="dim-value">{dims.diningDepthCm} cm</span>
            <button
              className="dim-btn"
              onClick={() => adjust('diningDepthCm', STEP)}
              aria-label="Increase dining depth"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Floor Plan Preview */}
      <div className="card">
        <div className="card-header">
          <div className="card-icon card-icon-success">📐</div>
          <div>
            <p className="card-title">Floor Plan Preview</p>
            <p className="card-subtitle">Proportional layout of your living/dining areas</p>
          </div>
        </div>
        <FloorPlanSVG dims={dims} />
      </div>

      {/* Confirm Button */}
      <button
        id="confirm-unit-btn"
        className="btn btn-primary"
        onClick={handleConfirm}
        style={{ marginTop: 'var(--space-sm)' }}
      >
        Confirm Dimensions & Continue
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------
   Floor Plan SVG — proportional 2D view of living + dining areas
   ------------------------------------------------------------------ */
function FloorPlanSVG({ dims }: { dims: RoomDimensions }) {
  const pad = 40;
  const labelOffset = 24;

  // Scale all dims to fit max 320px wide
  const maxRealWidth = Math.max(dims.livingWidthCm, dims.diningWidthCm);
  const totalRealDepth = dims.livingDepthCm + dims.diningDepthCm;
  const scale = Math.min(300 / maxRealWidth, 260 / totalRealDepth);

  const lw = dims.livingWidthCm * scale;
  const ld = dims.livingDepthCm * scale;
  const dw = dims.diningWidthCm * scale;
  const dd = dims.diningDepthCm * scale;

  const svgW = Math.max(lw, dw) + pad * 2 + labelOffset;
  const svgH = ld + dd + pad * 2 + labelOffset;

  // Rooms start offset to center them
  const livingX = pad + labelOffset + (Math.max(lw, dw) - lw) / 2;
  const diningX = pad + labelOffset + (Math.max(lw, dw) - dw) / 2;
  const livingY = pad;
  const diningY = pad + ld;

  return (
    <div className="floor-plan-container">
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Floor plan preview"
      >
        {/* Living Room */}
        <rect
          x={livingX}
          y={livingY}
          width={lw}
          height={ld}
          fill="#EBF0F7"
          stroke="#1F3864"
          strokeWidth="2"
          rx="3"
        />
        <text
          x={livingX + lw / 2}
          y={livingY + ld / 2 - 8}
          textAnchor="middle"
          fill="#1F3864"
          fontSize="11"
          fontWeight="600"
          fontFamily="Inter, system-ui, sans-serif"
        >
          Living Area
        </text>
        <text
          x={livingX + lw / 2}
          y={livingY + ld / 2 + 8}
          textAnchor="middle"
          fill="#6B7280"
          fontSize="9"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {dims.livingWidthCm} × {dims.livingDepthCm} cm
        </text>

        {/* Sofa icon (simple rectangle) */}
        <rect
          x={livingX + 12}
          y={livingY + ld - 28}
          width={lw * 0.5}
          height={14}
          fill="#1F3864"
          opacity="0.15"
          rx="3"
        />

        {/* Dining Room */}
        <rect
          x={diningX}
          y={diningY}
          width={dw}
          height={dd}
          fill="#F0F7EB"
          stroke="#1F3864"
          strokeWidth="2"
          rx="3"
        />
        <text
          x={diningX + dw / 2}
          y={diningY + dd / 2 - 8}
          textAnchor="middle"
          fill="#1F3864"
          fontSize="11"
          fontWeight="600"
          fontFamily="Inter, system-ui, sans-serif"
        >
          Dining Area
        </text>
        <text
          x={diningX + dw / 2}
          y={diningY + dd / 2 + 8}
          textAnchor="middle"
          fill="#6B7280"
          fontSize="9"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {dims.diningWidthCm} × {dims.diningDepthCm} cm
        </text>

        {/* Table icon (simple oval) */}
        <ellipse
          cx={diningX + dw / 2}
          cy={diningY + dd / 2 + 20}
          rx={dw * 0.18}
          ry={dd * 0.12}
          fill="#1F3864"
          opacity="0.12"
        />

        {/* Width dimension line — living */}
        <line
          x1={livingX}
          y1={livingY - 10}
          x2={livingX + lw}
          y2={livingY - 10}
          stroke="#9CA3AF"
          strokeWidth="1"
          markerStart="url(#arrowL)"
          markerEnd="url(#arrowR)"
        />
        <text
          x={livingX + lw / 2}
          y={livingY - 16}
          textAnchor="middle"
          fill="#9CA3AF"
          fontSize="8"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {dims.livingWidthCm} cm
        </text>

        {/* Depth dimension line — left side */}
        <line
          x1={Math.min(livingX, diningX) - 10}
          y1={livingY}
          x2={Math.min(livingX, diningX) - 10}
          y2={diningY + dd}
          stroke="#9CA3AF"
          strokeWidth="1"
        />
        <text
          x={Math.min(livingX, diningX) - 14}
          y={(livingY + diningY + dd) / 2}
          textAnchor="middle"
          fill="#9CA3AF"
          fontSize="8"
          fontFamily="Inter, system-ui, sans-serif"
          transform={`rotate(-90, ${Math.min(livingX, diningX) - 14}, ${(livingY + diningY + dd) / 2})`}
        >
          {dims.livingDepthCm + dims.diningDepthCm} cm total
        </text>

        {/* Arrow markers */}
        <defs>
          <marker id="arrowL" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto">
            <path d="M6,0 L0,3 L6,6" fill="none" stroke="#9CA3AF" strokeWidth="1" />
          </marker>
          <marker id="arrowR" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6" fill="none" stroke="#9CA3AF" strokeWidth="1" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
