import { toBounds, effectiveLengthCm, effectiveWidthCm } from '../engine/clearance';
import { getRoomForCategory, CONDO_ROOMS, type RoomZone } from '../data/condoLayout';
import type { FurnitureItem } from '../types';

export const GRID_CM = 5;

/** The unit envelope. Furniture may move anywhere inside these outer walls. */
export const UNIT_WIDTH_CM = 510;
export const UNIT_HEIGHT_CM = 880;

/** Snap a centimetre value to the interaction grid. */
export function snapCm(cm: number): number {
  return Math.round(cm / GRID_CM) * GRID_CM;
}

/** A layout with exactly one item's centre moved to (posX, posZ), world metres. */
export function withMovedItem(
  items: FurnitureItem[],
  id: string,
  posX: number,
  posZ: number,
): FurnitureItem[] {
  return items.map((it) => (it.id === id ? { ...it, posX, posZ } : it));
}

/** A layout with exactly one item's rotation set, world radians. */
export function withRotatedItem(
  items: FurnitureItem[],
  id: string,
  rotationY: number,
): FurnitureItem[] {
  return items.map((it) => (it.id === id ? { ...it, rotationY } : it));
}

/** A layout with exactly one item's room assignment changed. */
export function withRoomAssignment(
  items: FurnitureItem[],
  id: string,
  roomId: string,
): FurnitureItem[] {
  return items.map((it) => (it.id === id ? { ...it, roomId } : it));
}

// ─── Free movement across the whole unit ──────────────────────────────────────
//
// Furniture is NOT caged inside its assigned room. The only hard boundary is
// the unit's outer wall; room membership is derived from where a piece is
// dropped. This is what makes the plan feel like a real design surface rather
// than eight disconnected boxes.

/** Clamp an item's centre so its whole footprint stays inside the outer walls. */
export function clampToUnit(
  item: FurnitureItem,
  posX: number,
  posZ: number,
): { posX: number; posZ: number } {
  const halfL = effectiveLengthCm(item) / 200;
  const halfW = effectiveWidthCm(item) / 200;
  const maxX = UNIT_WIDTH_CM / 100;
  const maxZ = UNIT_HEIGHT_CM / 100;

  // A piece larger than the unit on an axis is centred rather than pinned to a
  // wall — it has nowhere valid to sit, so keep it addressable.
  const outX = halfL * 2 >= maxX;
  const outZ = halfW * 2 >= maxZ;

  return {
    posX: outX ? maxX / 2 : Math.max(halfL, Math.min(maxX - halfL, posX)),
    posZ: outZ ? maxZ / 2 : Math.max(halfW, Math.min(maxZ - halfW, posZ)),
  };
}

/** The room zone containing a point, or null if the point is outside every zone. */
export function roomIdAtPoint(xMetres: number, zMetres: number): string | null {
  const xCm = xMetres * 100;
  const zCm = zMetres * 100;
  const hit = CONDO_ROOMS.find(
    (r) => xCm >= r.x && xCm <= r.x + r.width && zCm >= r.y && zCm <= r.y + r.height,
  );
  return hit ? hit.id : null;
}

/**
 * The room a piece now belongs to, chosen by which zone holds the largest share
 * of its footprint. Falls back to the centre point, then to its existing
 * assignment — a piece straddling a threshold lands in the room it mostly sits in.
 */
export function roomIdForItem(item: FurnitureItem): string {
  const b = toBounds(item);
  let bestId: string | null = null;
  let bestArea = 0;

  for (const room of CONDO_ROOMS) {
    const rMinX = room.x / 100;
    const rMaxX = (room.x + room.width) / 100;
    const rMinZ = room.y / 100;
    const rMaxZ = (room.y + room.height) / 100;

    const overlapX = Math.min(b.maxX, rMaxX) - Math.max(b.minX, rMinX);
    const overlapZ = Math.min(b.maxZ, rMaxZ) - Math.max(b.minZ, rMinZ);
    if (overlapX <= 0 || overlapZ <= 0) continue;

    const area = overlapX * overlapZ;
    if (area > bestArea) {
      bestArea = area;
      bestId = room.id;
    }
  }

  return (
    bestId ??
    roomIdAtPoint(item.posX, item.posZ) ??
    item.roomId ??
    getRoomForCategory(item.category, item.label)
  );
}

