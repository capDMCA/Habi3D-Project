import { useMemo, useRef, useState, useEffect } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { projectItems } from './floorPlanGeometry';
import { color as t } from './designTokens';
import { CONDO_ROOMS, getRoomForCategory } from '../data/condoLayout';
import { WALKWAY_PATHS, type WalkwayStatus } from '../engine/walkways';
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

function walkwayBelongsToRoom(pathId: string, roomId: string): boolean {
  if (roomId === 'living') return ['living_dining', 'living_balcony', 'living_bedroom'].includes(pathId);
  if (roomId === 'dining') return ['living_dining', 'dining_kitchen'].includes(pathId);
  if (roomId === 'bedroom1' || roomId === 'bedroom2') return ['living_bedroom', 'bedroom_bathroom'].includes(pathId);
  if (roomId === 'kitchen') return ['dining_kitchen'].includes(pathId);
  if (roomId === 'bathroom') return ['bedroom_bathroom'].includes(pathId);
  return false;
}

export interface CondoFloorPlanInteraction {
  draggableItemId: string;
  infeasible: boolean;
  onDragStart: (itemId: string) => void;
  onDragMove: (itemId: string, worldXMetres: number, worldZMetres: number) => void;
  onDragEnd: (itemId: string) => void;
}

export interface CondoFloorPlanProps {
  items: FurnitureItem[];
  highlightItemId?: string;
  itemStatuses?: Record<string, 'RED' | 'YELLOW' | 'GREEN'>;
  interactive?: CondoFloorPlanInteraction;
  onSelectItem?: (itemId: string) => void;
  walkwayStatuses?: WalkwayStatus[];
  focusedRoomId?: string | null;
  onFocusRoom?: (roomId: string | null) => void;
}

