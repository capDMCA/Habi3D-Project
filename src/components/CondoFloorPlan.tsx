import { useMemo, useRef, useState, useEffect } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { projectItems } from './floorPlanGeometry';
import { color as t } from './designTokens';
import { CONDO_ROOMS, getRoomForCategory } from '../data/condoLayout';
import { WALKWAY_PATHS, type WalkwayStatus } from '../engine/walkways';
import { clampToRoomSoft, snapTarget, getAlignmentGuides, type AlignmentGuide } from './floorPlanDrag';
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
  focusedRoomId?: string | null;
  onFocusRoom?: (roomId: string | null) => void;
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
  focusedRoomId = null,
  onFocusRoom,
}: CondoFloorPlanProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
  const draggedItemIdRef = useRef<string | null>(null);
  const [activeGuides, setActiveGuides] = useState<AlignmentGuide[]>([]);

  // Project furniture items
  const rects = useMemo(() => projectItems(items), [items]);

  // Find the selected furniture and its corresponding room zone
  const selectedItem = useMemo(() => {
    return items.find((it) => it.id === highlightItemId) ?? null;
  }, [items, highlightItemId]);

  const activeRoomId = useMemo(() => {
    if (focusedRoomId) return focusedRoomId;
    if (!selectedItem) return null;
    return selectedItem.roomId || getRoomForCategory(selectedItem.category, selectedItem.label);
  }, [selectedItem, focusedRoomId]);

  // ─── viewBox Smooth Zoom Interpolation ─────────────────────────────────────
  const targetViewBox = useMemo(() => {
    if (!focusedRoomId) {
      return { x: -PAD_CM, y: -PAD_CM, w: WIDTH_CM + PAD_CM * 2, h: HEIGHT_CM + PAD_CM * 2 };
    }
    const room = CONDO_ROOMS.find((r) => r.id === focusedRoomId);
    if (!room) {
      return { x: -PAD_CM, y: -PAD_CM, w: WIDTH_CM + PAD_CM * 2, h: HEIGHT_CM + PAD_CM * 2 };
    }
    const margin = 40; // cm padding around focused room
    return {
      x: room.x - margin,
      y: room.y - margin,
      w: room.width + margin * 2,
      h: room.height + margin * 2,
    };
  }, [focusedRoomId]);

  const [vb, setVb] = useState(targetViewBox);

  useEffect(() => {
    let start: number | null = null;
    const startVb = { ...vb };
    const duration = 380; // ms transition

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = timestamp - start;
      const tProgress = Math.min(progress / duration, 1);
      const ease = 1 - Math.pow(1 - tProgress, 3); // cubic ease out

      setVb({
        x: startVb.x + (targetViewBox.x - startVb.x) * ease,
        y: startVb.y + (targetViewBox.y - startVb.y) * ease,
        w: startVb.w + (targetViewBox.w - startVb.w) * ease,
        h: startVb.h + (targetViewBox.h - startVb.h) * ease,
      });

      if (progress < duration) {
        requestAnimationFrame(animate);
      }
    };

    const animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [targetViewBox]);

  // ─── Pointer Event Handlers ────────────────────────────────────────────────
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

    // Apply smart snapping, then apply spring elastic boundary clamp
    const targetSnap = snapTarget(xm, zm, item, items, null, room);
    const softClamped = clampToRoomSoft({ ...item, posX: targetSnap.posX, posZ: targetSnap.posZ }, room);

    // Calculate smart guidelines based on the soft clamped coordinates
    const itemForGuides = { ...item, posX: softClamped.posX, posZ: softClamped.posZ };
    const guides = getAlignmentGuides(itemForGuides, items, room);
    setActiveGuides(guides);

    interactive.onDragMove(softClamped.posX, softClamped.posZ);
  }

  function handlePointerUp(e: ReactPointerEvent<SVGRectElement>) {
    if (!interactive || !draggingRef.current) return;
    draggingRef.current = false;
    draggedItemIdRef.current = null;
    setActiveGuides([]);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    interactive.onDragEnd();
  }

  return (
    <div style={containerStyle}>
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
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
          const isHighlighted = activeRoomId === room.id;
          const isDimmed = focusedRoomId && focusedRoomId !== room.id;

          return (
            <g key={room.id} style={{ transition: 'opacity 0.3s ease' }} opacity={isDimmed ? 0.3 : 1}>
              <rect
                x={room.x}
                y={room.y}
                width={room.width}
                height={room.height}
                fill={room.bgColor}
                fillOpacity={0.08}
                stroke={isHighlighted ? t.accent : t.roomStroke}
                strokeWidth={isHighlighted ? 3 : 1.5}
                style={{ cursor: focusedRoomId ? 'default' : 'pointer' }}
                onClick={() => !focusedRoomId && onFocusRoom && onFocusRoom(room.id)}
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
          const statusObj = walkwayStatuses.find((s) => s.id === path.id);
          const status = statusObj?.status ?? 'GREEN';
          
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

          const strokeOpacity = isWalkwayDimmed ? 0.15 : 0.6;

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
                strokeOpacity={strokeOpacity}
                rx={2}
                style={pointerNone}
              />
            </g>
          );
        })}

        {/* 3. FIGMA SMART GUIDES */}
        {activeGuides.map((g, idx) => {
          if (g.type === 'x') {
            return (
              <line
                key={`guide-x-${idx}`}
                x1={g.coord * 100}
                y1={0}
                x2={g.coord * 100}
                y2={HEIGHT_CM}
                stroke="#3B82F6"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                opacity={0.8}
                style={pointerNone}
              />
            );
          } else {
            return (
              <line
                key={`guide-z-${idx}`}
                x1={0}
                y1={g.coord * 100}
                x2={WIDTH_CM}
                y2={g.coord * 100}
                stroke="#3B82F6"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                opacity={0.8}
                style={pointerNone}
              />
            );
          }
        })}

        {/* 4. FURNITURE ITEMS */}
        {rects.map((r) => {
          const isSelected = highlightItemId === r.id;
          const isDraggable = interactive?.draggableItemId === r.id;
          const isBad = isDraggable && interactive!.infeasible;

          const item = items.find((it) => it.id === r.id);
          if (!item) return null;
          const itemRoomId = item.roomId || getRoomForCategory(item.category, item.label);
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
              style={{ opacity: isItemDimmed ? 0.15 : 1, transition: 'opacity 0.3s ease' }}
            >
              {/* Visual Outline & Block */}
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
                  transition: 'fill 0.15s ease, stroke 0.15s ease',
                  pointerEvents: 'none',
                }}
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

              {/* Invisible touch & grab area overlay - expanded by 24px for easy mobile manipulation */}
              <rect
                x={r.xCm - 20}
                y={r.yCm - 20}
                width={r.wCm + 40}
                height={r.hCm + 40}
                fill="transparent"
                style={{
                  cursor: isDraggable ? 'grab' : 'pointer',
                  touchAction: 'none',
                }}
                onPointerDown={(e) => handlePointerDown(e, r.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
            </g>
          );
        })}
      </svg>

      {/* 5. CORNER CONDO MINIMAP */}
      {focusedRoomId && (
        <div style={minimapContainerStyle}>
          <svg
            viewBox={`-5 -5 ${WIDTH_CM + 10} ${HEIGHT_CM + 10}`}
            style={{ width: '100%', height: '100%' }}
          >
            <rect
              x={0}
              y={0}
              width={WIDTH_CM}
              height={HEIGHT_CM}
              fill="none"
              stroke="#CBD5E1"
              strokeWidth={3}
              rx={4}
            />
            {CONDO_ROOMS.map((room) => {
              const isActive = focusedRoomId === room.id;
              return (
                <rect
                  key={`mini-${room.id}`}
                  x={room.x}
                  y={room.y}
                  width={room.width}
                  height={room.height}
                  fill={isActive ? t.accent : '#E2E8F0'}
                  stroke="#94A3B8"
                  strokeWidth={1}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onFocusRoom && onFocusRoom(room.id)}
                />
              );
            })}
          </svg>
          <button
            style={minimapExitBtn}
            onClick={() => onFocusRoom && onFocusRoom(null)}
            aria-label="Zoom out to condo"
          >
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
