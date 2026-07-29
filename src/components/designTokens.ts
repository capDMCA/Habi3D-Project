import type { CSSProperties } from 'react';

/**
 * The single source of colour and type for the recommendation plan surface —
 * FloorPlan2D, StatusRow, and the action card all read from here. No component
 * defines its own shade or font size.
 *
 * Three severity states share one colour language everywhere. The interactive
 * accent (draggable block, ghost target) is a distinct blue — separate from the
 * red/amber/green states so "you can move this" never reads as a warning.
 *
 * Foreground values are chosen for daylight legibility on white (all ≥ 4.5:1
 * contrast); the accent blue sits clearly apart from every state hue.
 */

export const color = {
  // neutrals — a slight cool bias so they read as chosen, not default grey
  ink: '#16203A', //  primary text            ~14:1 on white
  inkSoft: '#4B5670', //  secondary text / labels ~7:1
  inkMute: '#8892A4', //  muted eyebrows          label use only
  line: '#D8DEE9', //  borders / dividers
  surface: '#FFFFFF',
  ground: '#F3F5F9', //  app background

  // plan geometry
  roomStroke: '#AEB8C7',
  itemFill: '#EDF1F7', //  neutral furniture
  itemStroke: '#97A2B4',

  // accent — interactive elements only (draggable block + ghost outline)
  accent: '#2563EB', //  ~4.9:1
  accentFill: '#DCE8FF', //  solid fill of the draggable block
  accentDeep: '#1E4FCC',

  // brand chrome — the app's established navy (matches index.css --primary),
  // for buttons/pills, kept distinct from the interactive plan accent
  brand: '#1F3864',
  brandTint: '#E6EDF8',

  // severity states — one hue + one soft ground each
  attentionFg: '#DC2626',
  attentionBg: '#FEECEC',
  tightFg: '#B45309',
  tightBg: '#FBF1E4',
  comfortFg: '#047857',
  comfortBg: '#E7F4EF',
} as const;

/** Four sizes, deliberate weights. Reading text (title/body) never below 15px;
 *  `label` (13px, uppercase) is for structural eyebrows only, not prose. */
export const type = {
  display: { fontSize: 22, fontWeight: 800, lineHeight: 1.2 } as CSSProperties,
  title: { fontSize: 18, fontWeight: 700, lineHeight: 1.35 } as CSSProperties,
  body: { fontSize: 15, fontWeight: 500, lineHeight: 1.5 } as CSSProperties,
  label: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  } as CSSProperties,
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;

/**
 * Plan mark treatments. The draggable block and the ghost target share the
 * accent hue but read as two different things: the block is a SOLID fill with a
 * thick stroke ("this object"), the ghost is a HOLLOW dashed outline ("put it
 * here"). That distinction survives a small screen in daylight because it's a
 * shape/fill difference, not only a colour one.
 */
export const planMark = {
  room: { fill: color.surface, stroke: color.roomStroke, strokeWidth: 4 },
  item: { fill: color.itemFill, stroke: color.itemStroke, strokeWidth: 3 },
  draggable: { fill: color.accentFill, stroke: color.accent, strokeWidth: 5, dash: undefined as string | undefined },
  ghost: { fill: 'none', stroke: color.accent, strokeWidth: 3, dash: '10 8' },
  infeasible: { fill: color.attentionBg, stroke: color.attentionFg, strokeWidth: 5, dash: undefined as string | undefined },
} as const;
