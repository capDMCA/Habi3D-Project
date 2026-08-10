# Habi3D Codebase — Current State & Recent Changes

**Last updated:** 2026-08-09
**Project phase:** Late Phase 2 → Phase 3 readiness

---

## Executive Summary

Habi3D is a **Priority-Ranked Sequential Recommendation Tool** for condominium residents to validate furniture layout against 10 clearance rules (5 living room, 5 dining). Three rounds of work landed since the last status snapshot:

1. **Free-movement drag system** for the 2D floor plan (`WorkspaceScreen`/`CondoFloorPlan`)
2. **User-friendly rule guidance with visual clearance meters** in the recommendations panel
3. **Login removed entirely** — replaced with an anonymous session id and a simplified entry → unit setup flow
4. **Downloadable PDF report** added to the Report screen — a one-page client-side keepsake of the session

---

## Recent Changes

### 1. Floor Plan Drag System Redesigned — Free Movement Across Unit

**Files changed:** `src/components/floorPlanDrag.ts`, `src/components/CondoFloorPlan.tsx`, `src/screens/WorkspaceScreen.tsx`

#### What was broken
- Furniture could not actually move — drops were silently rejected by `isFeasible(entireLayout)`, which required *all* pieces to be clear
- Initial layouts placed every stray piece at its room's exact centre, creating permanent overlaps
- Camera zoom during drag jostled the piece's world coordinates
- Room membership was hard-coded, even for oversized pieces

#### What's fixed
- **Free movement:** Pieces now drag across the entire unit. Only the unit's outer wall is a hard boundary; room membership is **derived automatically** from where you drop (by footprint overlap majority)
- **Live feedback while dragging:** alignment guides (walls, room edges, neighbours), live gap readouts in cm, collision highlighting, room drop-target highlighting
- **Robust coordinate tracking:** delta-based dragging captures screen-to-world scale at pointerdown, immune to mid-drag camera zoom
- **Better initial layout:** `packItemsIntoRoom()` lays out misplaced pieces side-by-side without overlaps, instead of stacking them
- **Per-item validation:** only the dragged piece is validated on release; pre-existing overlaps elsewhere don't block you
- **50-step undo history:** Ctrl/Cmd+Z, plus an Undo button
- **Keyboard:** arrow keys nudge 1cm (Shift for 10cm), R rotates
- **Verified:** 19 drag-geometry assertions pass (packing, room attribution, unit clamping, snapping, per-item gating, gap measurement)

#### Architecture
- `floorPlanDrag.ts` — core physics (`clampToUnit`, `roomIdForItem`, `snapFree`, `edgeGaps`, `packItemsIntoRoom`, `UNIT_WIDTH_CM`/`UNIT_HEIGHT_CM` constants)
- `CondoFloorPlan.tsx` — SVG rendering + window-level pointer listeners
- `WorkspaceScreen.tsx` — DragSession, history stack, normalization, keyboard handlers, `commitLayout` helper

---

### 2. Recommendations Panel — User-Friendly Rule Guidance with Visual Meters

**Files changed:** `src/screens/WorkspaceScreen.tsx`, `src/App.css`
**Files added:** `src/engine/ruleGuidance.ts`, `src/components/ClearanceMeter.tsx`

#### What's new
- **Each violation card shows:** the rule in plain English ("Room to walk through") with its requirement spelled out, a clearance meter plotting the measurement against the rule's three bands, a "DO THIS" action block, and a `Rule L1 · General Circulation` footer for traceability
- **New Rules tab** — all 10 rules grouped by area, each showing pass/fail status and its band definitions
- **Accessibility-first encoding** — shape (triangle/diamond/circle) + words + track position, never colour alone
- **Verified:** 12 meter geometry checks pass — bands tile to 100% with no unreadable slivers, meter band always agrees with the engine's own `classifyGap` at every threshold

#### Accessibility note
The red/amber/green palette (ΔE 2.8 between amber `#B45309` and red `#DC2626` under deuteranopia) is inherently CVD-hostile — no hue substitution fixes a traffic-light triad for red-green colourblindness. Mitigated with shape + label + position encoding rather than colour alone.

---

### 3. Login Removed — Anonymous Sessions, Simplified Entry Flow