/** ids of every item whose footprint overlaps `item`. Empty means the spot is free. */
export function overlappingItemIds(item: FurnitureItem, items: FurnitureItem[]): string[] {
  const a = toBounds(item);
  const epsilon = 0.01; // 1cm tolerance — touching edges is not an overlap
  const hits: string[] = [];

  for (const other of items) {
    if (other.id === item.id) continue;
    const b = toBounds(other);
    const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    const overlapZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
    if (overlapX > epsilon && overlapZ > epsilon) hits.push(other.id);
  }

  return hits;
}

/**
 * Dividing wall separating the bedrooms and balcony (z < 3.40m / y < 340cm)
 * from the Living and Dining areas.
 */
export const BEDROOM_DIVIDER_WALL_Z_M = 3.40;

/**
 * Checks whether an item's footprint crosses into the bedroom/balcony area.
 * The bedroom wall barrier is at z = 3.40m (y = 340cm).
 * Any item whose bounding box intrudes past this wall into the bedroom zone (z < 3.40m)
 * or whose assigned room is bedroom1, bedroom2, or balcony is considered in the bedroom.
 */
export function isItemInBedroom(item: FurnitureItem): boolean {
  const b = toBounds(item);
  const epsilon = 0.01; // 1cm tolerance for touching the wall
  if (b.minZ < BEDROOM_DIVIDER_WALL_Z_M - epsilon) {
    return true;
  }
  const rId = roomIdForItem(item);
  return rId === 'bedroom1' || rId === 'bedroom2' || rId === 'balcony';
}

/**
 * Checks whether an item's footprint intersects a specific room zone based on CONDO_ROOMS layout data.
 */
export function itemIntersectsRoomZone(item: FurnitureItem, roomId: string, epsilon = 0.01): boolean {
  const room = CONDO_ROOMS.find((r) => r.id === roomId);
  if (!room) return false;
  const b = toBounds(item);
  const rMinX = room.x / 100;
  const rMaxX = (room.x + room.width) / 100;
  const rMinZ = room.y / 100;
  const rMaxZ = (room.y + room.height) / 100;

  const overlapX = Math.min(b.maxX, rMaxX) - Math.max(b.minX, rMinX);
  const overlapZ = Math.min(b.maxZ, rMaxZ) - Math.max(b.minZ, rMinZ);
  return overlapX > epsilon && overlapZ > epsilon;
}

/**
 * Checks whether an item is inside or intersects the Kitchen zone (x: 260..510cm, y: 620..880cm).
 */
export function isItemInKitchen(item: FurnitureItem): boolean {
  if (roomIdForItem(item) === 'kitchen') return true;
  return itemIntersectsRoomZone(item, 'kitchen');
}

/**
 * Checks whether an item is inside or intersects the Bathroom zone (x: 260..510cm, y: 460..620cm).
 */
export function isItemInBathroom(item: FurnitureItem): boolean {
  if (roomIdForItem(item) === 'bathroom') return true;
  return itemIntersectsRoomZone(item, 'bathroom');
}

/**
 * Checks whether an item is inside or intersects the Kitchen or Bathroom zones.
 */
export function isItemInKitchenOrBathroom(item: FurnitureItem): boolean {
  return isItemInKitchen(item) || isItemInBathroom(item);
}

/**
 * Checks whether an item is placed strictly within the allowed Living or Dining rooms.
 */
