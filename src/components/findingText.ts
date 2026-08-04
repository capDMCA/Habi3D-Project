import type { FurnitureItem, Violation } from '../types';
import { getRoomForCategory, CONDO_ROOMS } from '../data/condoLayout';

/**
 * Plain-language description of a clearance finding, for a StatusRow. Names
 * both objects (or the wall) involved — never a rule code. Shared so the
 * preview and the Analysis list phrase findings identically.
 */
export function describeFinding(v: Violation, items: FurnitureItem[]): string {
  const a = v.furnitureLabel;
  const item = items.find((it) => it.id === v.furnitureId);
  const roomZoneId = item?.roomId || (item ? getRoomForCategory(item.category, item.label) : 'living');
  const roomLabel = CONDO_ROOMS.find((r) => r.id === roomZoneId)?.label ?? 'Living Room';

  if (!v.itemBId || v.itemBId === 'wall') {
    return v.wallSide 
      ? `Between your ${a} and the ${v.wallSide} wall in the ${roomLabel}` 
      : `Around your ${a} in the ${roomLabel}`;
  }
  const b = items.find((it) => it.id === v.itemBId)?.label ?? 'another piece';
  return `Between your ${a} and ${b} in the ${roomLabel}`;
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

// Same consequence, as a standalone sentence with no object names — for the
// status row's primary line. Never a measurement, never a rule code: just
// what it would feel like to live with this gap.
const CONSEQUENCE_SENTENCE: Record<string, string> = {
  L1: 'Not enough room to walk through comfortably',
  L2: 'Not enough legroom here',
  L3: 'A tight squeeze to move between these',
  L4: 'The main walkway is too narrow here',
  L5: 'Not enough depth for a comfortable seating area',
  D1: 'Not enough room to pull the table out',
  D2: 'Not enough room to pull a chair out and sit',
  D3: 'No room to pass behind someone seated',
  D4: 'Too tight to walk past someone seated',
  D5: 'Too tight a passage to move through',
};

/**
 * The plain-language consequence alone, standalone — "Not enough room to
 * walk past comfortably." No object names, no measurement, no rule code.
 * This is the resident-facing status row's primary line; the measurement
 * (findingDetail) goes below it as a smaller, secondary line.
 */
export function findingConsequence(v: Violation): string {
  return CONSEQUENCE_SENTENCE[v.ruleCode] ?? 'Tighter than recommended here';
}

/**
 * One-sentence reason a finding matters — names both objects (or the wall) and
 * the human consequence. No rule codes, no numbers.
 */
export function findingReason(v: Violation, items: FurnitureItem[]): string {
  const a = v.furnitureLabel;
  const item = items.find((it) => it.id === v.furnitureId);
  const roomZoneId = item?.roomId || (item ? getRoomForCategory(item.category, item.label) : 'living');
  const roomLabel = CONDO_ROOMS.find((r) => r.id === roomZoneId)?.label ?? 'Living Room';

  const where =
    !v.itemBId || v.itemBId === 'wall'
      ? v.wallSide
        ? `between your ${a} and the ${v.wallSide} wall in the ${roomLabel}`
        : `around your ${a} in the ${roomLabel}`
      : `between your ${a} and ${items.find((it) => it.id === v.itemBId)?.label ?? 'another piece'} in the ${roomLabel}`;
  const consequence = RULE_CONSEQUENCE[v.ruleCode] ?? 'is tighter than recommended';
  return `Improve circulation inside the ${roomLabel}. The space ${where} ${consequence}.`;
}
