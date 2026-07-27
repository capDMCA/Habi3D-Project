import type { Violation } from '../types';

/**
 * Stable identity of a clearance finding, independent of the measured gap.
 *
 * Violation.id embeds measuredCm, so it changes whenever the gap changes even
 * slightly — which makes it useless for tracking "the user resolved THIS
 * finding" across a re-analysis. This key is the same logical check regardless
 * of the current measurement: rule, the primary item, the other item (or the
 * wall), and which wall side.
 *
 * For a Violation, itemA is furnitureId. One check produces one finding per
 * (rule, itemA, itemB, wallSide) per analysis, so this is unique within a
 * layout and identical for the same check across re-analyses.
 */
export function stableViolationKey(v: Violation): string {
  return `${v.ruleCode}::${v.furnitureId}::${v.itemBId ?? 'wall'}::${v.wallSide ?? ''}`;
}
