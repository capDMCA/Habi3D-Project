# Habi3D Codebase — Current State & Recent Changes

**Last updated:** 2026-08-10
**Project phase:** Late Phase 2 → Phase 3 readiness

---

## Executive Summary

Habi3D is a **Priority-Ranked Sequential Recommendation Tool** for condominium residents to validate furniture layout against 10 clearance rules (5 living room, 5 dining). Five rounds of work have landed:

1. **Free-movement drag system** for the 2D floor plan (`WorkspaceScreen`/`CondoFloorPlan`)
2. **User-friendly rule guidance with visual clearance meters** in the recommendations panel
3. **Downloadable PDF report** on the Report screen — a one-page client-side keepsake of the session
4. **Single-unit scope + full account auth rebuilt** — the thesis now targets one fixed Mulberry Place unit (no picker), and login is back — this time on real Supabase Auth, with a "resume your last session" feature
5. **Circular dining table support**, end to end — measuring, 2D rendering, PDF rendering

There is also a **pending request, not yet implemented** — see "Pending / Open Requests" below.

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
- Accessibility-first encoding (shape + words + track position, never colour alone) — the app's red/amber/green palette is inherently CVD-hostile (ΔE 2.8 under deuteranopia); mitigated rather than "fixed," since no hue substitution solves a traffic-light triad for red-green colourblindness
- Verified: 12 meter geometry assertions pass

---

### 3. Downloadable PDF Report

**Files added:** `src/components/pdfReport.ts`, `src/components/DownloadReportButton.tsx`

- One-page PDF: header, drawn floor-plan snapshot, plain-language per-item status list, closing disclaimer
- Generated **client-side** with `jsPDF` — no server call, no upload, no Supabase write
- Draws from the same geometry source as the live plan (`CONDO_ROOMS` + `projectItems()`) — never a screenshot. Confirmed the `html2canvas` chunk that shows up in the production build is jsPDF's own unused `.html()` plugin (a dynamic import inside jsPDF itself), not anything this codebase calls — `grep -r html2canvas src/` stays clean
- `DownloadReportButton` is a shared idle → working → success → idle / error-with-retry component

---

### 4. Single-Unit Scope + Account Auth Rebuilt

This reverses part of an earlier decision. The project had gone anonymous-only (no login, generated `sessionId` only) as a deliberate simplification. That decision was **reversed on purpose**: the thesis now scopes to one fixed 2BR Mulberry Place unit, and residents need real accounts so they can leave and resume a session later.

**Files deleted:** `src/screens/UnitSetupScreen.tsx`
**Files added:** `src/screens/AuthScreen.tsx`, `src/stores/useAutosaveLayout.ts`
**Files changed:** `src/types/index.ts`, `src/data/roomData.ts`, `src/stores/sessionStore.ts`, `src/stores/furnitureStore.ts`, `src/supabase.ts`, `src/App.tsx`, `src/screens/EntryScreen.tsx`, `src/screens/FurnitureInputScreen.tsx`, `src/screens/PositionMapScreen.tsx`, `src/screens/WorkspaceScreen.tsx`

#### Single-unit scope
- `roomData.ts` only ever contained one unit config (`MULBERRY_PLACE_2BR`) — the old 15-option `UnitSetupScreen` picker was already cosmetic, every option started from the same `defaultDimensions` regardless of which was picked. So there was no real ambiguity to resolve here.
- `UnitSetupScreen.tsx` deleted outright. `sessionStore.startNewSession()` now sets `unitTypeId` to a fixed constant (`MULBERRY_PLACE_2BR_ID`) and reads `roomDimensions` straight from `roomData.ts` — no picker, no confirmation screen.
- Step counters that referenced the old 6-step wizard (`FurnitureInputScreen`/`PositionMapScreen` said "Step 2/4 of 6") were stale even before this — the earlier `DimensionVerificationScreen` deletion had already broken that numbering. Fixed to an honest "Step 1/2 of 2".

