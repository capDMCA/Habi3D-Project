# Habi3D Codebase — Current State & Recent Changes

**Last updated:** 2026-08-18
**Project phase:** Late Phase 2 → Phase 3 readiness

---

## Executive Summary

Habi3D is a **Priority-Ranked Sequential Recommendation Tool** for condominium residents to validate furniture layout against 10 clearance rules (5 living room, 5 dining). Twenty-one rounds of work have landed:

1. **Free-movement drag system** for the 2D floor plan (`WorkspaceScreen`/`CondoFloorPlan`)
2. **User-friendly rule guidance with visual clearance meters** in the recommendations panel
3. **Downloadable PDF report** on the Report screen — a client-side keepsake of the session
4. **Single-unit scope + full account auth (v1)** — the thesis now targets one fixed Mulberry Place unit (no picker), login rebuilt on Supabase Auth
5. **Circular dining table support**, end to end — measuring, 2D rendering, PDF rendering
6. **Auth rebuilt again — Supabase Auth replaced with a plain username/password table** (v2, since superseded by Round 18) — bcrypt inside Postgres, never in the browser
7. **Full visual modernization** — one design-token source app-wide, native system typeface, a real landing-page hierarchy, and a WorkspaceScreen chrome overhaul
8. **Comprehensive PDF report** — full rule-by-rule breakdown (all 10 rules, violated *and* cleared), paginated
9. **AR-to-2D coordinate calibration** — a two-tap system (`src/ar/calibration.ts`) deriving the rigid transform between a WebXR session's raw hit-test frame and the 2D plan's fixed frame, so furniture placed in AR lands at the right spot on the plan
10. **2D plan wayfinding** — a lettered-row/numbered-column reference grid, room-fill muting (living/dining full-weight, the other 6 rooms muted), and unit-edge dimension callouts
11. **2D plan stability fixes** — zoom-transition jump fixed, click-vs-drag jitter fixed, a confusing orange walkway-corridor overlay removed (the underlying walkway data/pill/list stayed)
12. **Landing page visual redesign** — no logo, "Habi3D" as a bold two-tone gradient wordmark, radial-gradient background, frosted-glass card
13. **ReportScreen completion-state reframe** — the headline is now built from a real session-start-to-now diff ("you made N spots more comfortable"), never a score or percentage
14. **WorkspaceScreen neutral palette pass** — 5 non-severity chrome elements that used the brand-blue token now use neutral tokens; the 3 severity hues are untouched
15. **Full-flow debug pass** — a real Playwright trace end to end surfaced that the (now-superseded) custom auth RPC functions were never actually created in the live Supabase project
16. **Design tokens reorganized** — `designTokens.ts` split into `src/components/tokens/{colors,type,spacing,marks,index}.ts`, values unchanged
17. **Dead code removed** — `ARDemoScreen.tsx` deleted, its `App.tsx` case and `ScreenName` entry removed
18. **Auth rebuilt a third time — real Supabase Auth, synthetic email.** Reverses Round 6: `supabase.auth.signUp`/`signInWithPassword` with a `${username}@habi3d.local` synthetic email, real `auth.uid()` flowing through the app as the user id
19. **WorkspaceScreen React-effect correctness fixes** — two `react-hooks/set-state-in-effect` warnings resolved via React's own documented patterns, not suppressed
20. **Supabase legacy-table cleanup** — confirmed zero references to the old custom `users` table and to `space_utilization_scores`, then dropped both
21. **AR calibration retry** — redo a single bad tap before it commits, or fully recalibrate after placement has started, without restarting the AR session

---

## Recent Changes

### 1. Floor Plan Drag System Redesigned — Free Movement Across Unit

**Files changed:** `src/components/floorPlanDrag.ts`, `src/components/CondoFloorPlan.tsx`, `src/screens/WorkspaceScreen.tsx`

- **Free movement:** pieces drag across the entire unit; only the outer wall is a hard boundary; room membership is derived automatically from drop location
- **Live feedback:** alignment guides, live gap readouts in cm, collision highlighting, room drop-target highlighting
- **Robust coordinate tracking:** delta-based dragging, immune to mid-drag camera zoom
- **Better initial layout:** `packItemsIntoRoom()` avoids the old center-stacking overlap bug
- **50-step undo**, keyboard shortcuts (arrows nudge, R rotates)
- Verified: 19 drag-geometry assertions pass

---

### 2. Recommendations Panel — User-Friendly Rule Guidance with Visual Meters

**Files added:** `src/engine/ruleGuidance.ts`, `src/components/ClearanceMeter.tsx`

- Each violation card shows the rule in plain English, a clearance meter plotting the measurement against the rule's three bands, a "DO THIS" action block, and a rule-code footer for traceability
- Rules reference tab — all 10 rules grouped by area
- Accessibility-first encoding (shape + words + track position, never colour alone)
- Verified: 12 meter geometry assertions pass

---

### 3. Downloadable PDF Report (v1 — superseded by Round 8)

**Files added:** `src/components/pdfReport.ts`, `src/components/DownloadReportButton.tsx`

- One-page PDF: header, drawn floor-plan snapshot, plain-language per-item status list, closing disclaimer
- Generated **client-side** with `jsPDF` — no server call, no upload, no Supabase write
- Draws from the same geometry source as the live plan (`CONDO_ROOMS` + `projectItems()`) — never a screenshot
- `DownloadReportButton` is a shared idle → working → success → idle / error-with-retry component

See Round 8 below — this is now the *first* page of a multi-page report, not the whole thing.

---

### 4. Single-Unit Scope + Account Auth (v1 — superseded by Round 6, then Round 18)

- `roomData.ts` only ever contained one unit config (`MULBERRY_PLACE_2BR`); the old 15-option `UnitSetupScreen` picker was deleted, `sessionStore.startNewSession()` reads the fixed dimensions directly
- Step counters fixed to an honest "Step 1/2 of 2"
- Auth (v1) was rebuilt on real Supabase Auth (`supabase.auth.signUp`/`signInWithPassword`) — replaced by Round 6, then Round 6 itself was reversed by Round 18 back onto Supabase Auth (see Round 18 for why, and for the current implementation).
- `EntryScreen.tsx` had three buttons: **Begin Session** (anonymous), **Log in**, **Create account**; login checked `saved_sessions` for a resumable layout
- Debounced autosave (1.5s) via `useAutosaveLayout`, wired into `FurnitureInputScreen` and `WorkspaceScreen`

