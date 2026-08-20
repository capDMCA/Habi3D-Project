# Habi3D — Methodology & Features

**Status:** Living document, grounded in the codebase as of 2026-08-21 (commit `ea6a6dd` + the in-progress UI polish pass on top of it). Every claim below was checked against the actual source file it describes, not written from memory or from the app's original design intent — this project has repeatedly found that assumed and real behavior diverge, so this document treats that as the default risk, not the exception.

---

## 1. Overview

Habi3D is a decision-support tool for residents of a specific real condominium unit — Mulberry Place, Bengaline, Acacia Estates, Taguig City — to check whether their living/dining furniture layout meets recognized interior-design clearance standards, and to see, in priority order, what to adjust and by how much. A resident declares their furniture (by category, shape, and dimensions — typed or AR-measured), places it either by dragging it on a 2D floor plan or by tapping its real position in AR, and the app runs it against 10 clearance rules drawn from *Time-Saver Standards for Interior Design* (DeChiara, Panero & Zelnik, 2001). The app never moves furniture on the resident's behalf — it surfaces what's tight, ranks it by how much it matters, and lets the resident decide.

**Scope:** one fixed unit configuration only — a 2-bedroom Mulberry Place unit, living area 600×500cm and dining area 500×390cm (researcher estimates, `src/data/roomData.ts`). There is no unit picker; every session starts from this same fixed geometry. The clearance rules and the app's interaction model only ever concern the living and dining areas — the other rooms in the unit (bedrooms, kitchen, bathroom, balcony, storage) exist on the 2D plan as placement zones with their own category restrictions, but no clearance rule ever fires inside them.

---

## 2. System Architecture

### The 6 live screens and the real navigation flow

Verified directly against `App.tsx`'s routing switch and every `navigateTo(...)` call site in `src/screens/` (not from an earlier design doc):

```
EntryScreen ──Begin Session──────────────────────────► FurnitureInputScreen
     │
     ├──Create account──► AuthScreen (signup) ────────► FurnitureInputScreen
     │
     └──Log in──────────► AuthScreen (login)
                                │
                                ├─ no saved layout ────► FurnitureInputScreen
                                └─ saved layout found ─► WorkspaceScreen (resumed)

FurnitureInputScreen ──Done Adding Furniture──────────► PositionMapScreen

PositionMapScreen ──Analyse layout────────────────────► WorkspaceScreen

WorkspaceScreen ──Done────────────────────────────────► ReportScreen

ReportScreen ──Finish and Exit────────────────────────► EntryScreen (session ends)
             ──Back to Layout Workspace───────────────► WorkspaceScreen
```

Two screens that appear in `App.tsx`'s switch statement as string cases — `'analysis'` and `'recommendations'`, plus a third alias `'recommendation'` that nothing ever actually navigates to — all render the same `WorkspaceScreen` component. There is no separate analysis screen or recommendation screen in the live app; both names are historical routing aliases into one screen.

**Screens that exist in the source tree but are not reachable through any live route:** `AnalysisScreen.tsx`, `RecommendationScreen.tsx` (and its `PlanSandbox.tsx`/`FloorPlan2D.tsx` support components), `ar/ClearanceOverlay.tsx`, `ar/CorrectionArrow.tsx`, `ar/overlayRenderer.tsx`, `components/previewMove.ts`, `utils/floorPlan.ts`. These represent earlier iterations of the recommendation flow, kept in the repo but confirmed (by import-graph analysis) to have zero path into the current app. They are not described anywhere below as live features.

### Stack

