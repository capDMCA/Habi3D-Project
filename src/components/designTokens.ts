import type { CSSProperties } from 'react';

/**
 * The single source of colour, type, and typeface for the whole app — every
 * screen and component reads from here. `index.css`'s `:root` custom
 * properties (`--text-primary`, `--success`, etc.) are a byte-for-byte CSS
 * mirror of the values below, because plain className-based screens need
 * real CSS custom properties and jsPDF (`pdfReport.ts`) needs concrete hex
 * strings at generation time — neither can resolve a shared .ts import on
 * their own. Change a value here first, then carry it into `index.css`'s
 * `:root` block by hand; nothing auto-syncs the two.
 *
 * Three severity states share one colour language everywhere, including the
 * generic success/warning/danger UI elsewhere in the app (form errors,
 * AR-support badges) — those used to be a separate, unverified colour set
 * (e.g. `#10B981` green on white, ~2.3:1 contrast) that drifted out of sync
 * with this file's contrast-checked values. Reconciled onto one set so there
 * is exactly one "what does red mean" answer app-wide.
 *
 * The interactive accent (draggable block, ghost target) is a distinct blue —
 * separate from the red/amber/green states so "you can move this" never
 * reads as a warning.
 *
 * Foreground values are chosen for daylight legibility on white (all ≥ 4.5:1
 * contrast); the accent blue sits clearly apart from every state hue.
 */

/** Native OS UI font — San Francisco (iOS/macOS), Roboto (Android), Segoe UI
 *  (Windows) — never a webfont. Chosen over Inter (the previous choice, CDN
 *  `@import`ed from Google Fonts) specifically because this app is used
 *  one-handed, inside a resident's own apartment, on whatever wifi they
 *  have: zero network requests for text to render, zero flash-of-unstyled-
 *  text, and each OS's own face is already metrics-tuned for small-size
 *  legibility on that exact device — which is the whole point of a utility
 *  tool read at arm's length, not a marketing surface. */
export const fontFamily =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

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

/** Four sizes, deliberate weights, one typeface. Reading text (title/body)
 *  never below 15px — bumped a step past that floor (16px) now that the
 *  native system faces replace Inter, which was chosen partly for a large
 *  x-height; system fonts read a touch smaller at the same px, so body
 *  gets a little headroom rather than sitting exactly on the limit.
 *  `label` (13px, uppercase) is for structural eyebrows only, not prose. */
export const type = {
  display: { fontFamily, fontSize: 24, fontWeight: 800, lineHeight: 1.2 } as CSSProperties,
  title: { fontFamily, fontSize: 19, fontWeight: 700, lineHeight: 1.3 } as CSSProperties,
  body: { fontFamily, fontSize: 16, fontWeight: 500, lineHeight: 1.5 } as CSSProperties,
  label: {
    fontFamily,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  } as CSSProperties,
} as const;

/** Signature choice: every live measurement in the app (drag-time gap
 *  readouts, clearance meter values, dimension steppers) uses tabular
 *  figures. Digits update in place, several times a second while dragging,
 *  without the text reflowing or jittering side to side — a considered
 *  detail tied to this app's actual core interaction (watching a number
 *  change in real time), not a decorative flourish. Spread into any style
 *  object rendering a live cm/percentage value. */
export const numeric: CSSProperties = { fontVariantNumeric: 'tabular-nums' };

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