const PAD_CM = 25;
const WIDTH_CM = UNIT_WIDTH_CM;
const HEIGHT_CM = UNIT_HEIGHT_CM;
// A click that never travels this far is a click, not a drag — nothing about
// the view, undo history, or furniture position may change because of it.
const DRAG_THRESHOLD_PX = 5;

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
  walkwayStatuses = [],
  focusedRoomId = null,
  onFocusRoom,
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

  // Live gap readouts for the piece being dragged.
  const draggedItem = useMemo(
    () => (draggingId ? items.find((it) => it.id === draggingId) ?? null : null),
    [draggingId, items],
  );
  const draggedGaps = useMemo(
    () => (draggedItem ? edgeGaps(draggedItem, items) : null),
    [draggedItem, items],
  );

  // ─── viewBox smooth zoom ────────────────────────────────────────────────────
  const targetViewBox = useMemo(() => {
    const full = { x: -PAD_CM, y: -PAD_CM, w: WIDTH_CM + PAD_CM * 2, h: HEIGHT_CM + PAD_CM * 2 };
    if (!focusedRoomId) return full;
    const room = CONDO_ROOMS.find((r) => r.id === focusedRoomId);
    if (!room) return full;
    const margin = 35;
    return { x: room.x - margin, y: room.y - margin, w: room.width + margin * 2, h: room.height + margin * 2 };
  }, [focusedRoomId]);

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
        {/* Outer unit boundary */}
        <rect x={0} y={0} width={WIDTH_CM} height={HEIGHT_CM} fill="none" stroke={t.roomStroke} strokeWidth={6} rx={8} />

        {/* 1. ROOM ZONES */}
        {CONDO_ROOMS.map((room) => {
          const isRoomActive = !activeRoomId || activeRoomId === room.id;
          const isHighlighted = activeRoomId === room.id;
          const isDropTarget = dropRoomId === room.id;
          const isDimmed = focusedRoomId && focusedRoomId !== room.id;

          return (
            <g key={room.id} style={{ transition: 'opacity 0.3s ease' }} opacity={isDimmed ? 0.3 : 1}>
              <rect
                x={room.x}
                y={room.y}
                width={room.width}
                height={room.height}
                fill={room.bgColor}
                fillOpacity={isDropTarget ? 0.22 : 0.08}
                stroke={isDropTarget ? t.accent : isHighlighted ? t.accent : t.roomStroke}
                strokeWidth={isDropTarget ? 4 : isHighlighted ? 3 : 1.5}
                style={{
                  cursor: focusedRoomId ? 'default' : 'pointer',
                  transition: 'fill-opacity 0.15s ease, stroke 0.15s ease',
                }}
                onClick={() => !focusedRoomId && onFocusRoom?.(room.id)}
              />
              <text
                x={room.x + room.width / 2}
                y={room.y + room.height / 2}
                fontSize={24}
                fontWeight={800}
                fill={room.textColor}
                textAnchor="middle"
                dominantBaseline="middle"
                opacity={isRoomActive ? 0.95 : 0.4}
                style={pointerNone}
              >
                {room.label}
              </text>
            </g>
          );
        })}

        {/* 2. WALKWAY CORRIDORS */}
        {WALKWAY_PATHS.map((path) => {
          const status = walkwayStatuses.find((s) => s.id === path.id)?.status ?? 'GREEN';
          const isWalkwayDimmed = activeRoomId && !walkwayBelongsToRoom(path.id, activeRoomId);

          let walkwayColor: string = t.comfortFg;
          let fillOpacity = 0.05;
          if (status === 'RED') {
            walkwayColor = t.attentionFg;
            fillOpacity = 0.15;
          } else if (status === 'YELLOW') {
            walkwayColor = t.tightFg;
            fillOpacity = 0.12;
          }

          return (
            <g key={path.id} style={{ transition: 'opacity 0.25s ease' }} opacity={isWalkwayDimmed ? 0.15 : 1}>
              <rect
                x={path.x}
                y={path.y}
                width={path.width}
                height={path.height}
                fill={walkwayColor}
                fillOpacity={fillOpacity}
                stroke={walkwayColor}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                strokeOpacity={isWalkwayDimmed ? 0.15 : 0.6}
                rx={2}
                style={pointerNone}
              />
            </g>
          );
        })}

        {/* 3. ALIGNMENT GUIDES */}
        {activeGuides.map((g, idx) =>
          g.type === 'x' ? (
            <line
              key={`guide-x-${idx}`}
              x1={g.coord * 100}
              y1={0}
              x2={g.coord * 100}
              y2={HEIGHT_CM}
              stroke={t.accent}
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
              stroke={t.accent}
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
          const isItemDimmed = !draggingId && activeRoomId && activeRoomId !== itemRoomId;

          let fill: string;
          let stroke: string;

          if (isColliding) {
            fill = t.attentionBg;
            stroke = t.attentionFg;
          } else if (isSelected) {
            fill = t.accentFill;
            stroke = t.accent;
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

          return (
            <g
              key={r.id}
              style={{
                opacity: isItemDimmed ? 0.25 : 1,
                transition: 'opacity 0.25s ease',
              }}
            >
              {isDragging && (
                <rect
                  x={r.xCm - 3}
                  y={r.yCm - 3}
                  width={r.wCm + 6}
                  height={r.hCm + 6}
                  fill="none"
                  stroke={isColliding ? t.attentionFg : t.accent}
                  strokeWidth={2}
                  strokeOpacity={0.35}
                  rx={7}
                  style={pointerNone}
                />
              )}

              {r.shape === 'round' ? (
                <circle
                  cx={r.xCm + r.wCm / 2}
                  cy={r.yCm + r.hCm / 2}
                  r={r.wCm / 2}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSelected || isDragging ? 4 : 2}
                  style={{
                    transition: isDragging ? 'none' : 'fill 0.15s ease, stroke 0.15s ease',
                    pointerEvents: 'none',
                  }}
                />
              ) : (
                <rect
                  x={r.xCm}
                  y={r.yCm}
                  width={r.wCm}
                  height={r.hCm}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSelected || isDragging ? 4 : 2}
                  rx={4}
                  style={{
                    transition: isDragging ? 'none' : 'fill 0.15s ease, stroke 0.15s ease',
                    pointerEvents: 'none',
                  }}
                />
              )}

              <text
                x={r.xCm + r.wCm / 2}
                y={r.yCm + r.hCm / 2}
                fontSize={18}
                fontWeight={700}
                fill={t.ink}
                textAnchor="middle"
                dominantBaseline="middle"
                style={pointerNone}
              >
                {r.label}
              </text>

              {/* Oversized transparent hit target — a near-zero alpha fill still
                  receives pointer events and makes small pieces easy to grab. */}
              <rect
                x={r.xCm - 12}
                y={r.yCm - 12}
                width={r.wCm + 24}
                height={r.hCm + 24}
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

        {/* 5. LIVE GAP READOUTS on the dragged piece */}
        {draggedItem && draggedGaps && (() => {
          const dr = rects.find((r) => r.id === draggedItem.id);
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
              >
                {gapLabel(cm)}
              </text>
            </g>
          );
          return (
            <>
              {badge('gap-w', Math.max(dr.xCm - 34, 30), cy, draggedGaps.west)}
              {badge('gap-e', Math.min(dr.xCm + dr.wCm + 34, WIDTH_CM - 30), cy, draggedGaps.east)}
              {badge('gap-n', cx, Math.max(dr.yCm - 22, 16), draggedGaps.north)}
              {badge('gap-s', cx, Math.min(dr.yCm + dr.hCm + 22, HEIGHT_CM - 16), draggedGaps.south)}
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
                fill={focusedRoomId === room.id ? t.accent : '#E2E8F0'}
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

const svgStyle: CSSProperties = {
  maxWidth: '100%',
  maxHeight: '100%',
  width: 'auto',
  height: 'auto',
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