**Files deleted:** `AuthScreen.tsx`, `AdminScreen.tsx`, their Supabase auth functions, the short-lived `SessionStartScreen.tsx` (built and then folded back into `EntryScreen.tsx` in the same pass — redundant once it was clear `EntryScreen` already was the clean "just a begin button" screen)
**Files changed:** `src/stores/sessionStore.ts`, `src/types/index.ts`, `src/App.tsx`, `src/screens/EntryScreen.tsx`, `src/screens/UnitSetupScreen.tsx` (restored), `src/screens/FurnitureInputScreen.tsx`

#### What changed
- No username/password/account of any kind. Tapping **Begin Session** on `EntryScreen` generates an anonymous `sessionId` (`crypto.randomUUID()`) and moves straight to unit setup — nothing is saved beyond the id.
- `sessionStore` dropped `userId`/`username`/`isAdmin`/`participantId`/`participantCode` entirely; it now holds only `sessionId`, `unitTypeId`, `roomDimensions`.
- `UnitSetupScreen` restored as its own step (the same 15-option grouped Mulberry Place unit picker + area reference + floor plan preview as before) — sits between `entry` and `furnitureInput`.
- Initial screen is `'entry'` again (was briefly `'sessionStart'` mid-session, reverted).

#### Current screen flow
```
entry → UnitSetupScreen chooses unit type/dimensions → furnitureInput
  → positionMap → analysis/recommendations/recommendation (WorkspaceScreen)
  → report
```

---

### 4. Downloadable PDF Report

**Files added:** `src/components/pdfReport.ts`, `src/components/DownloadReportButton.tsx`
**Files changed:** `src/screens/ReportScreen.tsx`, `src/screens/RecommendationScreen.tsx` (updated to the new shared button; this screen itself is currently unrouted, see Known Issues)

#### What it does
- A "Keep a copy" card on `ReportScreen` offers a one-page PDF: header (date + "Mulberry Place"), a drawn floor plan snapshot, a plain-language per-item status list, and a closing disclaimer line.
- Generated **client-side** with `jsPDF` — no server call, no upload, no Supabase write.
- The plan drawn into the PDF sources its geometry from the same places the live plan does — `CONDO_ROOMS` (room boundaries/labels) and `projectItems()` in `floorPlanGeometry.ts` (furniture rectangles) — never a screenshot/`html2canvas` capture, so the PDF can't show a different room than the one actually arranged.
- `DownloadReportButton` is a shared idle → working → success → idle (auto-settles after ~2.2s) / error-with-retry component, used by both `ReportScreen` and `RecommendationScreen`.

---

## Project Context (Locked)

**What it is:** BSIT Undergraduate Thesis — Application Development. A WebXR/2D tool for 2BR condo residents (Mulberry Place, Acacia Estates, Taguig) to lay out furniture and validate against 10 clearance rules from *Time-Saver Standards for Interior Design* (DeChiara, Panero & Zelnik, 2001, pp.61–99).

**Tech stack:** React 19 + TypeScript 6 + Vite 8 + @react-three/fiber/xr + Zustand + Supabase + Vercel + jsPDF

**The 10 rules** (locked values in `src/engine/rules.ts`):
- **Living (L1–L5):** General circulation, sofa-coffee table legroom, secondary path, main traffic, conversation depth
- **Dining (D1–D5):** Table-to-wall, chair pull-out, passage behind seated, walking past seated, minimum passage
- Each rule has RED (violation), YELLOW (warning), GREEN (clear) thresholds

**Research sample:** N=30 purposive (2BR only). Phase 3 evaluation sessions upcoming.

---

## Current Architecture

### Screen Flow (App.tsx routing)
```
entry → EntryScreen (logo, "for Mulberry Place residents", one "Begin Session" button — generates sessionId)
  ↓
unitSetup → UnitSetupScreen (unit type picker + dimensions, no confirmation gate beyond this)
  ↓
furnitureInput → FurnitureInputScreen (AR two-tap measuring; planeDetection still true ⚠️ — live blocker)
  ↓
positionMap → PositionMapScreen (AR furniture placement; planeDetection already fixed)
  ↓
analysis / recommendations / recommendation → WorkspaceScreen
    (2D SVG plan, free-movement drag, clearance meters, Rules tab — no AR, no planeDetection concern here)
  ↓
report → ReportScreen (headline + room-by-room status + PDF download + exit actions)
```

`arDemo` still routes to `ARDemoScreen` but nothing in the flow above links to it.