export function isItemInLivingOrDining(item: FurnitureItem): boolean {
  if (isItemInBedroom(item)) return false;
  if (isItemInKitchenOrBathroom(item)) return false;
  const rId = roomIdForItem(item);
  return rId === 'living' || rId === 'dining';
}

/** True when this one piece sits inside the unit, not in a bedroom or blocked zone. Furniture overlaps are allowed as soft constraints. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function canPlace(item: FurnitureItem, _items: FurnitureItem[] = []): boolean {
  const b = toBounds(item);
  const epsilon = 0.01;
  const insideUnit =
    b.minX >= -epsilon &&
    b.minZ >= -epsilon &&
    b.maxX <= UNIT_WIDTH_CM / 100 + epsilon &&
    b.maxZ <= UNIT_HEIGHT_CM / 100 + epsilon;

  return (
    insideUnit &&
    !isItemInBedroom(item) &&
    !isItemInKitchenOrBathroom(item)
  );
}

// ─── Snapping ─────────────────────────────────────────────────────────────────

export interface AlignmentGuide {
  type: 'x' | 'z';
  coord: number;
  originId: string;
}

export interface SnapResult {
  posX: number;
  posZ: number;
  guides: AlignmentGuide[];
}

interface SnapCandidate {
  coord: number;
  originId: string;
}

/** Collect every line a dragged edge/centre can latch onto, per axis. */
function candidateLines(
  item: FurnitureItem,
  items: FurnitureItem[],
): { xs: SnapCandidate[]; zs: SnapCandidate[] } {
  const xs: SnapCandidate[] = [
    { coord: 0, originId: 'unit' },
    { coord: UNIT_WIDTH_CM / 100, originId: 'unit' },
  ];
  const zs: SnapCandidate[] = [
    { coord: 0, originId: 'unit' },
    { coord: UNIT_HEIGHT_CM / 100, originId: 'unit' },
  ];

  // Room partition walls — these are what make a piece read as "in" a room.
  for (const room of CONDO_ROOMS) {
    xs.push({ coord: room.x / 100, originId: `room:${room.id}` });
    xs.push({ coord: (room.x + room.width) / 100, originId: `room:${room.id}` });
    zs.push({ coord: room.y / 100, originId: `room:${room.id}` });
    zs.push({ coord: (room.y + room.height) / 100, originId: `room:${room.id}` });
  }

  // Every other piece: both edges and the centre line.
  for (const other of items) {
    if (other.id === item.id) continue;
    const b = toBounds(other);
    xs.push({ coord: b.minX, originId: other.id });
    xs.push({ coord: b.maxX, originId: other.id });
    xs.push({ coord: (b.minX + b.maxX) / 2, originId: other.id });
    zs.push({ coord: b.minZ, originId: other.id });
    zs.push({ coord: b.maxZ, originId: other.id });
    zs.push({ coord: (b.minZ + b.maxZ) / 2, originId: other.id });
  }

  return { xs, zs };
}

/**
 * Resolve one axis: try latching the dragged piece's leading edge, centre, and
 * trailing edge onto any candidate line, and keep the closest match. Returns the
 * adjusted centre plus the guide that won, or null when nothing is in range.
 */
function resolveAxis(
  centre: number,
  half: number,
  candidates: SnapCandidate[],
  threshold: number,
  axis: 'x' | 'z',
): { centre: number; guide: AlignmentGuide } | null {
  const anchors = [-half, 0, half]; // min edge, centre, max edge
  let best: { centre: number; guide: AlignmentGuide; delta: number } | null = null;

  for (const anchor of anchors) {
    const anchorPos = centre + anchor;
    for (const cand of candidates) {
      const delta = Math.abs(anchorPos - cand.coord);
      if (delta > threshold) continue;
      if (best && delta >= best.delta) continue;
      best = {
        centre: cand.coord - anchor,
        guide: { type: axis, coord: cand.coord, originId: cand.originId },
        delta,
      };
    }
  }

  return best ? { centre: best.centre, guide: best.guide } : null;
}

