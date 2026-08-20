# Full Codebase Cleanup Audit — Live vs. Dead

**Date:** 2026-08-20
**Status:** Report only — no code changes made as part of this audit. This maps the entire live process flow and classifies every screen/component/engine file as live, dead, or uncertain, to support a real deletion decision. Nothing has been deleted yet.

**Note on this filename:** this file previously held a "WorkspaceScreen Recolor" report that didn't match its `SUPABASE_TABLE_AUDIT` name — a mislabeling from an earlier session. That content is preserved in git history (commit `ea6a6dd`); this file now holds what its name should have meant all along, expanded into a full cleanup audit (Supabase findings are one section of it, under Task 2).

---

## Task 1 — The Real Process Flow

**`App.tsx`'s exact switch statement, current:**

```tsx
switch (currentScreen) {
  case 'entry':
    return <EntryScreen />;
  case 'auth':
    return <AuthScreen />;
  case 'furnitureInput':
    return <FurnitureInputScreen />;
  case 'positionMap':
    return <PositionMapScreen />;
  case 'analysis':
  case 'recommendations':
  case 'recommendation':
    return <WorkspaceScreen />;
  case 'report':
    return <ReportScreen />;
  default:
    return <PlaceholderScreen screenName={currentScreen} />;
}
```

App.tsx imports exactly 7 screens: `EntryScreen`, `AuthScreen`, `FurnitureInputScreen`, `PositionMapScreen`, `WorkspaceScreen`, `ReportScreen`, `PlaceholderScreen`. **`AnalysisScreen` and `RecommendationScreen` are not imported by App.tsx at all** — not even as unreachable cases. `ARDemoScreen`'s case is fully gone (zero occurrences of the string `ARDemoScreen` anywhere in `src/`).

`currentScreen` has exactly one writer in normal operation: `navigateTo()` (`sessionStore.ts:48`, plain `set({ currentScreen: screen })`). A second setter, `reset()`, exists (also sets `currentScreen: 'entry'`) but **has zero call sites anywhere in `src/`** — dead store action, never invoked.

**The real, ordered flow**, built from every `navigateTo(...)` call site, grepped directly:

```
EntryScreen (currentScreen initial value: 'entry')
 ├─ "Begin Session" → startNewSession() + navigateTo('furnitureInput') ──────┐
 ├─ "Create account" → setAuthMode('signup') + navigateTo('auth') ──┐        │
 └─ "Log in" → setAuthMode('login') + navigateTo('auth') ───────────┤        │
                                                                     ▼        │
                                                              AuthScreen      │
              ┌─ back arrow → navigateTo('entry')                  │        │
              ├─ signup submit → createAccount() → startFresh() ───┼────────┤
              ├─ login, no saved session → startFresh() ───────────┼────────┤
              ├─ login, saved session found → resumeChoice phase:  │        │
              │    ├─ "Resume your last session" → navigateTo('recommendations') ──┐
              │    └─ "Start fresh" → startFresh() ────────────────┼────────┤     │
              └────────────────────────────────────────────────────┘        │     │
                                                                              ▼     │
                                                                  FurnitureInputScreen │
              ┌─ back arrow → navigateTo('entry')                           │     │
              └─ "Continue" (≥1 item) → navigateTo('positionMap') ──────────┤     │
                                                                              ▼     │
                                                                  PositionMapScreen  │
              ┌─ back arrow → navigateTo('furnitureInput')                  │     │
              ├─ "No furniture added" fallback → navigateTo('furnitureInput')│     │
              └─ "Analyse layout" → navigateTo('analysis') ─────────────────┤     │
                                                                              ▼     │
                                                              WorkspaceScreen ◄──────┘
                                        (rendered for 'analysis' / 'recommendations' / 'recommendation')
              ┌─ back arrow → navigateTo('positionMap')
              └─ "Done" → navigateTo('report')
                                                                              │
                                                                              ▼
                                                                        ReportScreen
              ┌─ back arrow (top) → navigateTo('analysis') ─→ WorkspaceScreen
              ├─ "Review Layout Again" → navigateTo('analysis') ─→ WorkspaceScreen
              └─ "Finish and Exit" → navigateTo('entry') ─→ EntryScreen (session ends)
```

