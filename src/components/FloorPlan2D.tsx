

import { useMemo, useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { projectItems } from './floorPlanGeometry';
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
  /** Highlight one item without making it interactive (e.g. the recommendation
   *  target in the read-only default view). Ignored while `interactive` drives
   *  the same item. */
  highlightItemId?: string;
  interactive?: FloorPlan2DInteraction;
}

const PAD_CM = 40;
const ROOM_STROKE = '#94A3B8';
const ITEM_FILL = '#E7ECF3';
const ITEM_STROKE = '#64748B';
const LABEL_COLOR = '#334155';
const NORTH_COLOR = '#94A3B8';
const SEL_FILL = '#DCE6F5';
const SEL_STROKE = '#2B4E8C';
const BAD_FILL = '#FEE2E2';
const BAD_STROKE = '#EF4444';

/** Pointer client coords → world metres, using the SVG's own screen CTM. No
 *  fallback: if the SVG isn't laid out yet there's no valid transform, and a
 *  silent guess would put furniture in the wrong place — fail loudly instead. */
function eventToWorldMetres(svg: SVGSVGElement, e: ReactPointerEvent): { xm: number; zm: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) throw new Error('FloorPlan2D: SVG has no screen CTM (not laid out); cannot map pointer to world.');
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return { xm: p.x / 100, zm: p.y / 100 }; // viewBox units are centimetres
}

export default function FloorPlan2D({ items, roomWidthCm, roomLengthCm, highlightItemId, interactive }: FloorPlan2DProps) {
  const rects = useMemo(() => projectItems(items), [items]);
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);

  // Label size in cm-units, tuned to land at a readable on-screen size once
  // the SVG scales to its container. Clamped so tiny/huge rooms stay legible.
  const fontCm = Math.min(28, Math.max(16, Math.min(roomWidthCm, roomLengthCm) * 0.045));

  const vbW = roomWidthCm + PAD_CM * 2;
  const vbH = roomLengthCm + PAD_CM * 2;

  function handlePointerDown(e: ReactPointerEvent<SVGRectElement>, itemId: string) {
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
        fill="#FFFFFF"
        stroke={ROOM_STROKE}
        strokeWidth={4}
        rx={6}
      />

      {/* Single north label, centred above the top (north) wall */}
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

      {/* Furniture */}
      {rects.map((r) => {
        const isDraggable = interactive?.draggableItemId === r.id;
        const isHighlighted = isDraggable || highlightItemId === r.id;
        const isBad = isDraggable && interactive!.infeasible;
        const fill = isBad ? BAD_FILL : isHighlighted ? SEL_FILL : ITEM_FILL;
        const stroke = isBad ? BAD_STROKE : isHighlighted ? SEL_STROKE : ITEM_STROKE;
        return (
          <g key={r.id}>
            <rect
              x={r.xCm}
              y={r.yCm}
              width={r.wCm}
              height={r.hCm}
              fill={fill}
              stroke={stroke}
              strokeWidth={isHighlighted ? 5 : 3}
              rx={4}
              style={isDraggable ? draggableRectStyle : undefined}
              onPointerDown={isDraggable ? (e) => handlePointerDown(e, r.id) : undefined}
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

const draggableRectStyle: CSSProperties = { cursor: 'grab', touchAction: 'none' };
const pointerNoneText: CSSProperties = { pointerEvents: 'none', userSelect: 'none' };
