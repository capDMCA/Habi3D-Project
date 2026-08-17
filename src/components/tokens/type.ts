import type { CSSProperties } from 'react';

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
