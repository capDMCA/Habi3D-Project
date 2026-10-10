import { useMemo, useRef, useState, useEffect } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { projectItems } from './floorPlanGeometry';
import { computeGridGeometry } from './gridOverlay';
import { color as t, numeric } from './tokens';
import { CONDO_ROOMS, getRoomForCategory } from '../data/condoLayout';
import type { RoomZone } from '../data/condoLayout';
import {
  clampToUnit,
  snapFree,
  edgeGaps,
  overlappingItemIds,
  roomIdForItem,
  UNIT_WIDTH_CM,
  UNIT_HEIGHT_CM,
  type AlignmentGuide,
} from './floorPlanDrag';
import type { FurnitureItem } from '../types';
import { MAIN_ENTRY_WALKWAY_RECT } from '../engine/walkways';

export interface CondoFloorPlanInteraction {
  draggableItemId: string;
  infeasible: boolean;
  onDragStart: (itemId: string) => void;
  onDragMove: (itemId: string, worldXMetres: number, worldZMetres: number) => void;
  onDragEnd: (itemId: string) => void;
}

export interface FocusTarget {
  itemId: string;
  wallSide?: 'west' | 'east' | 'north' | 'south';
  roomZoneId?: string;
  fixDirectionLabel?: string;
  fixDirectionCm?: number;
  itemBId?: string | 'wall';
  actionText?: string;
}

export interface CondoFloorPlanProps {
  items: FurnitureItem[];
  highlightItemId?: string;
  itemStatuses?: Record<string, 'RED' | 'YELLOW' | 'GREEN'>;
  interactive?: CondoFloorPlanInteraction;
  onSelectItem?: (itemId: string) => void;
  focusedRoomId?: string | null;
  onFocusRoom?: (roomId: string | null) => void;
  focusTarget?: FocusTarget | null;
}

const PAD_CM = 25;
const WIDTH_CM = UNIT_WIDTH_CM;
const HEIGHT_CM = UNIT_HEIGHT_CM;
// A click that never travels this far is a click, not a drag — nothing about
// the view, undo history, or furniture position may change because of it.
const DRAG_THRESHOLD_PX = 5;

// Computed once — the unit's own dimensions never change at runtime, so
// there's no reason to recompute this per render or per instance.
const GRID = computeGridGeometry(WIDTH_CM, HEIGHT_CM);

/** Which room a grid cell's centre falls in, for label colour + the
 *  living/dining opacity reduction. Rooms tile the unit with no gaps, so
 *  every cell centre resolves to exactly one room. */
function roomAtPoint(xCm: number, yCm: number): RoomZone | undefined {
  return CONDO_ROOMS.find(
    (r) => xCm >= r.x && xCm < r.x + r.width && yCm >= r.y && yCm < r.y + r.height,
  );
}

/**
 * Live state of a grab. Screen-to-world conversion uses the scale captured when
 * the drag began, so the piece tracks the cursor 1:1 even if the camera is
 * mid-zoom — reading getScreenCTM() every move made blocks fly across the plan.
 */
interface DragSession {
  itemId: string;
  startClientX: number;
  startClientY: number;
  startPosX: number;
  startPosZ: number;
  pxPerCmX: number;
  pxPerCmY: number;
  moved: boolean;
}

