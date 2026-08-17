# Recent Changes

**Covers:** everything since `CODEBASE_STATUS.md`'s last full snapshot (Round 8, comprehensive PDF report). For the full project history and current architecture, see `CODEBASE_STATUS.md`; for the detailed WorkspaceScreen-vs-RecommendationScreen findings below, see `WORKSPACE_VS_RECOMMENDATION_AUDIT.md`.

---

## 1. 2D floor plan — click no longer moves furniture

**File:** `src/components/CondoFloorPlan.tsx`

A plain click on a furniture piece was jittering its position by a few cm. Root cause: `handlePointerDown` fired `onDragStart`/committed a position on every pointer event, with no minimum-movement gate — a `moved` flag existed but was never actually checked. Fixed with a real 5px drag threshold (`DRAG_THRESHOLD_PX`): a click that never travels that far now does nothing to the view, undo history, or furniture position. Real drags are unaffected.

## 2. AR placement now writes 2D-plan-frame coordinates, via a two-tap calibration step

**Files:** `src/ar/calibration.ts` (new), `src/screens/PositionMapScreen.tsx`

Investigated and confirmed earlier: AR hit-test coordinates and the 2D plan's fixed frame (unit's northwest corner, X→east, Z→south) had no relationship — not "drift," no alignment ever existed. Fixed by adding a calibration step at the start of each fresh AR session in Position Map:
1. Tap the unit's northwest corner (the plan's origin).
2. Tap a second point along the north wall (establishes heading/rotation).

From those two points, `calibration.ts` derives a translation + rotation transform (extends the existing dead-code `calibrationOffset` idea from `AnalysisScreen.tsx`, which only ever handled translation). Every `posX`/`posZ` written from AR placement is now passed through this transform before it reaches `furnitureStore` — so what's stored is already in the plan's frame, not raw AR-session-local coordinates. Calibration is required again if the AR session restarts.

## 3. WorkspaceScreen vs. RecommendationScreen — architecture audit

**File:** `WORKSPACE_VS_RECOMMENDATION_AUDIT.md` (new)

A report-only audit (no code changes) comparing the live `WorkspaceScreen`/`CondoFloorPlan` against the orphaned `RecommendationScreen`/`PlanSandbox`. Confirmed `RecommendationScreen` is unreachable through any route in `App.tsx`. Full feature-by-feature diff table, a genuine code-duplication finding (`isFeasible()` in `floorPlanDrag.ts` reimplements `findLayoutViolation()` in `engine/clearance.ts` almost line-for-line), and port-cost estimates for keeping either screen and deleting the other. No recommendation made — flagged as a decision for the project owner.

## 4. Floor plan gets a wayfinding grid, room color coding, and dimension callouts

**Files:** `src/components/gridOverlay.ts` (new), `src/components/CondoFloorPlan.tsx`, `src/components/designTokens.ts`

- A lettered-row/numbered-column reference grid (A1, B7, ...) now overlays the whole unit — one grid spanning all 8 rooms (they tile with zero gaps, so every cell gets a genuinely unique label), computed from real unit dimensions, not hardcoded. Purely decorative: `pointer-events: none`, renders behind furniture.
- Living/Dining (the only rooms clearance rules can ever apply to, via `RoomZone.allowedCategories`) render at full color weight; the other 6 rooms (bedrooms, CR, kitchen, balcony, storage) render muted. New `roomFillOpacityActive`/`roomFillOpacityMuted` tokens in `designTokens.ts`. Explicitly decorative only — no placement restrictions were added; every room remains exactly as draggable/droppable as before.
- Overall unit width/height dimension callouts (cm + ft) added along the plan's outer edge, pulled from real `UNIT_WIDTH_CM`/`UNIT_HEIGHT_CM`.
- Known, stated simplification: the real hallway notch between Bedroom 1/2 isn't modeled in `CONDO_ROOMS` (they're plain abutting rectangles) and wasn't added here — out of scope, not silently faked.

## 5. Landing page redesign

**Files:** `src/screens/EntryScreen.tsx`, `src/App.css`

- Removed the house-icon logo mark.
- "Habi3D" is now the sole focal point: much larger, bold, tight tracking, a white-to-light-blue gradient text fill.
- Full-bleed navy radial-gradient background (reuses the existing `--primary`/`--primary-light`/`--primary-dark` brand tokens, not new colors).
- The action card got a frosted-glass treatment (translucent + blur) to sit cleanly on the new background.
- Kept the existing system font stack app-wide (no CDN/webfont dependency); added `ui-rounded` as a first preference just for the wordmark for a bit more character where the OS supports it.

## 6. Floor plan no longer jumps size when zooming in/out of a room

**File:** `src/components/CondoFloorPlan.tsx`

The `<svg>` was sized `width: auto; height: auto` off its own viewBox aspect ratio — since each room has a different shape than the full unit, the element's own on-screen box (not just its content) was resizing and re-centering on every zoom transition, on top of the intended pan/zoom animation. Fixed by locking the SVG to a fixed `aspect-ratio` matching the full zoomed-out view, always; `preserveAspectRatio`'s default now just letterboxes whichever room is active inside that fixed frame. Verified: the element's pixel bounding box is now byte-identical zoomed out → zoomed into a room → zoomed back out.

## 7. Removed the walkway corridor overlay (the orange dashed rectangles)

**Files:** `src/components/CondoFloorPlan.tsx`, `src/screens/WorkspaceScreen.tsx`

The unlabeled dashed rectangles scattered across the plan were the 5 walkway-corridor zones, color-coded by clearance status — confusing with no legend. Removed that visual layer entirely. The underlying walkway-tracking feature is untouched and still surfaced clearly elsewhere: the "N Walkways Blocked" pill, and a proper labeled "Walkway Access" list (name, measured cm, Blocked/Tight/Clear badge) in the side drawer.

---

## Verification status

Every change above was checked with `tsc -b --force` (clean) and `eslint .` (clean except the same 2 pre-existing, intentionally-left `WorkspaceScreen.tsx` warnings that predate all of this work) at the time it landed. Several were also verified with a real headless-browser trace (Playwright) rather than just a visual read — notably #1 (click vs. drag), #2 (calibration math, numeric before/after), and #6 (zoom frame stability, pixel-identical bounding box across a zoom in/out cycle).
