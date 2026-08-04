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
    title: 'Room to walk through',
    requirement: 'Leave at least 91 cm of open floor for everyday circulation.',
    consequence: 'the gap is too narrow to walk through comfortably',
  },
  L2: {
    title: 'Legroom at the sofa',
    requirement: 'Leave 45–60 cm between the sofa and the coffee table.',
    consequence: 'there is not enough legroom to sit down properly',
  },
  L3: {
    title: 'Squeezing between furniture',
    requirement: 'Leave at least 76 cm between two pieces people pass between.',
    consequence: 'it is a tight squeeze to move between them',
  },
  L4: {
    title: 'Main walkway width',
    requirement: 'Keep the main route through the room at least 91 cm wide.',
    consequence: 'the main walkway through the room is too narrow',
  },
  L5: {
    title: 'Seating area depth',
    requirement: 'Allow at least 300 cm of depth for a comfortable sofa grouping.',
    consequence: 'the seating area is too shallow to sit and talk comfortably',
  },
  D1: {
    title: 'Table to wall',
    requirement: 'Leave at least 91 cm between the table edge and the wall.',
    consequence: 'there is not enough room to get around the table',
  },
  D2: {
    title: 'Pulling out a chair',
    requirement: 'Leave at least 97 cm behind the table to pull a chair out and sit.',
    consequence: 'a chair cannot be pulled out far enough to sit down',
  },
  D3: {
    title: 'Passing behind a seated person',
    requirement: 'Leave at least 107 cm to edge past someone who is seated.',
    consequence: 'there is no room to pass behind someone seated',
  },
  D4: {
    title: 'Walking past a seated person',
    requirement: 'Leave at least 112 cm to walk past someone who is seated.',
    consequence: 'it is too tight to walk past someone seated',
  },
  D5: {
    title: 'Minimum passage',
    requirement: 'Never let a passage between furniture drop below 76 cm.',
    consequence: 'the passage is too tight to move through',
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