/**
 * Snap a free-moving piece. Priority per axis: nearest wall / room edge /
 * neighbouring furniture line within `thresholdCm`, else the 5cm floor grid.
 * Returns the guides that actually fired so the canvas can draw them.
 */
export function snapFree(
  targetXMetres: number,
  targetZMetres: number,
  item: FurnitureItem,
  items: FurnitureItem[],
  thresholdCm = 8,
): SnapResult {
  const halfL = effectiveLengthCm(item) / 200;
  const halfW = effectiveWidthCm(item) / 200;
  const threshold = thresholdCm / 100;
  const { xs, zs } = candidateLines(item, items);

  const guides: AlignmentGuide[] = [];

  const snappedX = resolveAxis(targetXMetres, halfL, xs, threshold, 'x');
  const snappedZ = resolveAxis(targetZMetres, halfW, zs, threshold, 'z');

  let posX: number;
  if (snappedX) {
    posX = snappedX.centre;
    guides.push(snappedX.guide);
  } else {
    posX = snapCm(targetXMetres * 100) / 100;
  }

  let posZ: number;
  if (snappedZ) {
    posZ = snappedZ.centre;
    guides.push(snappedZ.guide);
  } else {
    posZ = snapCm(targetZMetres * 100) / 100;
  }

  return { posX, posZ, guides };
}

/**
 * Horizontal perimeter segment of an active planning boundary.
 */
export interface HorizontalBoundarySegment {
  z: number;
  minX: number;
  maxX: number;
  facing: 'north' | 'south';
}

/**
 * Vertical perimeter segment of an active planning boundary.
 */
export interface VerticalBoundarySegment {
  x: number;
  minZ: number;
  maxZ: number;
  facing: 'west' | 'east';
}

/**
 * Composite boundary of the active planning region (Living + Dining union).
 */
export interface ActivePlanningBoundary {
  horizontal: HorizontalBoundarySegment[];
  vertical: VerticalBoundarySegment[];
}

interface Interval1D {
  start: number;
  end: number;
}

function subtractInterval(intervals: Interval1D[], cut: Interval1D): Interval1D[] {
  const result: Interval1D[] = [];
  const eps = 1e-4;

  for (const inv of intervals) {
    if (cut.end <= inv.start + eps || cut.start >= inv.end - eps) {
      result.push(inv);
      continue;
    }
    if (cut.start <= inv.start + eps && cut.end < inv.end - eps) {
      result.push({ start: cut.end, end: inv.end });
      continue;
    }
    if (cut.start > inv.start + eps && cut.end >= inv.end - eps) {
      result.push({ start: inv.start, end: cut.start });
      continue;
    }
    if (cut.start > inv.start + eps && cut.end < inv.end - eps) {
      result.push({ start: inv.start, end: cut.start });
      result.push({ start: cut.end, end: inv.end });
      continue;
    }
  }

  return result;
}

function mergeIntervals(intervals: Interval1D[]): Interval1D[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval1D[] = [{ start: sorted[0].start, end: sorted[0].end }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const prev = merged[merged.length - 1];
    if (current.start <= prev.end + 1e-4) {
      prev.end = Math.max(prev.end, current.end);
    } else {
      merged.push({ start: current.start, end: current.end });
    }
  }

  return merged;
}

/**
 * Derives the active 2D planning geometry from CONDO_ROOMS for the combined
 * Living + Dining region. Treats Living and Dining as a union:
 * - Shared internal boundaries (such as the Living/Dining threshold) are cancelled out.
 * - Outer perimeters (adjacent to Bedroom, Storage, Bathroom, Kitchen, and exterior walls)
 *   are preserved.
 * - Stepped or non-rectangular boundaries are fully supported.
 */
