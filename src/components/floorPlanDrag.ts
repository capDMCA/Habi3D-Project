import { toBounds, effectiveLengthCm, effectiveWidthCm } from '../engine/clearance';
import { getRoomForCategory, CONDO_ROOMS, type RoomZone } from '../data/condoLayout';
import type { FurnitureItem } from '../types';

export const GRID_CM = 5;

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

/** Clamps coordinates to be fully inside the assigned room's boundary. */
export function clampToRoom(item: FurnitureItem, room: RoomZone): { posX: number; posZ: number } {
  const halfL = effectiveLengthCm(item) / 200; // in metres
  const halfW = effectiveWidthCm(item) / 200; // in metres

  let roomMinX = room.x / 100;
  let roomMaxX = (room.x + room.width) / 100;
  let roomMinZ = room.y / 100;
  let roomMaxZ = (room.y + room.height) / 100;

  let widthM = room.width / 100;
  let heightM = room.height / 100;

  if (item.category === 'cabinet' && (room.id === 'living' || room.id === 'dining')) {
    roomMinX = 0;
    roomMaxX = 2.60;
    roomMinZ = 3.40;
    roomMaxZ = 8.80;
    widthM = 2.60;
    heightM = 5.40;
  }

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

/** Performs smart snapping to floor grid, walls, other items, and recommendations. */
export function snapTarget(
  targetXMetres: number,
  targetZMetres: number,
  item: FurnitureItem,
  items: FurnitureItem[],
  ghostItem: FurnitureItem | null,
  room: RoomZone,
): { posX: number; posZ: number } {
  const halfL = effectiveLengthCm(item) / 200;
  const halfW = effectiveWidthCm(item) / 200;

  let roomMinX = room.x / 100;
  let roomMaxX = (room.x + room.width) / 100;
  let roomMinZ = room.y / 100;
  let roomMaxZ = (room.y + room.height) / 100;

  if (item.category === 'cabinet' && (room.id === 'living' || room.id === 'dining')) {
    roomMinX = 0;
    roomMaxX = 2.60;
    roomMinZ = 3.40;
    roomMaxZ = 8.80;
  }

  // Snapping threshold (10cm)
  const SNAP_THRESHOLD = 0.10;

  // 1. Ghost overlay snapping (highest priority)
  if (ghostItem) {
    const dist = Math.sqrt(
      Math.pow(targetXMetres - ghostItem.posX, 2) + Math.pow(targetZMetres - ghostItem.posZ, 2),
    );
    if (dist < 0.15) {
      return { posX: ghostItem.posX, posZ: ghostItem.posZ };
    }
  }

  let finalX = targetXMetres;
  let finalZ = targetZMetres;

  // 2. Room wall snapping
  if (Math.abs((targetXMetres - halfL) - roomMinX) < SNAP_THRESHOLD) {
    finalX = roomMinX + halfL;
  } else if (Math.abs((targetXMetres + halfL) - roomMaxX) < SNAP_THRESHOLD) {
    finalX = roomMaxX - halfL;
  }

  if (Math.abs((targetZMetres - halfW) - roomMinZ) < SNAP_THRESHOLD) {
    finalZ = roomMinZ + halfW;
  } else if (Math.abs((targetZMetres + halfW) - roomMaxZ) < SNAP_THRESHOLD) {
    finalZ = roomMaxZ - halfW;
  }

  // 3. Furniture-to-furniture snapping (align edges with other items in the same room)
  for (const other of items) {
    if (other.id === item.id) continue;
    
    // Check if other item is in the same room
    const otherRoomId = other.roomId || getRoomForCategory(other.category, other.label);
    const inLivingOrDining = (roomId: string) => roomId === 'living' || roomId === 'dining';
    
    if (item.category === 'cabinet' && (room.id === 'living' || room.id === 'dining')) {
      if (!inLivingOrDining(otherRoomId)) continue;
    } else {
      if (otherRoomId !== room.id) continue;
    }

    const b = toBounds(other);
    const itemMinX = finalX - halfL;
    const itemMaxX = finalX + halfL;
    const itemMinZ = finalZ - halfW;
    const itemMaxZ = finalZ + halfW;

    // Check X edge alignment (e.g. left edge aligns with right edge of other)
    if (Math.abs(itemMinX - b.maxX) < SNAP_THRESHOLD) {
      finalX = b.maxX + halfL;
    } else if (Math.abs(itemMaxX - b.minX) < SNAP_THRESHOLD) {
      finalX = b.minX - halfL;
    }

    // Check Z edge alignment (e.g. top edge aligns with bottom edge of other)
    if (Math.abs(itemMinZ - b.maxZ) < SNAP_THRESHOLD) {
      finalZ = b.maxZ + halfW;
    } else if (Math.abs(itemMaxZ - b.minZ) < SNAP_THRESHOLD) {
      finalZ = b.minZ - halfW;
    }
  }

  // 4. Fallback: snap to the 5cm floor grid if not snapped to edges
  if (finalX === targetXMetres) {
    finalX = snapCm(finalX * 100) / 100;
  }
  if (finalZ === targetZMetres) {
    finalZ = snapCm(finalZ * 100) / 100;
  }

  return { posX: finalX, posZ: finalZ };
}

/** Determines if the current layout configuration is valid without overlaps or out-of-room placement. */
export function isFeasible(
  items: FurnitureItem[],
  _roomWidthCm: number,
  _roomLengthCm: number,
): boolean {
  const bounds = items.map(toBounds);
  const epsilon = 0.01; // 1cm tolerance

  // Check that every item resides fully inside its assigned room boundary
  for (const b of bounds) {
    const roomId = b.item.roomId || getRoomForCategory(b.item.category, b.item.label);
    const room = CONDO_ROOMS.find((r) => r.id === roomId);
    if (!room) continue;

    let roomMinX = room.x / 100;
    let roomMaxX = (room.x + room.width) / 100;
    let roomMinZ = room.y / 100;
    let roomMaxZ = (room.y + room.height) / 100;

    if (b.item.category === 'cabinet' && (room.id === 'living' || room.id === 'dining')) {
      roomMinX = 0;
      roomMaxX = 2.60;
      roomMinZ = 3.40;
      roomMaxZ = 8.80;
    }

    if (
      b.minX < roomMinX - epsilon ||
      b.minZ < roomMinZ - epsilon ||
      b.maxX > roomMaxX + epsilon ||
      b.maxZ > roomMaxZ + epsilon
    ) {
      return false;
    }
  }

  // Check furniture overlaps
  for (let i = 0; i < bounds.length; i += 1) {
    for (let j = i + 1; j < bounds.length; j += 1) {
      const a = bounds[i];
      const b = bounds[j];
      const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
      const overlapZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
      if (overlapX > epsilon && overlapZ > epsilon) {
        return false;
      }
    }
  }

  return true;
}
