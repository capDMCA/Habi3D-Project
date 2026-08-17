/**
 * The single source of colour for the whole app — every screen and
 * component reads from here. `index.css`'s `:root` custom properties
 * (`--text-primary`, `--success`, etc.) are a byte-for-byte CSS mirror of
 * the values below, because plain className-based screens need real CSS
 * custom properties and jsPDF (`pdfReport.ts`) needs concrete hex strings
 * at generation time — neither can resolve a shared .ts import on their
 * own. Change a value here first, then carry it into `index.css`'s `:root`
 * block by hand; nothing auto-syncs the two.
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

  // Room-fill muting for the wayfinding plan. condoLayout.ts's per-room
  // bgColor/textColor stay the source of truth for what colour each of the
  // 8 rooms IS — this pair only controls how strongly that colour reads:
  // full weight for living/dining (where clearance rules actually apply
  // and furniture is actually placed), muted for the other 6 (bedrooms,
  // CR, kitchen, balcony, storage). This is a decorative distinction
  // only — it does not gate what the app allows; the only real placement
  // restriction is RoomZone.allowedCategories. Room LABEL opacity is
  // deliberately not part of this — see the comment at its one call site
  // in CondoFloorPlan.tsx for why (a muted label still needs to be legible).
  roomFillOpacityActive: 0.16,
  roomFillOpacityMuted: 0.07,
  roomLabelOpacityActive: 0.95,

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
