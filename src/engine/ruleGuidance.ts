import { CLEARANCE_RULES } from './rules';
import type { ClearanceRule } from '../types';

/**
 * The user-facing layer over the 10 clearance rules.
 *
 * `rules.ts` holds the measurements and citations; this holds the words a
 * resident reads. Every rule answers three questions in plain language:
 *   title       — what this rule is about
 *   requirement — what you have to do to satisfy it
 *   consequence — what goes wrong when you don't
 *
 * Rule codes (L1, D3, …) stay available for traceability back to the source
 * standard, but they are never the primary label in the UI.
 */

export type Band = 'RED' | 'YELLOW' | 'GREEN';

export interface RuleGuidance {
  code: string;
  title: string;
  requirement: string;
  consequence: string;
  /** Where this rule applies, for grouping in the reference list. */
  area: 'Living area' | 'Dining area';
  violationThresholdCm: number;
  warningThresholdCm: number;
}

const COPY: Record<string, { title: string; requirement: string; consequence: string }> = {
  L1: {
    title: 'Main Trafficway',
    requirement: 'Keep the main trafficway at least 91 cm wide (minimum 61 cm).',
    consequence: 'the main trafficway is too narrow to navigate comfortably',
  },
  L2: {
    title: 'General Circulation',
    requirement: 'Leave at least 61 cm for general circulation around active furniture.',
    consequence: 'circulation path around furniture is restricted',
  },
  L3: {
    title: 'Furniture Grouping',
    requirement: 'Keep at least 61 cm between seating pieces in a conversation grouping.',
    consequence: 'the conversational seating pieces are cramped together',
  },
  L4: {
    title: 'Walkway Obstruction',
    requirement: 'Keep dedicated pedestrian walkways clear by at least 91 cm (minimum 61 cm).',
    consequence: 'furniture is intruding into an active pedestrian walkway',
  },
  L5: {
    title: 'Living-Dining Transition',
    requirement: 'Provide at least 91 cm (minimum 61 cm) transition clearance between living and dining areas.',
    consequence: 'the transition between living and dining zones is obstructed',
  },
  D1: {
    title: 'Chair Access',
    requirement: 'Leave at least 81 cm behind the table to pull out chairs and sit.',
    consequence: 'chairs cannot be pulled out far enough to sit down comfortably',
  },
  D2: {
    title: 'Chair + Passage',
    requirement: 'Leave at least 96 cm behind the table for chair pull-out plus walking passage.',
    consequence: 'there is insufficient clearance for someone to walk behind pulled-out chairs',
  },
  D3: {
    title: 'Serving Behind Chair',
    requirement: 'Leave at least 107 cm behind seated diners for food serving and passage.',
    consequence: 'there is no room to serve food behind occupied dining chairs',
  },
  D4: {
    title: 'Passage Only',
    requirement: 'Keep at least 61 cm for passage-only routes behind dining furniture.',
    consequence: 'the passage route behind dining furniture is too narrow',
  },
  D5: {
    title: 'Table to Base Cabinet',
    requirement: 'Leave at least 122 cm between the dining table and any base cabinet or buffet.',
    consequence: 'base cabinet drawers or doors cannot open fully without hitting the table',
  },
};

const GUIDANCE: Record<string, RuleGuidance> = Object.fromEntries(
  CLEARANCE_RULES.map((rule: ClearanceRule) => {
    const copy = COPY[rule.id] ?? {
      title: rule.name,
      requirement: rule.description,
      consequence: 'the gap is tighter than recommended',
    };
    return [
      rule.id,
      {
        code: rule.id,
        title: copy.title,
        requirement: copy.requirement,
        consequence: copy.consequence,
        area: rule.category === 'living' ? 'Living area' : 'Dining area',
        violationThresholdCm: rule.violationThresholdCm,
        warningThresholdCm: rule.warningThresholdCm,
      } satisfies RuleGuidance,
    ];
  }),
);

export function ruleGuidance(code: string): RuleGuidance | null {
  return GUIDANCE[code] ?? null;
}

export const ALL_RULE_GUIDANCE: RuleGuidance[] = CLEARANCE_RULES.map((r) => GUIDANCE[r.id]);

/** Word for a band. Always shown next to the colour — never colour alone. */
export function bandLabel(band: Band): string {
  if (band === 'RED') return 'Too tight';
  if (band === 'YELLOW') return 'Tight';
  return 'Comfortable';
}

/** The three bands of a rule, as ranges a person can read. */
export interface BandRange {
  band: Band;
  label: string;
  fromCm: number;
  toCm: number | null; // null = open-ended
}

export function bandRanges(g: RuleGuidance): BandRange[] {
  if (g.warningThresholdCm <= g.violationThresholdCm) {
    return [
      { band: 'RED', label: bandLabel('RED'), fromCm: 0, toCm: g.violationThresholdCm },
      { band: 'GREEN', label: bandLabel('GREEN'), fromCm: g.violationThresholdCm, toCm: null },
    ];
  }
  return [
    { band: 'RED', label: bandLabel('RED'), fromCm: 0, toCm: g.violationThresholdCm },
    {
      band: 'YELLOW',
      label: bandLabel('YELLOW'),
      fromCm: g.violationThresholdCm,
      toCm: g.warningThresholdCm,
    },
    { band: 'GREEN', label: bandLabel('GREEN'), fromCm: g.warningThresholdCm, toCm: null },
  ];
}

/**
 * Upper end of the meter's scale. Extending past the comfortable threshold by
 * half of it keeps the green band visible instead of a sliver at the far edge.
 */
export function meterMaxCm(g: RuleGuidance): number {
  return Math.round(g.warningThresholdCm * 1.5);
}
