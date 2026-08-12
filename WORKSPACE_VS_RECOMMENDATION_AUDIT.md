# WorkspaceScreen/CondoFloorPlan vs. RecommendationScreen/PlanSandbox — Architecture Audit

**Date:** 2026-08-12
**Status:** Report only — no code changes made as part of this audit. This document lays out facts to support a real architectural decision (keep one screen pair, delete the other); it does not make a recommendation.

---

## Task 1 — Which screen is actually live

**`App.tsx`'s exact routing** (full switch statement):
```tsx
switch (currentScreen) {
  case 'entry': return <EntryScreen />;
  case 'auth': return <AuthScreen />;
  case 'arDemo': return <ARDemoScreen />;
  case 'furnitureInput': return <FurnitureInputScreen />;
  case 'positionMap': return <PositionMapScreen />;
  case 'analysis':
  case 'recommendations':
  case 'recommendation':
    return <WorkspaceScreen />;
  case 'report': return <ReportScreen />;
  default: return <PlaceholderScreen screenName={currentScreen} />;
}
```
`RecommendationScreen` is **not imported in `App.tsx` at all**. Every `currentScreen` value that sounds like it should reach it — `'analysis'`, `'recommendations'`, and even `'recommendation'` (singular) — routes to `WorkspaceScreen` instead.

**`sessionStore.ts`'s `navigateTo`** (`src/stores/sessionStore.ts:22`) is `(screen) => set({ currentScreen: screen })` — a direct passthrough, no branching, no special-casing. There is no code path anywhere in `sessionStore.ts` that could route around `App.tsx`'s switch.

**Conclusion: `RecommendationScreen` is fully orphaned** — not reachable through any `currentScreen` value, any button, or any store action in the current build. A real user placing furniture always reaches `WorkspaceScreen`.

---

## Task 2 — Feature-by-feature diff

| Feature | WorkspaceScreen / CondoFloorPlan | PlanSandbox / RecommendationScreen | Shared code or duplicated? |
|---|---|---|---|
| Free-movement drag with room re-homing | Yes — full drag + `roomIdForItem` against all 8 `CONDO_ROOMS` (`CondoFloorPlan.tsx`, `WorkspaceScreen.tsx`) | Partial — drag exists (`withMovedItem`/`isFeasible`/`snapCm`), but **no room re-homing at all**: `PlanSandbox.tsx`/`FloorPlan2D.tsx` never reference `CONDO_ROOMS` or `roomIdForItem` (confirmed via grep — zero hits). It models one undifferentiated rectangular room, not the 8-zone unit | Drag physics shared (`floorPlanDrag.ts`, one file); room re-homing exists only on the WorkspaceScreen side |
| Live gap readouts / clearance meters | Yes — CondoFloorPlan's per-edge cm badges during drag (`edgeGaps`), plus `ClearanceMeter.tsx` band visualization in the side drawer | Partial — PlanSandbox shows a live `StatusRow` list that re-runs `runClearanceAnalysis` on settle, but no per-edge gap badges during drag and no `ClearanceMeter` usage anywhere | Two separate UI implementations, not shared components |
| Click-vs-drag threshold fix | Yes — `DRAG_THRESHOLD_PX = 5` gating `onDragStart`/`onDragEnd` (`CondoFloorPlan.tsx`) | No — `FloorPlan2D.tsx`'s `handlePointerDown` has no threshold, no `moved` flag, no `hypot` check (confirmed via grep, zero matches) | Not shared — the fix lives only in `CondoFloorPlan.tsx`; `FloorPlan2D.tsx` is a separate component, untouched |
| Circular furniture rendering | Yes — `<circle>` for `shape==='round'` | No — `FloorPlan2D.tsx` contains exactly 3 `<rect>` elements and zero `<circle>` elements; every item renders as a rectangle regardless of shape | Not shared — a previously-documented, still-present gap |
| Confirm-writes-real-position flow | **Does not exist as a gate** — `commitLayout()` writes to `furnitureStore` on every drag release, automatically, no confirm step | **Yes, this is the core model** — `PlanSandbox`'s own docstring: "never writes to furnitureStore... confirm step, Phase 3." The actual write is `RecommendationScreen.handleConfirm()`, gated behind "Keep it here anyway"/"Looks good, keep it here" | Not a shared flow — genuinely different interaction models, not two copies of one idea |
| Stable-key resolved/skipped tracking (`violationKey.ts`) | Machinery present but inert — `WorkspaceScreen.tsx` only calls `refreshViolations()`, never `resolveCurrentStep`/`resolveViolations`, so `violationStore`'s `resolvedKeys` set is never populated on this path | Actually exercised — `RecommendationScreen.tsx:258` calls `resolveViolations(currentGroup.allViolations.map(v => v.id))`, and `PlanSandbox.tsx` separately uses `stableViolationKey` for its own "improved" flash highlight | Same underlying file/function (one `violationKey.ts`) — but only the RecommendationScreen path actually uses the resolved-tracking feature it powers |
| Tradeoff disclosure sentence | No | No | **Does not currently exist in either screen.** Built in a prior round; confirmed via direct read that zero references to `tradeoffSentence` remain anywhere in `src/` |
| AR calibration render path (`invertCalibration`, rotation correction) | N/A directly | N/A directly | **Upstream of both, specific to neither.** `invertCalibration`/`applyCalibration`/`calibrationThetaRad` are used only in `PositionMapScreen.tsx` (+ `calibration.ts`). Both display screens just read whatever `posX`/`posZ` is already sitting in `furnitureStore` — neither has calibration-aware code of its own, so both benefit identically and neither needs anything ported |
| Rule guidance panel / DO THIS cards / rules reference tab | Yes — side drawer's Items/Rules tabs, `ClearanceMeter` + `ruleGuidance.ts`'s `ALL_RULE_GUIDANCE` | Different mechanism entirely — one-violation-at-a-time cards via `findingReason()`/`engineMoveLines()`/`commitLines()`. No rules-reference tab; doesn't import `ruleGuidance.ts` or `ClearanceMeter` at all | Not shared — two independently-built guidance UIs |
| PDF report generation + Download entry point | Indirect — "Done" navigates to `ReportScreen`, which has the live Download button | Direct — `RecommendationScreen.tsx` has its own `DownloadReportButton` usage (2 call sites) | `pdfReport.ts`/`DownloadReportButton.tsx` is **one shared implementation** — 3 total call sites across the codebase (`ReportScreen` ×1 live, `RecommendationScreen` ×2 dead), same underlying code |