- **Frontend:** React 19 + TypeScript, built with Vite.
- **State:** Zustand — three stores (`sessionStore`, `furnitureStore`, `violationStore`) plus one non-store hook (`useAutosaveLayout`).
- **3D / AR:** `@react-three/fiber` (React renderer for Three.js) + `@react-three/xr` (WebXR sessions) are live and used throughout the AR screens. `@react-three/drei` is a real dependency but, as of this document, its only importers (`Text`, for floating AR labels) are the two dead AR overlay files above — the live AR label in `PositionMapScreen.tsx` builds its own canvas-texture sprite (`makeLabelTexture`) instead of using drei.
- **Backend:** Supabase — Postgres + Auth only. No custom server, no API routes; the client talks to Supabase directly via `@supabase/supabase-js`.
- **PDF:** `jsPDF`, entirely client-side.
- **Deployment:** Vercel (WebXR requires HTTPS, so AR features only work over a deployed HTTPS URL or a properly certificated local tunnel — not plain `localhost` over HTTP on a physical device).

### What runs where

Everything except two Supabase calls runs entirely client-side: furniture declaration, AR measuring, AR placement, the clearance engine, the 2D drag interaction, and PDF generation never touch a server. The two exceptions are authentication (`supabase.auth.signUp`/`signInWithPassword`) and the `saved_sessions` autosave/resume read-write pair. There is no application backend beyond Supabase's own Postgres + Auth services.

---

## 3. The Clearance Engine

### The 10 rules, quoted directly from `src/engine/rules.ts`

Source cited in the file itself: *Time-Saver Standards for Interior Design* (DeChiara, Panero & Zelnik, 2001), pp. 61–90, imperial values converted to metric. Classification: **RED** below `violationThresholdCm` (a functional violation), **YELLOW** between the two thresholds (a warning — usable but not comfortable), **GREEN** at or above `warningThresholdCm`.

| ID | Name | RED below | YELLOW below | Description (from source) |
|---|---|---|---|---|
| L1 | General Circulation | 60cm | 91cm | General circulation clearance in the combined living/dining area |
| L2 | Sofa / Coffee Table | 35cm | 45cm | Sofa or coffee table clearance for legroom and use |
| L3 | Secondary Circulation | 61cm | 76cm | Secondary circulation path between furniture pieces |
| L4 | Main Traffic Path | 76cm | 91cm | Main traffic path toward kitchen path |
| L5 | Conversation Area | 244cm | 300cm | Conversation area depth for sofa grouping. Shortfall is measured against 244cm minimum; affected edge is the sofa face width. |
| D1 | Table to Wall | 76cm | 91cm | Minimum dining clearance from table edge to wall |
| D2 | Chair Pull-out + Access | 81cm | 97cm | Space needed to pull out a dining chair and access the seat |
| D3 | Passage Behind Seated | 91cm | 107cm | Clearance to pass behind a seated person at the dining table |
| D4 | Walking Past Seated | 97cm | 112cm | Clearance to walk past a seated person at the dining area |
| D5 | Minimum Passage | 61cm | 76cm | Minimum passage width in tight spaces between dining furniture and walls |

### Which rules fire on which items

`runClearanceAnalysis()` (`clearance.ts`) checks every pairwise combination of furniture, plus every item against the nearest wall. Two rules — **L1 and L3** — run unconditionally on *every* item pair and every item-to-wall gap in the layout, with no category filter. The remaining pairwise rules are conditional:

- **L2** additionally fires on sofa↔coffee_table pairs specifically (`pairAppliesToL2`).
- **D4** fires when one side of the pair is a dining chair and the other is not a dining table/chair (`pairAppliesToD4`).
- **D5** fires whenever either side of a pair is a dining table or dining chair (`pairAppliesToD5`).
- **D1**/**D2**/**D3**/**L4**/**L5** are wall-facing checks gated by category (dining table → D1; dining chair → D2 and D3; sofa → L5 against whichever wall it faces; L4 always applies to whichever single item in the layout has the single largest wall gap).

