import { toBounds } from '../engine/clearance';
import type { FurnitureItem } from '../types';

/**
 * Pure world → plan projection for the 2D floor plan.
 *
 * Every rectangle is the engine's toBounds() axis-aligned envelope — the same
 * region runClearanceAnalysis measures against — expressed in centimetres with
 * a top-left origin (x→east, y→south, so z=0/NORTH is at the top). No
 * bounding-box math is reimplemented; a duplicate copy drifted once already.
 *
 * Kept separate from the FloorPlan2D component so drag interaction can reuse
 * the exact same mapping the render uses.
 */

export interface PlanRect {
  id: string;
  label: string;
  /** all in centimetres, top-left origin */
  xCm: number;
  yCm: number;
  wCm: number;
  hCm: number;
}

export function projectItems(items: FurnitureItem[]): PlanRect[] {
  return items.map((item) => {
    const b = toBounds(item);
    return {
      id: item.id,
      label: item.label,
      xCm: b.minX * 100,
      yCm: b.minZ * 100,
      wCm: (b.maxX - b.minX) * 100,
      hCm: (b.maxZ - b.minZ) * 100,
    };
  });
}
