import { toBounds } from '../engine/clearance';
import type { FurnitureItem, FurnitureShape } from '../types';

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
  /** Direct 1:1 real-world centimetre dimensions */
  lengthCm: number;
  widthCm: number;
  /** Passed through from the source item so renderers (CondoFloorPlan,
   *  pdfReport) can draw a circle for round furniture without re-deriving
   *  it — one shape flag, read once, at the one place bounds are computed. */
  shape: FurnitureShape;
}

export function projectItems(items: FurnitureItem[]): PlanRect[] {
  return items.map((item) => {
    const b = toBounds(item);
    const isRotated90 = Math.abs(Math.sin(item.rotationY)) > 0.5;
    const directW = isRotated90 ? item.widthCm : item.lengthCm;
    const directH = isRotated90 ? item.lengthCm : item.widthCm;
    return {
      id: item.id,
      label: item.label,
      xCm: b.minX * 100,
      yCm: b.minZ * 100,
      wCm: directW,
      hCm: directH,
      lengthCm: item.lengthCm,
      widthCm: item.widthCm,
      shape: item.shape,
    };
  });
}