#### Auth — rebuilt on real Supabase Auth, not the old custom table
`AuthScreen.tsx`/`AdminScreen.tsx` and every auth function in `supabase.ts` were confirmed **fully deleted**, not dead code, before this rebuild started. Rebuilt using `supabase.auth.signUp`/`signInWithPassword` (`auth.users`) rather than reviving the old hand-rolled `users` table + SHA-256 password column.

- `EntryScreen.tsx` now has three buttons: **Begin Session** (unchanged — anonymous, nothing saved), **Log in**, **Create account**
- **Create account** → immediate session start → `furnitureInput`
- **Log in** → checks `saved_sessions` for that account → if a saved layout exists, shows an inline **"Resume your last session" / "Start fresh"** choice (not a modal) → Resume loads the layout straight into `WorkspaceScreen` via a new `furnitureStore.setItems()` action
- `AdminScreen` was **not** restored, per explicit instruction — regular user auth only

#### Session persistence — `saved_sessions`
- Debounced autosave (1.5s) on every layout change, wired into both `FurnitureInputScreen` and `WorkspaceScreen` via one shared hook (`useAutosaveLayout`) — chosen over a completion-only write so a resident who closes the tab mid-arrangement, before ever reaching Report, still has something to resume
- No-op on the anonymous "Begin Session" path (`userId` is null there — matches "no account = nothing persisted")
- **⚠️ The `saved_sessions` table does not exist yet.** I have no DB execution access from this environment — it must be created manually. Exact DDL + required RLS policies:
  ```sql
  create table saved_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade unique,
    session_id text not null,
    layout_data jsonb not null,
    updated_at timestamptz not null default now()
  );
  alter table saved_sessions enable row level security;
  create policy "select own session" on saved_sessions for select using (auth.uid() = user_id);
  create policy "upsert own session" on saved_sessions for insert with check (auth.uid() = user_id);
  create policy "update own session" on saved_sessions for update using (auth.uid() = user_id);
  ```
  One row per `user_id` (upsert) — "resume" always means "your latest layout," no session-history table.
- **⚠️ Check the Supabase project's email-confirmation setting.** If "Confirm email" is on (Supabase's default for new projects), `signUp` won't produce an active session until the resident clicks a confirmation link — so `auth.uid()` is null and the autosave write fails silently (caught, logged to console) until they confirm. For thesis testing convenience this probably wants to be **off** (Authentication → Providers → Email in the Supabase dashboard). Not changed from this environment — no dashboard access.

#### Current screen flow
```
entry (Begin Session / Log in / Create account)
  ├─ Begin Session ──────────────► furnitureInput (anonymous, nothing persisted)
  ├─ Create account ──► auth (signup) ──────────► furnitureInput
  └─ Log in ──────────► auth (login) ──► saved_sessions found?
                                            ├─ no ──────────────► furnitureInput
                                            └─ yes ─► Resume/Start fresh choice
                                                        ├─ Resume ──► recommendations (WorkspaceScreen, furniture pre-placed)
                                                        └─ Start fresh ─► furnitureInput

furnitureInput → positionMap → analysis/recommendations/recommendation (WorkspaceScreen) → report
```

#### What was NOT verified
No browser/device available in this environment. Verified structurally instead: `tsc`/`eslint` clean, and traced by hand that `AuthScreen.handleResume`'s `setItems()` call feeds into `WorkspaceScreen`'s existing `useMemo`-based clearance analysis correctly on mount. **Not** the same as clicking through create-account → place furniture → reload → log back in → confirm restore. Do that once the SQL above is run.

---

### 5. Circular Dining Table Support, End to End

**Files changed:** `src/components/floorPlanGeometry.ts`, `src/components/CondoFloorPlan.tsx`, `src/components/pdfReport.ts`, `src/screens/FurnitureInputScreen.tsx`, `src/screens/WorkspaceScreen.tsx`

