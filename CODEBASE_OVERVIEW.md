# Habi3D — Full Codebase Overview

A complete walkthrough of what this codebase is, how every piece fits together, and what's actually live versus dead. For a chronological history of changes, see `CODEBASE_STATUS.md` and `RECENT_CHANGES.md`. For the specific WorkspaceScreen-vs-RecommendationScreen question, see `WORKSPACE_VS_RECOMMENDATION_AUDIT.md`.

---

## 1. What this is

Habi3D is a BSIT undergraduate thesis project (Application Development specialization): a WebXR/2D tool that lets a resident of a specific real condo unit — Mulberry Place, Bengaline, Acacia Estates, Taguig City — lay out furniture and check it against 10 furniture-clearance rules sourced from *Time-Saver Standards for Interior Design* (DeChiara, Panero & Zelnik, 2001, pp. 61–90).

The workflow: measure/declare furniture → place it in AR (or skip AR entirely and just work in 2D) → the app runs the clearance rules automatically and shows a priority-ranked list of what to fix → download a PDF keepsake.

**Locked scope decisions** (see project memory for the full history): 2BR units only, one fixed unit config (no unit picker), Concept 5 "one violation at a time, priority-ranked" as the guiding UX idea (though the *shipped* screen — see §3 — actually free-drags instead), and Time-Saver Standards + Grimley & Love (2018) as the clearance citation basis.

## 2. Tech stack

React 19 + TypeScript 6, Vite 8 for build/dev, `@react-three/fiber`/`@react-three/xr` for the WebXR/3D AR layer, Zustand for state, Supabase (Postgres + RPC — **not** Supabase Auth, see §9) for the backend, jsPDF for the report, deployed on Vercel. No CSS framework — hand-written CSS with a small token system (§8).

No automated test suite exists (`package.json` has no `test` script). Everything in this codebase has been verified via `tsc -b --force` (type checking), `eslint .`, `vite build`, and — for anything interactive — real headless-browser (Playwright) traces run manually during development, not a persisted CI suite.

---

## 3. Screens — what's live, what's not

`App.tsx` is a single `switch` on `sessionStore.currentScreen`. This is the **entire routing table** — there is no router library, no nested routes, just one flat switch:

```tsx
switch (currentScreen) {
  case 'entry':         return <EntryScreen />;
  case 'auth':          return <AuthScreen />;
  case 'arDemo':         return <ARDemoScreen />;
  case 'furnitureInput': return <FurnitureInputScreen />;
  case 'positionMap':    return <PositionMapScreen />;
  case 'analysis':
  case 'recommendations':
  case 'recommendation': return <WorkspaceScreen />;
  case 'report':         return <ReportScreen />;
  default:                return <PlaceholderScreen screenName={currentScreen} />;
}
```

| Screen (file) | Route(s) | Status | What it does |
|---|---|---|---|
| `EntryScreen.tsx` | `entry` | **Live** | Landing page — Begin Session (anonymous) / Create account / Log in. Full-bleed blue gradient background, "Habi3D" as the sole visual focal point (no logo). |
| `AuthScreen.tsx` | `auth` | **Live** | Username + password login/signup against a plain Postgres `users` table (§9) — no Supabase Auth, no email. Offers "resume your last session" if a saved layout exists. |
| `FurnitureInputScreen.tsx` | `furnitureInput` | **Live** | Declare each piece of furniture: category, shape (including round/circular), dimensions — either typed or measured in AR via `ARMeasureSession`. |
| `PositionMapScreen.tsx` | `positionMap` | **Live** | AR placement. Opens a WebXR session, requires a two-tap calibration step per fresh session (§7), then lets the resident tap-to-place each piece in the real room. |
| `WorkspaceScreen.tsx` (+ `CondoFloorPlan.tsx`) | `analysis`, `recommendations`, `recommendation` | **Live — the actual 2D workspace** | Free-drag 2D floor plan of the whole 8-room unit, live clearance analysis, rule guidance panel, PDF download entry (via "Done" → Report). This is where nearly all of this session's work has landed. |
| `ReportScreen.tsx` | `report` | **Live** | Plain-language room-by-room summary + the PDF download button. |
| `ARDemoScreen.tsx` | `arDemo` | **Dead** | A WebXR capability-check screen (HTTPS/hit-test/etc. badges). Nothing links to it, but it's still wired into the switch. |
| `AnalysisScreen.tsx` | *(none — orphaned)* | **Dead** | An earlier AR-camera-overlay version of the analysis flow (`ClearanceOverlay`, live AR calibration via tap). Predates `WorkspaceScreen`. No route reaches it. |
| `RecommendationScreen.tsx` (+ `PlanSandbox.tsx`) | *(none — orphaned)* | **Dead** | An earlier one-violation-at-a-time, propose-then-confirm 2D flow. Fully described in `WORKSPACE_VS_RECOMMENDATION_AUDIT.md` — genuinely different interaction model from `WorkspaceScreen`, not a duplicate. |
| `PlaceholderScreen.tsx` | `default` case | **Live (fallback)** | Renders if `currentScreen` is somehow a value with no case — a safety net, not a real screen. |