**Unreachable-in-practice findings:**
- **`case 'recommendation':`** (singular) — technically routed to `WorkspaceScreen`, but **zero `navigateTo('recommendation')` call sites exist anywhere.** Only `'analysis'` (from PositionMapScreen, ReportScreen) and `'recommendations'` plural (from AuthScreen's resume path) are ever actually set. This branch is a dead alias inside a live screen's routing.
- **`default:` → `PlaceholderScreen`** — per its own doc comment, only renders if `currentScreen` somehow holds a value outside the `ScreenName` union. Since `navigateTo` is fully typed against that union, this is unreachable in any TypeScript-compiled path — a pure defensive fallback.
- **"Finish and Exit" doesn't call `reset()`** — it calls `navigateTo('entry')` directly, so `userId`/`sessionId`/`username` are never cleared on exit even though the screen resets to Entry. Not in scope to fix here, just worth knowing before touching this flow.

---

## Task 2 — Full File Inventory: Live vs. Dead

| File | Status | Evidence | Depends on / Depended on by |
|---|---|---|---|
| `screens/EntryScreen.tsx` | **LIVE** | Imported by `App.tsx` case `'entry'` | → `sessionStore` |
| `screens/AuthScreen.tsx` | **LIVE** | Imported by `App.tsx` case `'auth'` | → `sessionStore`, `furnitureStore`, `roomData`, `supabase.ts` |
| `screens/FurnitureInputScreen.tsx` | **LIVE** | Imported by `App.tsx` case `'furnitureInput'` | → `ar/ARMeasureSession`, `ar/shapeLibrary`, `data/condoLayout`, `tokens` |
| `screens/PositionMapScreen.tsx` | **LIVE** | Imported by `App.tsx` case `'positionMap'` | → `ar/shapeLibrary`, `ar/calibration`, `tokens` |
| `screens/WorkspaceScreen.tsx` | **LIVE** | Imported by `App.tsx` cases `'analysis'/'recommendations'/'recommendation'` | → `CondoFloorPlan`, `ClearanceMeter`, `engine/clearance`, `engine/walkways`, `engine/ruleGuidance`, `floorPlanDrag`, `condoLayout`, all 3 stores |
| `screens/ReportScreen.tsx` | **LIVE** | Imported by `App.tsx` case `'report'` | → `DownloadReportButton`, `StatusRow`, `statusVocabulary`, `engine/clearance`, `engine/violationKey`, `findingText` |
| `screens/PlaceholderScreen.tsx` | **LIVE** (fallback only) | Imported by `App.tsx` `default:` case | → `sessionStore` only |
| `screens/AnalysisScreen.tsx` | **DEAD — confirmed orphaned** | `grep "from ['"].*AnalysisScreen['"]" src/` → no matches anywhere, including `App.tsx` | → `ar/ClearanceOverlay`, `ar/shapeLibrary`, `engine/clearance`, `components/ErrorBoundary` (one-directional; nothing depends on it) |
| `screens/RecommendationScreen.tsx` | **DEAD — confirmed orphaned** | `grep "from ['"].*RecommendationScreen['"]" src/` → no matches anywhere, including `App.tsx` | → `PlanSandbox`, `ar/ClearanceOverlay`, `ar/CorrectionArrow`, `previewMove`, `findingText`, `DownloadReportButton`, `ErrorBoundary`, `engine/clearance` |
| `components/PlanSandbox.tsx` | **DEAD — transitively orphaned** | Sole importer: `RecommendationScreen.tsx:9` (itself dead) | → `FloorPlan2D`, `StatusRow`, `statusVocabulary`, `findingText`, `engine/violationKey`, `engine/clearance`, `floorPlanDrag` (`isFeasible`, `snapCm`, `withMovedItem`, `withRotatedItem`) |
| `components/FloorPlan2D.tsx` | **DEAD — transitively orphaned** | Sole importer: `PlanSandbox.tsx:3` (itself dead) | → `floorPlanGeometry` |
| `ar/ClearanceOverlay.tsx` | **DEAD — transitively orphaned** | Importers: `AnalysisScreen.tsx:6`, `RecommendationScreen.tsx:5` — both dead | → `engine/clearance` (types only) |
| `ar/CorrectionArrow.tsx` | **DEAD — transitively orphaned** | Sole importer: `RecommendationScreen.tsx:6` (itself dead) | none found |
| `ar/overlayRenderer.tsx` | **DEAD — fully orphaned** | `grep "overlayRenderer" src/` → no matches at all, not even from other dead files | → `engine/clearance` (types only) |
| `components/previewMove.ts` | **DEAD — transitively orphaned** | Sole importer: `RecommendationScreen.tsx:10-11` (itself dead) | → `engine/clearance` (types only) |
| `components/findingText.ts` | **LIVE** | Imported by `ReportScreen.tsx:10` and `pdfReport.ts:3` (both live); also used by dead `PlanSandbox`/`RecommendationScreen` | — |
| `utils/floorPlan.ts` | **DEAD — fully orphaned** | `grep "from ['"].*utils/floorPlan['"]" src/` → no matches at all | none (canvas-based renderer, superseded by SVG `CondoFloorPlan`) |
| `components/CondoFloorPlan.tsx` | **LIVE** | Sole importer: `WorkspaceScreen.tsx:3` | → `floorPlanGeometry`, `gridOverlay`, `floorPlanDrag`, `condoLayout`, `tokens` |
| `components/floorPlanDrag.ts` | **LIVE** | Imported by `CondoFloorPlan.tsx` and `WorkspaceScreen.tsx` | → `engine/clearance`, `condoLayout` — see Task 3 for dead exports *inside* this live file |
| `components/floorPlanGeometry.ts` | **LIVE** | Imported by `CondoFloorPlan.tsx` and `pdfReport.ts` (both live); also by dead `FloorPlan2D` | → `engine/clearance` |
| `components/gridOverlay.ts` | **LIVE** | Sole importer: `CondoFloorPlan.tsx:4` | — |
| `components/ClearanceMeter.tsx` | **LIVE** | Sole importer: `WorkspaceScreen.tsx:4` | → `engine/ruleGuidance` |
| `components/StatusRow.tsx` | **LIVE** | Imported by `ReportScreen.tsx:8` (live); also dead `PlanSandbox` | → `statusVocabulary` |
| `components/statusVocabulary.ts` | **LIVE** | Imported by `ReportScreen.tsx:9` (live); also dead `PlanSandbox` | — |
| `components/DownloadReportButton.tsx` | **LIVE** | Imported by `ReportScreen.tsx:7` (live); also dead `RecommendationScreen` | → `pdfReport` |
| `components/pdfReport.ts` | **LIVE** | Sole non-dead importer: `DownloadReportButton.tsx:3` | → `floorPlanGeometry`, `findingText`, `engine/ruleGuidance`, `engine/clearance` (types) |
| `components/ErrorBoundary.tsx` | **LIVE** | Imported by `main.tsx:5` (wraps the whole app); also dead `AnalysisScreen`/`RecommendationScreen` | — |
| `components/tokens/{colors,type,spacing,marks,index}.ts` | **LIVE** | 15 import sites across `src/`, including every live screen and `CondoFloorPlan` | — |
| `ar/ARMeasureSession.tsx` | **LIVE** | Sole importer: `FurnitureInputScreen.tsx:8` | — |
| `ar/shapeLibrary.ts` | **LIVE** | Imported by `FurnitureInputScreen.tsx` and `PositionMapScreen.tsx` (both live); also dead `AnalysisScreen`/`RecommendationScreen` | — |
| `ar/calibration.ts` | **LIVE** | Sole importer: `PositionMapScreen.tsx:13` | — |

**UNCERTAIN:** none found. Every file resolved cleanly to LIVE or DEAD via direct import-graph evidence — no conditionally-imported or feature-flagged files exist in this codebase (no dynamic `import()` calls or env-gated component selection anywhere in `src/`).

### Supabase-related dead code

| Item | Status | Evidence |
|---|---|---|
| `createAccount`, `logIn`, `fetchSavedSession`, `saveSessionLayout` | **LIVE** | Called from `AuthScreen.tsx` and `useAutosaveLayout.ts` |
| `insertParticipant`, `insertSusSurvey`, `insertPostSurvey` | **DEAD — zero callers** | `grep "insertParticipant\|insertSusSurvey\|insertPostSurvey" src/` → only their own definitions in `supabase.ts`, no call sites anywhere |
| `participants`, `sus_responses`, `post_survey_responses`, `pre_survey_responses` table refs | **DEAD** | Zero references outside the 3 unused functions above; `pre_survey_responses` has no corresponding function at all |
| Old custom `users` table, any `.rpc(...)` call | **Gone** | `grep "\.rpc\("` → zero matches; matches CODEBASE_STATUS.md Round 20's claim that this table was dropped |
| `space_utilization_scores` | **Gone** | Zero references (also matches Round 20) |
| `ar_measurement_tests`, `rule_test_cases` | **Unpopulated, no write path** | Zero references in `src/` — schema-only, as previously documented |

### `src/engine/` — every file individually confirmed

| File | Status | Evidence |
|---|---|---|
| `rules.ts` | **LIVE** | Imported by `clearance.ts` and `ruleGuidance.ts` |
| `clearance.ts` | **LIVE** | Imported by `WorkspaceScreen`, `ReportScreen`, `floorPlanDrag`, `floorPlanGeometry`, `DownloadReportButton` (types), plus dead files |
| `walkways.ts` | **LIVE** | Sole importer: `WorkspaceScreen.tsx:21` |
| `ruleGuidance.ts` | **LIVE** | Imported by `WorkspaceScreen`, `ClearanceMeter`, `pdfReport` |
| `violationKey.ts` | **LIVE** | Imported by `violationStore.ts`, `ReportScreen.tsx`; also dead `PlanSandbox` |
| `clearanceTestCases.ts` | **⚠️ DEAD — zero importers, contrary to the "should all be live" assumption** | `grep "clearanceTestCases" src/` → only its own file, no import anywhere. It's scratch scaffolding for populating the still-empty `rule_test_cases` Supabase table (10 rule tests + 5 priority-score tests, per CODEBASE_STATUS.md's "Before Phase 3" list) — unfinished infrastructure, not abandoned cruft, but currently 100% inert code. |

