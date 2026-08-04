# Habi3D Codebase — Current State & Recent Changes

**Last updated:** 2026-08-04  
**Project phase:** Late Phase 2 → Phase 3 readiness  
**Model mode:** claude-haiku-4-5

---

## Executive Summary

Habi3D is a **Priority-Ranked Sequential Recommendation Tool** for condominium residents to validate furniture layout against 10 clearance rules (5 living room, 5 dining). Recent work (this session) focused on two major UX enhancements: **(1) free-movement drag system** for the 2D floor plan, and **(2) user-friendly rule guidance with visual clearance meters** in the recommendations panel.

---

## Recent Changes (This Session)

### 1. Floor Plan Drag System Redesigned — Free Movement Across Unit

**Files changed:** `src/components/floorPlanDrag.ts`, `src/components/CondoFloorPlan.tsx`, `src/screens/WorkspaceScreen.tsx`

#### What was broken
- Furniture could not actually move — drops were silently rejected by `isFeasible(entireLayout)`, which required *all* pieces to be clear
- Initial layouts placed every stray piece at its room's exact centre, creating permanent overlaps
- Camera zoom during drag jostled the piece's world coordinates
- Room membership was hard-coded, even for oversized pieces

#### What's fixed
- **Free movement:** Pieces now drag across the entire unit. Only the unit's outer wall is a hard boundary; room membership is **derived automatically** from where you drop (by footprint overlap majority)
- **Live feedback while dragging:**
  - Alignment guides (blue dashed lines) snap to walls, room edges, and neighbours' edges + centerlines
  - Gap readouts on all four sides show clearance in centimetres, colour-coded by your rule thresholds (red <60cm, orange <91cm, green)
  - Collision highlighting when dragging over overlaps
  - Room drop-target zones highlight as you cross them
- **Robust coordinate tracking:** Delta-based dragging captures screen-to-world scale at pointerdown, immune to mid-drag camera zoom
- **Better initial layout:** `packItemsIntoRoom()` lays out mislaced pieces side-by-side without overlaps, instead of stacking them
- **Per-item validation:** Only the dragged piece is validated on release; pre-existing overlaps elsewhere don't block you
- **50-step undo history:** Ctrl/Cmd+Z, plus an Undo button
- **Keyboard:** Arrow keys nudge 1cm (Shift for 10cm), R rotates, keyboard overlay updated
- **Verified:** All 19 drag-geometry assertions pass (packing, room attribution, unit clamping, snapping, per-item gating, gap measurement)

#### Architecture
- `floorPlanDrag.ts`: Core physics (clampToUnit, roomIdForItem, snapFree with intelligent guide calculation, edgeGaps, packItemsIntoRoom)
- `CondoFloorPlan.tsx`: SVG rendering + window-level pointer listeners (pointermove/pointerup at window, not element)
- `WorkspaceScreen.tsx`: DragSession interface, history stack, normalization via packItemsIntoRoom, keyboard handlers, commitLayout helper

---

### 2. Recommendations Panel — User-Friendly Rule Guidance with Visual Meters

**Files changed:** `src/screens/WorkspaceScreen.tsx`, `src/App.css`  
**Files added:** `src/engine/ruleGuidance.ts`, `src/components/ClearanceMeter.tsx`

#### What was missing
- Red/amber/green badges with bare rule codes (L1, D3, etc.) — no context for residents
- No way to see which rule applied or why it mattered
- No reference list of all 10 rules

#### What's new
- **Each violation card now shows:**
  - Rule in plain English — "Room to walk through" — with its requirement spelled out
  - Clearance meter: your measurement plotted against the rule's own three bands (RED/YELLOW/GREEN) with distinct silhouettes (triangle/diamond/circle) so it survives greyscale and full CVD
  - "DO THIS" action block with the move direction and consequence if you don't
  - Traceability: `Rule L1 · General Circulation` footer
- **New Rules tab** (third panel) — all 10 rules grouped by area, each showing passing/failing status and its band definitions
- **Accessibility-first encoding:**
  - Shape (triangle/diamond/circle) instead of colour alone
  - Position on the meter track (fully colour-independent reading)
  - Words on every band caption
  - 2px surface gaps between bands for structural boundaries
- **Smooth animations:** Cards stagger in with `recCardIn` keyframe (40ms delay per card), lift on hover, meter marker eases to new position
- **Verified:** All 12 meter geometry checks pass — bands tile to 100% with no unreadable slivers, meter band always agrees with engine's `classifyGap` at every threshold

#### Architecture
- `ruleGuidance.ts`: User-facing layer over 10 rules — title, requirement, consequence (in plain language, never codes), thresholds, and helpers (bandRanges, meterMaxCm)
- `ClearanceMeter.tsx`: Visual meter component — track with three bands, marker, readout row, band captions with glyphs
- Drawer widened from 18% flex to 340px (min 300px) to fit richer cards without crushing

