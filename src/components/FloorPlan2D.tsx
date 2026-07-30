

import { useMemo, useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { projectItems } from './floorPlanGeometry';
import { color } from './designTokens';
import type { FurnitureItem } from '../types';

/**
 * Top-down, to-scale schematic of the room and the user's AR-placed
 * furniture. Purely 2D SVG — no photos, no 3D, no rule codes, no scores.
 *
 * COORDINATES. The SVG viewBox is the room in centimetres, so 1 SVG unit
 * = 1 cm and everything is drawn to scale with no bespoke scaling math.
 * World → plan mapping (matches how the engine names walls):
 *   x  → left/right   (x=0 is the WEST wall, x=roomWidthCm is EAST)
 *   z  → top/bottom   (z=0 is the NORTH wall at the top, increasing = SOUTH)
 * SVG's y-axis already points down, so z maps straight to y and NORTH
 * lands at the top, which is where the single "N" label goes.
 *
 * GEOMETRY. Every rectangle comes from the engine's toBounds() via
 * projectItems() — the same axis-aligned envelope runClearanceAnalysis
 * measures against — so the plan and the analysis can never disagree.
 *
 * INTERACTION (optional). Pass `interactive` to make one block draggable. This
 * component owns only the pointer→world projection (via the SVG's own screen
 * CTM — the one place with the element ref) and reports raw world-metre
 * coordinates upward. Snapping, feasibility and snap-back live in the caller,
 * on top of the engine predicate — this component makes no geometry decisions.
 */

export interface FloorPlan2DInteraction {
  draggableItemId: string;
  /** Tint the draggable block to show its current position is not allowed. */
  infeasible: boolean;
  onDragStart: (itemId: string) => void;
  onDragMove: (worldXMetres: number, worldZMetres: number) => void;
  onDragEnd: () => void;
}

export interface FloorPlan2DProps {
  items: FurnitureItem[];
  roomWidthCm: number;
  roomLengthCm: number;
  highlightItemId?: string;
  /** Clearance status of each furniture item. */
  itemStatuses?: Record<string, 'RED' | 'YELLOW' | 'GREEN'>;
  /** Optional ghost/recommended position to display. */
  ghostItem?: FurnitureItem | null;
  interactive?: FloorPlan2DInteraction;
  onSelectItem?: (itemId: string) => void;
}

const PAD_CM = 40;
const ROOM_STROKE = color.roomStroke;
const LABEL_COLOR = color.inkSoft;
const NORTH_COLOR = color.inkMute;

// Phase 1 tokens for selections and bounds
const SEL_FILL = color.accentFill;
const SEL_STROKE = color.accent;
const BAD_FILL = color.attentionBg;
const BAD_STROKE = color.attentionFg;

// Clearance status colors for other items
const STATUS_COLORS = {
  RED: { fill: color.attentionBg, stroke: color.attentionFg },
  YELLOW: { fill: color.tightBg, stroke: color.tightFg },
  GREEN: { fill: color.comfortBg, stroke: color.comfortFg },
} as const;

function eventToWorldMetres(svg: SVGSVGElement, e: ReactPointerEvent): { xm: number; zm: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) throw new Error('FloorPlan2D: SVG has no screen CTM (not laid out); cannot map pointer to world.');
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return { xm: p.x / 100, zm: p.y / 100 }; // viewBox units are centimetres
}