---

## Task 3 — Code Health Spot-Check

**1. Duplication status — worse than "still present," now partially dead on both sides:**

- `engine/clearance.ts`'s `findLayoutViolation()` (line 103) — zero callers anywhere, only a comment referencing it. Dead code inside a live, must-not-touch file.
- `components/floorPlanDrag.ts`'s `isFeasible()` (line 403) — sole caller is `PlanSandbox.tsx`, which is itself dead. So the duplication flagged in the earlier `WORKSPACE_VS_RECOMMENDATION_AUDIT.md` isn't just unreconciled anymore — both halves of it are now unused in practice, one directly dead, one transitively dead.
- Same "Legacy single-room helpers" block in `floorPlanDrag.ts` (lines 369-433) has mixed live/dead status per-export, worth knowing before touching that file:
  - `withMovedItem` — **live** (also used by `WorkspaceScreen.tsx`, not just `PlanSandbox`)
  - `snapCm` — **live**, but only because `snapFree()` (used by the live `CondoFloorPlan`) calls it internally at lines 263/271 — its only *external* caller is dead
  - `withRotatedItem` — **dead**, sole caller is dead `PlanSandbox`; `WorkspaceScreen`'s own rotate handler does its own inline rotation math instead
  - `clampToRoom` — **fully dead**, zero callers anywhere, not even from `PlanSandbox`

