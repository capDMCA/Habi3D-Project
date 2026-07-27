import type { WallSide } from '../engine/clearance';
import type { FurnitureItem } from '../types';

/**
 * The move the user built in the sandbox, as a self-contained payload handed
 * to the existing guided instruction / AR-confirm flow. It carries the exact
 * dragged delta (not a rounded guess) plus a derived primary direction and
 * resulting facing for the commit sentences, so the receiver can pre-load it
 * as the current target.
 */
export interface PreviewMove {
  itemId: string;
  itemLabel: string;
  /** Primary translation, using the app's wall-naming convention. Null when
   *  the item was only rotated, never translated. */
  directionWall: WallSide | null;
  distanceCm: number;
  /** Full translation delta in centimetres (signed), for an exact receiver. */
  dxCm: number;
  dzCm: number;
  /** Rotation applied in the sandbox, radians (signed). 0 when none. */
  rotationDeltaRad: number;
  /** Rotation amount for display, whole degrees in (0, 360). 0 when none. */
  rotationDeg: number;
  /** Cardinal the item faces AFTER the rotation. Null when not rotated. */
  facingAfter: WallSide | null;
}

/**
 * Cardinal an item faces for a given rotation. The furniture model has no
 * explicit "front", so we adopt one documented convention: at rotationY = 0 an
 * item faces SOUTH (toward +Z — the open/viewer side in AR, the bottom of the
 * plan). Rotating about the up-axis turns that facing vector; we snap the
 * result to the nearest cardinal. Derived from the actual rotation, never
 * hardcoded.
 */
function facingDirection(rotationY: number): WallSide {
  const fx = -Math.sin(rotationY);
  const fz = Math.cos(rotationY);
  if (Math.abs(fz) >= Math.abs(fx)) return fz >= 0 ? 'south' : 'north';
  return fx >= 0 ? 'east' : 'west';
}

/** Build the move from the item's real (base) state and its previewed state. */
export function computeMove(base: FurnitureItem, preview: FurnitureItem): PreviewMove {
  const dxCm = Math.round((preview.posX - base.posX) * 100);
  const dzCm = Math.round((preview.posZ - base.posZ) * 100);
  const rotationDeltaRad = preview.rotationY - base.rotationY;

  // Primary direction = the dominant axis of the drag. x → west/east,
  // z → north/south, matching how the engine names walls (x=0 west, z=0 north).
  let directionWall: WallSide | null = null;
  let distanceCm = 0;
  if (Math.abs(dxCm) >= Math.abs(dzCm) && dxCm !== 0) {
    directionWall = dxCm > 0 ? 'east' : 'west';
    distanceCm = Math.abs(dxCm);
  } else if (dzCm !== 0) {
    directionWall = dzCm > 0 ? 'south' : 'north';
    distanceCm = Math.abs(dzCm);
  }

  const rotated = Math.abs(rotationDeltaRad) > 1e-6;
  const rotationDeg = rotated
    ? ((Math.round((rotationDeltaRad * 180) / Math.PI) % 360) + 360) % 360
    : 0;
  const facingAfter = rotated && rotationDeg !== 0 ? facingDirection(preview.rotationY) : null;

  return {
    itemId: base.id,
    itemLabel: base.label,
    directionWall,
    distanceCm,
    dxCm,
    dzCm,
    rotationDeltaRad,
    rotationDeg,
    facingAfter,
  };
}

/**
 * The commit instruction(s), in the app's existing "toward the {wall} wall"
 * phrasing. Returns one line per action; a move that both translates and
 * rotates returns TWO lines rather than a compound sentence. Empty only if the
 * item did not actually change (never rendered in that case).
 */
export function commitLines(move: PreviewMove): string[] {
  const lines: string[] = [];
  const hasTranslation = move.directionWall !== null && move.distanceCm > 0;
  const hasRotation = move.rotationDeg > 0 && move.facingAfter !== null;

  if (hasTranslation) {
    lines.push(`Move your ${move.itemLabel} ${move.distanceCm} cm toward the ${move.directionWall} wall.`);
  }
  if (hasRotation) {
    // Once a preceding line has named the item, refer to it as "it".
    const subject = lines.length > 0 ? 'it' : `your ${move.itemLabel}`;
    lines.push(`Rotate ${subject} ${move.rotationDeg}° so it faces the ${move.facingAfter} wall.`);
  }
  return lines;
}