---

### 5. Circular Dining Table Support, End to End

**Files changed:** `src/components/floorPlanGeometry.ts`, `src/components/CondoFloorPlan.tsx`, `src/components/pdfReport.ts`, `src/screens/FurnitureInputScreen.tsx`, `src/screens/WorkspaceScreen.tsx`

- **Measuring:** a round shape shows a single "Diameter" field (two AR taps, edge-to-edge through the centre), written to both `lengthCm` and `widthCm`
- **2D rendering:** `CondoFloorPlan.tsx` draws an SVG `<circle>`; `PlanRect` in `floorPlanGeometry.ts` carries a `shape` field so both renderers read from one geometry source
- **Rotation disabled for round items** — button hidden, `handleRotate` no-ops too
- **PDF:** `pdfReport.ts` draws `doc.circle(...)` for round items
- **No clearance-engine changes** — confirmed numerically (11/12 assertions; the 1 "failure" was float-rounding noise in the test itself)
- **Known gap, still open:** `FloorPlan2D.tsx` (used by the orphaned `RecommendationScreen.tsx`) still draws every item as a `<rect>` — out of scope, dead-code screen

---

### 6. Auth Rebuilt Again — Plain Username/Password Table, No Supabase Auth (v2 — superseded by Round 18)

**Files changed (at the time):** `src/supabase.ts`, `src/screens/AuthScreen.tsx`, `src/stores/sessionStore.ts`

> **⚠️ This entire round has since been reversed.** Round 18 replaced this custom `users` table + `pgcrypto` RPC design with real Supabase Auth again, and Round 20 confirmed and dropped the `users` table this round created. The SQL below is kept for historical record only — **do not run it**; it describes a design no longer used anywhere in this codebase.

This reversed Round 4's Supabase Auth rebuild on explicit instruction at the time: no synthetic email, no `auth.users` dependency, username + password only. Password hashing/verification happened entirely in Postgres via `pgcrypto` (`crypt()`/`gen_salt('bf')`), called through two `SECURITY DEFINER` RPC functions (`create_user`, `verify_login`) the client invoked with `supabase.rpc(...)`.

**What actually happened to this design:** Round 15's live Playwright trace against the real Supabase project found `verify_login` returning a 404 — the RPC functions documented here were never actually created in the live database. Round 18 then reversed the whole approach back to Supabase Auth before those functions were ever run. Round 20 confirmed via `grep` that nothing in the codebase references the `users` table anymore and it was dropped from Supabase.

---

### 7. Full Visual Modernization

**Files changed:** `src/components/designTokens.ts` (see Round 16 — since split into `src/components/tokens/`), `src/index.css`, `src/App.css`, `index.html`, `src/screens/EntryScreen.tsx`, `src/screens/FurnitureInputScreen.tsx`, `src/screens/PositionMapScreen.tsx`, `src/screens/ReportScreen.tsx`, `src/screens/WorkspaceScreen.tsx`, `src/components/ErrorBoundary.tsx`

#### Design tokens — one canonical source, app-wide
`designTokens.ts` was previously scoped to just the plan-surface SVG components (its own docstring said so). It's now the app-wide source for colour, type, and typeface; `index.css`'s `:root` custom properties mirror it by hand (documented at the top of both files) — className-based screens need real CSS variables and `pdfReport.ts` needs concrete hex at generation time, neither can resolve a shared `.ts` import, so two files still exist but only one is where values are *decided*.