**2. TODO/FIXME comments:** `grep "TODO|FIXME" src/` → zero matches anywhere in the codebase.

**3. Baseline build status (before any cleanup work begins):**
- `tsc -b --force` → clean, exit 0
- `eslint .` → clean, exit 0, zero warnings
- `vite build` → succeeds, 602 modules transformed, same pre-existing chunk-size warning as always (unrelated to any of the above)

---

## Summary for the cutting decision

**Confirmed safe to delete as one connected cluster** (nothing outside the cluster references any of it): `AnalysisScreen.tsx`, `RecommendationScreen.tsx`, `PlanSandbox.tsx`, `FloorPlan2D.tsx`, `ar/ClearanceOverlay.tsx`, `ar/CorrectionArrow.tsx`, `ar/overlayRenderer.tsx`, `components/previewMove.ts`, `utils/floorPlan.ts` — 9 files.

**Confirmed safe to delete as unused symbols inside otherwise-live files** (narrower, more surgical): `findLayoutViolation()` in `engine/clearance.ts`, `isFeasible()`/`withRotatedItem()`/`clampToRoom()` in `components/floorPlanDrag.ts`, `insertParticipant`/`insertSusSurvey`/`insertPostSurvey` in `supabase.ts`, `reset()` in `sessionStore.ts`.