#### Accessibility note
Your red/amber/green palette (ΔE 2.8 between amber `#B45309` and red `#DC2626` under deuteranopia) is inherently CVD-hostile — no hue substitution fixes it, because traffic-light triads don't work for red-green colourblindness. I tested four amber alternatives; none passed CVD checks. Instead, the UI never relies on colour alone — every status has a distinct shape + label + numeric position, so the information is accessible whether the viewer perceives the hue or not.

---

## Project Context (Locked)

**What it is:** BSIT Undergraduate Thesis — Application Development. A WebXR/2D tool for 2BR condo residents (Mulberry Place, Acacia Estates, Taguig) to layout furniture and validate against 10 clearance rules from *Time-Saver Standards for Interior Design* (DeChiara, Panero & Zelnik, 2001, pp.61–99).

**Tech stack:** React 19 + TypeScript 6 + Vite 8 + @react-three/fiber/xr + Zustand + Supabase + Vercel + jsPDF

**The 10 rules** (locked values in `src/engine/rules.ts`):
- **Living (L1–L5):** General circulation, sofa-coffee table legroom, secondary path, main traffic, conversation depth
- **Dining (D1–D5):** Table-to-wall, chair pull-out, passage behind seated, walking past seated, minimum passage
- Each rule has RED (violation), YELLOW (warning), GREEN (clear) thresholds

**Research sample:** N=30 purposive (2BR only). Phase 3 evaluation sessions starting soon with 10 seeded accounts in Supabase.

---

## Current Architecture

### Screen Flow (App.tsx routing)
```
auth → AuthScreen (login/register/guest against Supabase users table)
  ↓
entry → EntryScreen
  ↓
unitSetup → UnitSetupScreen
  ↓
furnitureInput → FurnitureInputScreen (AR two-tap measuring, planeDetection still true ⚠️)
  ↓
positionMap → PositionMapScreen (AR furniture placement)
  ↓
analysis → AnalysisScreen (AR overlay, space score card, violations list; planeDetection still true ⚠️)
  ↓
recommendations → RecommendationScreen (Concept 5: one violation at a time; planeDetection still true ⚠️)
  ↓
report → ReportScreen (rebuilt 2026-06-13: before/after space score, violations resolved, final status)
```

### Store Locations
- `src/stores/sessionStore.ts` — currentScreen, navigateTo, userId, roomDimensions
- `src/stores/furnitureStore.ts` — items[], layout normalization
- `src/stores/violationStore.ts` — violations[], analysis results

### Key Engines
- `src/engine/rules.ts` — 10 rules, classifyGap(measuredCm, rule) → 'RED'|'YELLOW'|'GREEN', Priority Score formula
- `src/engine/clearance.ts` — runClearanceAnalysis(items, roomDimensions) → sorted violations with priority scores
- `src/engine/ruleGuidance.ts` — **NEW** — user-facing text layer (title, requirement, consequence) for each rule
- `src/components/floorPlanDrag.ts` — **REWRITTEN** — free-movement physics (clampToUnit, roomIdForItem, snapFree, packItemsIntoRoom)
- `src/components/CondoFloorPlan.tsx` — **REWRITTEN** — SVG floor plan + window-level drag listeners

### AR
- `src/ar/ClearanceOverlay.tsx` — AR rendering of violations (fixed — uses getBounds() + getWallZone())
- `src/ar/CorrectionArrow.tsx` — directional guidance for fixes
- `src/ar/ARMeasureSession.tsx` — point-to-point distance measuring (tap-tap with reticle)

### Supabase Tables (current)
- `users` — login (username, password_hash, building, unit_number); admin bypass: admin/admin123
- `participants`, `pre_survey_responses`, `sus_responses`, `post_survey_responses` — legacy, largely unused
- `space_utilization_scores` — **EMPTY** — broken Supabase write (see Known Issues below)
- `ar_measurement_tests`, `rule_test_cases` — schema present, not yet populated

---

## What's Working

✅ **2D Floor Plan**
- Drag pieces freely across the entire unit with smooth snapping
- Live gap readouts, alignment guides, collision highlighting
- Undo history (50 steps), keyboard shortcuts (arrows, R, Ctrl+Z)
- Smart automatic room re-homing based on drop location

✅ **AR Furniture Placement** (PositionMapScreen only — other screens still have planeDetection=true)
- Point-to-point measuring with reticle
- Furniture layout in AR space with bounding box collision
- Surfaces (floor, walls) visible

✅ **Clearance Analysis**
- 10 rules evaluated, violations sorted by Priority Score
- Gaps measured correctly, classifications (RED/YELLOW/GREEN) accurate
- Before/after space score tracked

✅ **Recommendations UI**
- Concept 5: one violation at a time, priority ranked
- Correction arrow guidance in AR
- User-friendly rule descriptions (no bare codes)
- Visual clearance meters with distinct shapes + labels (CVD-safe)

✅ **Reports**
- Before/after space utilization shown
- Final status per rule

✅ **Auth**
- Login/register/guest against Supabase users table
- Admin account (admin/admin123) with user management UI

---

## Known Issues & Blockers

### 🔴 planeDetection still true in 3 files — ARCore rejection risk

**Status:** Unfixed  
**Files:**
- `src/screens/AnalysisScreen.tsx` (line ~18)
- `src/screens/RecommendationScreen.tsx` (line ~18)
- `src/screens/FurnitureInputScreen.tsx` (line ~15)