- **Typeface:** Inter (Google Fonts `@import`, CDN-dependent) → native OS stack (`-apple-system, 'Segoe UI', Roboto, …`). Chosen because this app runs one-handed, in a resident's own apartment, on whatever wifi they have — zero network requests for text to render, zero flash-of-unstyled-text. Removed the `<link>`/`@import` entirely.
- **Type scale:** display 22→24px, title 18→19px, body 15→16px (still ≥15px floor, now with headroom since system fonts read a touch smaller than Inter at the same size). `label` unchanged.
- **Colour:** brand navy, accent blue, and the red/amber/green severity family are **untouched** — already contrast-checked and CVD-mitigated from Round 2, no reason to re-verify a new hue set for a cosmetic pass. What *was* fixed: `index.css`'s generic `--success`/`--warning`/`--danger` (used for form errors, AR-support badges) were a separate, unverified colour set — `#10B981` green on white was ~2.3:1 contrast, well under WCAG AA. Reconciled onto the same verified ≥4.5:1 values the clearance meters already use.
- **Signature choice:** a new `numeric` token (`font-variant-numeric: tabular-nums`) applied to every live measurement in the app — drag-time gap readouts, clearance meter values, dimension steppers — so digits don't jitter sideways while updating in real time. Tied to the app's core interaction, not decorative.
- **One-off styles found and fixed in the same pass:** ~20 hardcoded hex values in `WorkspaceScreen.tsx` → token references; a third independent "danger red" in `FurnitureInputScreen.tsx`'s remove button → `var(--danger*)`; near-duplicate hex sitting next to already-token'd values in `ReportScreen.tsx`; 5 files with an independently hardcoded `"'Inter', system-ui, sans-serif"` string → single `fontFamily` import.
- **Deliberately left alone:** the WebXR camera-overlay HUDs (`FurnitureInputScreen`/`PositionMapScreen`'s `XRDomOverlay` content) — bright status colours over a live camera feed are a different legibility problem than the app's normal light-mode screens. Also left alone: every dead-code screen (`AnalysisScreen`, `RecommendationScreen`, `FloorPlan2D`; `ARDemoScreen` was later deleted entirely, see Round 17). `ErrorBoundary.tsx` got the shared `fontFamily`, but its status colours stayed self-contained literals on purpose — it's the crash fallback, and staying decoupled from the rest of the token system is the right isolation for a component whose whole job is rendering when something else may be broken.

#### Landing page (`EntryScreen.tsx`) — three-tier hierarchy (v1; visual treatment since redone, see Round 12)
**Begin Session** is primary (largest, filled navy) — for a first-time visitor, trying the tool with zero commitment is the highest-value action. **Create account** is the stronger of the two auth paths. **Log in** dropped to a quiet text link below it. This hierarchy decision is still current — only the visual skin around it changed in Round 12.

#### WorkspaceScreen chrome overhaul
Measured before touching anything (real DOM measurements at a 390×844 viewport, via a temporary store patch reverted immediately after):

| | Before | After |
|---|---|---|
| Header | 124.8px (stacked title + subtitle + step text) | 57px, single row |
| Footer/toolbar | 185px (full-width "Rotate 90"/"Undo"/"Reset" text buttons, wrapped onto several lines) | Removed as a distinct bar |
| Canvas region (`planContainer`) | 46.1% of viewport height | 81.6% |

- **Header:** dropped the stacked status subtitle ("N clearance issues · N blocked walkways") — it duplicated the pill row directly beneath it.
- **Rotate/Undo/Reset:** moved to a slim row of 44×44px circular icon buttons directly *under* the canvas (next to the status caption), so the buttons never sit on top of the plan.
- **Did not touch:** `floorPlanDrag.ts`, `floorPlanGeometry.ts`, or any drag physics/geometry.
- **Verified with a real interaction trace**: select → nudge (keyboard) → undo → rotate → reset — reset landed the item back at its exact original coordinates. Zero console errors.

---

### 8. Comprehensive PDF Report — Rule-by-Rule Detail, Paginated

**Files changed:** `src/components/pdfReport.ts`, `src/components/DownloadReportButton.tsx`, `src/screens/ReportScreen.tsx`

The Round 3 PDF only ever showed a coarse per-item status word + one sentence, capped at one page with no pagination guard. Now:

- **Every one of the 10 rules that applied to the layout** gets its own section: plain-English requirement, numeric RED/YELLOW/GREEN bands, and every individual check performed against it — **cleared (GREEN) checks included, not only violations.**
- Each check shows a status word, a plain description, and the measurement (with shortfall for anything not comfortable).
- **Real pagination**, added fresh — `ensureSpace()` checks remaining page height before every block; `addContinuationPage()` starts a new page with a small "(continued)" header when it doesn't fit.
- **`ReportScreen.tsx` recomputes `runClearanceAnalysis()` fresh** rather than threading a new field through `violationStore` and every screen that calls `setViolations`/`refreshViolations`.
- **Verified with a real downloaded PDF**: confirmed 4 pages via `pdftotext`/`pdfinfo`, cross-checked exact Unicode codepoints of the em-dash/middle-dot characters via `pdfjs-dist` to rule out a garbled-glyph regression.

---

### 9. AR-to-2D Coordinate Calibration

**Files added:** `src/ar/calibration.ts`
**Files changed:** `src/screens/PositionMapScreen.tsx`

A WebXR session's hit-test coordinates have no relationship to the 2D plan's fixed frame (origin at the unit's northwest corner, +X east, +Z south) — origin and heading are whatever the device's tracking system happened to establish when the session started. `calibration.ts` derives the rigid transform (rotation + translation, no scale — both sides already use real-world metres) between the two frames from **two AR taps**:

1. **Corner tap** — the plan's known origin (the unit's northwest corner, where the two outer walls meet).
2. **North-wall tap** — any point further along the north wall (at least `MIN_REFERENCE_DISTANCE_M = 1.0`m from the corner — closer than that and a small tap-precision error swings the derived heading wildly).

```ts
export function deriveCalibration(corner: ArPoint, alongNorthWall: ArPoint): CalibrationTransform | null
export function applyCalibration(point: ArPoint, t: CalibrationTransform): ArPoint    // AR-local → plan frame, the write path
export function invertCalibration(point: ArPoint, t: CalibrationTransform): ArPoint   // plan frame → AR-local, the read path
export function calibrationThetaRad(t: CalibrationTransform): number                  // heading correction alone, for rotationY
```

`PositionMapScreen.tsx` gates all furniture placement on `calibration` being non-null — before that, the AR view shows `CalibrationScene` (the two-tap capture UI) instead of `PlacementScene`. Once captured, every new placement is converted via `applyCalibration` before it ever reaches `furnitureStore`, and every already-placed item is converted back via `invertCalibration` to render its ghost in the correct spot in the *current* AR session (which has its own, unrelated raw coordinate frame each time `enterAR()` is called). Calibration is captured once per AR session and cleared automatically when the session ends (see Round 21 for the mid-session redo path added later).

---

### 10. 2D Plan Wayfinding — Grid Overlay, Room Muting, Dimension Callouts

**Files added:** `src/components/gridOverlay.ts`
**Files changed:** `src/components/CondoFloorPlan.tsx`, `src/components/tokens/colors.ts` (then `designTokens.ts`, pre-Round-16 split)

- **Lettered-row/numbered-column grid** spans the *whole* unit (not one grid per room) — `CONDO_ROOMS`'s 8 rooms tile the unit with zero gaps, so a unit-wide grid already renders "inside" whichever room each cell falls in, and every cell gets a genuinely unique reference (one true "E6") rather than 8 grids each restarting at A1. Cell size (~60cm, a wayfinding reference scale, not furniture precision) is derived from the unit's real dimensions via `computeGridGeometry()`.
- **Room-fill muting** — a purely decorative distinction, not a placement restriction (the only real placement restriction is `RoomZone.allowedCategories`): living/dining (where clearance rules actually apply and furniture is actually placed) render at full fill weight, the other 6 rooms (bedrooms, CR, kitchen, balcony, storage) render muted. Sourced from two new tokens, `roomFillOpacityActive`/`roomFillOpacityMuted` — `condoLayout.ts`'s per-room `bgColor`/`textColor` stayed the source of truth for *which* colour each room is.
- **Dimension callouts** — the unit's outer width/height rendered along the plan's edges in both cm and feet (`{WIDTH_CM} cm ({(WIDTH_CM / 30.48).toFixed(1)} ft)`).
- **Fixed during this work:** an early version also reduced muted rooms' *label* opacity along with their fill opacity, which made white room-name text functionally invisible against the near-white plan background. Fixed by keeping label opacity on the original unified logic and letting only fill opacity carry the active/muted distinction.

---

### 11. 2D Plan Stability Fixes

**Files changed:** `src/components/CondoFloorPlan.tsx`

- **Zoom-transition jump, fixed:** the SVG's `width:auto;height:auto` derived its intrinsic box from the *current* viewBox's aspect ratio, which differs per room — so the element's own on-screen box (not just its content) resized/repositioned on every room-focus zoom transition. Fixed with a CSS `aspect-ratio` locked permanently to the full-unit shape, so the frame itself never moves; only the viewBox content zooms within it.
- **Click-vs-drag jitter, fixed:** a `moved` flag was computed in `CondoFloorPlan.tsx`'s `DragSession` but never actually checked anywhere — `onDragStart`/`onDragEnd` fired unconditionally on pointerdown/pointerup, so a plain tap was misread as a drag. Fixed with a real `DRAG_THRESHOLD_PX = 5` gate: nothing about the view, undo history, or furniture position changes unless the pointer actually travels past that threshold.
- **Walkway corridor overlay removed:** an orange dashed-rectangle overlay drawn over the plan was confusing, not informative. Removed; the underlying walkway *data* (`computeWalkways()`, the "N Walkways Blocked" pill, the Walkway Access list in `WorkspaceScreen`'s Fixes tab) is untouched — those are separate consumers of the same walkway engine, not this overlay.

---

### 12. Landing Page Visual Redesign

**Files changed:** `src/screens/EntryScreen.tsx`, `src/App.css`

The three-tier button hierarchy from Round 7 is unchanged — this round is a visual skin, not a flow change:

- **No logo/mark anymore** — the "Habi3D" wordmark itself is the focal point, rendered larger and bolder than a plain heading, with a two-tone gradient fill (`linear-gradient(135deg, #FFFFFF 0%, #BBD6FF 100%)` clipped to text) rather than a flat colour.
- **Background:** a radial glow (`var(--primary-light)`) composited over a linear navy gradient (`var(--primary)` → `var(--primary-dark)`) — reuses the existing brand tokens rather than introducing new arbitrary blues.
- **Card:** frosted glass — `rgba(255,255,255,0.96)` with a 20px backdrop blur — sitting on the dark gradient background, distinct from the light neutral "utility tool" surface the rest of the app uses once a session is underway.

---

### 13. ReportScreen Completion-State Reframe

**Files changed:** `src/stores/violationStore.ts`, `src/screens/WorkspaceScreen.tsx`, `src/components/StatusRow.tsx`, `src/screens/ReportScreen.tsx`

The old completion headline was a 4-branch ternary keyed on `totalIssues`/`redRemaining`/`yellowRemaining` — no memory of what a session actually *changed*, and its "Keep a copy" section still described the PDF as "one-page" after Round 8 made it multi-page.

- **`violationStore.ts`** gained `initialFindingKeys: Set<string> | null` (a session-start snapshot of every finding's `stableViolationKey()`, captured once and never overwritten) and `touchedItemIds: Set<string>` (furniture ids the resident actually committed a change to — drag-end, rotate, or reset). New actions `captureInitialFindings()` (idempotent — safe to call on every analysis) and `markItemTouched()`.
- **`WorkspaceScreen.tsx`** calls `captureInitialFindings(analysis.violations)` in a new effect right after its existing violation-seeding effect (deliberately *not* gated on `violations.length > 0` — a session that starts fully comfortable still needs a real, empty snapshot captured), and calls `markItemTouched(changed.id)` inside `commitLayout`.
- **`StatusRow.tsx`** gained an optional third `note` line (quieter, not severity-coloured) for context that isn't itself a measurement.
- **`ReportScreen.tsx`** headline is now built from `resolvedCount` (keys present in the initial snapshot but no longer in the current violation set) vs. `initialCount`: *"Everything already fit comfortably"* / *"You made N spots more comfortable"* / *"No tight spots were resolved this session"* — **no score, percentage, or grade anywhere.** A fixed calm line ("Some tightness is normal in a real room…") replaced the old conditional subtext. A "See the details" toggle expands a `StatusRow` list per current finding, showing "You decided this works for you" only on findings tied to an item the resident actually touched. The "Keep a copy" section was reframed to "Get the full report," and its description corrected to describe the real multi-page PDF.
- **Verified with real session data** (Playwright): seeded two overlapping pieces of furniture, dragged one apart, walked through to Report. Headline read "You made 3 spots more comfortable"; the expanded list correctly distinguished the touched item from the untouched one.

---

### 14. WorkspaceScreen Neutral Palette Pass

**Files changed:** `src/screens/WorkspaceScreen.tsx`, `src/App.css`

Audited every non-severity colour in `WorkspaceScreen`'s chrome. Five elements used `t.brand`/`t.brandTint` (`#1F3864`/`#E6EDF8`, the app's distinct brand-identity token) rather than the neutral family:

1. Header breadcrumb ("Mulberry Place," clickable to un-focus a room)
2. "Done" button
3. Rotate/Undo/Reset icon buttons (enabled state)
4. Items/Fixes/Rules active tab (label + underline)
5. Selected furniture list row (background + border)

All five, plus a matching hardcoded hex in `App.css`'s `.wksp-solid-btn:hover` shadow, now source from `t.ink`/`t.inkSoft`/`t.surface`/`t.line` — the same neutral family already used for all body text. **The 3 severity hues (`attentionFg`/`tightFg`/`comfortFg` and their `Bg` pairs) were explicitly not touched** — confirmed via `git diff` grep. Verified via computed style in a live browser: the Done button's background went from `rgb(31, 56, 100)` (`#1F3864`) to `rgb(22, 32, 58)` (`#16203A`).

---

### 15. Full-Flow Debug Pass

**Report only — no code changes.** A real Playwright trace through Entry → Auth → Furniture Input → Position Map → Workspace → Report → PDF download, capturing every console message and network request/response.

Findings:
- **The `create_user`/`verify_login` RPC functions from Round 6 were never actually created in the live Supabase project** — a login attempt returned a `404` on `rest/v1/rpc/verify_login`, surfaced to the user as a generic "Something went wrong." This was already a known unchecked item in this document's own "Before Phase 3" list — this was the first *live* confirmation of it. This finding is what motivated Round 18's decision to abandon the custom-table approach rather than just run the missing SQL.
- The same root cause explained a `saved_sessions` 404 seen in an earlier seeded trace (autosave silently failing, as documented under Round 6's known issues).
- A pre-existing `ReportScreen.tsx` console warning (mixing shorthand `border` with longhand `borderLeft` in the same inline style object) — cosmetic, not fixed as part of this pass.
- AR placement correctly fails with "No runtimes supported the requested configuration" in this WebXR-less environment — expected, not a bug, and the reason later rounds (16, 19, 21) had to invent alternative verification strategies (component-state seeding + native DOM click dispatch) instead of real device traces.
- PDF download: clean, zero console errors.

---

### 16. Design Tokens Reorganized Into `tokens/`

**Files removed:** `src/components/designTokens.ts`
**Files added:** `src/components/tokens/{colors,type,spacing,marks,index}.ts`
**Files changed:** all 14 import sites across `src/components/` and `src/screens/`, plus `index.css`'s sync-documentation comments

Pure reorganization — **zero value changes**, verified by cross-checking every hex in the new `colors.ts` against `index.css`'s mirror. Split by concern:
- `colors.ts` — the `color` object (neutrals, severity states, brand, accent, plan geometry)
- `type.ts` — `fontFamily`, `type` (the 4-size scale), `numeric` (tabular-nums)
- `spacing.ts` — `space`, `radius`
- `marks.ts` — `planMark` (draggable/ghost/infeasible plan-surface treatments), imports `color` from `./colors`
- `index.ts` — barrel re-export, so every consumer still does one `import { color, radius } from '../components/tokens'`

---

### 17. Dead Code Removed — `ARDemoScreen.tsx`

**Files removed:** `src/screens/ARDemoScreen.tsx`
**Files changed:** `src/App.tsx` (removed its case + import), `src/types/index.ts` (removed `'arDemo'` from the `ScreenName` union)

Confirmed via `grep` before deletion: zero references anywhere else in `src/`. `arDemo` had a route in `App.tsx` but nothing in the live navigation flow ever linked to it. Confirmed via `vite build`: module count dropped 603 → 602 and the main bundle shrank, proving it's actually gone from the shipped output, not just unreferenced in source.

---

### 18. Auth Rebuilt a Third Time — Real Supabase Auth, Synthetic Email

**Files changed:** `src/supabase.ts`, `src/screens/AuthScreen.tsx`

**This reverses Round 6.** The custom `users` table + `pgcrypto` RPC design was replaced with plain Supabase Auth: simpler by design, fewer moving parts, standard Supabase behaviour throughout. The app's UI still only ever asks for a **username** (never an email field) — the username is turned into a synthetic `${username}@habi3d.local` email under the hood, and the identity the rest of the app actually cares about is the real `auth.uid()` Supabase returns.

```ts
const SYNTHETIC_EMAIL_DOMAIN = 'habi3d.local';

function buildSyntheticEmail(username: string): string {
  if (username.includes('@')) {
    throw new Error('Username cannot contain "@".');
  }
  return `${username}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export async function createAccount(username: string, password: string): Promise<AuthUser> {
  const email = buildSyntheticEmail(username);
  const { data, error } = await supabase.auth.signUp({ email, password });
  // error.message mapped to friendly text: "already registered"/"already exists" →
  // "That username is already taken."; "password" → length message; anything
  // else → a generic fallback (see the note on error handling below).
  return { userId: data.user.id, username };
}

export async function logIn(username: string, password: string): Promise<AuthUser> {
  const email = buildSyntheticEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  // Generic failure message on purpose — Supabase Auth itself never reveals
  // whether the underlying email/username exists.
  return { userId: data.user.id, username };
}
```

- **Username validation:** rejected *before* the synthetic email is ever constructed if it contains `"@"` — otherwise `${username}@habi3d.local` could end up with two `@` signs and silently target a different, invalid address.
- **`AuthUser` interface unchanged** (`{ userId, username }`) — `sessionStore`, `useAutosaveLayout`, and `AuthScreen.tsx`'s call sites needed *no* changes beyond a stale doc-comment update. `fetchSavedSession`/`saveSessionLayout` also needed zero changes — they already operated generically on a `userId: string`.
- **Operational prerequisite:** requires "Confirm email" turned **off** in the Supabase project (Dashboard → Authentication → Sign In / Providers → Email). The synthetic domain can never receive a real confirmation link — with confirmation left on, `signUp()` would create the `auth.users` row but never establish a session, and every RLS check against `auth.uid()` would silently fail. Confirmed via live testing that this project already has it off.
- **New `saved_sessions` SQL** (this table's shape is otherwise unchanged — `user_id`, `session_id`, `layout_data`, `updated_at` — only the FK target and RLS role changed):

```sql
create table saved_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  session_id text not null,
  layout_data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table saved_sessions enable row level security;

create policy "select own session" on saved_sessions
  for select to authenticated
  using (auth.uid() = user_id);

create policy "insert own session" on saved_sessions
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "update own session" on saved_sessions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on saved_sessions to authenticated;
```

  **Role is `authenticated`, not `anon`** — a real change from Round 6's design (which was always `anon`, since there was never a real session). Once someone signs in, the Supabase JS client attaches a JWT to every request and PostgREST maps that to `authenticated`; granting only `anon` here would look plausible but silently fail every autosave. The trailing `unique` on `user_id` is required — `saveSessionLayout`'s `.upsert(..., { onConflict: 'user_id' })` needs a unique constraint on the conflict column or Postgres rejects the upsert. This table has been created and its RLS verified in the Supabase dashboard (per direct confirmation, not just documented).
- **This is a real, meaningful RLS improvement over Round 6:** the old design's `saved_sessions` policies allowed anyone bearing the right `user_id` (an unlisted UUID) to read/write that row — flagged at the time as fine for closed thesis testing but not production-grade. The new `auth.uid() = user_id` policies are backed by a real session token, closing that gap entirely. (Round 6's "trust model is looser" known issue is resolved by this round, not just superseded.)
- **Verified with a real round trip against the live Supabase project** (Playwright driving the actual UI, not calling `supabase.auth.*` from a script): create account with a fresh username → real `supabase.auth.signOut()` → log back in with the same username → same `userId` (`auth.uid()`) both times.
- **Not fully diagnosed:** a separately-reported "could not create account" generic error was investigated in depth (fresh signups, a duplicate-username case, a 6-request burst for rate-limiting, 5 fully-instrumented runs) — the mechanism worked correctly ~19 of ~20 real attempts against the live project, and the exact reported message was never reproduced from this environment. The swallow point is known regardless: any `signUp`/`signInWithPassword` error whose message doesn't match `"already registered"`/`"already exists"`/`"password"` collapses to a generic "Could not create an account just now — try again." with `error.status`/`error.code` never logged anywhere. Worth surfacing those if the generic message recurs.

---

### 19. WorkspaceScreen React-Effect Correctness Fixes

**Files changed:** `src/screens/WorkspaceScreen.tsx`

`eslint`'s `react-hooks/set-state-in-effect` rule (part of the `eslint-plugin-react-hooks` "recommended" flat config, a React-Compiler-derived dataflow check, not a simple line-pattern lint) flagged two long-standing warnings. Fixed properly, not suppressed:

- **Mount-normalization effect:** was calling `setPreview(normalized)`/`previewRef.current = normalized` after writing normalized positions to the furniture store — genuinely redundant, since a second effect already re-synced `preview` from `items` whenever `items`/`loaded` changed, and would fire immediately after this effect's own store writes landed. Those two lines were simply removed.
- **`loaded` converted from `useState` to a `useRef`:** grep confirmed it was never read by JSX — pure internal "have I run the one-time setup yet" bookkeeping, which doesn't need to trigger a re-render on its own. This also eliminated the `set-state-in-effect` warning on `setLoaded(true)`, since the mount effect no longer calls any component state setter at all.
- **"Keep preview in sync with store" effect rewritten as a render-time adjustment** — React's own documented pattern for state that mirrors another value (`https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes`): a `prevItems` state tracks the last-seen `items` reference, and `setPreview(items)` fires inline during render (not inside `useEffect`) when it changes, applying before the next paint instead of costing an extra commit.
- A follow-on `react-hooks/refs` violation surfaced by this rewrite (refs may only be mutated in an effect or event handler, never during render) was fixed by moving `previewRef.current = preview` into its own small dedicated effect.
- **Verified with a real interaction trace, not just a clean lint run:** seeded two overlapping furniture items (forcing the mount-normalization path to do real work), then drove mount → auto-separate → select → drag → undo → rotate (correctly rejected as infeasible — real business logic, not a bug) → reset → tab switching. Zero console errors throughout.
- `eslint .` now runs completely clean project-wide — zero errors, zero warnings, for the first time this session.

---

### 20. Supabase Legacy-Table Cleanup

**Report + confirmation, then dropped by the project owner (no DB access from this environment).**

Audited `users` (Round 6's now-abandoned custom table) and `space_utilization_scores` (long-flagged as empty with no write path):

- **`users`:** zero references anywhere in `src/` — confirmed via both an exact `.from('users')`/`"users"` grep and a broader case-insensitive sweep. Every `users`-adjacent hit was either `auth.users` (a different table entirely) or a comment describing the already-replaced design in past tense.
- **`space_utilization_scores`:** zero references, case-insensitive, anywhere in `src/`.
- **Current auth confirmed to exclusively use `supabase.auth.*`** — no `.rpc()` call of any kind remains in `supabase.ts`.

Both tables have since been dropped from the live Supabase project. **Resolves** the "space_utilization_scores table is empty" known issue from earlier snapshots of this document — moot now that the table doesn't exist.

---

### 21. AR Calibration Retry

**Files changed:** `src/screens/PositionMapScreen.tsx` (no changes to `src/ar/calibration.ts` itself)

Round 9's two-tap calibration had no way to redo a tap, before or after it committed — a bad corner tap meant exiting AR entirely and starting over; a bad wall tap couldn't be caught at all, since `handleTapWall` computed *and committed* the transform in the same synchronous call.

**Retry before commit:**
- Tap 1 (corner) already had a "Start over from the corner" redo path; confirmed still correct.
- Tap 2 (wall) now holds the derived transform in a new `pendingCalibration` state (paired with `wallPoint` for a second, colour-distinct AR marker) instead of committing it immediately. A new review panel — "Retap" (discards, stays ready for a new tap) / "Use this point" (the actual commit) — sits between the tap landing and `calibration` ever becoming non-null.

**Retry after commit:**
- A "Recalibrate" button now lives in the top bar throughout the whole placement phase (not buried, not gated on whether an item is mid-placement). It clears only calibration-related state — never `items`, `activeItemId`, `lockedPosition`, or `previewPosition` — and never ends the AR session (confirmed safe: calibration state and the WebXR session lifecycle are fully decoupled).
- **Already-placed furniture is explicitly left as-is, not silently decided either way.** Recalibrating does not retroactively re-map already-stored plan-frame positions through the new transform — composing old→new calibration math on real placement data was judged too risky to attempt unverified, with no hardware available to validate it here. If anything is already placed, clicking "Recalibrate" shows an inline warning (not a native `confirm()` — matches this app's established no-browser-modals convention) stating plainly that already-placed items won't move and may need to be re-placed, with Cancel / Recalibrate-anyway.

**Verification, given no WebXR hardware is available in this environment:** the component's `useState` initial values were seeded directly to reach each state (pending wall point, committed calibration + an already-placed item) and native DOM `.click()` events were dispatched on the real rendered buttons — bypassing only the `visibility:hidden` CSS Playwright's actionability check respects, not the actual React code paths. Confirmed: tap-1 retap resets the step correctly; tap-2 retap discards only the pending point; "Use this point" commits calibration and switches the UI into placement mode; the full Recalibrate → warning → Cancel → Recalibrate → confirm cycle correctly clears calibration while leaving a seeded item's `posX`/`posZ` **byte-identical** before and after (read directly from a temporarily window-exposed store). Zero console errors in every scenario. All temporary seeds and the window exposure were fully reverted afterward.

---

## Project Context (Locked)

**What it is:** BSIT Undergraduate Thesis — Application Development. A WebXR/2D tool for 2BR condo residents (Mulberry Place, Acacia Estates, Taguig) to lay out furniture and validate against 10 clearance rules from *Time-Saver Standards for Interior Design* (DeChiara, Panero & Zelnik, 2001, pp. 61–90).

**Tech stack:** React 19 + TypeScript 6 + Vite 8 + @react-three/fiber/xr + Zustand + Supabase (Postgres + Auth — real `supabase.auth.*`, since Round 18; not the custom RPC table from Round 6) + Vercel + jsPDF

**The 10 rules** (locked values in `src/engine/rules.ts`):
- **Living (L1–L5):** General circulation, sofa-coffee table legroom, secondary path, main traffic, conversation depth
- **Dining (D1–D5):** Table-to-wall, chair pull-out, passage behind seated, walking past seated, minimum passage
- Each rule has RED (violation), YELLOW (warning), GREEN (clear) thresholds

**Research sample:** N=30 purposive (2BR only, single unit). Phase 3 evaluation sessions upcoming.

---

## Current Architecture

### Screen Flow
```
entry (Begin Session / Log in / Create account)
  ├─ Begin Session ──────────────► furnitureInput (anonymous, nothing persisted)
  ├─ Create account ──► auth (signup, username → synthetic email, Supabase Auth) ──► furnitureInput
  └─ Log in ──────────► auth (login, username → synthetic email) ──► saved_sessions found?
                                            ├─ no ──────────────► furnitureInput
                                            └─ yes ─► Resume/Start fresh choice
                                                        ├─ Resume ──► recommendations (WorkspaceScreen, furniture pre-placed)
                                                        └─ Start fresh ─► furnitureInput

furnitureInput → positionMap (two-tap AR calibration, then AR placement) → analysis/recommendations/recommendation (WorkspaceScreen) → report
```
`ARDemoScreen` no longer exists (deleted, Round 17) — there is no dead route left pointing at it.

### Store Locations
- `src/stores/sessionStore.ts` — `currentScreen`, `navigateTo`, `sessionId`, `unitTypeId` (fixed), `roomDimensions` (fixed), `userId` (now a real `auth.uid()`, Round 18), `username`, `authMode`, `startNewSession()`
- `src/stores/furnitureStore.ts` — `items[]`, `addItem`/`updateItem`/`updatePosition`/`removeItem`/`clearAll`, `setItems()` for bulk-loading a resumed layout
- `src/stores/violationStore.ts` — `violations[]`, `recommendations[]`, analysis results, plus (Round 13) `initialFindingKeys`/`touchedItemIds` and their `captureInitialFindings()`/`markItemTouched()` actions, driving `ReportScreen`'s session-diff headline. Still does **not** store `allClassifications` (recomputed on demand in `ReportScreen.tsx`, see Round 8).
- `src/stores/useAutosaveLayout.ts` — not a store, a shared hook consumed by any screen that mutates furniture; no-ops when `userId` is null (the anonymous path)

### Key Engines
- `src/engine/rules.ts` — 10 rules, `classifyGap()`, Priority Score formula
- `src/engine/clearance.ts` — `runClearanceAnalysis()`; returns `{ violations, spaceScoreBefore, allClassifications }` — **untouched by any round in this document**
- `src/engine/ruleGuidance.ts` — user-facing text layer per rule (`ALL_RULE_GUIDANCE`, `bandLabel`, `bandRanges`)
- `src/engine/walkways.ts` — `computeWalkways()`, still live and consumed by `WorkspaceScreen`'s pill/list (Round 11 only removed a plan-surface *overlay* of this data, not the data itself)
- `src/components/floorPlanDrag.ts` — free-movement physics + unit envelope constants (**untouched** by any round in this document)
- `src/components/floorPlanGeometry.ts` — `projectItems()`, the single geometry source `CondoFloorPlan` and `pdfReport` both draw from (**untouched**)
- `src/components/gridOverlay.ts` — (Round 10) pure geometry for the unit-wide wayfinding grid, `computeGridGeometry()`
- `src/components/CondoFloorPlan.tsx` — SVG floor plan + window-level drag listeners + circle rendering + grid/dimension overlays (Round 10) + zoom/jitter fixes (Round 11)
- `src/components/pdfReport.ts` — client-side PDF builder (jsPDF); multi-page with real pagination (Round 8)
- `src/components/DownloadReportButton.tsx` — shared download UI state machine
- `src/components/tokens/{colors,type,spacing,marks,index}.ts` — **app-wide canonical design tokens** (Round 16 split of the former single `designTokens.ts`; values unchanged) — colour, type scale, `fontFamily`, `numeric`, `space`, `radius`, `planMark`
- `src/ar/calibration.ts` — (Round 9) `deriveCalibration`/`applyCalibration`/`invertCalibration`/`calibrationThetaRad`, the AR-to-plan coordinate transform

### AR
- `src/ar/ClearanceOverlay.tsx`, `src/ar/CorrectionArrow.tsx`, `src/ar/ARMeasureSession.tsx` (point-to-point measuring, also used for diameter taps)
- `src/ar/calibration.ts` — (Round 9) the two-tap AR-to-plan transform; consumed by `PositionMapScreen.tsx`'s `CalibrationScene`/`PlacementScene`, with a full retry path added in Round 21

### Supabase
- **Auth (Round 18, current):** real Supabase Auth. `supabase.auth.signUp`/`signInWithPassword`, with the app's username-only UI mapped to a synthetic `${username}@habi3d.local` email. `userId` throughout the app is the real `auth.uid()`. Requires "Confirm email" off in the project's Auth settings (confirmed already off). No `.rpc()` call of any kind remains in `supabase.ts`.
- **`saved_sessions`** (Round 18) — `user_id references auth.users(id)`, RLS `to authenticated using/with check (auth.uid() = user_id)`, granted to `authenticated`. Created and verified in the Supabase dashboard.
- **`users`** (the Round 6 custom table) and **`space_utilization_scores`** — confirmed (Round 20) to have zero references anywhere in `src/`, and have been dropped.
- `participants`, `pre_survey_responses`, `sus_responses`, `post_survey_responses` — legacy, unused; `insertParticipant`/`insertSusSurvey`/`insertPostSurvey` still exist in `supabase.ts` but have zero callers anywhere — not touched by any round in this document, flagged for a future cleanup pass if wanted.
- `ar_measurement_tests`, `rule_test_cases` — schema present, not yet populated.

---

## What's Working

✅ **Entry & auth** — a redesigned landing page (bold gradient wordmark, frosted-glass card) with the same three-tier hierarchy; real Supabase Auth under a username-only UI; login offers resume of a saved layout; verified end-to-end (signup → real sign-out → login → same `auth.uid()`) against the live project
✅ **Single fixed unit** — dimensions read silently from `roomData.ts`, no picker
✅ **2D Floor Plan** (`WorkspaceScreen`) — free drag, live gap readouts, alignment guides, collision highlighting, undo, keyboard shortcuts, automatic room re-homing, compact header, canvas at ~82% of viewport height, a lettered/numbered wayfinding grid, room-fill muting, dimension callouts, zoom-stable, jitter-free, and a fully clean `eslint` pass (Round 19)
✅ **Circular furniture** — diameter measuring, circle rendering in both the live plan and the PDF, rotation correctly disabled
✅ **AR Furniture Placement** (`PositionMapScreen`) — two-tap calibration with a full retry path (redo a bad tap before commit, or fully recalibrate mid-session without losing already-placed furniture's data)
✅ **Clearance Analysis** — 10 rules, Priority Score ranking, unaffected by any round through 21
✅ **Recommendations UI** — plain-English rule guidance, CVD-safe clearance meters, Rules reference tab
✅ **Reports** — completion state built from a real session-start-to-now diff (no score/percentage), PDF download with a full rule-by-rule breakdown across multiple pages (violated *and* cleared)

---

## Known Issues & Blockers

### 🔴 planeDetection still true — one live file
**Live blocker:** `src/screens/FurnitureInputScreen.tsx` (line ~17) — still routed, still `planeDetection: true`. **Re-confirmed current** as of this update.
**Dead code, same flag present, low priority:** `AnalysisScreen.tsx`, `RecommendationScreen.tsx`.
**Fix:** remove `planeDetection: true` from `FurnitureInputScreen.tsx`'s `createXRStore` call before Android testing.

### 🟡 No password reset flow
Plain limitation of Supabase Auth used this way (no UI built for it), same limitation the two earlier auth designs had. Stated for this tester group, not a silent gap.

### 🟡 "Could not create an account" generic error — reported once, not reproduced
Investigated in depth (Round 18): ~19 of ~20 real signup attempts against the live project succeeded cleanly; the exact reported message was never reproduced from this environment. The swallow point (`error.status`/`error.code` never logged, only a substring-matched `error.message`) is known and documented in Round 18 above — worth wiring up if it recurs live.

### 🟡 AR coordinate drift between sessions (known limitation, mitigated by Round 9/21, not eliminated)
Each `enterAR()` still starts a fresh world origin — Round 9's calibration re-derives the AR-to-plan transform once per session rather than eliminating the underlying drift, and Round 21 makes that calibration redoable if a tap was bad. See `project_habi3d_live_scan_backup_plan` memory for a fallback approach that avoids persisting cross-session coordinates at all.

### 🟡 `FloorPlan2D.tsx` still draws every item as a `<rect>`
Unchanged since Round 5 — only reachable through the dead `RecommendationScreen.tsx`, out of scope.

---

## Before Phase 3 Evaluation Sessions

**Must-do:**
- [ ] Remove `planeDetection: true` from `FurnitureInputScreen.tsx`
- [ ] End-to-end test on Android Chrome (WebXR), including the two-tap AR calibration flow, its retry paths (Round 21), and the circular-table measuring flow
- [ ] Populate `rule_test_cases` (10 rule tests + 5 priority score ranking tests)
- [ ] Resolve the pending guest-feature request (see below)
- [ ] If the generic "could not create account" message recurs live, capture `error.status`/`error.code` at the point flagged in Round 18 to get a specific cause

**Resolved since last snapshot (2026-08-11):**
- ~~Run the Round 6 SQL — verify/create `users`, `create_user`/`verify_login` RPCs~~ — moot, Round 18 abandoned this design entirely in favour of real Supabase Auth
- ~~Decide and implement the `space_utilization_scores` fix~~ — moot, Round 20 confirmed it had zero write path anywhere and the table was dropped
- ~~Live-test the full auth + resume flow against the real Supabase project~~ — done, Round 18, real round trip against the live project
- ~~Decide whether the `saved_sessions` RLS trust model needs tightening to a real session token~~ — done, Round 18's `auth.uid() = user_id` policies are backed by a real session, not an unlisted UUID

**Still pending, not yet implemented:**
1. **A "guest" feature for testing.** Still unanswered: a second button that behaves exactly like "Begin Session" (fully anonymous), or a real lightweight Supabase anonymous-auth account (so testers can exercise save/resume without typing credentials)? Flagged rather than guessed.

**Nice-to-have:**
- [ ] Decide the fate of orphaned `AnalysisScreen.tsx`/`RecommendationScreen.tsx`/`FloorPlan2D.tsx`/`PlanSandbox.tsx`
- [ ] Clean up unused `insertParticipant`/`insertSusSurvey`/`insertPostSurvey` in `supabase.ts` and their legacy tables, if a broader Supabase cleanup pass happens
- [ ] Expert interior designer validation document
- [ ] DMCI floor plan dimensions confirmation

---

## Testing & Verification Done (cumulative)

✅ TypeScript: `tsc -b --force` clean across the whole repo, re-verified after every round through 21
✅ Linting: `eslint .` — **fully clean, zero errors/zero warnings**, as of Round 19 (the two long-standing `WorkspaceScreen.tsx` `set-state-in-effect` warnings, present since before this document's first snapshot, are now fixed rather than accepted as known-intentional)
✅ Production build: `vite build` passes, re-verified after every round through 21
✅ Drag geometry: 19 assertions · Meter geometry: 12 assertions · Circular-table geometry + clearance: 11/12 assertions
✅ Round 9 (AR calibration): pure-function module, exercised via Round 21's seeded-state trace
✅ Round 13 (ReportScreen reframe): real Playwright trace with real session data — dragged furniture, walked through to Report, confirmed both collapsed and expanded states
✅ Round 14 (neutral palette): before/after computed-style comparison in a live browser, confirmed severity tokens untouched via diff
✅ Round 15 (debug pass): full Entry→Report Playwright trace with console/network capture at every step
✅ Round 18 (auth rebuild): **live-executed**, not just hand-traced — real signup → real sign-out → real login against the live Supabase project, same `auth.uid()` both times
✅ Round 19 (effect fixes): real interaction trace (mount-normalize → select → drag → undo → rotate → reset), zero console errors
✅ Round 21 (calibration retry): three seeded-state scenarios exercising every button via native DOM click dispatch on the real component tree, including byte-identical before/after proof that already-placed furniture is left untouched by recalibration

**Not verified — no browser/device access available in this environment:**
- Circular table rendering, the modernized UI, and the full AR calibration + retry flow, on an actual phone
- Android Chrome / WebXR behavior generally

---

## Useful Links

- **Memory:** `C:\Users\Dell\.claude\projects\c--Users-Dell-Habi3D-Project\memory\`
- **Repo docs:** `CODEBASE_OVERVIEW.md`, `RECENT_CHANGES.md` at repo root (`PROCESS_FLOW.md`/`SYSTEM_CANVAS.md`, referenced in earlier snapshots of this document, do not currently exist in the repo — removed from this list rather than left as dead links)
- **Time-Saver Standards citation:** DeChiara, Panero & Zelnik (2001), pp. 61–90