**Needs a product decision, not just a grep:** `engine/clearanceTestCases.ts` (unused now, but it's pending Phase-3 infrastructure per the project's own TODO list — deleting it would remove groundwork, not just clutter) and the `case 'recommendation':` dead alias in `App.tsx` (trivial to drop, but touches routing).

No deletions made in this pass — this is the map, not the cut.

---
---

# UI Polish Pass — Smooth Transitions, Loading States, Touch Targets

**Date:** 2026-08-21
**Scope:** the 6 confirmed-live screens only (per the audit above): EntryScreen, AuthScreen, FurnitureInputScreen, PositionMapScreen, WorkspaceScreen, ReportScreen. Visual/interaction polish only — no new features, no routing changes, no engine changes.

**Skill file:** `/mnt/skills/public/frontend-design/SKILL.md` does not exist in this environment (confirmed by direct read attempt) — proceeded on the project's own token system and established conventions instead.

## Task 1 — Audit (before any changes)

**1. Screen-to-screen transitions:** `.screen` (App.css) already gave every screen using `className="screen"` a mount-in fade (`screenFadeIn 0.35s ease`, opacity 0→1 + `translateY(12px)`→0) — covering 5 of 6 live screens (Entry, Auth, FurnitureInput, PositionMap, Report). **WorkspaceScreen had none** — its custom `shell` layout doesn't use `className="screen"`. No screen had an exit transition (`App.tsx`'s switch swaps synchronously). **Real gap:** `screenFadeIn` had zero `prefers-reduced-motion` handling anywhere.

**2. Loading/pending states:**
- AuthScreen submit — partial gap: already disabled + "Please wait…" text, but no spinner.
- PositionMapScreen "Place in room" → `await enterAR()` — real gap, zero feedback during the wait.
- FurnitureInputScreen "Measure" → `await enterAR()` — same gap.
- WorkspaceScreen's `runClearanceAnalysis` — synchronous/sub-ms, not a real gap (can't show a loading state mid-synchronous-block without a Web Worker; out of scope).
- ReportScreen/DownloadReportButton PDF generation — already polished (Spinner + "Preparing your report…" + success + inline retry). No regression.
- Confirmed zero `alert(`/`confirm(`/`prompt(` anywhere in `src/screens/`.