**Why the dead screens are still here:** each one was superseded by later work but never deleted — this codebase's established pattern (documented repeatedly in `CODEBASE_STATUS.md`) is to leave orphaned screens alone rather than risk scope creep touching unreached code. `WORKSPACE_VS_RECOMMENDATION_AUDIT.md` exists specifically to give the project owner the facts needed to decide whether to delete one pair or port features between them.

## 4. State management — 3 Zustand stores

| Store | File | Holds |
|---|---|---|
| **sessionStore** | `stores/sessionStore.ts` | `currentScreen` (the router state), `sessionId`, `unitTypeId`/`roomDimensions` (fixed, read once from `roomData.ts`), `userId`/`username`, `authMode`. Pure in-memory — never persisted, so a page reload always lands back at `entry`. |
| **furnitureStore** | `stores/furnitureStore.ts` | `items: FurnitureItem[]` — the single source of truth for every piece of furniture in the session. `addItem`/`updateItem`/`updatePosition`/`removeItem`/`clearAll`/`setItems` (bulk-load, used when resuming a saved session). |
| **violationStore** | `stores/violationStore.ts` | `violations[]`, `recommendations[]` (same data, priority-sorted), `resolvedKeys` (a `Set<string>` keyed by `stableViolationKey`, tracking what the user has explicitly resolved — see §5), `spaceScoreBefore`/`spaceScoreAfter`. |

A fourth file, `stores/useAutosaveLayout.ts`, is not a store but a shared hook — debounced (1.5s) autosave of the current layout to Supabase's `saved_sessions` table, a no-op when `userId` is null (the anonymous path).

## 5. The clearance engine (`src/engine/`)

This is the mathematical core, and it's completely UI-agnostic — every screen (live or dead) calls into the same functions.

- **`rules.ts`** — the 10 rules as data (`CLEARANCE_RULES`): L1–L5 (living: general circulation, sofa/coffee-table legroom, secondary circulation, main traffic path, conversation-area depth) and D1–D5 (dining: table-to-wall, chair pull-out, passage behind seated, walking past seated, minimum passage). Each has a `violationThresholdCm` (RED below this) and `warningThresholdCm` (YELLOW below this, GREEN at/above). `classifyGap(measuredCm, rule)` does the three-way classification. `computePriorityScore(severityWeight, shortfallCm, affectedEdgeLengthCm)` — Priority Score = VSW × shortfall × affected-edge-length, VSW = 3 for RED, 1 for YELLOW.

- **`clearance.ts`** — the actual analysis:
  - `toBounds(item)` — an item's axis-aligned bounding box, accounting for rotation (`effectiveLengthCm`/`effectiveWidthCm` — the rotated footprint's envelope, conservative/over-estimating at non-90° angles so clearances are never over-reported).
  - `findLayoutViolation(bounds, roomWidthM, roomLengthM)` — a fast, exception-free out-of-bounds/overlap predicate. **Note:** a near-duplicate of this logic also exists as `isFeasible()` in `components/floorPlanDrag.ts` — flagged as real (if currently harmless) duplication in `WORKSPACE_VS_RECOMMENDATION_AUDIT.md`.
  - `runClearanceAnalysis(items, roomWidthCm, roomLengthCm)` — the main entry point. Runs every applicable rule check (pairwise between items, and item-to-wall) across the *entire* furniture list against one combined room envelope. **Important:** it has no concept of the 8-room `CONDO_ROOMS` layout at all — it doesn't know or care which visual "room" an item is sitting in, only its category (which rules can even apply) and raw position. Returns `{ violations, spaceScoreBefore, allClassifications }` — `allClassifications` holds *every* check performed, GREEN included, which is what powers the PDF's rule-by-rule detail (§10) and the grid overlay's "which rooms actually have rule-checking" distinction (§7).