export function deriveActivePlanningBoundary(
  rooms: RoomZone[] = CONDO_ROOMS,
  activeRoomIds: string[] = ['living', 'dining'],
): ActivePlanningBoundary {
  const activeRooms = rooms.filter((r) => activeRoomIds.includes(r.id));

  const northMap = new Map<number, Interval1D[]>();
  const southMap = new Map<number, Interval1D[]>();
  const westMap = new Map<number, Interval1D[]>();
  const eastMap = new Map<number, Interval1D[]>();

  const roundKey = (val: number) => Math.round(val * 1000) / 1000;

  const pushInterval = (map: Map<number, Interval1D[]>, key: number, start: number, end: number) => {
    const rKey = roundKey(key);
    const list = map.get(rKey) ?? [];
    list.push({ start: Math.min(start, end), end: Math.max(start, end) });
    map.set(rKey, list);
  };

  for (const r of activeRooms) {
    const minX = r.x / 100;
    const maxX = (r.x + r.width) / 100;
    const minZ = r.y / 100;
    const maxZ = (r.y + r.height) / 100;

    pushInterval(northMap, minZ, minX, maxX);
    pushInterval(southMap, maxZ, minX, maxX);
    pushInterval(westMap, minX, minZ, maxZ);
    pushInterval(eastMap, maxX, minZ, maxZ);
  }

  const horizontal: HorizontalBoundarySegment[] = [];
  const vertical: VerticalBoundarySegment[] = [];

  const allZ = new Set<number>([...northMap.keys(), ...southMap.keys()]);
  for (const z of allZ) {
    const norths = mergeIntervals(northMap.get(z) ?? []);
    const souths = mergeIntervals(southMap.get(z) ?? []);

    let remainingNorth = norths;
    for (const s of souths) {
      remainingNorth = subtractInterval(remainingNorth, s);
    }

    let remainingSouth = souths;
    for (const n of norths) {
      remainingSouth = subtractInterval(remainingSouth, n);
    }

    for (const seg of remainingNorth) {
      horizontal.push({ z, minX: seg.start, maxX: seg.end, facing: 'north' });
    }
    for (const seg of remainingSouth) {
      horizontal.push({ z, minX: seg.start, maxX: seg.end, facing: 'south' });
    }
  }

  const allX = new Set<number>([...westMap.keys(), ...eastMap.keys()]);
  for (const x of allX) {
    const wests = mergeIntervals(westMap.get(x) ?? []);
    const easts = mergeIntervals(eastMap.get(x) ?? []);

    let remainingWest = wests;
    for (const e of easts) {
      remainingWest = subtractInterval(remainingWest, e);
    }

    let remainingEast = easts;
    for (const w of wests) {
      remainingEast = subtractInterval(remainingEast, w);
    }

    for (const seg of remainingWest) {
      vertical.push({ x, minZ: seg.start, maxZ: seg.end, facing: 'west' });
    }
    for (const seg of remainingEast) {
      vertical.push({ x, minZ: seg.start, maxZ: seg.end, facing: 'east' });
    }
  }

  // Merge contiguous collinear segments sharing the same facing
  const mergedHorizontal: HorizontalBoundarySegment[] = [];
  const hGroups = new Map<string, HorizontalBoundarySegment[]>();
  for (const h of horizontal) {
    const key = `${roundKey(h.z)}_${h.facing}`;
    const group = hGroups.get(key) ?? [];
    group.push(h);
    hGroups.set(key, group);
  }
  for (const group of hGroups.values()) {
    const intervals = mergeIntervals(group.map((g) => ({ start: g.minX, end: g.maxX })));
    for (const inv of intervals) {
      mergedHorizontal.push({ z: group[0].z, minX: inv.start, maxX: inv.end, facing: group[0].facing });
    }
  }

  const mergedVertical: VerticalBoundarySegment[] = [];
  const vGroups = new Map<string, VerticalBoundarySegment[]>();
  for (const v of vertical) {
    const key = `${roundKey(v.x)}_${v.facing}`;
    const group = vGroups.get(key) ?? [];
    group.push(v);
    vGroups.set(key, group);
  }
  for (const group of vGroups.values()) {
    const intervals = mergeIntervals(group.map((g) => ({ start: g.minZ, end: g.maxZ })));
    for (const inv of intervals) {
      mergedVertical.push({ x: group[0].x, minZ: inv.start, maxZ: inv.end, facing: group[0].facing });
    }
  }

  return {
    horizontal: mergedHorizontal,
    vertical: mergedVertical,
  };
}

