import { color } from './designTokens';
import type { GapClassificationLevel } from '../types';

/**
 * The app's single vocabulary for how much room a gap has. Named by meaning,
 * not by engine severity — a resident reads these, not "RED / YELLOW / L3".
 * One word, one colour, one icon per state; never two states sharing either.
 *
 * Engine → human mapping:
 *   RED    → needs-attention
 *   YELLOW → tight
 *   GREEN  → comfortable
 *
 * Defined here so every surface (this preview, and the Analysis list in a
 * later phase) speaks the same three words.
 */

export type StatusKey = 'comfortable' | 'tight' | 'needs-attention';

export interface StatusMeta {
  key: StatusKey;
  label: string;
  color: string;
  bg: string;
}

const META: Record<StatusKey, StatusMeta> = {
  comfortable: { key: 'comfortable', label: 'Comfortable', color: color.comfortFg, bg: color.comfortBg },
  tight: { key: 'tight', label: 'Tight', color: color.tightFg, bg: color.tightBg },
  'needs-attention': { key: 'needs-attention', label: 'Needs attention', color: color.attentionFg, bg: color.attentionBg },
};

export function statusMeta(key: StatusKey): StatusMeta {
  return META[key];
}

export function statusForClassification(classification: GapClassificationLevel): StatusMeta {
  if (classification === 'RED') return META['needs-attention'];
  if (classification === 'YELLOW') return META.tight;
  return META.comfortable;
}