- **`walkways.ts`** — a separate, simpler check: 5 fixed corridor zones (`WALKWAY_PATHS`) with hardcoded bounding boxes, and `computeWalkways(items)` measuring how much any furniture protrudes into each one. Powers the "N Walkways Blocked" pill and the "Walkway Access" list in `WorkspaceScreen`'s side drawer. (A visual dashed-rectangle rendering of this on the plan itself was removed for being confusing/unlabeled — the list and pill remain the clear presentation.)

- **`ruleGuidance.ts`** — the plain-English layer over the 10 rules: `title`/`requirement`/`consequence` per rule, `ALL_RULE_GUIDANCE` (all 10, for the Rules reference tab), `bandRanges()`/`bandLabel()`/`meterMaxCm()` for rendering the visual clearance meter.

- **`violationKey.ts`** — `stableViolationKey(v)` = `` `${ruleCode}::${furnitureId}::${itemBId ?? 'wall'}::${wallSide ?? ''}` ``. Exists because `Violation.id` embeds the measured cm value and changes on every re-analysis — this key is what stays constant for "the same underlying check" across re-analyses, which is what makes "mark this as resolved" tracking possible.

- **`clearanceTestCases.ts`** — hand-written scratch verification helpers (rotation symmetry checks, etc.), not a real test suite hooked into any CI.

## 6. The 2D floor plan stack

This is the most-touched part of the codebase this session. Four layers, cleanly separated:

1. **`data/condoLayout.ts`** — `CONDO_ROOMS`: 8 rooms (Balcony, Bedroom 1, Bedroom 2, Living Room, Storage, Bathroom/CR, Dining Area, Kitchen), each a plain axis-aligned rectangle (`x, y, width, height` in cm) plus a `bgColor`/`textColor`/`allowedCategories`. They tile the full unit (510×880cm) with **zero gaps** — confirmed by direct check, this matters for the grid overlay (below). `getRoomForCategory()` maps a furniture category to its default room. **Known simplification, stated plainly:** the real hallway notch between Bedroom 1/2 isn't modeled — they're two plain abutting rectangles sharing a straight edge. Not silently faked with fake geometry; genuinely out of scope so far.

2. **`components/floorPlanGeometry.ts`** — `projectItems(items)`: the *only* place `FurnitureItem` → on-screen rectangle conversion happens (`toBounds()` from the engine, expressed in cm with a top-left origin). Both the live plan (`CondoFloorPlan`) and the PDF (`pdfReport.ts`) draw from this one function — "a duplicate copy drifted once already," per its own docstring, so this was deliberately centralized.

3. **`components/floorPlanDrag.ts`** — the drag physics: `clampToUnit`, `snapFree` (free-movement snapping to walls/room-edges/neighbors, with alignment guides), `edgeGaps` (live gap readouts), `overlappingItemIds`, `roomIdForItem` (automatic room re-homing on drop), `canPlace`, plus the PlanSandbox-only `isFeasible`/`snapCm`/`withMovedItem`/`withRotatedItem` (grid-snap model, different UX from the free-drag one). `UNIT_WIDTH_CM = 510`, `UNIT_HEIGHT_CM = 880` live here.

4. **`components/CondoFloorPlan.tsx`** — the actual SVG renderer + interaction handler for `WorkspaceScreen`. In render order:
   - Outer unit boundary rect.
   - **Dimension callouts** — overall width/height (cm + ft), pulled from `UNIT_WIDTH_CM`/`UNIT_HEIGHT_CM`, never hand-typed.
   - **Room zones** — each room's fill/label. Living/Dining (the only rooms clearance rules can ever fire in, since only sofa/coffee_table/tv_stand/dining_table/dining_chair trigger any rule, and `allowedCategories` restricts those to just those two rooms) render at full color weight; the other 6 render muted (`roomFillOpacityActive`/`roomFillOpacityMuted` tokens) — decorative only, **not** a placement restriction; every room stays exactly as draggable/droppable as before.
   - **Wayfinding grid** (`components/gridOverlay.ts`) — a lettered-row/numbered-column reference grid (A1, B7, ...) spanning the *whole* unit as one grid (not one per room — since the 8 rooms tile with zero gaps, a unit-wide grid naturally reads as "inside" whichever room, and gives every cell a genuinely unique label). Cell size (~60cm target) is computed from real unit dimensions. Pure decoration: `pointer-events: none`, renders behind furniture.
   - **Alignment guides**, **furniture items** (with the click-vs-drag threshold — see below — and circular-shape rendering via `<circle>` vs `<rect>`), **live gap-readout badges**.
   - A corner minimap when a room is zoomed into.