**A pre-existing inconsistency, resolved rather than compounded:** `FurnitureItem.shape` already included `'round'`/`'oval'`/`'l-shape'` (not just `'rectangle'`), and `'round'` was already selectable in `FurnitureInputScreen`'s shape picker for `dining_table`/`side_table`/`coffee_table`/`other` — but only wired through to the AR 3D preview, never to the 2D plan or the PDF. Rather than add a second, competing `shape` field, the existing `'round'` value was extended end to end.

- **Measuring:** a round shape now shows a single "Diameter" field (two AR taps, edge-to-edge through the centre, reusing `ARMeasureSession`'s existing point-to-point primitive unchanged) instead of separate Length/Width fields. The measured value is written to both `lengthCm` and `widthCm`.
- **2D rendering:** `CondoFloorPlan.tsx` draws an SVG `<circle>` instead of a `<rect>` for round items. `PlanRect` (in `floorPlanGeometry.ts`) now carries a `shape` field, passed through from the source item, so both renderers read it from the one geometry source rather than each re-deriving it.
- **Rotation disabled for round items** — the button is hidden (not just greyed out) when a round item is selected, and `handleRotate` itself no-ops too, so the R keyboard shortcut can't bypass the hidden button.
- **PDF:** `pdfReport.ts` draws `doc.circle(...)` for round items using the same `projectItems()` source.
- **No clearance-engine changes** — confirmed rather than assumed: `effectiveLengthCm`/`effectiveWidthCm` treat a `lengthCm === widthCm` item's square bounding box as exact at rotation 0° and conservatively oversized (up to `diameter×√2`) at 45°, the same safe-direction bias already accepted for rotated rectangles. Verified numerically against the real engine (11/12 assertions passed; the 1 "failure" was float-rounding noise in the test's own strict-equality check, not a defect).
- **Known gap, not silently left:** `FloorPlan2D.tsx` (used by `PlanSandbox` inside the currently-orphaned `RecommendationScreen.tsx`) still draws every item as a `<rect>` regardless of shape — out of this task's explicit scope, and touching dead-code screens risked scope creep. Needs the same treatment if `RecommendationScreen` is ever revived.

---

## Pending / Open Requests

**Not yet implemented** — received right after the auth rebuild above, work paused pending clarification:

1. **A "guest" feature for testing.** Asked whether it should just be a second button that does exactly what "Begin Session" already does (fully anonymous, nothing saved), or a real lightweight Supabase **anonymous-auth** account (so testers can exercise the save/resume feature too, without typing credentials). Not answered yet — flagged rather than guessed, since the two options are materially different features, not a style choice.
2. **Login/create-account should use a username instead of an email field.** This one's unambiguous and just needs implementing: Supabase Auth is natively email-based, so the plan is a synthetic-email pattern (`${username}@habi3d.local` under the hood, real username kept in `user_metadata`) — Supabase's own `auth.users.email` uniqueness constraint gives username uniqueness for free, no extra table needed. Worth noting: this means the app collects no real email address at all going forward, and rules out any future "reset password via email" flow using the entered username as-is.

---

## Project Context (Locked)

**What it is:** BSIT Undergraduate Thesis — Application Development. A WebXR/2D tool for 2BR condo residents (Mulberry Place, Acacia Estates, Taguig) to lay out furniture and validate against 10 clearance rules from *Time-Saver Standards for Interior Design* (DeChiara, Panero & Zelnik, 2001, pp.61–99).

**Tech stack:** React 19 + TypeScript 6 + Vite 8 + @react-three/fiber/xr + Zustand + Supabase + Vercel + jsPDF

**The 10 rules** (locked values in `src/engine/rules.ts`):
- **Living (L1–L5):** General circulation, sofa-coffee table legroom, secondary path, main traffic, conversation depth
- **Dining (D1–D5):** Table-to-wall, chair pull-out, passage behind seated, walking past seated, minimum passage
- Each rule has RED (violation), YELLOW (warning), GREEN (clear) thresholds