**This means a sofa-to-coffee-table gap is evaluated by three separate rules at once — L1, L2, and L3 — against the same physical measurement**, each with its own threshold and its own entry in the violations list. This has been reviewed with adviser input and is treated as an intentional design decision, not a bug: L1 and L3 are general circulation/secondary-path standards that apply everywhere by definition, and L2 is a distinct, stricter legroom standard that layers on top for that specific furniture relationship — three genuinely different requirements can legitimately apply to one gap. This is documented here for transparency, not as an open defect.

### Priority Score

The formula actually used, from `computePriorityScore()` in `rules.ts`, called by `clearance.ts`'s `makeViolation()`:

```
Priority Score = VSW × Shortfall(cm) × Affected Edge Length(cm)

VSW (Violation Severity Weight):
  RED    → 3
  YELLOW → 1
  GREEN  → not scored, no violation recorded

Shortfall = Required Threshold − Measured Clearance (never negative)
Affected Edge Length = the length of the furniture edge facing the gap
```

Violations are sorted by descending Priority Score, so the resident always sees the most spatially significant problem first.

**Note on dead code in this file:** `rules.ts` also defines `calculateSpatialImpact()` and `calculatePriorityScore()` (lowercase `'red'|'yellow'` signature) — these have zero callers anywhere in the codebase and are not the formula actually used. They appear to be an earlier iteration left in place. Do not cite them as the live formula.

### Rotation handling

`toBounds()` in `clearance.ts` computes each item's axis-aligned bounding envelope via `effectiveLengthCm()`/`effectiveWidthCm()`:

```ts
effectiveLengthCm = lengthCm × |cos(rotationY)| + widthCm × |sin(rotationY)|
effectiveWidthCm  = lengthCm × |sin(rotationY)| + widthCm × |cos(rotationY)|
```

This is a **conservative axis-aligned envelope**, not a true rotated-rectangle intersection test. At any non-cardinal angle (not 0°/90°/180°/270°), it over-estimates the item's occupied footprint — so a rotated item's clearance is always reported *equal to or tighter than* reality, never more generous. This is a deliberate, stated trade-off (a "safe direction" approximation, per the function's own doc comment): the engine will never tell a resident a rotated piece has more room than it actually does, but it may occasionally report a tighter reading than a true rotated-geometry check would. At rotationY = 0 (the common case — most furniture in this app is placed axis-aligned), the formulas reduce exactly to `lengthCm`/`widthCm` with zero error.

### The layout-validity guard — what's actually live here

`clearance.ts` does define a pure predicate, `findLayoutViolation(bounds, roomWidthM, roomLengthM)`, that returns the first out-of-bounds or overlapping item it finds. **As of this document, `findLayoutViolation` has zero live callers anywhere in the codebase** — it exists but is not currently wired into any reachable code path (confirmed by direct grep). `runClearanceAnalysis()` — the function that actually powers the live app — deliberately does **not** call it, and says why in its own comment: AR-placed furniture carries coordinates relative to whatever origin that AR session happened to start at, not normalized into `[0, roomWidth]`, so it routinely reads as "out of bounds" by this predicate's standard on entirely ordinary layouts. Throwing or rejecting there would crash the workspace on real data. The clearance engine has no reject path at all — it always runs every rule and reports what it finds; it never refuses to analyze a layout.

The **real, live guard against invalid placement** is separate and lives in `components/floorPlanDrag.ts`: `overlappingItemIds()` and `canPlace()`, which `WorkspaceScreen`'s drag handlers call on every drop to detect a genuine footprint overlap (with a 1cm tolerance so touching edges don't false-positive) and, if found, revert the piece to its last clear position rather than let the drop commit. This is what actually prevents two pieces from landing on top of each other in the 2D workspace — not `findLayoutViolation`.

### Circular furniture