### Walkthrough: how a typed cm value becomes a rendered rectangle

This crosses `FurnitureInputScreen`, the engine, and the plan stack above, so it's worth tracing end to end — there are two different units in play (cm and metres) and the boundary between them is easy to lose track of.

1. **Declaring the piece (`FurnitureInputScreen.tsx`).** The length/width/height fields are plain digit-only text inputs — whatever the resident types is centimetres, stored as-is (`toPositiveInteger(lengthCm)` etc., no scaling). The alternative to typing is AR-measuring it: `ARMeasureSession`'s `onMeasured` callback hands back `floorCm()`'s result — a Three.js/WebXR distance, which is natively in **metres**, multiplied by 100 right there to produce the centimetre value that lands in the same text field. Either way, by the time `handleAddItem()` runs, `lengthCm`/`widthCm`/`heightCm` are plain centimetre integers. Round shapes get one extra step: a single diameter tap/entry writes the *same* value to both `lengthCm` and `widthCm` — a circle's bounding square. The new `FurnitureItem` is pushed to `furnitureStore` with `posX: 0, posZ: 0, rotationY: 0` — declared, but not yet positioned (`isPositioned()` elsewhere checks exactly this: `posX !== 0 || posZ !== 0`).

2. **Getting a position.** This happens later and separately from dimensions, and — this is the detail that trips people up — **position is stored in metres, not centimetres.** Either `PositionMapScreen` writes a calibrated AR-space point (§7), or dragging on the 2D plan itself writes one via `floorPlanDrag.ts`'s `withMovedItem`/`snapFree` (also metres, converted from screen pixels via the SVG's `getScreenCTM()`). So a finished `FurnitureItem` always has `lengthCm`/`widthCm`/`heightCm` in cm sitting right next to `posX`/`posZ` in metres — two different units on the same object, by design, not an inconsistency.

3. **The engine's bounding box — `toBounds(item)` in `engine/clearance.ts`.** This is where the two units actually meet. It converts the cm dimensions to metres (`effectiveLengthCm(item) / 100`, `effectiveWidthCm(item) / 100` — these also account for rotation, so a piece turned 45° gets a correctly larger axis-aligned envelope, never under-reported) and combines that with the already-metric `posX`/`posZ` to produce `{ minX, maxX, minZ, maxZ }`, all in metres. `runClearanceAnalysis` measures every rule against these same metre-based bounds.

4. **Back to cm for drawing — `projectItems()` in `components/floorPlanGeometry.ts`.** Takes that same `toBounds()` result and multiplies everything by 100 to get a `PlanRect` in centimetres (`xCm`, `yCm`, `wCm`, `hCm`). This is the *only* place that conversion happens for rendering purposes, and it calls the identical `toBounds()` the clearance engine just used — so the rectangle drawn on screen and the rectangle the rules were checked against are provably the same shape, never two independently-computed versions that could drift apart.

