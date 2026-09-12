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
    name: 'Main Trafficway',
    category: 'living',
    violationThresholdCm: 61,   // RED: < 61 cm
    warningThresholdCm: 91,     // YELLOW: 61–90 cm · GREEN: ≥ 91 cm
    description:
      'Main trafficway clearance through the living area',
  },
  {
    id: 'L2',
    name: 'General Circulation',
    category: 'living',
    violationThresholdCm: 61,   // RED: < 61 cm
    warningThresholdCm: 61,     // GREEN: ≥ 61 cm (No YELLOW)
    description:
      'General circulation clearance around active living furniture',
  },
  {
    id: 'L3',
    name: 'Furniture Grouping',
    category: 'living',
    violationThresholdCm: 61,   // RED: < 61 cm
    warningThresholdCm: 61,     // GREEN: ≥ 61 cm (No YELLOW)
    description:
      'Clearance between pieces within a conversational furniture grouping',
  },
  {
    id: 'L4',
    name: 'Walkway Obstruction',
    category: 'living',
    violationThresholdCm: 61,   // RED: < 61 cm
    warningThresholdCm: 91,     // YELLOW: 61–90 cm · GREEN: ≥ 91 cm
    description:
      'Pedestrian walkway corridor obstruction clearance',
  },
  {
    id: 'L5',
    name: 'Living-Dining Transition',
    category: 'living',
    violationThresholdCm: 61,   // RED: < 61 cm
    warningThresholdCm: 91,     // Contextual: YELLOW 61–90 cm if main path, GREEN ≥ 91 cm
    description:
      'Circulation transition clearance between living and dining areas',
  },

  // ── Dining Room Rules (Table 4) ──────────────────────────────
  {
    id: 'D1',
    name: 'Chair Access',
    category: 'dining',
    violationThresholdCm: 81,   // RED: < 81 cm
    warningThresholdCm: 81,     // GREEN: ≥ 81 cm (No YELLOW)
    description:
      'Clearance behind dining table to access and pull out chairs',
  },
  {
    id: 'D2',
    name: 'Chair + Passage',
    category: 'dining',
    violationThresholdCm: 96,   // RED: < 96 cm
    warningThresholdCm: 96,     // GREEN: ≥ 96 cm (No YELLOW)
    description:
      'Clearance behind table for chair pull-out plus walking passage',
  },
  {
    id: 'D3',
    name: 'Serving Behind Chair',
    category: 'dining',
    violationThresholdCm: 107,  // RED: < 107 cm
    warningThresholdCm: 107,    // GREEN: ≥ 107 cm (No YELLOW)
    description:
      'Clearance behind seated diners for food serving and clear passage',
  },
  {
    id: 'D4',
    name: 'Passage Only',
    category: 'dining',
    violationThresholdCm: 61,   // RED: < 61 cm
    warningThresholdCm: 61,     // GREEN: ≥ 61 cm (No YELLOW)
    description:
      'Passage only clearance behind dining chairs or around dining furniture',
  },
  {
    id: 'D5',
    name: 'Table to Base Cabinet',
    category: 'dining',
    violationThresholdCm: 122,  // RED: < 122 cm
    warningThresholdCm: 122,    // GREEN: ≥ 122 cm (No YELLOW)
    description:
      'Clearance between dining table and base cabinet, buffet, or storage piece',
  },
];

export const CLEARANCE_RULES = clearanceRules;

export function classifyGap(
  measuredCm: number,
  rule: ClearanceRule,
): 'RED' | 'YELLOW' | 'GREEN' {
  if (measuredCm < rule.violationThresholdCm) return 'RED';
  if (rule.warningThresholdCm > rule.violationThresholdCm && measuredCm < rule.warningThresholdCm) {
    return 'YELLOW';
  }
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