A round item's single AR-measured or typed "diameter" value is written to **both** `lengthCm` and `widthCm` (`FurnitureInputScreen.tsx`'s `handleMeasured`). Because `toBounds()` has no shape-awareness at all — it only ever reads `lengthCm`/`widthCm` — a round item's clearance footprint is a bounding **square** whose side equals the diameter, not a true circular clearance zone. It renders as a circle on the 2D plan (`CondoFloorPlan.tsx` draws an SVG `<circle>` when `shape === 'round'`) and as a cylinder in the AR 3D preview (`shapeLibrary.ts`'s `createRoundGeometry`), but the clearance math underneath is always the same rectangular-bounds logic every other shape uses.

---

## 4. AR Features

### Measurement — `ARMeasureSession.tsx`

A shared two-tap measuring primitive, reused for both rectangular length/width and a round item's single diameter tap. Uses the WebXR hit-test API directly (not the `@react-three/xr` `useXRHitTest` wrapper, per the component's own comment, because that wrapper had timing failures for this pattern). Shows a live reticle on the detected floor, a first-tap marker, a live measuring line with a running distance readout, then hands back a rounded centimetre distance (`floorCm()` — Euclidean distance in the XZ floor plane) after the second tap.

### Placement — `PositionMapScreen.tsx`

Opens a WebXR session per unplaced furniture item, shows a ghost mesh following the floor hit-test cursor, lets the resident tap to lock a position and drag a rotation slider (0-360°) to orient it, then confirm. Already-placed items render in the same live AR view (converted through calibration — see below) so the resident can see prior placements while positioning the next one.

### Two-point calibration — `ar/calibration.ts`

