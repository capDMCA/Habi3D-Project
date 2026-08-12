/**
 * AR-space ↔ 2D-plan-frame calibration.
 *
 * The 2D plan (floorPlanGeometry.ts) assumes a fixed frame: origin at the
 * unit's northwest corner, +X → east, +Z → south (see that file's own
 * docstring). A WebXR session's hit-test coordinates have no relationship
 * to that frame — origin and heading are whatever the device's tracking
 * system happened to establish when the session started. This module
 * derives the rigid transform (rotation + translation, no scale — both
 * sides already use real-world metres) between the two, from two taps: the
 * plan's known origin corner, and a second point along the north wall.
 *
 * The translation half of this follows the same approach as the existing
 * (unused) calibrationOffset in AnalysisScreen.tsx/ClearanceOverlay.tsx —
 * subtract a known reference point's AR-space coordinates from the target
 * point. That mechanism never handled rotation: its job was re-aligning one
 * AR session's hit-tests against another session's already-stored
 * positions, which it could assume were already axis-aligned with each
 * other. This can't assume that — the two frames may be arbitrarily
 * rotated relative to each other from the very first placement — so this
 * extends the same idea with an explicit heading correction derived from
 * the second tap.
 */

export interface ArPoint {
  x: number;
  z: number;
}

export interface CalibrationTransform {
  /** AR-space coordinates of the plan's origin (the northwest corner). */
  originX: number;
  originZ: number;
  cosTheta: number;
  sinTheta: number;
}

/** Two calibration taps closer together than this produce an unreliable
 *  heading — a small tap-precision error swings the angle wildly over a
 *  short baseline. Reject and ask the user to tap further along the wall. */
export const MIN_REFERENCE_DISTANCE_M = 1.0;

/**
 * Derives the transform from two AR-space reference taps:
 *   corner        — the plan's origin (northwest corner)
 *   alongNorthWall — any point further east along the north wall
 *
 * Returns null if the two points are too close together to derive a
 * reliable heading (see MIN_REFERENCE_DISTANCE_M) — never returns a
 * transform built on a degenerate (near-zero-length) baseline.
 */
export function deriveCalibration(corner: ArPoint, alongNorthWall: ArPoint): CalibrationTransform | null {
  const dx = alongNorthWall.x - corner.x;
  const dz = alongNorthWall.z - corner.z;
  const distance = Math.hypot(dx, dz);
  if (distance < MIN_REFERENCE_DISTANCE_M) return null;

  // The AR-space vector corner→alongNorthWall represents the plan's +X
  // (east) direction as observed in this session's frame. Rotating by
  // -angleAR maps that vector onto the plan's actual +X axis.
  const angleAR = Math.atan2(dz, dx);
  const theta = -angleAR;

  return {
    originX: corner.x,
    originZ: corner.z,
    cosTheta: Math.cos(theta),
    sinTheta: Math.sin(theta),
  };
}

/** Converts a raw AR hit-test point into the 2D plan's coordinate frame.
 *  This is the write path: call before storing a placement. */
export function applyCalibration(point: ArPoint, t: CalibrationTransform): ArPoint {
  const dx = point.x - t.originX;
  const dz = point.z - t.originZ;
  return {
    x: dx * t.cosTheta - dz * t.sinTheta,
    z: dx * t.sinTheta + dz * t.cosTheta,
  };
}

/** Converts a plan-frame point (e.g. an already-stored posX/posZ) back into
 *  this session's raw AR-space — the read path, for rendering previously
 *  placed items at their correct real-world spot in the live AR view. */
export function invertCalibration(point: ArPoint, t: CalibrationTransform): ArPoint {
  const x = point.x * t.cosTheta + point.z * t.sinTheta;
  const z = -point.x * t.sinTheta + point.z * t.cosTheta;
  return { x: x + t.originX, z: z + t.originZ };
}

/** The heading correction alone, in radians — plan-frame angle = AR-frame
 *  angle + this. Used to also correct an item's facing (rotationY) when
 *  rendering it back in AR-local space, so a placed piece's orientation
 *  matches the plan, not just its position. */
export function calibrationThetaRad(t: CalibrationTransform): number {
  return Math.atan2(t.sinTheta, t.cosTheta);
}
