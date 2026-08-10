import type { RoomDimensions } from '../types';

export interface UnitConfig {
  name: string;
  building: string;
  unitType: string;
  totalFloorAreaSqm: number;
  livingDiningAreaSqm: number;
  defaultDimensions: RoomDimensions;
  description: string;
}

/**
 * Mulberry Place Bengaline — 2 Bedroom Mid-Rise Unit
 *
 * Total floor area: ~67.00 sqm
 * Living/dining combined: ~49.50 sqm
 *
 * Dimension breakdown (estimates):
 *   Living area: 600cm × 500cm = 30.00 sqm
 *   Dining area: 500cm × 390cm = 19.50 sqm
 *   Combined: 49.50 sqm
 *
 * These are researcher estimates — the one reference floor plan every
 * Mulberry Place unit type currently resolves to. Read silently at session
 * start; there is no screen to edit them.
 */
/** Stable id for the single unit this thesis scopes to — no picker, so this
 *  is the only value sessionStore.unitTypeId is ever set to. */
export const MULBERRY_PLACE_2BR_ID = 'mulberry-place-bengaline-2br';

export const MULBERRY_PLACE_2BR: UnitConfig = {
  name: 'Mulberry Place Bengaline — 2 Bedroom',
  building: 'Mulberry Place',
  unitType: '2-Bedroom Mid-Rise',
  totalFloorAreaSqm: 67.0,
  livingDiningAreaSqm: 49.5,
  defaultDimensions: {
    livingWidthCm: 600,
    livingDepthCm: 500,
    diningWidthCm: 500,
    diningDepthCm: 390,
  },
  description:
    'Standard 2-bedroom mid-rise unit at Mulberry Place, Bengaline, Acacia Estates, Taguig City',
};