export default function CondoFloorPlan({
  items,
  highlightItemId,
  itemStatuses = {},
  interactive,
  onSelectItem,
  focusedRoomId = null,
  onFocusRoom,
  focusTarget = null,
}: CondoFloorPlanProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragSession | null>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [activeGuides, setActiveGuides] = useState<AlignmentGuide[]>([]);
  const [collidingIds, setCollidingIds] = useState<string[]>([]);
  const [dropRoomId, setDropRoomId] = useState<string | null>(null);

  // Fresh refs for window listeners, which outlive any single render.
  const itemsRef = useRef(items);
  const interactiveRef = useRef(interactive);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    interactiveRef.current = interactive;
  }, [interactive]);

  const rects = useMemo(() => projectItems(items), [items]);

  const selectedItem = useMemo(
    () => items.find((it) => it.id === highlightItemId) ?? null,
    [items, highlightItemId],
  );

  const activeRoomId = useMemo(() => {
    if (focusedRoomId) return focusedRoomId;
    if (!selectedItem) return null;
    return selectedItem.roomId || getRoomForCategory(selectedItem.category, selectedItem.label);
  }, [selectedItem, focusedRoomId]);

  // Live gap readouts for the piece being dragged or selected.
  const activeGapItem = useMemo(() => {
    if (draggingId) {
      return items.find((it) => it.id === draggingId) ?? null;
    }
    if (highlightItemId) {
      return items.find((it) => it.id === highlightItemId) ?? null;
    }
    return null;
  }, [draggingId, highlightItemId, items]);

  const activeGaps = useMemo(() => {
    if (!activeGapItem) return null;
    return edgeGaps(activeGapItem, items);
  }, [activeGapItem, items]);

  // ─── viewBox smooth zoom ────────────────────────────────────────────────────
  const targetViewBox = useMemo(() => {
    const full = { x: -PAD_CM, y: -PAD_CM, w: WIDTH_CM + PAD_CM * 2, h: HEIGHT_CM + PAD_CM * 2 };

    // When focusing a specific recommendation problem area:
    if (focusTarget) {
      const item = items.find((it) => it.id === focusTarget.itemId);
      if (item) {
        const isRotated90 = Math.abs(Math.sin(item.rotationY)) > 0.5;
        const directWidthCm = isRotated90 ? item.widthCm : item.lengthCm;
        const directHeightCm = isRotated90 ? item.lengthCm : item.widthCm;
        const itemLeft = item.posX * 100 - directWidthCm / 2;
        const itemTop = item.posZ * 100 - directHeightCm / 2;

        let minX = itemLeft;
        let maxX = itemLeft + directWidthCm;
        let minY = itemTop;
        let maxY = itemTop + directHeightCm;

        // Include correction direction span
        if (focusTarget.fixDirectionLabel) {
          const dir = focusTarget.fixDirectionLabel.toLowerCase();
          const dist = Math.max(focusTarget.fixDirectionCm ?? 30, 40);
          if (dir.includes('north')) minY -= dist;
          if (dir.includes('south')) maxY += dist;
          if (dir.includes('west'))  minX -= dist;
          if (dir.includes('east'))  maxX += dist;
        }

        // Include affected wall if specified
        if (focusTarget.wallSide) {
          const side = focusTarget.wallSide;
          const rId = item.roomId || getRoomForCategory(item.category, item.label);
          const rZone = CONDO_ROOMS.find((r) => r.id === rId);
          const rX = rZone ? rZone.x : 0;
          const rY = rZone ? rZone.y : 0;
          const rW = rZone ? rZone.width : WIDTH_CM;
          const rH = rZone ? rZone.height : HEIGHT_CM;
          if (side === 'west') minX = Math.min(minX, rX);
          if (side === 'east') maxX = Math.max(maxX, rX + rW);
          if (side === 'north') minY = Math.min(minY, rY);
          if (side === 'south') maxY = Math.max(maxY, rY + rH);
        }

        const pad = 50;
        const boxW = Math.max(maxX - minX + pad * 2, 230);
        const boxH = Math.max(maxY - minY + pad * 2, 230);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const clampedX = Math.max(-10, Math.min(centerX - boxW / 2, WIDTH_CM - boxW + 10));
        const clampedY = Math.max(-10, Math.min(centerY - boxH / 2, HEIGHT_CM - boxH + 10));

        return { x: clampedX, y: clampedY, w: boxW, h: boxH };
      }
    }

    if (!focusedRoomId) return full;
    const room = CONDO_ROOMS.find((r) => r.id === focusedRoomId);
    if (!room) return full;
    const margin = 35;
    return { x: room.x - margin, y: room.y - margin, w: room.width + margin * 2, h: room.height + margin * 2 };
  }, [focusTarget, focusedRoomId, items]);

  const [vb, setVb] = useState(targetViewBox);
  const vbRef = useRef(vb);

  useEffect(() => {
    vbRef.current = vb;
  }, [vb]);

  useEffect(() => {
    // Never re-frame mid-grab: the drag maps screen pixels to world units using
    // the scale captured at pointerdown, and animating the camera under the
    // cursor would fight the user's hand.
    if (dragRef.current) {
      setVb(targetViewBox);
      return;
    }

    let raf = 0;
    let start: number | null = null;
    const from = { ...vbRef.current };
    const duration = 350;

    const animate = (timestamp: number) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      setVb({
        x: from.x + (targetViewBox.x - from.x) * ease,
        y: from.y + (targetViewBox.y - from.y) * ease,
        w: from.w + (targetViewBox.w - from.w) * ease,
        h: from.h + (targetViewBox.h - from.h) * ease,
      });

      if (progress < 1) raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [targetViewBox]);

  // ─── Dragging ───────────────────────────────────────────────────────────────
  function handlePointerDown(e: ReactPointerEvent<SVGElement>, itemId: string) {
    e.stopPropagation();
    e.preventDefault();

    onSelectItem?.(itemId);

    const svg = svgRef.current;
    const item = itemsRef.current.find((it) => it.id === itemId);
    if (!svg || !item || !interactiveRef.current) return;

    const ctm = svg.getScreenCTM();
    if (!ctm || ctm.a === 0 || ctm.d === 0) return;

    dragRef.current = {
      itemId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPosX: item.posX,
      startPosZ: item.posZ,
      pxPerCmX: ctm.a,
      pxPerCmY: ctm.d,
      moved: false,
    };

    // Note: setDraggingId/onDragStart do NOT fire here — see onMove below.
    // A plain click must produce zero side effects (no ghost outline, no
    // undo-history push, no store write), so "a drag has begun" is only
    // true once the pointer actually crosses DRAG_THRESHOLD_PX.

    const onMove = (evt: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const current = itemsRef.current.find((it) => it.id === drag.itemId);
      if (!current) return;

      if (!drag.moved) {
        const traveledPx = Math.hypot(evt.clientX - drag.startClientX, evt.clientY - drag.startClientY);
        if (traveledPx <= DRAG_THRESHOLD_PX) return; // still just a click — no-op
        drag.moved = true;
        setDraggingId(drag.itemId);
        interactiveRef.current?.onDragStart(drag.itemId);
      }

      // Screen delta → world delta, using the scale from drag start.
      const dxM = (evt.clientX - drag.startClientX) / drag.pxPerCmX / 100;
      const dzM = (evt.clientY - drag.startClientY) / drag.pxPerCmY / 100;

      const rawX = drag.startPosX + dxM;
      const rawZ = drag.startPosZ + dzM;

      // Snap freely against walls, room edges and neighbours — then keep the
      // piece inside the unit. No room caging: it may go anywhere it fits.
      const snapped = snapFree(rawX, rawZ, current, itemsRef.current);
      const placed = clampToUnit(current, snapped.posX, snapped.posZ);

      const preview = { ...current, posX: placed.posX, posZ: placed.posZ };
      setActiveGuides(snapped.guides);
      setCollidingIds(overlappingItemIds(preview, itemsRef.current));
      setDropRoomId(roomIdForItem(preview));

      interactiveRef.current?.onDragMove(drag.itemId, placed.posX, placed.posZ);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);

      const drag = dragRef.current;
      dragRef.current = null;
      setDraggingId(null);
      setActiveGuides([]);
      setCollidingIds([]);
      setDropRoomId(null);
      // Only a real drag (crossed the threshold, so onDragStart already
      // fired) reaches onDragEnd — a plain click never committed anything
      // to begin with, so there's nothing to finalize.
      if (drag?.moved) interactiveRef.current?.onDragEnd(drag.itemId);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  const gapLabel = (cm: number) => (cm < 0 ? '0' : String(cm));

  return (
    <div style={containerStyle}>
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        style={svgStyle}
        role="img"
        aria-label="Mulberry Place Condo Digital Twin Floor Plan"
      >
        <defs>
          {/* Subtle glowing filter for focused furniture */}
          <filter id="focus-glow-furniture" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur" />
            <feComponentTransfer in="blur" result="glow">
              <feFuncA type="linear" slope="1.5" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Flowing glow filter for affected wall boundaries */}
          <filter id="focus-glow-wall" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Directional arrowhead marker for correction vectors */}
          <marker
            id="arrowhead-correction"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <polygon points="0 1, 8 4, 0 7" fill="#2563EB" />
          </marker>
        </defs>

        {/* Outer unit boundary */}
        <rect x={0} y={0} width={WIDTH_CM} height={HEIGHT_CM} fill="none" stroke={t.roomStroke} strokeWidth={6} rx={8} />

        {/* 0. DIMENSION CALLOUTS — overall unit width/height only, for
            orientation. Pulled from WIDTH_CM/HEIGHT_CM (UNIT_WIDTH_CM/
            UNIT_HEIGHT_CM from floorPlanDrag.ts, themselves derived from the
            real room data) — never a hand-typed number. Kept thin/small and
            outside the unit boundary so it stays secondary to the actual
            furniture/clearance UI. */}
        <g style={pointerNone}>
          <line x1={0} y1={-10} x2={WIDTH_CM} y2={-10} stroke={t.roomStroke} strokeWidth={1} opacity={0.6} />
          <line x1={0} y1={-14} x2={0} y2={-6} stroke={t.roomStroke} strokeWidth={1} opacity={0.6} />
          <line x1={WIDTH_CM} y1={-14} x2={WIDTH_CM} y2={-6} stroke={t.roomStroke} strokeWidth={1} opacity={0.6} />
          <text x={WIDTH_CM / 2} y={-16} fontSize={9} fontWeight={600} fill={t.inkMute} textAnchor="middle">
            {WIDTH_CM} cm ({(WIDTH_CM / 30.48).toFixed(1)} ft)
          </text>

          <line x1={-10} y1={0} x2={-10} y2={HEIGHT_CM} stroke={t.roomStroke} strokeWidth={1} opacity={0.6} />
          <line x1={-14} y1={0} x2={-6} y2={0} stroke={t.roomStroke} strokeWidth={1} opacity={0.6} />
          <line x1={-14} y1={HEIGHT_CM} x2={-6} y2={HEIGHT_CM} stroke={t.roomStroke} strokeWidth={1} opacity={0.6} />
          <text
            x={-16}
            y={HEIGHT_CM / 2}
            fontSize={9}
            fontWeight={600}
            fill={t.inkMute}
            textAnchor="middle"
            transform={`rotate(-90, -16, ${HEIGHT_CM / 2})`}
          >
            {HEIGHT_CM} cm ({(HEIGHT_CM / 30.48).toFixed(1)} ft)
          </text>
        </g>

        {/* 1. ROOM ZONES
            Living/dining render at full fill/label weight — they're where
            clearance rules actually apply (see the earlier audit: the engine
            has no room-zone awareness at all, this "rule room" distinction is
            purely which categories runClearanceAnalysis's rules can ever
            fire for) and where furniture actually gets placed. The other 6
            rooms render muted — decoration only. Every interactive affordance
            below (stroke highlight, drop-target glow, click-to-focus) is
            untouched and identical for every room regardless of this — this
            only changes fill/label opacity, never what's clickable or
            droppable. */}
        {CONDO_ROOMS.map((room) => {
          const isRoomActive = !activeRoomId || activeRoomId === room.id;
          const isHighlighted = activeRoomId === room.id;
          const isDropTarget = dropRoomId === room.id;
          const isDimmed = focusedRoomId && focusedRoomId !== room.id;
          const isRuleRoom = room.validationLevel !== 'limited';

          const baseFillOpacity = isRuleRoom ? t.roomFillOpacityActive : t.roomFillOpacityMuted;
          const labelOpacity = isRoomActive ? t.roomLabelOpacityActive : 0.55;

          const strokeColor = isDropTarget || isHighlighted ? t.ink : t.roomStroke;
          const strokeW = isDropTarget ? 3.5 : isHighlighted ? 3 : 1.5;

          // Living's south wall and dining's north wall are the same
          // real-world wall (living ends at y=700, dining starts at
          // y=700cm) — each room independently strokes its own full
          // rectangle, so that shared wall rendered as two overlapping
          // lines. Every other wall, on every room including these two,
          // is untouched: the rect below still strokes normally except on
          // this one room, where the shared edge is left open and redrawn
          // as a single 3-sided path instead, so the two real corners stay
          // properly mitered and only the shared segment is gone.
          const omitEdge: 'top' | 'bottom' | null =
            room.id === 'living' ? 'bottom' : room.id === 'dining' ? 'top' : null;
          const openSidesPath =
            omitEdge === 'bottom'
              ? `M ${room.x} ${room.y + room.height} L ${room.x} ${room.y} L ${room.x + room.width} ${room.y} L ${room.x + room.width} ${room.y + room.height}`
              : omitEdge === 'top'
                ? `M ${room.x} ${room.y} L ${room.x} ${room.y + room.height} L ${room.x + room.width} ${room.y + room.height} L ${room.x + room.width} ${room.y}`
                : null;

          return (
            <g key={room.id} style={{ transition: 'opacity 0.3s ease' }} opacity={isDimmed ? 0.3 : 1}>
              <rect
                x={room.x}
                y={room.y}
                width={room.width}
                height={room.height}
                fill={room.bgColor}
                fillOpacity={isDropTarget ? 0.24 : baseFillOpacity}
                stroke={omitEdge ? 'none' : strokeColor}
                strokeWidth={strokeW}
                style={{
                  cursor: focusedRoomId ? 'default' : 'pointer',
                  transition: 'fill-opacity 0.15s ease, stroke 0.15s ease',
                }}
                onClick={() => !focusedRoomId && onFocusRoom?.(room.id)}
              />
              {openSidesPath && (
                <path
                  d={openSidesPath}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  style={{ ...pointerNone, transition: 'stroke 0.15s ease' }}
                />
              )}
              <text
                x={room.x + room.width / 2}
                y={room.y + room.height / 2 - 8}
                fontSize={21}
                fontWeight={800}
                fill={room.textColor}
                textAnchor="middle"
                dominantBaseline="middle"
                opacity={labelOpacity}
                style={pointerNone}
              >
                {room.label}
              </text>
              <text
                x={room.x + room.width / 2}
                y={room.y + room.height / 2 + 13}
                fontSize={10.5}
                fontWeight={700}
                fill={room.textColor}
                textAnchor="middle"
                dominantBaseline="middle"
                opacity={Math.max(0.7, labelOpacity)}
                style={pointerNone}
              >
                {room.validationLevel === 'full'
                  ? '• Clearance Standards (L/D)'
                  : room.validationLevel === 'bedroom'
                  ? '• Bedroom Standards (B1–B2)'
                  : '• Limited Analysis (Perimeter)'}
              </text>
            </g>
          );
        })}

        {/* 1B. WAYFINDING GRID — a background reference layer, drawn above the
            room fill but below furniture. Never intercepts pointer events:
            the whole group is pointer-events:none, so drag/click handling on
            rooms and furniture below is completely unaffected. Lettered rows
            and numbered columns are computed once from the unit's own real
            dimensions (gridOverlay.ts) — not hand-picked to match any
            reference image. Labels read quieter inside living/dining, since
            that's the one area the user is actually working in. */}
        <g style={pointerNone}>
          {GRID.verticalLinesCm.map((x) => (
            <line
              key={`grid-v-${x}`}
              x1={x}
              y1={0}
              x2={x}
              y2={HEIGHT_CM}
              stroke={t.roomStroke}
              strokeWidth={0.75}
              opacity={0.35}
            />
          ))}
          {GRID.horizontalLinesCm.map((y) => (
            <line
              key={`grid-h-${y}`}
              x1={0}
              y1={y}
              x2={WIDTH_CM}
              y2={y}
              stroke={t.roomStroke}
              strokeWidth={0.75}
              opacity={0.35}
            />
          ))}
          {GRID.cells.map((cell) => {
            const cx = cell.xCm + cell.wCm / 2;
            const cy = cell.yCm + cell.hCm / 2;
            const cellRoom = roomAtPoint(cx, cy);
            const isActiveRoom = cellRoom?.id === 'living' || cellRoom?.id === 'dining';
            return (
              <text
                key={`grid-label-${cell.rowLabel}${cell.colLabel}`}
                x={cx}
                y={cy}
                fontSize={9}
                fontWeight={600}
                fill={cellRoom?.textColor ?? t.roomStroke}
                opacity={isActiveRoom ? 0.22 : 0.5}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {cell.rowLabel}{cell.colLabel}
              </text>
            );
          })}
        </g>

        {/* 2. MAIN WALKWAY CORRIDOR OVERLAY (Front Entrance -> Bedrooms) */}
        <g style={pointerNone}>
          <rect
            x={MAIN_ENTRY_WALKWAY_RECT.x}
            y={MAIN_ENTRY_WALKWAY_RECT.y}
            width={MAIN_ENTRY_WALKWAY_RECT.width}
            height={MAIN_ENTRY_WALKWAY_RECT.height}
            fill="rgba(43, 84, 154, 0.05)"
            stroke={t.inkSoft}
            strokeWidth={2}
            strokeDasharray="6 4"
            rx={6}
          />
          <text
            x={MAIN_ENTRY_WALKWAY_RECT.x + MAIN_ENTRY_WALKWAY_RECT.width / 2}
            y={MAIN_ENTRY_WALKWAY_RECT.y + MAIN_ENTRY_WALKWAY_RECT.height / 2}
            fontSize={11}
            fontWeight={700}
            fill={t.inkMute}
            letterSpacing={2}
            opacity={0.45}
            textAnchor="middle"
            transform={`rotate(-90, ${MAIN_ENTRY_WALKWAY_RECT.x + MAIN_ENTRY_WALKWAY_RECT.width / 2}, ${MAIN_ENTRY_WALKWAY_RECT.y + MAIN_ENTRY_WALKWAY_RECT.height / 2})`}
          >
            MAIN WALKWAY
          </text>
        </g>

        {/* 2B. ARCHITECTURAL PARTITION WALLS */}
        <g style={pointerNone}>
          {/* Wall separating Bedroom 2 and Living (y = 340cm, x: 0..260cm) */}
          <line
            x1={0}
            y1={340}
            x2={260}
            y2={340}
            stroke="#0f172a"
            strokeWidth={4.5}
            strokeLinecap="round"
          />
          {/* Divider wall separating West and East zones (x = 260cm, y: 100..880cm) */}
          <line
            x1={260}
            y1={100}
            x2={260}
            y2={880}
            stroke="#0f172a"
            strokeWidth={4.5}
            strokeLinecap="round"
          />
        </g>

        {/* 2C. GLOWING WALL / BOUNDARY HIGHLIGHT FOR FOCUS RECOMMENDATION */}
        {focusTarget && focusTarget.wallSide && (() => {
          const targetItem = items.find((it) => it.id === focusTarget.itemId);
          const rId = targetItem?.roomId || (targetItem ? getRoomForCategory(targetItem.category, targetItem.label) : null);
          const rZone = rId ? CONDO_ROOMS.find((r) => r.id === rId) : null;
          const rX = rZone ? rZone.x : 0;
          const rY = rZone ? rZone.y : 0;
          const rW = rZone ? rZone.width : WIDTH_CM;
          const rH = rZone ? rZone.height : HEIGHT_CM;

          let x1 = rX;
          let y1 = rY;
          let x2 = rX + rW;
          let y2 = rY;

          if (focusTarget.wallSide === 'west') {
            x1 = rX; y1 = rY; x2 = rX; y2 = rY + rH;
          } else if (focusTarget.wallSide === 'east') {
            x1 = rX + rW; y1 = rY; x2 = rX + rW; y2 = rY + rH;
          } else if (focusTarget.wallSide === 'north') {
            x1 = rX; y1 = rY; x2 = rX + rW; y2 = rY;
          } else if (focusTarget.wallSide === 'south') {
            x1 = rX; y1 = rY + rH; x2 = rX + rW; y2 = rY + rH;
          }

          return (
            <g style={pointerNone}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#2563EB"
                strokeWidth={7}
                strokeLinecap="round"
                strokeDasharray="12 6"
                filter="url(#focus-glow-wall)"
                className="wksp-glowing-wall"
              />
            </g>
          );
        })()}

        {/* Main entry walkway corridor obstruction */}
        {focusTarget && focusTarget.actionText && focusTarget.actionText.toLowerCase().includes('walkway') && (
          <g style={pointerNone}>
            <rect
              x={MAIN_ENTRY_WALKWAY_RECT.x}
              y={MAIN_ENTRY_WALKWAY_RECT.y}
              width={MAIN_ENTRY_WALKWAY_RECT.width}
              height={MAIN_ENTRY_WALKWAY_RECT.height}
              fill="rgba(37, 99, 235, 0.08)"
              stroke="#2563EB"
              strokeWidth={4}
              strokeDasharray="8 4"
              filter="url(#focus-glow-wall)"
              className="wksp-glowing-wall"
              rx={6}
            />
          </g>
        )}

        {/* 3. ALIGNMENT GUIDES */}
        {activeGuides.map((g, idx) =>
          g.type === 'x' ? (
            <line
              key={`guide-x-${idx}`}
              x1={g.coord * 100}
              y1={0}
              x2={g.coord * 100}
              y2={HEIGHT_CM}
              stroke={t.ink}
              strokeWidth={2}
              strokeDasharray="6 4"
              opacity={0.9}
              style={pointerNone}
            />
          ) : (
            <line
              key={`guide-z-${idx}`}
              x1={0}
              y1={g.coord * 100}
              x2={WIDTH_CM}
              y2={g.coord * 100}
              stroke={t.ink}
              strokeWidth={2}
              strokeDasharray="6 4"
              opacity={0.9}
              style={pointerNone}
            />
          ),
        )}

        {/* 4. FURNITURE ITEMS */}
        {rects.map((r) => {
          const isSelected = highlightItemId === r.id;
          const isDragging = draggingId === r.id;
          const isColliding = collidingIds.includes(r.id) || (isDragging && collidingIds.length > 0);

          const item = items.find((it) => it.id === r.id);
          if (!item) return null;
          const itemRoomId = item.roomId || getRoomForCategory(item.category, item.label);

          // While dragging, keep every piece legible — dimming hides collisions.
          // When focusing a recommendation, dim unrelated furniture pieces.
          const isRecommendationFocused = Boolean(focusTarget && focusTarget.itemId === r.id);
          const isItemDimmed =
            (!draggingId && activeRoomId && activeRoomId !== itemRoomId && !focusTarget) ||
            (!draggingId && focusTarget && focusTarget.itemId !== r.id && focusTarget.itemBId !== r.id);

          let fill: string;
          let stroke: string;

          if (isColliding) {
            // Darker fill than the plain-selected case below — a real
            // blocking state (this drop would overlap) needs to read as
            // more urgent than "just selected," even with color removed
            // from the distinction entirely.
            fill = t.inkMute;
            stroke = t.ink;
          } else if (isSelected) {
            fill = t.line;
            stroke = t.ink;
          } else {
            const status = itemStatuses[r.id] ?? 'GREEN';
            if (status === 'RED') {
              fill = t.attentionBg;
              stroke = t.attentionFg;
            } else if (status === 'YELLOW') {
              fill = t.tightBg;
              stroke = t.tightFg;
            } else {
              fill = t.comfortBg;
              stroke = t.comfortFg;
            }
          }

          // Direct 1:1 real-world centimetre dimensions from pristine furnitureStore state
          const isRotated90 = Math.abs(Math.sin(item.rotationY)) > 0.5;
          const directWidthCm = isRotated90 ? item.widthCm : item.lengthCm;
          const directHeightCm = isRotated90 ? item.lengthCm : item.widthCm;
          const directRadiusCm = item.widthCm / 2;

          return (
            <g
              key={r.id}
              style={{
                opacity: isItemDimmed ? 0.28 : 1,
                transition: 'opacity 0.25s ease',
              }}
            >
              {isDragging && (
                <rect
                  x={r.xCm - 3}
                  y={r.yCm - 3}
                  width={directWidthCm + 6}
                  height={directHeightCm + 6}
                  fill="none"
                  stroke={isColliding ? t.ink : t.inkSoft}
                  strokeWidth={2}
                  strokeOpacity={0.35}
                  rx={7}
                  style={pointerNone}
                />
              )}

              {/* Glowing pulsing focus ring around affected recommendation furniture */}
              {isRecommendationFocused && (
                r.shape === 'round' ? (
                  <circle
                    cx={r.xCm + directWidthCm / 2}
                    cy={r.yCm + directHeightCm / 2}
                    r={directRadiusCm + 7}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth={4}
                    filter="url(#focus-glow-furniture)"
                    className="wksp-glow-ring"
                    style={pointerNone}
                  />
                ) : (
                  <rect
                    x={r.xCm - 7}
                    y={r.yCm - 7}
                    width={directWidthCm + 14}
                    height={directHeightCm + 14}
                    rx={8}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth={4}
                    filter="url(#focus-glow-furniture)"
                    className="wksp-glow-ring"
                    style={pointerNone}
                  />
                )
              )}

              {r.shape === 'round' ? (
                <circle
                  cx={r.xCm + directWidthCm / 2}
                  cy={r.yCm + directHeightCm / 2}
                  r={directRadiusCm}
                  fill={fill}
                  stroke={isRecommendationFocused ? '#2563EB' : stroke}
                  strokeWidth={isRecommendationFocused || isSelected || isDragging ? 4 : 2}
                  strokeDasharray={r.placementType === 'wall' ? '6 3' : undefined}
                  style={{
                    transition: isDragging ? 'none' : 'fill 0.15s ease, stroke 0.15s ease',
                    pointerEvents: 'none',
                  }}
                />
              ) : r.shape === 'oval' ? (
                <ellipse
                  cx={r.xCm + directWidthCm / 2}
                  cy={r.yCm + directHeightCm / 2}
                  rx={directWidthCm / 2}
                  ry={directHeightCm / 2}
                  fill={fill}
                  stroke={isRecommendationFocused ? '#2563EB' : stroke}
                  strokeWidth={isRecommendationFocused || isSelected || isDragging ? 4 : 2}
                  strokeDasharray={r.placementType === 'wall' ? '6 3' : undefined}
                  style={{
                    transition: isDragging ? 'none' : 'fill 0.15s ease, stroke 0.15s ease',
                    pointerEvents: 'none',
                  }}
                />
              ) : r.shape === 'l-shape' ? (
                <polygon
                  points={`${r.xCm},${r.yCm} ${r.xCm + directWidthCm},${r.yCm} ${r.xCm + directWidthCm},${r.yCm + directHeightCm * 0.45} ${r.xCm + directWidthCm * 0.45},${r.yCm + directHeightCm * 0.45} ${r.xCm + directWidthCm * 0.45},${r.yCm + directHeightCm} ${r.xCm},${r.yCm + directHeightCm}`}
                  fill={fill}
                  stroke={isRecommendationFocused ? '#2563EB' : stroke}
                  strokeWidth={isRecommendationFocused || isSelected || isDragging ? 4 : 2}
                  strokeDasharray={r.placementType === 'wall' ? '6 3' : undefined}
                  style={{
                    transition: isDragging ? 'none' : 'fill 0.15s ease, stroke 0.15s ease',
                    pointerEvents: 'none',
                  }}
                />
              ) : (
                <rect
                  x={r.xCm}
                  y={r.yCm}
                  width={directWidthCm}
                  height={directHeightCm}
                  fill={fill}
                  stroke={isRecommendationFocused ? '#2563EB' : stroke}
                  strokeWidth={isRecommendationFocused || isSelected || isDragging ? 4 : 2}
                  strokeDasharray={r.placementType === 'wall' ? '6 3' : undefined}
                  rx={4}
                  style={{
                    transition: isDragging ? 'none' : 'fill 0.15s ease, stroke 0.15s ease',
                    pointerEvents: 'none',
                  }}
                />
              )}

              <text
                x={r.xCm + directWidthCm / 2}
                y={r.placementType === 'wall' ? r.yCm + directHeightCm / 2 - 7 : r.yCm + directHeightCm / 2}
                fontSize={16}
                fontWeight={700}
                fill={t.ink}
                textAnchor="middle"
                dominantBaseline="middle"
                style={pointerNone}
              >
                {r.label}
              </text>

              {r.placementType === 'wall' && (
                <text
                  x={r.xCm + directWidthCm / 2}
                  y={r.yCm + directHeightCm / 2 + 10}
                  fontSize={11}
                  fontWeight={800}
                  fill="#2563EB"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={pointerNone}
                >
                  {`[WALL ${r.mountHeightCm ?? 120}cm]`}
                </text>
              )}

              {/* 2D Animated Correction Arrow */}
              {isRecommendationFocused && focusTarget?.fixDirectionLabel && (() => {
                const ft = focusTarget;
                if (!ft || !ft.fixDirectionLabel) return null;
                const dir = ft.fixDirectionLabel.toLowerCase();
                const arrowDist = Math.max(ft.fixDirectionCm ?? 30, 42);
                const cx = r.xCm + directWidthCm / 2;
                const cy = r.yCm + directHeightCm / 2;
                let startX = cx;
                let startY = cy;
                let endX = cx;
                let endY = cy;

                if (dir.includes('north')) {
                  startY = r.yCm;
                  endY = startY - arrowDist;
                } else if (dir.includes('south')) {
                  startY = r.yCm + directHeightCm;
                  endY = startY + arrowDist;
                } else if (dir.includes('west')) {
                  startX = r.xCm;
                  endX = startX - arrowDist;
                } else if (dir.includes('east')) {
                  startX = r.xCm + directWidthCm;
                  endX = startX + arrowDist;
                }

                const badgeX = (startX + endX) / 2;
                const badgeY = (startY + endY) / 2;
                const arrowSymbol = dir.includes('north') ? '↑' : dir.includes('south') ? '↓' : dir.includes('west') ? '←' : '→';

                return (
                  <g key="correction-arrow" style={pointerNone} className="wksp-correction-arrow">
                    <line
                      x1={startX}
                      y1={startY}
                      x2={endX}
                      y2={endY}
                      stroke="#2563EB"
                      strokeWidth={3.5}
                      strokeLinecap="round"
                      markerEnd="url(#arrowhead-correction)"
                    />
                    <g transform={`translate(${badgeX}, ${badgeY})`}>
                      <rect
                        x={-38}
                        y={-12}
                        width={76}
                        height={24}
                        rx={12}
                        fill="#2563EB"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                      <text
                        x={0}
                        y={0}
                        fontSize={11}
                        fontWeight={800}
                        fill="#ffffff"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {`${arrowSymbol} ${ft.fixDirectionCm ?? 25} cm`}
                      </text>
                    </g>
                  </g>
                );
              })()}

              {/* Oversized transparent hit target — a near-zero alpha fill still
                  receives pointer events and makes small pieces easy to grab. */}
              <rect
                x={r.xCm - 12}
                y={r.yCm - 12}
                width={directWidthCm + 24}
                height={directHeightCm + 24}
                fill="rgba(0,0,0,0.001)"
                style={{
                  cursor: isDragging ? 'grabbing' : 'grab',
                  touchAction: 'none',
                  pointerEvents: 'all',
                }}
                onPointerDown={(e) => handlePointerDown(e, r.id)}
              />
            </g>
          );
        })}

        {/* 5. LIVE GAP READOUTS on the dragged or selected piece */}
        {activeGapItem && activeGaps && (() => {
          const dr = rects.find((r) => r.id === activeGapItem.id);
          if (!dr) return null;
          const cx = dr.xCm + dr.wCm / 2;
          const cy = dr.yCm + dr.hCm / 2;
          const badge = (key: string, x: number, y: number, cm: number) => (
            <g key={key} style={pointerNone}>
              <rect
                x={x - 26}
                y={y - 12}
                width={52}
                height={24}
                rx={12}
                fill={cm < 60 ? t.attentionFg : cm < 91 ? t.tightFg : t.comfortFg}
                opacity={0.95}
              />
              <text
                x={x}
                y={y}
                fontSize={14}
                fontWeight={800}
                fill="#FFFFFF"
                textAnchor="middle"
                dominantBaseline="middle"
                style={numeric}
              >
                {gapLabel(cm)}
              </text>
            </g>
          );
          return (
            <>
              {badge('gap-w', Math.max(dr.xCm - 34, 30), cy, activeGaps.west)}
              {badge('gap-e', Math.min(dr.xCm + dr.wCm + 34, WIDTH_CM - 30), cy, activeGaps.east)}
              {badge('gap-n', cx, Math.max(dr.yCm - 22, 16), activeGaps.north)}
              {badge('gap-s', cx, Math.min(dr.yCm + dr.hCm + 22, HEIGHT_CM - 16), activeGaps.south)}
            </>
          );
        })()}
      </svg>

      {/* 6. CORNER CONDO MINIMAP */}
      {focusedRoomId && (
        <div style={minimapContainerStyle}>
          <svg viewBox={`-5 -5 ${WIDTH_CM + 10} ${HEIGHT_CM + 10}`} style={{ width: '100%', height: '100%' }}>
            <rect x={0} y={0} width={WIDTH_CM} height={HEIGHT_CM} fill="none" stroke="#CBD5E1" strokeWidth={3} rx={4} />
            {CONDO_ROOMS.map((room) => (
              <rect
                key={`mini-${room.id}`}
                x={room.x}
                y={room.y}
                width={room.width}
                height={room.height}
                fill={focusedRoomId === room.id ? t.ink : '#E2E8F0'}
                stroke="#94A3B8"
                strokeWidth={1}
                style={{ cursor: 'pointer' }}
                onClick={() => onFocusRoom?.(room.id)}
              />
            ))}
          </svg>
          <button style={minimapExitBtn} onClick={() => onFocusRoom?.(null)} aria-label="Zoom out to condo">
            Zoom Out
          </button>
        </div>
      )}
    </div>
  );
}

const containerStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
  position: 'relative',
};

// Fixed to the FULL unit's ratio (the zoomed-out view), always — never the
// ratio of whatever viewBox happens to be active. Without this, the <svg>
// element's own CSS box (sized by `width:auto;height:auto` off its
// intrinsic/viewBox aspect ratio) resizes and re-centres itself every time
// `vb` animates between a room's shape and the full unit's differently-
// shaped rectangle, on top of the intentional camera pan/zoom — the plan
// frame itself visibly jumps, not just its content. Locking the outer box
// to one constant shape makes the frame's size and centred position on
// screen completely stable; `preserveAspectRatio`'s default (xMidYMid
// meet) then does the letterboxing/centring of whatever viewBox is
// currently active INSIDE that fixed frame, which is exactly the zoom
// effect this is meant to look like.
const svgStyle: CSSProperties = {
  maxWidth: '100%',
  maxHeight: '100%',
  width: 'auto',
  height: 'auto',
  aspectRatio: `${WIDTH_CM + PAD_CM * 2} / ${HEIGHT_CM + PAD_CM * 2}`,
  display: 'block',
  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.06)',
  borderRadius: '16px',
  background: '#FCFDFE',
  border: `1px solid ${t.line}`,
  touchAction: 'none',
};

const pointerNone: CSSProperties = {
  pointerEvents: 'none',
  userSelect: 'none',
};

const minimapContainerStyle: CSSProperties = {
  position: 'absolute',
  top: 24,
  right: 24,
  width: 90,
  height: 175,
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(4px)',
  border: '1px solid #E2E8F0',
  borderRadius: '12px',
  padding: '8px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  zIndex: 10,
};

const minimapExitBtn: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  padding: '4px 6px',
  background: '#F1F5F9',
  border: '1px solid #CBD5E1',
  borderRadius: '6px',
  cursor: 'pointer',
  textAlign: 'center',
  color: '#475569',
};
