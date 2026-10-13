import React from 'react';
import type { FurnitureItem } from '../types';
import { color as t } from './tokens';

export interface FurniturePlanSymbolProps {
  item: FurnitureItem;
  xCm: number;
  yCm: number;
  wCm: number;
  hCm: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  isSelected?: boolean;
  isDragging?: boolean;
  isRecommendationFocused?: boolean;
  showLabel?: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGElement>) => void;
  onPointerMove?: (e: React.PointerEvent<SVGElement>) => void;
  onPointerUp?: (e: React.PointerEvent<SVGElement>) => void;
  onPointerCancel?: (e: React.PointerEvent<SVGElement>) => void;
  cursor?: string;
}

const pointerNone: React.CSSProperties = { pointerEvents: 'none' };

export const FurniturePlanSymbol: React.FC<FurniturePlanSymbolProps> = ({
  item,
  xCm: propXCm,
  yCm: propYCm,
  wCm: propWCm,
  hCm: propHCm,
  fill,
  stroke,
  strokeWidth,
  strokeDasharray,
  isSelected,
  isDragging,
  isRecommendationFocused,
  showLabel = true,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  cursor,
}) => {
  const { category, shape, label, placementType } = item;
  const isWall = placementType === 'wall';
  const detailColor = stroke;
  const detailOpacity = isRecommendationFocused ? 0.6 : isSelected ? 0.45 : 0.28;

  // Center of the item footprint
  const cx = propXCm + propWCm / 2;
  const cy = propYCm + propHCm / 2;

  // Normalized rotation in degrees (0..359)
  const rotationDeg = Number.isFinite(item.rotationY)
    ? ((Math.round((item.rotationY * 180) / Math.PI) % 360) + 360) % 360
    : 0;

  // Canonical (unrotated) dimensions:
  // When an item is rotated orthogonally (e.g. 90° or 270°), propWCm and propHCm
  // in CondoFloorPlan might already be swapped due to bounding box projection.
  // We draw the canonical unrotated symbol (where lengthCm is width and widthCm is depth),
  // then apply SVG rotation around (cx, cy) so the architectural shapes and details
  // face the correct cardinal direction while perfectly aligning with the bounding box.
  const isOrthogonallyRotated = rotationDeg === 90 || rotationDeg === 270;
  const canonicalW = item.lengthCm || (isOrthogonallyRotated ? propHCm : propWCm);
  const canonicalH = item.widthCm || (isOrthogonallyRotated ? propWCm : propHCm);

  // Top-left origin of the canonical unrotated shape centered at (cx, cy)
  const xCm = cx - canonicalW / 2;
  const yCm = cy - canonicalH / 2;
  const wCm = canonicalW;
  const hCm = canonicalH;

  // Render top-down architectural furniture symbols
  const renderArchitecturalDetails = () => {
    // 1. BED
    if (category === 'bed') {
      const headboardH = Math.min(16, Math.max(8, hCm * 0.12));
      const isSingle = wCm < 115;
      const pillowW = isSingle ? Math.min(wCm * 0.55, 55) : Math.min((wCm - 16) / 2, 50);
      const pillowH = Math.min(26, Math.max(14, (hCm - headboardH) * 0.22));
      const pillowY = yCm + headboardH + 4;
      const duvetY = yCm + headboardH + pillowH + 10;
      const duvetH = Math.max(0, yCm + hCm - duvetY);

      return (
        <g style={pointerNone}>
          {/* Headboard */}
          <rect
            x={xCm}
            y={yCm}
            width={wCm}
            height={headboardH}
            rx={2}
            fill={detailColor}
            opacity={0.3}
            stroke={detailColor}
            strokeWidth={1}
          />
          {/* Pillows */}
          {isSingle ? (
            <rect
              x={xCm + (wCm - pillowW) / 2}
              y={pillowY}
              width={pillowW}
              height={pillowH}
              rx={4}
              fill="#FFFFFF"
              stroke={detailColor}
              strokeWidth={1.2}
              opacity={0.85}
            />
          ) : (
            <>
              <rect
                x={xCm + 6}
                y={pillowY}
                width={pillowW}
                height={pillowH}
                rx={4}
                fill="#FFFFFF"
                stroke={detailColor}
                strokeWidth={1.2}
                opacity={0.85}
              />
              <rect
                x={xCm + wCm - 6 - pillowW}
                y={pillowY}
                width={pillowW}
                height={pillowH}
                rx={4}
                fill="#FFFFFF"
                stroke={detailColor}
                strokeWidth={1.2}
                opacity={0.85}
              />
            </>
          )}
          {/* Folded Duvet / Blanket Line */}
          {duvetH > 15 && (
            <>
              <line
                x1={xCm + 4}
                y1={duvetY}
                x2={xCm + wCm - 4}
                y2={duvetY}
                stroke={detailColor}
                strokeWidth={1.4}
                opacity={detailOpacity + 0.15}
              />
              <line
                x1={xCm + 4}
                y1={duvetY + 5}
                x2={xCm + wCm - 4}
                y2={duvetY + 5}
                stroke={detailColor}
                strokeWidth={0.8}
                strokeDasharray="4 2"
                opacity={detailOpacity}
              />
            </>
          )}
        </g>
      );
    }

    // 2. SOFA / SECTIONAL
    if (category === 'sofa') {
      if (shape === 'l-shape') {
        const legW = wCm * 0.45;
        const legH = hCm * 0.45;
        const backD = Math.min(22, hCm * 0.22);
        return (
          <g style={pointerNone}>
            {/* Backrest along top & side leg */}
            <rect
              x={xCm}
              y={yCm}
              width={wCm}
              height={backD}
              fill={detailColor}
              opacity={detailOpacity}
              rx={3}
            />
            <rect
              x={xCm}
              y={yCm}
              width={legW * 0.45}
              height={hCm}
              fill={detailColor}
              opacity={detailOpacity}
              rx={3}
            />
            {/* Cushion seam line */}
            <line
              x1={xCm + legW}
              y1={yCm + backD}
              x2={xCm + legW}
              y2={yCm + legH}
              stroke={detailColor}
              strokeWidth={1.2}
              opacity={detailOpacity}
            />
          </g>
        );
      }

      const backD = Math.min(24, Math.max(12, hCm * 0.22));
      const armW = Math.min(22, Math.max(10, wCm * 0.12));
      const seatW = wCm - armW * 2;
      const isThreeSeater = wCm >= 170;

      return (
        <g style={pointerNone}>
          {/* Backrest Cushion */}
          <rect
            x={xCm + armW}
            y={yCm + 2}
            width={seatW}
            height={backD}
            rx={4}
            fill={detailColor}
            opacity={detailOpacity + 0.05}
          />
          {/* Left Armrest */}
          <rect
            x={xCm + 2}
            y={yCm + 2}
            width={armW - 2}
            height={hCm - 4}
            rx={4}
            fill={detailColor}
            opacity={detailOpacity}
          />
          {/* Right Armrest */}
          <rect
            x={xCm + wCm - armW}
            y={yCm + 2}
            width={armW - 2}
            height={hCm - 4}
            rx={4}
            fill={detailColor}
            opacity={detailOpacity}
          />
          {/* Seat Cushion Dividers */}
          {isThreeSeater ? (
            <>
              <line
                x1={xCm + armW + seatW / 3}
                y1={yCm + backD + 2}
                x2={xCm + armW + seatW / 3}
                y2={yCm + hCm - 3}
                stroke={detailColor}
                strokeWidth={1.2}
                opacity={detailOpacity + 0.1}
              />
              <line
                x1={xCm + armW + (seatW * 2) / 3}
                y1={yCm + backD + 2}
                x2={xCm + armW + (seatW * 2) / 3}
                y2={yCm + hCm - 3}
                stroke={detailColor}
                strokeWidth={1.2}
                opacity={detailOpacity + 0.1}
              />
            </>
          ) : (
            <line
              x1={xCm + wCm / 2}
              y1={yCm + backD + 2}
              x2={xCm + wCm / 2}
              y2={yCm + hCm - 3}
              stroke={detailColor}
              strokeWidth={1.2}
              opacity={detailOpacity + 0.1}
            />
          )}
        </g>
      );
    }

    // 3. ARMCHAIR
    if (category === 'armchair') {
      const backD = Math.min(22, hCm * 0.25);
      const armW = Math.min(20, wCm * 0.2);
      return (
        <g style={pointerNone}>
          {/* Curved Backrest */}
          <rect
            x={xCm + armW}
            y={yCm + 2}
            width={wCm - armW * 2}
            height={backD}
            rx={4}
            fill={detailColor}
            opacity={detailOpacity + 0.08}
          />
          {/* Arms */}
          <rect
            x={xCm + 2}
            y={yCm + 2}
            width={armW - 2}
            height={hCm - 4}
            rx={4}
            fill={detailColor}
            opacity={detailOpacity}
          />
          <rect
            x={xCm + wCm - armW}
            y={yCm + 2}
            width={armW - 2}
            height={hCm - 4}
            rx={4}
            fill={detailColor}
            opacity={detailOpacity}
          />
          {/* Central cushion contour */}
          <rect
            x={xCm + armW + 3}
            y={yCm + backD + 3}
            width={wCm - armW * 2 - 6}
            height={hCm - backD - 7}
            rx={4}
            fill="none"
            stroke={detailColor}
            strokeWidth={1}
            opacity={detailOpacity}
          />
        </g>
      );
    }

    // 4. DINING TABLE
    if (category === 'dining_table') {
      if (shape === 'round') {
        const cx = xCm + wCm / 2;
        const cy = yCm + hCm / 2;
        const r = Math.min(wCm, hCm) / 2;
        return (
          <g style={pointerNone}>
            {/* Inset rim */}
            <circle
              cx={cx}
              cy={cy}
              r={r - 5}
              fill="none"
              stroke={detailColor}
              strokeWidth={1}
              opacity={detailOpacity}
            />
            {/* Tucked chair outlines */}
            <circle cx={cx} cy={yCm + 6} r={8} fill="none" stroke={detailColor} strokeWidth={1} opacity={detailOpacity} />
            <circle cx={cx} cy={yCm + hCm - 6} r={8} fill="none" stroke={detailColor} strokeWidth={1} opacity={detailOpacity} />
            <circle cx={xCm + 6} cy={cy} r={8} fill="none" stroke={detailColor} strokeWidth={1} opacity={detailOpacity} />
            <circle cx={xCm + wCm - 6} cy={cy} r={8} fill="none" stroke={detailColor} strokeWidth={1} opacity={detailOpacity} />
          </g>
        );
      }

      if (shape === 'oval') {
        const cx = xCm + wCm / 2;
        const cy = yCm + hCm / 2;
        return (
          <g style={pointerNone}>
            <ellipse
              cx={cx}
              cy={cy}
              rx={wCm / 2 - 6}
              ry={hCm / 2 - 6}
              fill="none"
              stroke={detailColor}
              strokeWidth={1}
              opacity={detailOpacity}
            />
          </g>
        );
      }

      // Rectangular Dining Table with perimeter chairs
      const chairW = Math.min(36, Math.max(20, wCm * 0.22));
      const chairD = 7;
      const numChairs = wCm >= 170 ? 3 : 2;
      return (
        <g style={pointerNone}>
          {/* Inner tabletop bevel inlay */}
          <rect
            x={xCm + 6}
            y={yCm + 6}
            width={wCm - 12}
            height={hCm - 12}
            rx={2}
            fill="none"
            stroke={detailColor}
            strokeWidth={1}
            opacity={detailOpacity}
          />
          {/* Top Edge Tucked Chairs */}
          {Array.from({ length: numChairs }).map((_, i) => {
            const spacing = wCm / (numChairs + 1);
            return (
              <rect
                key={`top-${i}`}
                x={xCm + spacing * (i + 1) - chairW / 2}
                y={yCm + 1}
                width={chairW}
                height={chairD}
                rx={2}
                fill={detailColor}
                opacity={detailOpacity}
              />
            );
          })}
          {/* Bottom Edge Tucked Chairs */}
          {Array.from({ length: numChairs }).map((_, i) => {
            const spacing = wCm / (numChairs + 1);
            return (
              <rect
                key={`bot-${i}`}
                x={xCm + spacing * (i + 1) - chairW / 2}
                y={yCm + hCm - chairD - 1}
                width={chairW}
                height={chairD}
                rx={2}
                fill={detailColor}
                opacity={detailOpacity}
              />
            );
          })}
        </g>
      );
    }

    // 5. DINING CHAIR / STOOL
    if (category === 'dining_chair') {
      const backD = Math.min(10, hCm * 0.25);
      return (
        <g style={pointerNone}>
          {/* Curved Backrest */}
          <rect
            x={xCm + 3}
            y={yCm + 2}
            width={wCm - 6}
            height={backD}
            rx={2}
            fill={detailColor}
            opacity={detailOpacity + 0.15}
          />
          {/* Seat cushion border */}
          <rect
            x={xCm + 4}
            y={yCm + backD + 3}
            width={wCm - 8}
            height={hCm - backD - 6}
            rx={3}
            fill="none"
            stroke={detailColor}
            strokeWidth={1}
            opacity={detailOpacity}
          />
        </g>
      );
    }

    // 6. COFFEE TABLE / SIDE TABLE
    if (category === 'coffee_table' || category === 'side_table') {
      if (shape === 'round' || shape === 'oval') {
        const cx = xCm + wCm / 2;
        const cy = yCm + hCm / 2;
        return (
          <g style={pointerNone}>
            {shape === 'round' ? (
              <circle
                cx={cx}
                cy={cy}
                r={Math.min(wCm, hCm) / 2 - 5}
                fill="none"
                stroke={detailColor}
                strokeWidth={1}
                opacity={detailOpacity}
              />
            ) : (
              <ellipse
                cx={cx}
                cy={cy}
                rx={wCm / 2 - 5}
                ry={hCm / 2 - 5}
                fill="none"
                stroke={detailColor}
                strokeWidth={1}
                opacity={detailOpacity}
              />
            )}
            {/* Center glass accent dot */}
            <circle cx={cx} cy={cy} r={3} fill={detailColor} opacity={detailOpacity} />
          </g>
        );
      }
      return (
        <g style={pointerNone}>
          {/* Tabletop Inset Bevel */}
          <rect
            x={xCm + 5}
            y={yCm + 5}
            width={wCm - 10}
            height={hCm - 10}
            rx={2}
            fill="none"
            stroke={detailColor}
            strokeWidth={1}
            opacity={detailOpacity}
          />
          {/* Corner table legs */}
          <rect x={xCm + 3} y={yCm + 3} width={5} height={5} rx={1} fill={detailColor} opacity={detailOpacity} />
          <rect x={xCm + wCm - 8} y={yCm + 3} width={5} height={5} rx={1} fill={detailColor} opacity={detailOpacity} />
          <rect x={xCm + 3} y={yCm + hCm - 8} width={5} height={5} rx={1} fill={detailColor} opacity={detailOpacity} />
          <rect x={xCm + wCm - 8} y={yCm + hCm - 8} width={5} height={5} rx={1} fill={detailColor} opacity={detailOpacity} />
        </g>
      );
    }

    // 7. TV STAND / MEDIA CONSOLE
    if (category === 'tv_stand') {
      const tvW = Math.max(wCm * 0.65, 45);
      return (
        <g style={pointerNone}>
          {/* TV Screen Bar */}
          <rect
            x={xCm + (wCm - tvW) / 2}
            y={yCm + hCm / 2 - 3}
            width={tvW}
            height={6}
            rx={2}
            fill="#0F172A"
            opacity={0.8}
          />
          {/* TV Stand Base Foot */}
          <rect
            x={xCm + wCm / 2 - 8}
            y={yCm + hCm / 2 - 5}
            width={16}
            height={10}
            rx={1}
            fill="#475569"
            opacity={0.7}
          />
          {/* Shelf divider lines */}
          <line
            x1={xCm + wCm * 0.25}
            y1={yCm + 3}
            x2={xCm + wCm * 0.25}
            y2={yCm + hCm - 3}
            stroke={detailColor}
            strokeWidth={1}
            opacity={detailOpacity}
          />
          <line
            x1={xCm + wCm * 0.75}
            y1={yCm + 3}
            x2={xCm + wCm * 0.75}
            y2={yCm + hCm - 3}
            stroke={detailColor}
            strokeWidth={1}
            opacity={detailOpacity}
          />
        </g>
      );
    }

    // 8. WORK DESK
    if (category === 'work_desk') {
      const matW = Math.min(wCm * 0.45, 45);
      const matH = Math.min(hCm * 0.45, 26);
      return (
        <g style={pointerNone}>
          {/* Laptop / Keyboard Workspace Mat */}
          <rect
            x={xCm + (wCm - matW) / 2}
            y={yCm + 6}
            width={matW}
            height={matH}
            rx={3}
            fill={detailColor}
            opacity={detailOpacity}
          />
          {/* Chair Well Seating Cutout (bottom edge) */}
          <path
            d={`M ${xCm + wCm * 0.25} ${yCm + hCm} Q ${xCm + wCm / 2} ${yCm + hCm - 9} ${xCm + wCm * 0.75} ${yCm + hCm}`}
            fill="none"
            stroke={detailColor}
            strokeWidth={1.2}
            strokeDasharray="4 2"
            opacity={detailOpacity + 0.1}
          />
          {/* Cable Grommet in corner */}
          <circle cx={xCm + wCm - 8} cy={yCm + 8} r={3} fill="none" stroke={detailColor} strokeWidth={1} opacity={detailOpacity} />
        </g>
      );
    }

    // 9. WARDROBE / CLOSET
    if (category === 'wardrobe') {
      return (
        <g style={pointerNone}>
          {/* Center split line dividing the two doors */}
          <line
            x1={xCm + wCm / 2}
            y1={yCm + 2}
            x2={xCm + wCm / 2}
            y2={yCm + hCm - 2}
            stroke={detailColor}
            strokeWidth={1.5}
            opacity={detailOpacity + 0.15}
          />
          {/* Door Pull Handles */}
          <line
            x1={xCm + wCm / 2 - 3}
            y1={yCm + hCm / 2 - 6}
            x2={xCm + wCm / 2 - 3}
            y2={yCm + hCm / 2 + 6}
            stroke={detailColor}
            strokeWidth={2}
            opacity={detailOpacity + 0.3}
          />
          <line
            x1={xCm + wCm / 2 + 3}
            y1={yCm + hCm / 2 - 6}
            x2={xCm + wCm / 2 + 3}
            y2={yCm + hCm / 2 + 6}
            stroke={detailColor}
            strokeWidth={2}
            opacity={detailOpacity + 0.3}
          />
          {/* Dashed Clothes Hanger Rail Line */}
          <line
            x1={xCm + 6}
            y1={yCm + hCm * 0.35}
            x2={xCm + wCm - 6}
            y2={yCm + hCm * 0.35}
            stroke={detailColor}
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={detailOpacity}
          />
        </g>
      );
    }

    // 10. CABINET / BOOKSHELF
    if (category === 'cabinet') {
      return (
        <g style={pointerNone}>
          {/* Shelf / Drawer divider lines */}
          <line
            x1={xCm + 3}
            y1={yCm + hCm * 0.35}
            x2={xCm + wCm - 3}
            y2={yCm + hCm * 0.35}
            stroke={detailColor}
            strokeWidth={1}
            opacity={detailOpacity}
          />
          <line
            x1={xCm + 3}
            y1={yCm + hCm * 0.7}
            x2={xCm + wCm - 3}
            y2={yCm + hCm * 0.7}
            stroke={detailColor}
            strokeWidth={1}
            opacity={detailOpacity}
          />
          {/* Drawer handles */}
          <line
            x1={xCm + wCm / 2 - 8}
            y1={yCm + hCm * 0.52}
            x2={xCm + wCm / 2 + 8}
            y2={yCm + hCm * 0.52}
            stroke={detailColor}
            strokeWidth={1.8}
            opacity={detailOpacity + 0.2}
          />
        </g>
      );
    }

    // 11. HOUSEHOLD APPLIANCE
    if (category === 'appliance') {
      const lower = label.toLowerCase();
      // Refrigerator
      if (lower.includes('refrigerator') || lower.includes('fridge')) {
        const splitY = yCm + hCm * 0.36;
        return (
          <g style={pointerNone}>
            {/* Split freezer / fridge door line */}
            <line
              x1={xCm + 2}
              y1={splitY}
              x2={xCm + wCm - 2}
              y2={splitY}
              stroke={detailColor}
              strokeWidth={1.6}
              opacity={detailOpacity + 0.2}
            />
            {/* Upper freezer handle */}
            <line
              x1={xCm + wCm - 6}
              y1={yCm + 6}
              x2={xCm + wCm - 6}
              y2={splitY - 4}
              stroke={detailColor}
              strokeWidth={2}
              opacity={detailOpacity + 0.3}
            />
            {/* Lower fridge handle */}
            <line
              x1={xCm + wCm - 6}
              y1={splitY + 5}
              x2={xCm + wCm - 6}
              y2={yCm + hCm - 8}
              stroke={detailColor}
              strokeWidth={2}
              opacity={detailOpacity + 0.3}
            />
          </g>
        );
      }

      // Washing Machine
      if (lower.includes('wash') || lower.includes('laundry')) {
        const cx = xCm + wCm / 2;
        const cy = yCm + hCm / 2 + 3;
        const drumR = Math.min(wCm, hCm) * 0.32;
        return (
          <g style={pointerNone}>
            {/* Top control strip */}
            <rect
              x={xCm + 3}
              y={yCm + 3}
              width={wCm - 6}
              height={Math.min(10, hCm * 0.15)}
              rx={1}
              fill={detailColor}
              opacity={detailOpacity}
            />
            {/* Outer and inner drum rings */}
            <circle cx={cx} cy={cy} r={drumR} fill="none" stroke={detailColor} strokeWidth={1.5} opacity={detailOpacity + 0.2} />
            <circle cx={cx} cy={cy} r={drumR * 0.65} fill="none" stroke={detailColor} strokeWidth={1} opacity={detailOpacity} />
          </g>
        );
      }

      // Stove / Oven / Cooktop
      if (lower.includes('stove') || lower.includes('cooktop') || lower.includes('oven')) {
        const r = Math.min(wCm, hCm) * 0.15;
        return (
          <g style={pointerNone}>
            <circle cx={xCm + wCm * 0.3} cy={yCm + hCm * 0.3} r={r} fill="none" stroke={detailColor} strokeWidth={1.2} opacity={detailOpacity + 0.2} />
            <circle cx={xCm + wCm * 0.7} cy={yCm + hCm * 0.3} r={r} fill="none" stroke={detailColor} strokeWidth={1.2} opacity={detailOpacity + 0.2} />
            <circle cx={xCm + wCm * 0.3} cy={yCm + hCm * 0.7} r={r} fill="none" stroke={detailColor} strokeWidth={1.2} opacity={detailOpacity + 0.2} />
            <circle cx={xCm + wCm * 0.7} cy={yCm + hCm * 0.7} r={r} fill="none" stroke={detailColor} strokeWidth={1.2} opacity={detailOpacity + 0.2} />
          </g>
        );
      }

      return (
        <g style={pointerNone}>
          <rect x={xCm + 4} y={yCm + 4} width={wCm - 8} height={hCm - 8} rx={2} fill="none" stroke={detailColor} strokeWidth={1} opacity={detailOpacity} />
        </g>
      );
    }

    // 12. ELECTRICAL / LAMP / FAN
    if (category === 'electrical') {
      const lower = label.toLowerCase();
      const cx = xCm + wCm / 2;
      const cy = yCm + hCm / 2;

      // Lamp
      if (lower.includes('lamp') || lower.includes('light')) {
        const baseR = Math.min(wCm, hCm) / 2 - 4;
        return (
          <g style={pointerNone}>
            {/* Shade ring */}
            <circle cx={cx} cy={cy} r={baseR} fill="none" stroke={detailColor} strokeWidth={1.4} opacity={detailOpacity + 0.2} />
            {/* Center bulb / cross */}
            <circle cx={cx} cy={cy} r={3.5} fill={detailColor} opacity={detailOpacity + 0.3} />
            <line x1={cx - baseR + 2} y1={cy} x2={cx + baseR - 2} y2={cy} stroke={detailColor} strokeWidth={0.8} opacity={detailOpacity} />
            <line x1={cx} y1={cy - baseR + 2} x2={cx} y2={cy + baseR - 2} stroke={detailColor} strokeWidth={0.8} opacity={detailOpacity} />
          </g>
        );
      }

      // Fan
      if (lower.includes('fan')) {
        const r = Math.min(wCm, hCm) / 2 - 4;
        return (
          <g style={pointerNone}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={detailColor} strokeWidth={1.2} opacity={detailOpacity + 0.2} />
            <circle cx={cx} cy={cy} r={4} fill={detailColor} opacity={detailOpacity + 0.3} />
            {/* 3 blades */}
            <line x1={cx} y1={cy} x2={cx} y2={cy - r + 2} stroke={detailColor} strokeWidth={1.8} opacity={detailOpacity + 0.2} />
            <line x1={cx} y1={cy} x2={cx + (r - 2) * 0.86} y2={cy + (r - 2) * 0.5} stroke={detailColor} strokeWidth={1.8} opacity={detailOpacity + 0.2} />
            <line x1={cx} y1={cy} x2={cx - (r - 2) * 0.86} y2={cy + (r - 2) * 0.5} stroke={detailColor} strokeWidth={1.8} opacity={detailOpacity + 0.2} />
          </g>
        );
      }
    }

    // 13. PLANT / POT
    if (category === 'plant' || label.toLowerCase().includes('plant')) {
      const cx = xCm + wCm / 2;
      const cy = yCm + hCm / 2;
      const r = Math.min(wCm, hCm) / 2 - 4;
      return (
        <g style={pointerNone}>
          {/* Pot Rim & Soil Ring */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={detailColor} strokeWidth={1.2} opacity={detailOpacity + 0.15} />
          <circle cx={cx} cy={cy} r={r * 0.65} fill="#4E342E" opacity={0.15} />
          {/* Foliage Petals / Fronds radiating outward */}
          <path
            d={`M ${cx} ${cy - r} C ${cx + r * 0.5} ${cy - r * 0.5} ${cx + r * 0.5} ${cy + r * 0.5} ${cx} ${cy + r} C ${cx - r * 0.5} ${cy + r * 0.5} ${cx - r * 0.5} ${cy - r * 0.5} ${cx} ${cy - r}`}
            fill="#2E7D32"
            opacity={0.28}
          />
          <path
            d={`M ${cx - r} ${cy} C ${cx - r * 0.5} ${cx + r * 0.5} ${cx + r * 0.5} ${cx + r * 0.5} ${cx + r} ${cy} C ${cx + r * 0.5} ${cx - r * 0.5} ${cx - r * 0.5} ${cx - r * 0.5} ${cx - r} ${cy}`}
            fill="#2E7D32"
            opacity={0.28}
          />
          <circle cx={cx} cy={cy} r={3} fill="#2E7D32" opacity={0.6} />
        </g>
      );
    }

    // 14. MIRROR
    if (category === 'mirror') {
      return (
        <g style={pointerNone}>
          {/* Double frame */}
          <rect x={xCm + 3} y={yCm + 3} width={wCm - 6} height={hCm - 6} rx={2} fill="none" stroke={detailColor} strokeWidth={1} opacity={detailOpacity} />
          {/* Diagonal shimmer reflection lines */}
          <line x1={xCm + 6} y1={yCm + hCm - 6} x2={xCm + wCm * 0.4} y2={yCm + 6} stroke={detailColor} strokeWidth={1.2} opacity={detailOpacity + 0.15} />
          <line x1={xCm + wCm * 0.4} y1={yCm + hCm - 6} x2={xCm + wCm * 0.75} y2={yCm + 6} stroke={detailColor} strokeWidth={1.2} opacity={detailOpacity + 0.15} />
        </g>
      );
    }

    // 15. BATHROOM FIXTURE / VANITY
    if (category === 'bathroom_fixture') {
      const cx = xCm + wCm / 2;
      const cy = yCm + hCm / 2;
      return (
        <g style={pointerNone}>
          {/* Countertop inset */}
          <rect x={xCm + 3} y={yCm + 3} width={wCm - 6} height={hCm - 6} rx={2} fill="none" stroke={detailColor} strokeWidth={0.8} opacity={detailOpacity} />
          {/* Basin oval sink */}
          <ellipse cx={cx} cy={cy} rx={wCm * 0.28} ry={hCm * 0.28} fill="none" stroke={detailColor} strokeWidth={1.4} opacity={detailOpacity + 0.2} />
          <circle cx={cx} cy={cy} r={2.5} fill={detailColor} opacity={detailOpacity + 0.3} />
          {/* Faucet tap mark at top */}
          <rect x={cx - 2} y={cy - hCm * 0.28 - 3} width={4} height={5} rx={1} fill={detailColor} opacity={detailOpacity + 0.3} />
        </g>
      );
    }

    // 16. STORAGE RACK / UTILITY
    if (category === 'storage_rack') {
      return (
        <g style={pointerNone}>
          {/* Slatted shelf tiers */}
          <line x1={xCm + 3} y1={yCm + hCm * 0.25} x2={xCm + wCm - 3} y2={yCm + hCm * 0.25} stroke={detailColor} strokeWidth={1} opacity={detailOpacity} />
          <line x1={xCm + 3} y1={yCm + hCm * 0.5} x2={xCm + wCm - 3} y2={yCm + hCm * 0.5} stroke={detailColor} strokeWidth={1} opacity={detailOpacity} />
          <line x1={xCm + 3} y1={yCm + hCm * 0.75} x2={xCm + wCm - 3} y2={yCm + hCm * 0.75} stroke={detailColor} strokeWidth={1} opacity={detailOpacity} />
        </g>
      );
    }

    // Default fallback
    return (
      <g style={pointerNone}>
        <rect x={xCm + 4} y={yCm + 4} width={wCm - 8} height={hCm - 8} rx={2} fill="none" stroke={detailColor} strokeWidth={0.8} opacity={detailOpacity} />
      </g>
    );
  };

  // Outer primary shape
  const renderBaseShape = () => {
    const commonProps = {
      fill,
      stroke,
      strokeWidth,
      strokeDasharray,
      style: {
        transition: isDragging ? 'none' : 'fill 0.15s ease, stroke 0.15s ease',
        cursor: cursor ?? (onPointerDown ? 'pointer' : 'default'),
        touchAction: 'none' as const,
      },
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    };

    if (shape === 'round') {
      return (
        <circle
          cx={xCm + wCm / 2}
          cy={yCm + hCm / 2}
          r={Math.min(wCm, hCm) / 2}
          {...commonProps}
        />
      );
    }

    if (shape === 'oval') {
      return (
        <ellipse
          cx={xCm + wCm / 2}
          cy={yCm + hCm / 2}
          rx={wCm / 2}
          ry={hCm / 2}
          {...commonProps}
        />
      );
    }

    if (shape === 'l-shape') {
      return (
        <polygon
          points={`${xCm},${yCm} ${xCm + wCm},${yCm} ${xCm + wCm},${yCm + hCm * 0.45} ${xCm + wCm * 0.45},${yCm + hCm * 0.45} ${xCm + wCm * 0.45},${yCm + hCm} ${xCm},${yCm + hCm}`}
          {...commonProps}
        />
      );
    }

    return (
      <rect
        x={xCm}
        y={yCm}
        width={wCm}
        height={hCm}
        rx={category === 'sofa' || category === 'armchair' ? 6 : 4}
        {...commonProps}
      />
    );
  };

  return (
    <g>
      {/* 1. Rotated Geometry Group (base shape + architectural detailing) */}
      <g transform={rotationDeg !== 0 ? `rotate(${rotationDeg}, ${cx}, ${cy})` : undefined}>
        {renderBaseShape()}
        {renderArchitecturalDetails()}
      </g>

      {/* 2. Text Label & Wall Badge — kept unrotated so it's always readable */}
      {showLabel && (
        <>
          <text
            x={cx}
            y={isWall ? cy - 7 : cy}
            fontSize={15}
            fontWeight={700}
            fill={t.ink}
            textAnchor="middle"
            dominantBaseline="middle"
            style={pointerNone}
          >
            {label}
          </text>

          {isWall && (
            <text
              x={cx}
              y={cy + 10}
              fontSize={11}
              fontWeight={800}
              fill="#2563EB"
              textAnchor="middle"
              dominantBaseline="middle"
              style={pointerNone}
            >
              WALL ({item.mountHeightCm ?? 120}cm)
            </text>
          )}
        </>
      )}
    </g>
  );
};

export default FurniturePlanSymbol;