### Store Locations
- `src/stores/sessionStore.ts` — `currentScreen`, `navigateTo`, `sessionId` (anonymous), `unitTypeId`, `roomDimensions`
- `src/stores/furnitureStore.ts` — items[], layout normalization
- `src/stores/violationStore.ts` — violations[], recommendations[], analysis results

### Key Engines
- `src/engine/rules.ts` — 10 rules, `classifyGap()`, Priority Score formula
- `src/engine/clearance.ts` — `runClearanceAnalysis()` → sorted violations with priority scores
- `src/engine/ruleGuidance.ts` — user-facing text layer (title, requirement, consequence) per rule
- `src/components/floorPlanDrag.ts` — free-movement physics + unit envelope constants
- `src/components/CondoFloorPlan.tsx` — SVG floor plan + window-level drag listeners
- `src/components/pdfReport.ts` — client-side PDF builder (jsPDF), draws from `CONDO_ROOMS` + `projectItems()`
- `src/components/DownloadReportButton.tsx` — shared download UI state machine

### AR
- `src/ar/ClearanceOverlay.tsx` — AR rendering of violations
- `src/ar/CorrectionArrow.tsx` — directional guidance for fixes
- `src/ar/ARMeasureSession.tsx` — point-to-point distance measuring (tap-tap with reticle), used by `FurnitureInputScreen`

### Supabase Tables (current)
- `space_utilization_scores` — **EMPTY**, and the previously-designed fix is now stale (see Known Issues — it assumed a `userId` that no longer exists)
- `participants`, `pre_survey_responses`, `sus_responses`, `post_survey_responses` — legacy, unused
- `ar_measurement_tests`, `rule_test_cases` — schema present, not yet populated
- The `users` table and its auth functions in `src/supabase.ts` are now dead — nothing in the app calls them since `AuthScreen`/`AdminScreen` were deleted. Worth a cleanup pass.

---

## What's Working

✅ **Entry & session start** — clean landing, anonymous `sessionId`, no account of any kind
✅ **Unit setup** — full Mulberry Place unit picker restored, dimensions read/adjustable
✅ **2D Floor Plan** (`WorkspaceScreen`) — free drag across the whole unit, live gap readouts, alignment guides, collision highlighting, 50-step undo, keyboard shortcuts, automatic room re-homing
✅ **AR Furniture Placement** (`PositionMapScreen`) — point-to-point measuring, bounding-box collision, planeDetection already off
✅ **Clearance Analysis** — 10 rules evaluated, violations sorted by Priority Score
✅ **Recommendations UI** — plain-English rule guidance, CVD-safe clearance meters, Rules reference tab
✅ **Reports** — plain-language room-by-room status, **PDF download** (new)

---

## Known Issues & Blockers

### 🔴 planeDetection still true — now only one live file

**Status:** Partially resolved by the routing change, not yet fixed
**Live blocker:** `src/screens/FurnitureInputScreen.tsx` (line ~15) — still routed, still `planeDetection: true`
**No longer reachable, same flag still present (low priority, dead code):** `src/screens/AnalysisScreen.tsx`, `src/screens/RecommendationScreen.tsx` — both orphaned since `WorkspaceScreen` replaced them for `analysis`/`recommendations`/`recommendation`. `ARDemoScreen.tsx` also has it but is unreached from the live flow.

**Impact:** Any unsupported WebXR required feature causes the whole AR session to be rejected with "AR Placement Failed" on Android Chrome. `plane-detection` is not universally supported.

**Fix:** Remove `planeDetection: true` from `FurnitureInputScreen.tsx`'s `createXRStore` call before Android testing. The other three files can be fixed opportunistically or left alone if/when they're deleted for good.

---

### 🔴 space_utilization_scores table is empty — previous fix design is now stale