export default function FloorPlan2D({
  items,
  roomWidthCm,
  roomLengthCm,
  highlightItemId,
  itemStatuses = {},
  ghostItem,
  interactive,
  onSelectItem,
}: FloorPlan2DProps) {
  const rects = useMemo(() => projectItems(items), [items]);
  const ghostRects = useMemo(() => (ghostItem ? projectItems([ghostItem]) : []), [ghostItem]);
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);

  const fontCm = Math.min(28, Math.max(16, Math.min(roomWidthCm, roomLengthCm) * 0.045));
  const vbW = roomWidthCm + PAD_CM * 2;
  const vbH = roomLengthCm + PAD_CM * 2;

  function handlePointerDown(e: ReactPointerEvent<SVGRectElement>, itemId: string) {
    if (onSelectItem) {
      onSelectItem(itemId);
    }
    // Allow dragging only if the item matches the active interactive target
    if (!interactive || itemId !== interactive.draggableItemId) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    interactive.onDragStart(itemId);
  }

  function handlePointerMove(e: ReactPointerEvent<SVGRectElement>) {
    if (!interactive || !draggingRef.current || !svgRef.current) return;
    const { xm, zm } = eventToWorldMetres(svgRef.current, e);
    interactive.onDragMove(xm, zm);
  }

  function handlePointerUp(e: ReactPointerEvent<SVGRectElement>) {
    if (!interactive || !draggingRef.current) return;
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    interactive.onDragEnd();
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`${-PAD_CM} ${-PAD_CM} ${vbW} ${vbH}`}
      style={svgStyle}
      role="img"
      aria-label="Top-down plan of your room and furniture"
    >
      {/* Room outline */}
      <rect
        x={0}
        y={0}
        width={roomWidthCm}
        height={roomLengthCm}
        fill={color.surface}
        stroke={ROOM_STROKE}
        strokeWidth={4}
        rx={6}
      />

      {/* Single north label */}
      <text
        x={roomWidthCm / 2}
        y={-PAD_CM / 2}
        fontSize={fontCm}
        fontWeight={700}
        fill={NORTH_COLOR}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        N
      </text>

      {/* Ghost recommendation overlay */}
      {ghostRects.map((r) => (
        <g key={`ghost-${r.id}`}>
          <rect
            x={r.xCm}
            y={r.yCm}
            width={r.wCm}
            height={r.hCm}
            fill="none"
            stroke={color.accent}
            strokeWidth={3}
            strokeDasharray="10 8"
            rx={4}
            opacity={0.65}
            style={{ pointerEvents: 'none' }}
          />
          <text
            x={r.xCm + r.wCm / 2}
            y={r.yCm + r.hCm / 2}
            fontSize={fontCm * 0.85}
            fontWeight={700}
            fill={color.accent}
            textAnchor="middle"
            dominantBaseline="middle"
            opacity={0.7}
            style={pointerNoneText}
          >
            Recommended Position
          </text>
        </g>
      ))}

      {/* Furniture */}
      {rects.map((r) => {
        const isSelected = highlightItemId === r.id;
        const isDraggable = interactive?.draggableItemId === r.id;
        const isBad = isDraggable && interactive!.infeasible;

        // Visual rules:
        // 1. If actively dragging/infeasible -> show red infeasibility tint.
        // 2. If it is the selected item -> show solid Phase 1 accent blue tokens.
        // 3. Otherwise -> color code according to its current clearance status.
        let fill: string = color.itemFill;
        let stroke: string = color.itemStroke;

        if (isBad) {
          fill = BAD_FILL;
          stroke = BAD_STROKE;
        } else if (isSelected) {
          fill = SEL_FILL;
          stroke = SEL_STROKE;
        } else {
          const status = itemStatuses[r.id] ?? 'GREEN';
          fill = STATUS_COLORS[status].fill;
          stroke = STATUS_COLORS[status].stroke;
        }

        const strokeWidth = isSelected ? 5 : 3;

        return (
          <g key={r.id}>
            <rect
              x={r.xCm}
              y={r.yCm}
              width={r.wCm}
              height={r.hCm}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              rx={4}
              style={{
                cursor: isDraggable ? 'grab' : 'pointer',
                touchAction: 'none',
              }}
              onPointerDown={(e) => handlePointerDown(e, r.id)}
              onPointerMove={isDraggable ? handlePointerMove : undefined}
              onPointerUp={isDraggable ? handlePointerUp : undefined}
              onPointerCancel={isDraggable ? handlePointerUp : undefined}
            />
            <text
              x={r.xCm + r.wCm / 2}
              y={r.yCm + r.hCm / 2}
              fontSize={fontCm}
              fontWeight={600}
              fill={LABEL_COLOR}
              textAnchor="middle"
              dominantBaseline="middle"
              style={pointerNoneText}
            >
              {r.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const svgStyle: CSSProperties = {
  width: '100%',
  height: 'auto',
  maxHeight: '58vh',
  display: 'block',
  fontFamily: "'Inter', system-ui, sans-serif",
  touchAction: 'none', // let the SVG own the drag gesture, not the page scroll
};

const pointerNoneText: CSSProperties = { pointerEvents: 'none', userSelect: 'none' };