**3. Touch targets under 44px:**
- `removeButtonStyle` (FurnitureInputScreen "Remove") — 36px. Violation.
- FurnitureInputScreen AR-overlay "Exit" — padding-only, ~41px computed. Violation.
- PositionMapScreen AR-overlay "Exit"/"Recalibrate" — padding-only, ~37px computed. Violation.
- Everything else checked (`.back-btn`, `.btn`, WorkspaceScreen's `iconBtn`/`backBtn`/`finishBtn`/`tabBtn`/`listItemStyle`) already ≥44px.
- CondoFloorPlan's SVG drag hit-targets are viewport-scaled world-space regions, not fixed-px DOM elements — N/A, not silently skipped.
- `dim-btn`/`likert-item`/`option-item` CSS classes exist in App.css but are used by **none** of the 6 live screens (confirmed via grep) — vestigial from removed survey screens, correctly out of scope.

**4. Layout shift:** no genuine bugs found — plan container is `aspect-ratio`-locked, `ShapePreview`'s R3F canvas has a fixed 160px height upfront, FurnitureInputScreen's progressive card reveal is deliberate step-flow, ReportScreen's staggered fade is opacity/transform-only with space already reserved (zero CLS). WorkspaceScreen's mount-normalization effect was verified empirically in the real trace below rather than assumed safe.

## Task 2 — Screen transitions

- Tightened `.screen`'s mount fade 350ms → **200ms** (within the requested 150-250ms band).
- Added `.wksp-shell` with the identical `screenFadeIn 0.2s ease` and applied it to WorkspaceScreen's root — now all 6 screens share one pattern, not five-plus-one-silent.
- Added `@media (prefers-reduced-motion: reduce) { .screen, .wksp-shell { animation: none; } }`.
- No true cross-fade exit transition was built — `App.tsx`'s router unmounts/mounts synchronously; animating the outgoing screen would need a bigger architectural change and risks violating "never blocking input." Extending the proven mount-fade to all 6 screens was the lower-risk reading of "one shared pattern reused everywhere."
- **Real check (Playwright, `page.emulateMedia`):** `getComputedStyle(...).animationName` = `'screenFadeIn'` on Entry/FurnitureInput/Workspace without reduced-motion; `'none'` on all three with it set.

## Task 3 — Loading/pending states

- **AuthScreen** — extracted the spinner already living in `DownloadReportButton.tsx` into a shared `components/Spinner.tsx` (removing a near-duplicate instead of writing a second one), added it next to "Please wait…".
- **PositionMapScreen** — new `arInitializing` state shows a spinner + "Setting up your camera…" on the item being placed, disables the other "Place in room" buttons for the `await enterAR()` window.
- **FurnitureInputScreen** — identical fix on all three "Measure" buttons (length/width/diameter).
- **DownloadReportButton** — confirmed already polished, not regressed.
- Every failure path already surfaces inline text (confirmed zero native dialogs).

## Task 4 — Touch targets + layout stability

- `removeButtonStyle`: 36px → 44px. **Verified live**: real `getBoundingClientRect().height` = exactly 44.
- FurnitureInputScreen's AR-overlay Exit, and PositionMapScreen's Exit/Recalibrate: explicit `minHeight: 44` + proper flex centering added (padding-only sizing wasn't tall enough and wouldn't have centered text once forced taller).
- These 3 AR-overlay buttons only render inside an active WebXR `XRDomOverlay`, unreachable in this environment (no WebXR hardware) — verified by deterministic CSS math instead of a live screenshot, same limitation this project has always had for AR UI.
- No layout-shift fixes were needed — none found in Task 1.4.

## Task 5 — One considered detail per screen

1. **EntryScreen** — fixed a real bug: `.entry-screen`'s `padding` shorthand was silently overwriting `.screen`'s safe-area-aware `padding-bottom`, on the one screen most likely to need it (full-bleed `100dvh`). Not decorative — could have clipped the footer under a phone's gesture-nav bar.
2. **AuthScreen** — signup-mode placeholder now reads "Your username (no @ symbol)," surfacing a real, previously-invisible constraint (`buildSyntheticEmail` throws on `@`) before a confusing failure.
3. **FurnitureInputScreen** — applied the existing `numeric` (tabular-nums) token to the 4 dimension inputs — the token's own documented use case ("dimension steppers"), previously unused there.
4. **PositionMapScreen** — same `numeric` token on the live rotation-degree readout during AR placement.
5. **WorkspaceScreen** (via `CondoFloorPlan.tsx`, its exclusive render surface) — same `numeric` token on the live drag-time gap-readout badges, the app's fastest-updating on-screen number.
6. **ReportScreen** — added a small rotating ▾ chevron to "See the details," a standard disclosure affordance using a plain glyph (matches the existing icon language: ↻ ↶ ⟲ ← elsewhere), not a new asset.

## Verification

- **Severity tokens:** `git diff --stat -- src/components/tokens/colors.ts` → empty. Untouched.
- **Engine files:** `git diff --stat -- src/engine/` → empty. Untouched.
- **Files touched:** `App.css`, `CondoFloorPlan.tsx`, `DownloadReportButton.tsx`, `AuthScreen.tsx`, `FurnitureInputScreen.tsx`, `PositionMapScreen.tsx`, `ReportScreen.tsx`, `WorkspaceScreen.tsx`, plus new `components/Spinner.tsx`.
- **`tsc -b --force`**, **`eslint .`**, **`vite build`** — all clean (603 modules, +1 for the new `Spinner.tsx`).
- **Real functional trace** (Playwright, actual pointer/keyboard events against seeded state): plain click → zero position change (drag threshold intact) → real drag → moved correctly → **R** rotate → `rotationY` became π/2 → **Ctrl+Z** undo → reverted to ~0 → Reset-position button → re-homed correctly, room preserved. Rotate/Undo/Reset icon buttons confirmed still exactly 44×44px. Zero console errors throughout.
- The temporary `window.__testStores` debug hook used for verification was fully reverted from `main.tsx` before finishing — confirmed via `git status`.
