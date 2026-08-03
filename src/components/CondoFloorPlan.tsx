import { useMemo, useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { projectItems } from './floorPlanGeometry';
import { color as t } from './designTokens';
import { CONDO_ROOMS, getRoomForCategory } from '../data/condoLayout';
import { WALKWAY_PATHS, type WalkwayStatus } from '../engine/walkways';
import { clampToRoom, snapTarget } from './floorPlanDrag';
import type { FurnitureItem } from '../types';

export interface CondoFloorPlanInteraction {
  draggableItemId: string;
  infeasible: boolean;
  onDragStart: (itemId: string) => void;
  onDragMove: (worldXMetres: number, worldZMetres: number) => void;
  onDragEnd: () => void;
}

export interface CondoFloorPlanProps {
  items: FurnitureItem[];
  highlightItemId?: string;
  itemStatuses?: Record<string, 'RED' | 'YELLOW' | 'GREEN'>;
  interactive?: CondoFloorPlanInteraction;
  onSelectItem?: (itemId: string) => void;
  walkwayStatuses?: WalkwayStatus[];
}

const PAD_CM = 25;
const WIDTH_CM = 510;
const HEIGHT_CM = 880;

function eventToWorldMetres(svg: SVGSVGElement, e: ReactPointerEvent): { xm: number; zm: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) throw new Error('CondoFloorPlan: SVG has no screen CTM; cannot map pointer to world.');
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return { xm: p.x / 100, zm: p.y / 100 }; // viewBox units are centimetres
}

export default function CondoFloorPlan({
  items,
  highlightItemId,
  itemStatuses = {},
  interactive,
  onSelectItem,
  walkwayStatuses = [],
}: CondoFloorPlanProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);

  // Project furniture items
  const rects = useMemo(() => projectItems(items), [items]);

  // Find the selected furniture and its corresponding room zone
  const selectedItem = useMemo(() => {
    return items.find((it) => it.id === highlightItemId) ?? null;
  }, [items, highlightItemId]);

  const activeRoomId = useMemo(() => {
    if (!selectedItem) return null;
    return selectedItem.roomId || getRoomForCategory(selectedItem.category, selectedItem.label);
  }, [selectedItem]);

  const draggedItemIdRef = useRef<string | null>(null);

  // Handlers for pointer gestures.
  function handlePointerDown(e: ReactPointerEvent<SVGRectElement>, itemId: string) {
    if (onSelectItem) {
      onSelectItem(itemId);
    }
    if (!interactive) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    draggedItemIdRef.current = itemId;
    interactive.onDragStart(itemId);
  }

  function handlePointerMove(e: ReactPointerEvent<SVGRectElement>) {
    if (!interactive || !draggingRef.current || !svgRef.current || !draggedItemIdRef.current) return;

    const itemId = draggedItemIdRef.current;
    const item = items.find((it) => it.id === itemId);
    if (!item) return;

    const { xm, zm } = eventToWorldMetres(svgRef.current, e);
    const roomZoneId = item.roomId || getRoomForCategory(item.category, item.label);
    const room = CONDO_ROOMS.find((r) => r.id === roomZoneId);

    if (!room) return;

    // Apply smart snapping first, then clamp fully inside the room zone (no ghost box snapping)
    const targetSnap = snapTarget(xm, zm, item, items, null, room);
    const clamped = clampToRoom({ ...item, posX: targetSnap.posX, posZ: targetSnap.posZ }, room);

    interactive.onDragMove(clamped.posX, clamped.posZ);
  }

  function handlePointerUp(e: ReactPointerEvent<SVGRectElement>) {
    if (!interactive || !draggingRef.current) return;
    draggingRef.current = false;
    draggedItemIdRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    interactive.onDragEnd();
  }

  return (
    <div style={containerStyle}>
      <svg
        ref={svgRef}
        viewBox={`${-PAD_CM} ${-PAD_CM} ${WIDTH_CM + PAD_CM * 2} ${HEIGHT_CM + PAD_CM * 2}`}
        style={svgStyle}
        role="img"
        aria-label="Mulberry Place Condo Digital Twin Floor Plan"
      >
        {/* Outer unit boundary/walls */}
        <rect
          x={0}
          y={0}
          width={WIDTH_CM}
          height={HEIGHT_CM}
          fill="none"
          stroke={t.roomStroke}
          strokeWidth={6}
          rx={8}
        />

        {/* 1. ROOM ZONES */}
        {CONDO_ROOMS.map((room) => {
          const isRoomActive = !activeRoomId || activeRoomId === room.id;
          const opacity = isRoomActive ? 0.9 : 0.35;
          const isHighlighted = activeRoomId === room.id;

          return (
            <g key={room.id} style={{ transition: 'opacity 0.25s ease' }}>
              <rect
                x={room.x}
                y={room.y}
                width={room.width}
                height={room.height}
                fill={room.bgColor}
                stroke={isHighlighted ? t.brand : t.line}
                strokeWidth={isHighlighted ? 4 : 2}
                opacity={opacity}
                rx={4}
              />
              {/* Room Label */}
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
          const status = walkwayStatuses.find((w) => w.id === path.id);
          const walkwayColor =
            status?.status === 'RED'
              ? t.attentionFg
              : status?.status === 'YELLOW'
              ? t.tightFg
              : t.comfortFg;
              
          const isWalkwayDimmed = activeRoomId && activeRoomId !== 'living' && activeRoomId !== 'dining';
          const fillOpacity = isWalkwayDimmed ? 0.08 : 0.25;
          const strokeOpacity = isWalkwayDimmed ? 0.15 : 0.6;

          return (
            <g key={path.id} style={{ transition: 'opacity 0.25s ease' }}>
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
                strokeOpacity={strokeOpacity}
                rx={2}
                style={pointerNone}
              />
            </g>
          );
        })}

        {/* 4. FURNITURE ITEMS */}
        {rects.map((r) => {
          const isSelected = highlightItemId === r.id;
          const isDraggable = interactive?.draggableItemId === r.id;
          const isBad = isDraggable && interactive!.infeasible;

          const item = items.find((it) => it.id === r.id);
          const itemRoomId = item?.roomId || (item ? getRoomForCategory(item.category, item.label) : null);
          const isItemDimmed = activeRoomId && activeRoomId !== itemRoomId;

          let fill: string;
          let stroke: string;

          if (isBad) {
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

          const strokeWidth = isSelected ? 4 : 2;

          return (
            <g
              key={r.id}
              style={{ opacity: isItemDimmed ? 0.45 : 1, transition: 'opacity 0.3s cubic-bezier(0.4,0,0.2,1)' }}
            >
              <rect
                className="fp-block"
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
                  transition: 'stroke-width 0.15s ease, fill 0.15s ease, stroke 0.15s ease, filter 0.15s ease',
                }}
                onPointerDown={(e) => handlePointerDown(e, r.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
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
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const containerStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px',
};

const svgStyle: CSSProperties = {
  maxWidth: '100%',
  maxHeight: '100%',
  width: 'auto',
  height: 'auto',
  display: 'block',
  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
  borderRadius: '12px',
  background: '#FCFDFE',
  border: `1px solid ${t.line}`,
};

const pointerNone: CSSProperties = {
  pointerEvents: 'none',
  userSelect: 'none',
};