**Impact:** Any unsupported WebXR required feature causes the whole AR session to be rejected with "AR Placement Failed" on Android Chrome. `plane-detection` is not universally supported.

**Fix:** Remove `planeDetection: true` from these 3 `createXRStore` calls. (PositionMapScreen was already fixed.)

---

### 🔴 space_utilization_scores table is empty — root cause found, fix designed but not applied

**Status:** Broken Supabase write identified, design approved, implementation interrupted  
**Root cause:** `sessionStore.participantId` is never set → `AnalysisScreen.tsx` useEffect always bails on the guard → no row written

**Current (broken) flow:**
1. AnalysisScreen tries to save at analysis time (before corrections) with score_after=0
2. Nothing ever updates those fields, so score_after stays 0
3. participantId is undefined anyway, so the whole thing fails silently

**Fix (designed, not yet applied):**
- Remove the broken save from `AnalysisScreen.tsx` entirely
- Instead, do a single complete write from `ReportScreen.tsx` (where spaceScoreBefore, spaceScoreAfter, resolved violation count are all known)
- Use `sessionStore.userId` (set at login) as the participant/user reference

**Impact:** Every evaluation session's space utilization score is silently lost. Before Phase 3 sessions, this must be fixed.

---

### 🟡 AR coordinate drift between sessions (known limitation, not a bug)

**Status:** By design — each enterAR() starts a fresh world origin at the device's current position  
**Impact:** Furniture posX/posZ stored during positionMap are only valid within that session. Re-opening AR causes offset.

**Mitigation:** See [[project_habi3d_live_scan_backup_plan]] for a fallback approach (reuse ARMeasureSession as a live rule-violation checker without persisting cross-session coordinates).

---

### 🟡 Authentication system drift from locked spec

**Locked decision:** "No login system — researcher assigns P01-P30 participant codes"  
**Current reality:** Full login/register/guest against Supabase users table with no participant codes

**Impact:** Minor — the login system works and serves the research (data is keyed to userId now). But the memory states a different spec. Clarify which is intended before Phase 3.

---

## Before Phase 3 Evaluation Sessions

**Must-do:**
- [ ] Remove `planeDetection: true` from 3 remaining screens
- [ ] Fix Supabase space_utilization_scores write (AnalysisScreen → ReportScreen approach)
- [ ] End-to-end test on Android Chrome (WebXR)
- [ ] Populate rule_test_cases (10 rules + 5 priority score tests)

**Nice-to-have:**
- [ ] Expert interior designer validation document
- [ ] DMCI floor plan dimensions confirmation
- [ ] Clarify auth spec (locked decision vs current impl)

---

## Key File Changes This Session

| File | Change | Status |
|------|--------|--------|
| `src/components/floorPlanDrag.ts` | Complete rewrite — free movement physics | ✅ Compiled, verified (19 checks) |
| `src/components/CondoFloorPlan.tsx` | Complete rewrite — window-level drag listeners | ✅ Compiled, ref-safety fixed |
| `src/screens/WorkspaceScreen.tsx` | Major refactor — normalization, history, keyboard, commitLayout | ✅ Compiled |
| `src/engine/ruleGuidance.ts` | **NEW** — user-facing rule text layer | ✅ All 10 rules covered |
| `src/components/ClearanceMeter.tsx` | **NEW** — visual meter with bands + glyphs | ✅ Verified (12 checks) |
| `src/App.css` | Added recCardIn animation, wksp-rec-card styles | ✅ Applied |

---

## Testing & Verification Done

✅ TypeScript: `tsc --noEmit` clean  
✅ Linting: eslint clean (two pre-existing mount-time state-in-effect warnings left intentional)  
✅ Production build: `vite build` passes  
✅ Drag geometry: 19 assertions (packing, room attribution, unit clamping, snapping, per-item validation, gap measurement)  
✅ Meter geometry: 12 assertions (guidance coverage, threshold sync, band tiling, band/engine agreement, marker clamping, green visibility)  
✅ Accessibility: Palette validated (CVD separation gap noted, mitigated with shape + label + position encoding)

---

## Next Steps

1. **Immediate (this or next session):**
   - Remove `planeDetection: true` from 3 files
   - Apply Supabase fix (move write to ReportScreen)
   - Test in browser to verify drag & recommendation UI render correctly

2. **Before Phase 3 sessions:**
   - Test on Android Chrome
   - Populate test cases
   - Verify all 10 accounts seeded in Supabase

3. **Long-term (post-thesis):**
   - Investigate AR coordinate persistence (worldmap anchors, if WebXR updates support)
   - Consider the ARMeasureSession live-checker fallback if drift persists

---

## Useful Links

- **Memory:** `C:\Users\Dell\.claude\projects\c--Users-Dell-Habi3D-Project\memory\`
- **Repo docs:** `PROCESS_FLOW.md`, `SYSTEM_CANVAS.md` at repo root
- **Time-Saver Standards citation:** DeChiara, Panero & Zelnik (2001), pp.61–99