**Research sample:** N=30 purposive (2BR only, single unit — see Recent Changes #4). Phase 3 evaluation sessions upcoming.

---

## Current Architecture

### Screen Flow
See the diagram under Recent Changes #4 — that's the live routing as of this update.

`arDemo` still routes to `ARDemoScreen` but nothing in the flow links to it.

### Store Locations
- `src/stores/sessionStore.ts` — `currentScreen`, `navigateTo`, `sessionId`, `unitTypeId` (fixed), `roomDimensions` (fixed), `userId`, `userEmail`, `authMode`, `startNewSession()`
- `src/stores/furnitureStore.ts` — `items[]`, `addItem`/`updateItem`/`updatePosition`/`removeItem`/`clearAll`, plus a new `setItems()` for bulk-loading a resumed layout
- `src/stores/violationStore.ts` — violations[], recommendations[], analysis results
- `src/stores/useAutosaveLayout.ts` — not a store, a shared hook consumed by any screen that mutates furniture

### Key Engines
- `src/engine/rules.ts` — 10 rules, `classifyGap()`, Priority Score formula
- `src/engine/clearance.ts` — `runClearanceAnalysis()`; unchanged by the circular-table work (confirmed, see #5)
- `src/engine/ruleGuidance.ts` — user-facing text layer per rule
- `src/components/floorPlanDrag.ts` — free-movement physics + unit envelope constants
- `src/components/floorPlanGeometry.ts` — `projectItems()`, the single geometry source `CondoFloorPlan` and `pdfReport` both draw from, now carries `shape`
- `src/components/CondoFloorPlan.tsx` — SVG floor plan + window-level drag listeners + circle rendering
- `src/components/pdfReport.ts` — client-side PDF builder (jsPDF)
- `src/components/DownloadReportButton.tsx` — shared download UI state machine

### AR
- `src/ar/ClearanceOverlay.tsx`, `src/ar/CorrectionArrow.tsx`, `src/ar/ARMeasureSession.tsx` (point-to-point measuring, now also used for diameter taps)

### Supabase
- **Auth:** `auth.users` via Supabase Auth (`signUpWithEmail`/`signInWithEmail` in `supabase.ts` — names are historical, will need renaming if/when the username-not-email request above lands)
- **`saved_sessions`** — needs to be created manually, see SQL under Recent Changes #4
- **`space_utilization_scores`** — still **EMPTY**. The fix should now key on the real Supabase `user_id` instead of the anonymous `sessionId` — flagged as a decision, not implemented (see Known Issues)
- `participants`, `pre_survey_responses`, `sus_responses`, `post_survey_responses` — legacy, unused
- `ar_measurement_tests`, `rule_test_cases` — schema present, not yet populated
- The old custom `users` table (username/password_hash) is no longer referenced anywhere — auth now runs entirely on `auth.users`

---

## What's Working

✅ **Entry & auth** — clean landing with anonymous/login/create-account paths; login offers resume of a saved layout
✅ **Single fixed unit** — dimensions read silently from `roomData.ts`, no picker
✅ **2D Floor Plan** (`WorkspaceScreen`) — free drag, live gap readouts, alignment guides, collision highlighting, undo, keyboard shortcuts, automatic room re-homing
✅ **Circular furniture** — diameter measuring, circle rendering in both the live plan and the PDF, rotation correctly disabled
✅ **AR Furniture Placement** (`PositionMapScreen`) — planeDetection already off
✅ **Clearance Analysis** — 10 rules, Priority Score ranking, unaffected by circular-table work
✅ **Recommendations UI** — plain-English rule guidance, CVD-safe clearance meters, Rules reference tab
✅ **Reports** — plain-language room-by-room status, PDF download

---

## Known Issues & Blockers

### 🔴 `saved_sessions` table doesn't exist — nothing persists until it's created
See the SQL under Recent Changes #4. Every write is caught and logged to console (won't crash the app), but silently does nothing until this table + its RLS policies exist.

### 🟡 Supabase email-confirmation setting unverified
If enabled, new accounts can't autosave/resume until the resident confirms their email. Check Authentication → Providers → Email in the Supabase dashboard.

### 🔴 planeDetection still true — one live file
**Live blocker:** `src/screens/FurnitureInputScreen.tsx` (line ~15) — still routed, still `planeDetection: true`.
**Dead code, same flag present, low priority:** `AnalysisScreen.tsx`, `RecommendationScreen.tsx` (orphaned since `WorkspaceScreen` replaced them), `ARDemoScreen.tsx` (unreached from the live flow).
**Fix:** remove `planeDetection: true` from `FurnitureInputScreen.tsx`'s `createXRStore` call before Android testing.

### 🔴 `space_utilization_scores` table is empty
Root cause: no write path was ever completed. Now that real accounts exist, the fix should key on `user_id` (this is a recommendation, not yet implemented — explicitly flagged rather than silently built, since it wasn't part of the auth-rebuild task).

### 🟡 AR coordinate drift between sessions (known limitation, not a bug)
Each `enterAR()` starts a fresh world origin. Furniture `posX`/`posZ` from `positionMap` are only valid within that session. See `project_habi3d_live_scan_backup_plan` memory for a fallback approach.

### 🟡 `signUpWithEmail`/`signInWithEmail` naming will go stale
If the pending username-not-email request (see Pending / Open Requests) lands, these function names in `supabase.ts` should be renamed for clarity even though the underlying Supabase call still technically uses a (synthetic) email.

---

## Before Phase 3 Evaluation Sessions

**Must-do:**
- [ ] Run the `saved_sessions` SQL (table + RLS policies) in the Supabase SQL editor
- [ ] Check/set the Supabase email-confirmation setting
- [ ] Remove `planeDetection: true` from `FurnitureInputScreen.tsx`
- [ ] Decide and implement the `space_utilization_scores` fix, keyed on `user_id`
- [ ] End-to-end test on Android Chrome (WebXR), including the new circular-table measuring flow
- [ ] Live-test the full auth + resume flow in a real browser (create account → place furniture → reload → log back in → confirm restore) — only verified structurally so far
- [ ] Populate `rule_test_cases` (10 rule tests + 5 priority score ranking tests)
- [ ] Resolve the pending guest-feature and username-vs-email requests

**Nice-to-have:**
- [ ] Decide the fate of orphaned `AnalysisScreen.tsx`/`RecommendationScreen.tsx` (delete, or bring up to date with the circular-table rendering `FloorPlan2D.tsx` is currently missing)
- [ ] Expert interior designer validation document
- [ ] DMCI floor plan dimensions confirmation

---

## Testing & Verification Done (cumulative)

✅ TypeScript: `tsc -b --force` clean across the whole repo
✅ Linting: `eslint .` clean except two pre-existing mount-time `set-state-in-effect` warnings in `WorkspaceScreen.tsx` (left intentional — legitimate effects writing to the external furniture store; fixing risked destabilizing the drag/preview sync)
✅ Production build: `vite build` passes
✅ Drag geometry: 19 assertions
✅ Meter geometry: 12 assertions
✅ Circular-table geometry + clearance: 11/12 assertions (1 float-rounding false alarm in the test itself, not the product)
✅ PDF geometry: confirmed via grep + jsPDF source inspection — no screenshot capture anywhere, the `html2canvas` build chunk is inert unused library code

**Not verified — no browser/device available in this environment:**
- The auth signup/login/resume flow, live
- Circular table rendering, visually
- Android Chrome / WebXR behavior generally

---

## Useful Links

- **Memory:** `C:\Users\Dell\.claude\projects\c--Users-Dell-Habi3D-Project\memory\`
- **Repo docs:** `PROCESS_FLOW.md`, `SYSTEM_CANVAS.md` at repo root
- **Time-Saver Standards citation:** DeChiara, Panero & Zelnik (2001), pp.61–99
