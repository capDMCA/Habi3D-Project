import { toBounds, findLayoutViolation } from '../engine/clearance';
import type { FurnitureItem } from '../types';

/**
 * Pure drag-support logic for the interactive floor plan.
 *
 * Feasibility is delegated entirely to the engine (toBounds +
 * findLayoutViolation) — no overlap/bounds math is reimplemented here. The
 * only thing this module owns is grid snapping and the "move one item"
 * transform, both of which are unit/data operations, not geometry.
 */

/** Interaction grid, in centimetres. Matches the step the recommendation
 *  engine works in, so no drag position yields false-precision like 11.7cm. */
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

/**
 * True when the layout has no overlap and nothing out of bounds — decided by
 * the engine's own fast predicate. Exception-free: safe to call on every
 * drag-frame.
 */
export function isFeasible(
  items: FurnitureItem[],
  roomWidthCm: number,
  roomLengthCm: number,
): boolean {
  const bounds = items.map(toBounds);
  return findLayoutViolation(bounds, roomWidthCm / 100, roomLengthCm / 100) === null;
}