5. **Rendering — `CondoFloorPlan.tsx`.** The SVG's `viewBox` is itself defined in centimetres (`UNIT_WIDTH_CM = 510`, `UNIT_HEIGHT_CM = 880`, and every `CONDO_ROOMS` rectangle, all in cm) — so **1 SVG unit is 1 real-world centimetre.** The `PlanRect`'s `xCm`/`yCm`/`wCm`/`hCm` values get used directly as the `<rect>`'s `x`/`y`/`width`/`height` attributes, no further scaling math needed anywhere in the component — the browser's own SVG viewBox-to-pixel scaling handles fitting that to the screen. This is why a 180cm sofa reliably looks twice as long as a 90cm side table on the plan: both are the same real centimetre value, in the same centimetre coordinate space, the whole way through. (Round items take one extra branch here: `shape === 'round'` draws an SVG `<circle>` using the `PlanRect`'s width as the diameter, instead of a `<rect>`.)

Two specific fixes landed here this session, both verified with real interaction traces rather than just visually:
   - **Click no longer moves furniture.** `handlePointerDown` used to commit a position on every pointer event with no minimum-movement gate. Now gated on a real 5px `DRAG_THRESHOLD_PX` — a click that never crosses it does nothing to the view, undo history, or position.
   - **The plan frame no longer jumps size when zooming in/out of a room.** The `<svg>` was sized `width:auto;height:auto` off its *own current* viewBox aspect ratio, which differs per room — so the element's own on-screen box (not just its content) was resizing on every zoom transition. Fixed with a CSS `aspect-ratio` locked to the full-unit shape, always; `preserveAspectRatio`'s default now just letterboxes whichever room is active inside that permanently fixed frame.

## 7. The AR subsystem (`src/ar/`)

- **`ARMeasureSession.tsx`** — the shared point-to-point measuring primitive: reticle + hit-test, tap twice, get a distance in cm (`floorCm()`). Used by `FurnitureInputScreen` both for measuring rectangular dimensions and (reused unchanged) for a round item's single diameter tap.
- **`shapeLibrary.ts`** — `createFurnitureShape(shape, dims)` — builds the actual Three.js geometry + bounding box for a furniture item's 3D mesh, used by every AR placement/preview scene.
- **`calibration.ts`** (new) — the AR-to-2D-plan coordinate fix. A WebXR session's hit-test coordinates have no inherent relationship to the 2D plan's fixed frame (northwest corner = origin, +X east, +Z south) — nothing bridges them by default. `PositionMapScreen` now runs a two-tap calibration once per fresh AR session (tap the real northwest corner, then a point along the north wall) before allowing any placement; `deriveCalibration()` computes a rotation+translation transform from those two points, `applyCalibration()`/`invertCalibration()` convert between AR-local and plan-frame coordinates. Every `posX`/`posZ` written from AR placement now passes through this — what's stored is already plan-frame, not raw AR-session-local. This extends (doesn't replace) an earlier, translation-only version of the same idea that already existed, unused, in the dead `AnalysisScreen.tsx`/`ClearanceOverlay.tsx`.
- **`ClearanceOverlay.tsx`, `CorrectionArrow.tsx`, `overlayRenderer.tsx`** — dead. Used only by (or, in `overlayRenderer.tsx`'s case, imported by *nothing at all*) the orphaned `AnalysisScreen.tsx`.

## 8. Design system

**`components/designTokens.ts`** is the single canonical source for color, type scale, and typeface — every live screen reads from here, not hardcoded hex. Key exports: `color` (neutrals, brand navy, accent blue, the three severity hues — red/amber/green, contrast-checked ≥4.5:1 and colorblind-mitigated via shape+word+position, never color alone), `type` (display/title/body/label, native system font stack), `numeric` (tabular-nums for live measurements), `space`/`radius`, `planMark` (SVG mark treatments).

**Typeface:** the native OS UI font stack (`-apple-system`/`Segoe UI`/`Roboto`/...) — deliberately *not* a webfont, because this app is used one-handed on a resident's own wifi and a network font dependency risks a flash of unstyled text. The one exception: the `EntryScreen` "Habi3D" wordmark adds `ui-rounded` as a first preference for a bit more character where the OS supports it, still with zero network risk.

**`index.css`'s `:root` custom properties are a byte-for-byte mirror of `designTokens.ts`** — necessary because plain className-based screens need real CSS variables and `pdfReport.ts` (jsPDF) needs concrete hex at generation time; neither can resolve a shared `.ts` import. The two are kept in sync by hand, documented at the top of both files.

**`App.css`** holds component-level styles (`.card`, `.btn`, `.screen`, per-screen classes like `.entry-*`). `condoLayout.ts`'s per-room `bgColor`/`textColor` deliberately stay as their own data source, not migrated into `designTokens.ts` — a considered call, not an oversight.

## 9. Auth & Supabase backend

**No Supabase Auth.** Auth is a plain `users` table (`id`, `username`, `password_hash`, `created_at`). Password hashing/verification happens *inside Postgres* via `pgcrypto` (bcrypt/Blowfish), called through two `SECURITY DEFINER` RPC functions (`create_user`, `verify_login`) — the client (`supabase.ts`'s `createAccount`/`logIn`) never sees a password hash. This was a deliberate rebuild away from Supabase Auth specifically to avoid a synthetic-email pattern; before that, an even older hand-rolled `users` table (SHA-256 hashing) existed and was fully replaced.

`login` never reveals whether a username exists — `verify_login` returns `null` uniformly on any failure, with a dummy `crypt()` call on a miss so timing doesn't leak it either. No password reset flow — a stated, known limitation for this tester group.

**`saved_sessions`** — one row per account, upserted (not appended), autosaved 1.5s after any layout change. Its exact DDL + RLS policies are documented in `CODEBASE_STATUS.md`; whether it's actually been run against the live Supabase project is unconfirmed from this environment (no DB execution access here).

Legacy/unused Supabase tables from an earlier survey-based version of this thesis: `participants`, `pre_survey_responses`, `sus_responses`, `post_survey_responses`. `space_utilization_scores` is confirmed empty — no write path was ever built for it.

## 10. The PDF report (`components/pdfReport.ts`)

Client-side only (jsPDF, no server call). Multi-page, with real pagination (`ensureSpace()`/`addContinuationPage()` — added fresh, no precedent existed anywhere in this codebase before). Page 1: header, a to-scale drawn floor-plan snapshot (same `projectItems()` source as the live plan — never a screenshot), a per-item summary list. Page 2+: a full rule-by-rule breakdown of all 10 rules that applied to the layout — **cleared (GREEN) checks included, not only violations** — using `allClassifications` from `runClearanceAnalysis`, which was being computed all along but previously discarded after one screen's local `useMemo`.

`DownloadReportButton.tsx` is the shared idle→working→success/error UI wrapping it, used from `ReportScreen` (live) and, independently, twice from the dead `RecommendationScreen`.

## 11. Everything else worth knowing

- **`data/roomData.ts`** — `MULBERRY_PLACE_2BR`, the one fixed unit config (living 600×500cm, dining 500×390cm — researcher estimates). `sessionStore.startNewSession()` reads this directly; there's no unit picker.
- **`types/index.ts`** — every shared TypeScript type: `ScreenName`, `FurnitureShape`/`FurnitureCategory`, `FurnitureItem`, `RoomDimensions`, `ClearanceRule`, `Violation`.
- **`components/statusVocabulary.ts`** — the app's one human vocabulary for severity: `comfortable`/`tight`/`needs-attention` (never "RED/YELLOW/L3" shown to a resident), mapping to the same color tokens everywhere.
- **`components/StatusRow.tsx`** / **`ClearanceMeter.tsx`** — the two shared "show one finding" UI pieces. `StatusRow` = icon + plain-language line + measurement. `ClearanceMeter` = the banded visual meter, colorblind-safe via shape+word+position.
- **`components/previewMove.ts`** — `computeMove`/`commitLines`, sentence-building for "move this piece 41cm toward the south wall" style instructions. Used by the dead `RecommendationScreen` only.
- **`utils/floorPlan.ts`** — a `<canvas>`-based (not SVG) floor-plan renderer, `drawFloorPlan()`. Confirmed via grep: **zero import sites anywhere in `src/`.** Fully dead code, not even wired to the other dead screens.
- **`components/ErrorBoundary.tsx`** — wraps the whole app in `main.tsx`. Deliberately does *not* pull from `designTokens.ts` for its colors (only the typeface) — it's the crash fallback, and staying decoupled from the rest of the token system is the correct isolation for a component whose job is rendering when something else may be broken.

## 12. Known issues / not yet done

- `saved_sessions` table/RLS existence unconfirmed in the live Supabase project.
- `saved_sessions` RLS trusts any request bearing the correct `user_id` (an unguessable UUID never shown in the UI) — a stated, not-silent tradeoff; a real session-token gate would be the tighter version.
- No password reset flow.
- `planeDetection: true` still set in `FurnitureInputScreen.tsx`'s `createXRStore` — a live WebXR compatibility risk on some Android/ARCore devices, not yet removed.
- `space_utilization_scores` table has no write path.
- `isFeasible()` (`floorPlanDrag.ts`) duplicates `findLayoutViolation()` (`engine/clearance.ts`) almost line-for-line, including a separately-hardcoded epsilon tolerance in four different places. Currently harmless (all four agree), but a real drift risk if any is ever tuned without the others.
- `RecommendationScreen`/`PlanSandbox` (and the whole dead-code cluster: `AnalysisScreen`, `ARDemoScreen`, `ClearanceOverlay`, `CorrectionArrow`, `overlayRenderer`, `FloorPlan2D`, `utils/floorPlan.ts`) remain unresolved — kept, not deleted, pending a decision (see the audit doc).
- AR coordinate drift *across* sessions is now addressed by calibration (§7) within a session, but requires re-calibrating every time AR is re-entered after an exit — by design, not yet automated further.