---

## Task 3 — Shared vs. duplicated foundations

**Mostly clean — one real duplication found, flagged as requested.**

Confirmed via import-site grep, both screens' geometry/engine layer resolve to the exact same files:
- `floorPlanGeometry.ts` (`projectItems`) — one file, imported by `CondoFloorPlan.tsx`, `FloorPlan2D.tsx`, and `pdfReport.ts` alike.
- `engine/clearance.ts` (`runClearanceAnalysis`, `toBounds`, `effectiveLengthCm`/`effectiveWidthCm`) — one file, imported by both `WorkspaceScreen.tsx` and `RecommendationScreen.tsx`/`PlanSandbox.tsx`, plus `ReportScreen.tsx`, `AnalysisScreen.tsx`, `floorPlanDrag.ts`, `floorPlanGeometry.ts`, and the AR overlay files.
- `floorPlanDrag.ts` — one file, imported by both `CondoFloorPlan.tsx` and `PlanSandbox.tsx`, though each pulls a **different subset of functions** (CondoFloorPlan: `clampToUnit`/`snapFree`/`edgeGaps`/`overlappingItemIds`/`roomIdForItem`; PlanSandbox: `isFeasible`/`snapCm`/`withMovedItem`/`withRotatedItem`) — different snapping *algorithms* (free-with-guides vs. 5cm-grid-with-reject) by design, not duplicated logic.

**Real duplication found:** `floorPlanDrag.ts`'s `isFeasible()` (`floorPlanDrag.ts:403-433`) is a near line-for-line reimplementation of `engine/clearance.ts`'s `findLayoutViolation()` (`clearance.ts:103-134`) — same dual out-of-bounds-then-overlap structure, same comparison logic. `findLayoutViolation` is never imported or called anywhere outside its own file; `isFeasible` exists as a second, independent copy used only by `PlanSandbox.tsx`. They currently agree only because both hardcode the same `0.01` epsilon separately — `clearance.ts`'s `FEASIBILITY_EPSILON_M`, `floorPlanDrag.ts`'s `isFeasible`, `floorPlanDrag.ts`'s `overlappingItemIds`, and `floorPlanDrag.ts`'s `canPlace` each define their own local `0.01` rather than sharing one constant — **four independent copies of the same tolerance value.** Nothing is broken today, but if that tolerance is ever tuned in one place, the others silently won't follow — exactly the drift-risk class of bug this project has hit before.

---

## Task 4 — What would be lost either way

### Scenario A: Keep WorkspaceScreen/CondoFloorPlan, delete RecommendationScreen/PlanSandbox

| Feature only in PlanSandbox/RecommendationScreen | Port size |
|---|---|
| Confirm-writes-real-position (propose-then-confirm gate) | **Large** — not a code move, a UX paradigm change to WorkspaceScreen's core direct-manipulation model |
| Resolved/skipped one-violation-at-a-time flow (`resolveViolations` actually wired up) | **Medium** — the store functions already exist and are shared; needs a new "one at a time, mark resolved/skip" UI built, since WorkspaceScreen has none |
| "Improved" flash highlight on status rows | **Small–medium** — a visual nicety, not core functionality |
| Tradeoff disclosure sentence | **N/A** — doesn't exist in either screen currently, nothing to port |
| RecommendationScreen's own Download button | **None** — redundant; `ReportScreen`'s live Download button already covers this with the same shared code |

### Scenario B: Keep RecommendationScreen/PlanSandbox, delete WorkspaceScreen/CondoFloorPlan

| Feature only in WorkspaceScreen/CondoFloorPlan | Port size |
|---|---|
| Full 8-room `CONDO_ROOMS` model + automatic re-homing + room-focus zoom + minimap | **Large** — PlanSandbox currently models one undifferentiated room; this is a rebuild, not a port |
| Free-movement drag across the whole unit (vs. 5cm-grid-snap-and-reject) | **Large** — a fundamentally different drag/feasibility model, not an addition |
| Rule guidance panel / `ClearanceMeter` / rules-reference tab | **Large** — an entirely separate guidance UI doesn't exist in RecommendationScreen at all today |
| Live per-edge gap readout badges during drag | **Medium** — underlying `edgeGaps` data is already available in the shared `floorPlanDrag.ts`; the UI itself would need building |
| Circular furniture rendering | **Small–medium** — the pattern to copy already exists verbatim in `CondoFloorPlan.tsx` |
| Click-vs-drag threshold fix | **Small** — ~20 lines, same pattern already written once |
| AR calibration integration | **None** — upstream of both, already benefits either scenario with no porting needed |

---

*No recommendation given — this is a decision for the project owner, not the agent.*