**Status:** Root cause still valid, but the previously-designed fix assumed a field that no longer exists
**Root cause:** No participant/session identifier was ever wired into a Supabase write. The old fix plan said "use `sessionStore.userId`" — but `userId` was removed entirely when login was deleted (Recent Changes #3).

**What needs to happen instead:** Decide what identifies a session for research purposes now that there's no account — most likely `sessionStore.sessionId` (the anonymous UUID already generated on entry) — then write `spaceScoreBefore`/`spaceScoreAfter`/resolved-violation-count from `ReportScreen.tsx` once, keyed to that id. No code has been written for this yet.

**Impact:** Every evaluation session's space utilization score is still silently lost. Must be resolved before Phase 3 sessions if this table is part of the thesis data collection plan — worth confirming it still needs to be, now that the participant-tracking approach has changed twice.

---

### 🟡 AR coordinate drift between sessions (known limitation, not a bug)

**Status:** By design — each `enterAR()` starts a fresh world origin at the device's current position
**Impact:** Furniture `posX`/`posZ` stored during `positionMap` are only valid within that session. Re-opening AR causes offset.
**Mitigation:** See `project_habi3d_live_scan_backup_plan` memory for a fallback approach.

---

### 🟢 Authentication spec drift — resolved (in the opposite direction)

The old note here was "locked decision says no login + P01-P30 codes, but the codebase has full login." That's now flipped: there is no login **and** no participant codes — just an anonymous `sessionId`. This matches the locked "no login" decision but does *not* give researchers a way to identify or re-contact a specific participant's session. If Phase 3 needs to tie a session back to a specific resident (e.g. for the SUS survey or interview follow-up), that identification mechanism doesn't exist yet and needs a decision.

---

## Before Phase 3 Evaluation Sessions

**Must-do:**
- [ ] Remove `planeDetection: true` from `FurnitureInputScreen.tsx`
- [ ] Decide the session-identification approach (`sessionId` vs. something else) and fix the `space_utilization_scores` write against it
- [ ] End-to-end test on Android Chrome (WebXR)
- [ ] Populate `rule_test_cases` (10 rule tests + 5 priority score ranking tests)
- [ ] Confirm whether Phase 3 needs a way to re-identify a participant's session — current anonymous-only model may not support the research plan

**Nice-to-have:**
- [ ] Remove dead auth code in `src/supabase.ts` (`registerUser`/`loginUser`/`getAllUsers`/`deleteUser` — no longer called anywhere)
- [ ] Decide the fate of orphaned `AnalysisScreen.tsx`/`RecommendationScreen.tsx` — delete, or keep as a fallback UI
- [ ] Expert interior designer validation document
- [ ] DMCI floor plan dimensions confirmation

---

## Testing & Verification Done (cumulative)

✅ TypeScript: `tsc -b --force` clean
✅ Linting: `eslint .` clean (two pre-existing mount-time `set-state-in-effect` warnings in `WorkspaceScreen.tsx`, left intentional — see below)
✅ Production build: `vite build` passes
✅ Drag geometry: 19 assertions (packing, room attribution, unit clamping, snapping, per-item validation, gap measurement)
✅ Meter geometry: 12 assertions (guidance coverage, threshold sync, band tiling, band/engine agreement, marker clamping, green visibility)
✅ Accessibility: palette validated with a CVD-separation script; gap mitigated with shape + label + position encoding
✅ PDF geometry: confirmed via grep that `pdfReport.ts` sources exclusively from `CONDO_ROOMS`/`projectItems()`/`floorPlanDrag.ts` constants, with no `html2canvas` anywhere in `src/`

The two `set-state-in-effect` warnings in `WorkspaceScreen.tsx` are legitimate mount-time normalization effects that write to the external furniture store — not fixed, left as-is deliberately to avoid destabilizing the drag/preview sync.

---

## Next Steps

1. **Immediate:**
   - Remove `planeDetection: true` from `FurnitureInputScreen.tsx`
   - Decide the session-identification approach and implement the `space_utilization_scores` write
   - Browser-test the full flow: entry → unit setup → furniture input → position map → workspace → report → PDF download

2. **Before Phase 3 sessions:**
   - Test on Android Chrome
   - Populate test cases
   - Resolve whether anonymous-only sessions meet the research plan's needs

3. **Housekeeping:**
   - Clean up dead auth code in `src/supabase.ts`
   - Decide whether to delete or keep `AnalysisScreen.tsx`/`RecommendationScreen.tsx`

4. **Long-term (post-thesis):**
   - Investigate AR coordinate persistence if WebXR anchor support improves
   - Consider the `ARMeasureSession` live-checker fallback if drift persists

---

## Useful Links

- **Memory:** `C:\Users\Dell\.claude\projects\c--Users-Dell-Habi3D-Project\memory\`
- **Repo docs:** `PROCESS_FLOW.md`, `SYSTEM_CANVAS.md` at repo root
- **Time-Saver Standards citation:** DeChiara, Panero & Zelnik (2001), pp.61–99