**What it solves:** a WebXR session's hit-test coordinates have no inherent relationship to the 2D plan's fixed frame (origin at the unit's northwest corner, +X east, +Z south). Each fresh AR session establishes its own arbitrary origin and heading. Without correction, furniture placed in AR would land at effectively random coordinates on the 2D plan.

**The math:** two taps — the plan's known origin (northwest corner) and any point at least `MIN_REFERENCE_DISTANCE_M = 1.0`m further along the north wall — derive a rigid transform (rotation + translation, no scale, since both frames already use real-world metres):

```ts
// Heading: the AR-space vector corner→alongNorthWall represents the
// plan's +X (east) direction as observed in this session's frame.
theta = -atan2(dz, dx)   // dx, dz = alongNorthWall − corner, in AR-space

applyCalibration(point, t):   // AR-local → plan frame (the write path)
  dx = point.x − t.originX;  dz = point.z − t.originZ
  x' = dx·cosθ − dz·sinθ
  z' = dx·sinθ + dz·cosθ

invertCalibration(point, t):  // plan frame → AR-local (the read path,
                               // for rendering prior placements)
```

Every placement is passed through `applyCalibration` before it ever reaches `furnitureStore` — what's stored is always plan-frame, never a raw AR-session-local coordinate. Two points closer than 1.0m are rejected (`deriveCalibration` returns `null`) because a small tap-precision error over a short baseline swings the derived heading unreliably.

Calibration includes a full retry path: the wall-tap can be re-tapped before it commits, and a "Recalibrate" control is available throughout placement to redo the whole two-tap sequence — but recalibrating does **not** retroactively re-map already-placed items' stored positions; they keep their old plan-frame coordinates and may need to be re-placed by hand if the new calibration differs meaningfully from the old one. The app shows an explicit inline warning to this effect before letting a resident recalibrate once anything is already placed.

**Known limitations, stated plainly, not softened:**
- Calibration is per-session — every fresh `enterAR()` call starts a new WebXR world origin, so the two-tap calibration must be repeated each time AR is re-entered after an exit.
- Real-device tap accuracy is unverified. The math has been checked with pure-function unit assertions and, separately, with seeded-state / synthetic-event traces run in a headless browser (no real hardware, no real WebXR session) — never with an actual finger tapping an actual phone screen pointed at an actual room.
- Recalibrating mid-session does not correct already-placed items, as stated above.

**AR features have not yet been verified on real hardware as of this document.** Every AR-related claim above and elsewhere in this project's development history has been checked via mathematical proof of the transform logic and via headless-browser traces that seed component state directly and dispatch synthetic events — because no WebXR-capable device has been available in this project's development environment. Android Chrome + ARCore is the intended and only supported runtime (iOS Safari does not support WebXR `immersive-ar` sessions at all). A real device test is a prerequisite before treating any AR feature as production-verified, not merely a nice-to-have follow-up.

---

## 5. The Interactive 2D Workspace

`WorkspaceScreen.tsx` + `CondoFloorPlan.tsx` + `components/floorPlanDrag.ts` — where nearly all layout adjustment actually happens day to day (AR placement establishes a starting position; this is where a resident refines it).

- **Free-drag across the whole unit** — furniture is not caged inside its assigned room; the only hard boundary is the unit's outer wall (`clampToUnit`). Room membership is derived automatically from wherever a piece is dropped (`roomIdForItem`, by largest footprint overlap with any of the 8 `CONDO_ROOMS` zones), not fixed at declaration time.
- **Snapping, precisely:** the primary behavior is snapping to the nearest wall, room edge, or neighboring furniture edge/centre-line within an 8cm threshold (`snapFree`). A plain 5cm floor grid (`GRID_CM = 5`, `snapCm()`) is only the fallback when nothing else is within range — it is not the primary or only snap behavior.
- **Category restrictions per room:** each of the 8 rooms (`condoLayout.ts`'s `CONDO_ROOMS`) declares an `allowedCategories` list — e.g. the kitchen only accepts `cabinet`/`other`, the dining area only `dining_table`/`dining_chair`/`other`. This is enforced entirely by the UI/drag layer, described in the next point.
- **Live clearance feedback loop:** every drag release calls `commitLayout()`, which writes the new position to `furnitureStore` and immediately re-runs `runClearanceAnalysis()` on the full committed layout — the violations list, priority ranking, and every RED/YELLOW/GREEN badge on screen update on every single committed move, not on a separate "analyze" step.

**Documented limitation, not glossed over: the clearance engine itself has zero spatial room-awareness.** `runClearanceAnalysis()` never references `CONDO_ROOMS`, room IDs, or room boundaries anywhere in `clearance.ts` — confirmed by direct inspection, not inferred. It only knows an item's raw `posX`/`posZ` and its `category` (which determines which rules can even apply to it). The 8-room model, `allowedCategories`, and automatic room re-homing are a presentation/interaction-layer concept implemented entirely in `condoLayout.ts` and `floorPlanDrag.ts` — a piece placed anywhere in the unit gets the same clearance analysis regardless of which visual "room" it's sitting in. Room restriction is a UI convention (what a resident is allowed to drop where), not something the clearance math itself checks or enforces.

---

## 6. Decision Support Framing

Habi3D is deliberately decision support, not prescriptive automation. The app never places or moves furniture on the resident's behalf — every position, every rotation, every accepted "this is tight but I'm keeping it here" is a choice the resident makes by hand. The clearance engine's role is to measure and rank, never to act.

This shows up concretely in the completion-state design (`ReportScreen.tsx`, `violationStore.ts`): the session-end headline is built from a real before/after diff — `"You made N spots more comfortable"` — never a percentage, score, or letter grade. `initialFindingKeys` snapshots every finding at the start of a session; `resolvedCount` is how many of those are no longer present at the end. A resident who ends a session with tight spots still remaining sees `"No tight spots were resolved this session"` stated as a plain fact, and a fixed, calm acknowledgement line — `"Some tightness is normal in a real room — you can always come back and keep adjusting."` — appears regardless of outcome. "Tight" is framed as a normal, common condition for a real, small unit, not a failure state the app is grading the resident on.

---

## 7. Authentication & Session Persistence

Auth is real Supabase Auth (`supabase.auth.signUp`/`signInWithPassword`), not a custom table. The app's UI only ever asks for a **username** — no email field is ever shown. `supabase.ts`'s `buildSyntheticEmail()` turns that into `${username}@habi3d.local` under the hood, and the identity the rest of the app actually tracks is Supabase's own returned `user.id` (`auth.uid()`). A username containing `@` is rejected before the synthetic email is ever constructed. This exists to give a small tester group (thesis evaluation participants) a plain username/password experience without building and maintaining a custom auth table + password-hashing scheme by hand — real Supabase Auth already provides that, correctly, for free.

**`saved_sessions`** — one row per account (`user_id references auth.users(id)`, unique), upserted rather than appended, so "resume" always means "my most recent layout." Autosaved 1.5 seconds after any furniture change (`useAutosaveLayout.ts`), a no-op for the anonymous "Begin Session" path (`userId` is null there — nothing is persisted beyond an in-memory session id). RLS is scoped to `auth.uid() = user_id` for `select`/`insert`/`update`, granted to the `authenticated` role only — a request must carry a real session token for that specific user, not merely know the right UUID.

---

## 8. Reporting

The PDF (`components/pdfReport.ts`, generated via `jsPDF`) is built entirely client-side — no server call, no upload. It draws the floor plan from the exact same `projectItems()` geometry function (`floorPlanGeometry.ts`) the live 2D plan uses, so the PDF is never a screenshot and can never visually diverge from what the resident was looking at. Beyond the plan snapshot, it includes a full rule-by-rule breakdown of all 10 rules that applied to the layout — every individual check performed, GREEN (cleared) entries included, not only violations — sourced from `runClearanceAnalysis()`'s `allClassifications` field. Real pagination is implemented (`ensureSpace()`/`addContinuationPage()`), so the report is not capped at one page regardless of layout size.

---

## 9. Known Limitations

Stated plainly, per this project's own standing practice of documenting limitations rather than minimizing them.

1. **L1/L2/L3 rule overlap.** L1 (General Circulation) and L3 (Secondary Circulation) fire unconditionally on every furniture pair; L2 (Sofa/Coffee Table) fires additionally on sofa↔coffee_table pairs specifically. A sofa-coffee_table gap is therefore evaluated by three separate rules against the same physical measurement. **Status: reviewed with adviser input and treated as intentional** — each rule represents a genuinely distinct spatial requirement (general circulation vs. a stricter legroom-specific standard) that can legitimately apply to the same gap simultaneously. Not an open defect.
2. **AR features are unverified on real hardware.** Every AR claim in this document has been checked via math proofs of the coordinate transforms and headless-browser traces with seeded state — never a real device, real WebXR session, or a real finger tapping a real phone in a real room. This is a genuine, current gap, not a formality.
3. **Rotation is a conservative approximation, not exact geometry.** The axis-aligned bounding envelope (`effectiveLengthCm`/`effectiveWidthCm`) over-estimates a rotated item's footprint at non-cardinal angles, so clearance is reported equal to or tighter than reality, never more generous — a deliberate "safe direction" trade-off, not a precision guarantee.
4. **The clearance engine has no spatial room-awareness.** It only sees raw position and category, never which of the 8 visual rooms an item sits in. Room restriction is enforced entirely by the drag/UI layer (`allowedCategories`), not by the clearance math.
5. **Single-unit scope.** Every session uses one fixed geometry — this specific 2BR Mulberry Place unit's estimated living (600×500cm) and dining (500×390cm) dimensions. There is no support for any other unit layout.
6. **Shape support is visual, not clearance-aware, beyond rectangle/round.** Four shapes are selectable and get genuinely distinct 3D geometry for AR/visual purposes (`rectangle`, `l-shape`, `round`, `oval`), but the clearance engine and the 2D plan both treat every shape except `round` as a plain rectangular bounding box, and `round` itself is a bounding *square* (diameter on both axes), not a true circular clearance zone. There is no shape-aware clearance calculation for L-shape or oval furniture.
