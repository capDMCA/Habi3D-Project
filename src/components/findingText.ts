import type { FurnitureItem, Violation } from '../types';

/**
 * Plain-language description of a clearance finding, for a StatusRow. Names
 * both objects (or the wall) involved — never a rule code. Shared so the
 * preview and the Analysis list phrase findings identically.
 */
export function describeFinding(v: Violation, items: FurnitureItem[]): string {
  const a = v.furnitureLabel;
  if (!v.itemBId || v.itemBId === 'wall') {
    return v.wallSide ? `Between your ${a} and the ${v.wallSide} wall` : `Around your ${a}`;
  }
  const b = items.find((it) => it.id === v.itemBId)?.label ?? 'another piece';
  return `Between your ${a} and ${b}`;
}

/**
 * State-of-the-gap detail line — a centimetre measurement, never an
 * instruction (instructions belong on the guided/commit step). Comfortable
 * gaps never reach here, so only tight / needs-attention are phrased.
 */
export function findingDetail(v: Violation): string {
  if (v.classification === 'RED') return `Needs ${v.shortfallCm} cm more room`;
  return `${v.shortfallCm} cm from comfortable`;
}

// Human consequence per rule — what the tight gap actually means to a resident.
const RULE_CONSEQUENCE: Record<string, string> = {
  L1: 'is too narrow to walk through comfortably',
  L2: 'leaves too little legroom',
  L3: 'is a tight squeeze to move between them',
  L4: 'makes the main walkway too narrow',
  L5: 'is too shallow for a comfortable seating area',
  D1: 'leaves too little room to pull the table out',
  D2: 'leaves too little room to pull a chair out and sit',
  D3: 'leaves no room to pass behind someone seated',
  D4: 'is too tight to walk past someone seated',
  D5: 'is too tight a passage to move through',
};

/**
 * One-sentence reason a finding matters — names both objects (or the wall) and
 * the human consequence. No rule codes, no numbers.
 */
export function findingReason(v: Violation, items: FurnitureItem[]): string {
  const a = v.furnitureLabel;
  const where =
    !v.itemBId || v.itemBId === 'wall'
      ? v.wallSide
        ? `between your ${a} and the ${v.wallSide} wall`
        : `around your ${a}`
      : `between your ${a} and ${items.find((it) => it.id === v.itemBId)?.label ?? 'another piece'}`;
  const consequence = RULE_CONSEQUENCE[v.ruleCode] ?? 'is tighter than recommended';
  return `The space ${where} ${consequence}.`;
}