let cachedBoundary: ActivePlanningBoundary | null = null;

export function getActivePlanningBoundary(): ActivePlanningBoundary {
  if (!cachedBoundary) {
    cachedBoundary = deriveActivePlanningBoundary();
  }
  return cachedBoundary;
}

/**
 * Distance in cm from each side of a piece to the nearest thing on that side —
 * another piece's facing edge, or the nearest boundary of the active Living + Dining
 * planning region (stopping at Kitchen, Bathroom, Bedroom, or exterior walls).
 * Powers the live gap readouts.
 */
export interface EdgeGaps {
  west: number;
  east: number;
  north: number;
  south: number;
}

export function edgeGaps(item: FurnitureItem, items: FurnitureItem[]): EdgeGaps {
  if (isItemInBedroom(item) || isItemInKitchenOrBathroom(item)) {
    return { west: 0, east: 0, north: 0, south: 0 };
  }

  const a = toBounds(item);
  const boundary = getActivePlanningBoundary();

  let west = Infinity;
  let east = Infinity;
  let north = Infinity;
  let south = Infinity;

  // 1. Measure against the valid outer perimeter of the active Living + Dining union
  for (const seg of boundary.vertical) {
    const spansZ = Math.min(a.maxZ, seg.maxZ) - Math.max(a.minZ, seg.minZ) > 0;
    if (!spansZ) continue;

    if (seg.facing === 'west' && a.maxX > seg.x) {
      west = Math.min(west, a.minX - seg.x);
    } else if (seg.facing === 'east' && a.minX < seg.x) {
      east = Math.min(east, seg.x - a.maxX);
    }
  }

  for (const seg of boundary.horizontal) {
    const spansX = Math.min(a.maxX, seg.maxX) - Math.max(a.minX, seg.minX) > 0;
    if (!spansX) continue;

    if (seg.facing === 'north' && a.maxZ > seg.z) {
      north = Math.min(north, a.minZ - seg.z);
    } else if (seg.facing === 'south' && a.minZ < seg.z) {
      south = Math.min(south, seg.z - a.maxZ);
    }
  }

  const gaps: EdgeGaps = {
    west: Number.isFinite(west) ? west : a.minX,
    east: Number.isFinite(east) ? east : UNIT_WIDTH_CM / 100 - a.maxX,
    north: Number.isFinite(north) ? north : a.minZ,
    south: Number.isFinite(south) ? south : UNIT_HEIGHT_CM / 100 - a.maxZ,
  };

  // 2. Measure against facing edges of other furniture pieces
  for (const other of items) {
    if (other.id === item.id) continue;
    const b = toBounds(other);

    // Only pieces that actually face each other across the axis count.
    const spansZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) > 0;
    const spansX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 0;

    if (spansZ) {
      if (b.maxX <= a.minX) gaps.west = Math.min(gaps.west, a.minX - b.maxX);
      if (b.minX >= a.maxX) gaps.east = Math.min(gaps.east, b.minX - a.maxX);
    }
    if (spansX) {
      if (b.maxZ <= a.minZ) gaps.north = Math.min(gaps.north, a.minZ - b.maxZ);
      if (b.minZ >= a.maxZ) gaps.south = Math.min(gaps.south, b.minZ - a.maxZ);
    }
  }

  return {
    west: Math.round(gaps.west * 100),
    east: Math.round(gaps.east * 100),
    north: Math.round(gaps.north * 100),
    south: Math.round(gaps.south * 100),
  };
}

