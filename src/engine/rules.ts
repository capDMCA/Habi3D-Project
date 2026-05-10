import type { ClearanceRule } from '../types';

/**
 * 10 Interior Design Clearance Rules
 * Source: Time-Saver Standards for Interior Design and Space Planning
 *         (DeChiara, Panero & Zelnik, 2001), pp. 61–90
 *
 * All clearance values converted from imperial to metric.
 *
 * Classification tiers:
 *   RED    — below minimum functional threshold (violation)
 *   YELLOW — above minimum but below comfortable threshold (warning)
 *   GREEN  — at or above comfortable threshold (clear)
 *
 * L1–L5: Living Room Rules (Table 3)
 * D1–D5: Dining Room Rules (Table 4)
 */
export const clearanceRules: ClearanceRule[] = [
  // ── Living Room Rules (Table 3) ──────────────────────────────
  {
    id: 'L1',
    name: 'General Circulation',
    category: 'living',
    violationThresholdCm: 60,   // RED: < 60 cm
    warningThresholdCm: 91,     // YELLOW: 60–89 cm · GREEN: ≥ 91 cm
    description:
      'General circulation clearance in the combined living/dining area',
  },
  {
    id: 'L2',
    name: 'Sofa / Coffee Table',
    category: 'living',
    violationThresholdCm: 35,   // RED: < 35 cm
    warningThresholdCm: 45,     // YELLOW: 35–45 cm · GREEN: 45–60 cm
    description:
      'Sofa or coffee table clearance for legroom and use',
  },
  {
    id: 'L3',
    name: 'Secondary Circulation',
    category: 'living',
    violationThresholdCm: 61,   // RED: < 61 cm
    warningThresholdCm: 76,     // YELLOW: 61–75 cm · GREEN: ≥ 76 cm
    description:
      'Secondary circulation path between furniture pieces',
  },
  {
    id: 'L4',
    name: 'Main Traffic Path',
    category: 'living',
    violationThresholdCm: 76,   // RED: < 76 cm
    warningThresholdCm: 91,     // YELLOW: 76–90 cm · GREEN: ≥ 91 cm
    description:
      'Main traffic path toward kitchen path',
  },
  {
    id: 'L5',
    name: 'Conversation Area',
    category: 'living',
    violationThresholdCm: 244,  // RED: < 244 cm
    warningThresholdCm: 300,    // YELLOW: 244–299 cm · GREEN: ≥ 300 cm
    description:
      'Conversation area depth for sofa grouping. Shortfall is measured '
      + 'against 244 cm minimum; affected edge is the sofa face width.',
  },

  // ── Dining Room Rules (Table 4) ──────────────────────────────
  {
    id: 'D1',
    name: 'Table to Wall',
    category: 'dining',
    violationThresholdCm: 76,   // RED: < 76 cm
    warningThresholdCm: 91,     // YELLOW: 76–90 cm · GREEN: ≥ 91 cm
    description:
      'Minimum dining clearance from table edge to wall',
  },
  {
    id: 'D2',
    name: 'Chair Pull-out + Access',
    category: 'dining',
    violationThresholdCm: 81,   // RED: < 81 cm
    warningThresholdCm: 97,     // YELLOW: 81–96 cm · GREEN: ≥ 97 cm
    description:
      'Space needed to pull out a dining chair and access the seat',
  },
  {
    id: 'D3',
    name: 'Passage Behind Seated',
    category: 'dining',
    violationThresholdCm: 91,   // RED: < 91 cm
    warningThresholdCm: 107,    // YELLOW: 91–106 cm · GREEN: ≥ 107 cm
    description:
      'Clearance to pass behind a seated person at the dining table',
  },
  {
    id: 'D4',
    name: 'Walking Past Seated',
    category: 'dining',
    violationThresholdCm: 97,   // RED: < 97 cm
    warningThresholdCm: 112,    // YELLOW: 97–111 cm · GREEN: ≥ 112 cm
    description:
      'Clearance to walk past a seated person at the dining area',
  },
  {
    id: 'D5',
    name: 'Minimum Passage',
    category: 'dining',
    violationThresholdCm: 61,   // RED: < 61 cm
    warningThresholdCm: 76,     // YELLOW: 61–75 cm · GREEN: ≥ 76 cm
    description:
      'Minimum passage width in tight spaces between dining furniture and walls',
  },
];

export const CLEARANCE_RULES = clearanceRules;

export function classifyGap(
  measuredCm: number,
  rule: ClearanceRule,
): 'RED' | 'YELLOW' | 'GREEN' {
  if (measuredCm < rule.violationThresholdCm) return 'RED';
  if (measuredCm < rule.warningThresholdCm) return 'YELLOW';
  return 'GREEN';
}

export function computePriorityScore(
  severityWeight: 3 | 1,
  shortfallCm: number,
  affectedEdgeLengthCm: number,
): number {
  return severityWeight * Math.max(0, shortfallCm) * affectedEdgeLengthCm;
}

/**
 * Priority Score = VSW × SI
 *
 * Violation Severity Weight (VSW):
 *   RED    → VSW = 3  (clearance below minimum functional threshold;
 *                       materially impedes daily use)
 *   YELLOW → VSW = 1  (clearance below comfortable threshold but
 *                       above minimum; suboptimal but functional)
 *   GREEN  → no score (no corrective action required)
 *
 * Spatial Impact (SI) in cm²:
 *   SI = Shortfall Distance (cm) × Affected Furniture Edge Length (cm)
 *
 *   Shortfall = Required Threshold − Measured Clearance
 *   Affected Edge = length of the furniture edge facing the clearance gap
 *
 *   For Rule L5 (conversation area), shortfall = 244 cm − measured zone depth,
 *   and affected edge = sofa face width.
 *
 * Ref: area-based impact scoring consistent with Dong et al. [36]
 *      interior space layout optimization metrics.
 */

/** Calculate spatial impact in cm² */
export function calculateSpatialImpact(
  shortfallCm: number,
  affectedEdgeLengthCm: number,
): number {
  return Math.abs(shortfallCm) * affectedEdgeLengthCm;
}

/** Calculate priority score: VSW × SI */
export function calculatePriorityScore(
  severity: 'red' | 'yellow',
  spatialImpactCm2: number,
): number {
  const vsw = severity === 'red' ? 3 : 1;
  return vsw * spatialImpactCm2;
}
