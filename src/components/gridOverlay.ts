/**
 * Pure geometry for the lettered-row/numbered-column wayfinding grid drawn
 * over the whole unit — a background reference layer, not a room boundary.
 *
 * One grid spans the entire unit rather than one grid per room: CONDO_ROOMS's
 * 8 rooms tile the unit with zero gaps between them, so a unit-wide grid
 * already renders "inside" whichever room each cell happens to fall in —
 * and every cell gets a genuinely unique reference (one true "E6"), which
 * per-room grids that each restart at A1 would not give. This also matches
 * the reference image's own convention: row letters run continuously across
 * horizontally-adjacent rooms (e.g. both bedrooms share rows B–D).
 *
 * Cell size is derived from the unit's real dimensions, not a fixed count —
 * see TARGET_CELL_CM below.
 */

export interface GridCell {
  rowLabel: string;
  colLabel: number;
  xCm: number;
  yCm: number;
  wCm: number;
  hCm: number;
}

export interface GridGeometry {
  cols: number;
  rows: number;
  cellWidthCm: number;
  cellHeightCm: number;
  /** X positions of internal column boundaries (excludes the unit's own edges). */
  verticalLinesCm: number[];
  /** Y positions of internal row boundaries (excludes the unit's own edges). */
  horizontalLinesCm: number[];
  cells: GridCell[];
}

/** Target cell size — a wayfinding reference scale (~60cm, roughly 2ft), not
 *  a furniture-precision measurement. The actual cell size is recomputed
 *  from this per axis so cells fit the unit's real width/height evenly,
 *  with no leftover partial cell at the far edge. */
const TARGET_CELL_CM = 60;

function columnLabel(index: number): number {
  return index + 1;
}

/** A, B, ... Z, AA, AB, ... — doesn't silently wrap back to 'A' if the unit
 *  ever needed more than 26 rows (it doesn't today: 15 rows at TARGET_CELL_CM). */
function rowLabel(index: number): string {
  let n = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export function computeGridGeometry(unitWidthCm: number, unitHeightCm: number): GridGeometry {
  const cols = Math.max(1, Math.round(unitWidthCm / TARGET_CELL_CM));
  const rows = Math.max(1, Math.round(unitHeightCm / TARGET_CELL_CM));
  const cellWidthCm = unitWidthCm / cols;
  const cellHeightCm = unitHeightCm / rows;

  const verticalLinesCm = Array.from({ length: cols - 1 }, (_, i) => (i + 1) * cellWidthCm);
  const horizontalLinesCm = Array.from({ length: rows - 1 }, (_, i) => (i + 1) * cellHeightCm);

  const cells: GridCell[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      cells.push({
        rowLabel: rowLabel(r),
        colLabel: columnLabel(c),
        xCm: c * cellWidthCm,
        yCm: r * cellHeightCm,
        wCm: cellWidthCm,
        hCm: cellHeightCm,
      });
    }
  }

  return { cols, rows, cellWidthCm, cellHeightCm, verticalLinesCm, horizontalLinesCm, cells };
}