/**
 * Lay a room's pieces out without overlaps, in reading order, wrapping to a new
 * row when the current one is full. Used on load so a fresh session never opens
 * with every piece stacked on one point.
 */
export function packItemsIntoRoom(items: FurnitureItem[], room: RoomZone): FurnitureItem[] {
  const pad = 0.1; // 10cm breathing room from the room's walls
  const roomMinX = room.x / 100 + pad;
  const roomMaxX = (room.x + room.width) / 100 - pad;
  const roomMinZ = room.y / 100 + pad;
  const roomMaxZ = (room.y + room.height) / 100 - pad;

  let cursorX = roomMinX;
  let cursorZ = roomMinZ;
  let rowHeight = 0;

  return items.map((item) => {
    const lengthM = effectiveLengthCm(item) / 100;
    const widthM = effectiveWidthCm(item) / 100;

    // Wrap to the next row when this piece would run past the right wall.
    if (cursorX + lengthM > roomMaxX && cursorX > roomMinX) {
      cursorX = roomMinX;
      cursorZ += rowHeight + pad;
      rowHeight = 0;
    }

    const posX = cursorX + lengthM / 2;
    let posZ = cursorZ + widthM / 2;

    cursorX += lengthM + pad;
    rowHeight = Math.max(rowHeight, widthM);

    // Once the room is full, stop stacking rows past the bottom wall — the user
    // can drag the overflow wherever they want.
    if (posZ + widthM / 2 > roomMaxZ) {
      posZ = Math.max(roomMinZ + widthM / 2, roomMaxZ - widthM / 2);
    }

    // A piece wider than its room would otherwise be laid out through the
    // building's outer wall; the unit envelope is the one hard boundary.
    const inUnit = clampToUnit(item, posX, posZ);
    return { ...item, posX: inUnit.posX, posZ: inUnit.posZ };
  });
}

// ─── Legacy single-room helpers (PlanSandbox / RecommendationScreen) ──────────

/** Clamps coordinates to be fully inside the assigned room's boundary. */
export function clampToRoom(item: FurnitureItem, room: RoomZone): { posX: number; posZ: number } {
  const halfL = effectiveLengthCm(item) / 200; // in metres
  const halfW = effectiveWidthCm(item) / 200; // in metres

  const roomMinX = room.x / 100;
  const roomMaxX = (room.x + room.width) / 100;
  const roomMinZ = room.y / 100;
  const roomMaxZ = (room.y + room.height) / 100;

  const widthM = room.width / 100;
  const heightM = room.height / 100;

  let posX = item.posX;
  let posZ = item.posZ;

  if (widthM <= halfL * 2) {
    posX = (roomMinX + roomMaxX) / 2;
  } else {
    posX = Math.max(roomMinX + halfL, Math.min(roomMaxX - halfL, posX));
  }

  if (heightM <= halfW * 2) {
    posZ = (roomMinZ + roomMaxZ) / 2;
  } else {
    posZ = Math.max(roomMinZ + halfW, Math.min(roomMaxZ - halfW, posZ));
  }

  return { posX, posZ };
}

/** Whole-layout validity check used by the legacy single-room sandbox. */
export function isFeasible(
  items: FurnitureItem[],
  roomWidthCm: number,
  roomLengthCm: number,
): boolean {
  const bounds = items.map(toBounds);
  const epsilon = 0.01;

  for (const b of bounds) {
    if (
      b.minX < -epsilon ||
      b.minZ < -epsilon ||
      b.maxX > roomWidthCm / 100 + epsilon ||
      b.maxZ > roomLengthCm / 100 + epsilon
    ) {
      return false;
    }
  }

  for (let i = 0; i < bounds.length; i += 1) {
    for (let j = i + 1; j < bounds.length; j += 1) {
      const a = bounds[i];
      const b = bounds[j];
      const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
      const overlapZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
      if (overlapX > epsilon && overlapZ > epsilon) return false;
    }
  }

  return true;
}
