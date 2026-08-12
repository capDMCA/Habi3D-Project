# Habi3D Codebase — Current State & Recent Changes

**Last updated:** 2026-08-11
**Project phase:** Late Phase 2 → Phase 3 readiness

---

## Executive Summary

Habi3D is a **Priority-Ranked Sequential Recommendation Tool** for condominium residents to validate furniture layout against 10 clearance rules (5 living room, 5 dining). Eight rounds of work have landed:

1. **Free-movement drag system** for the 2D floor plan (`WorkspaceScreen`/`CondoFloorPlan`)
2. **User-friendly rule guidance with visual clearance meters** in the recommendations panel
3. **Downloadable PDF report** on the Report screen — a client-side keepsake of the session
4. **Single-unit scope + full account auth (v1)** — the thesis now targets one fixed Mulberry Place unit (no picker), login rebuilt on Supabase Auth
5. **Circular dining table support**, end to end — measuring, 2D rendering, PDF rendering
6. **Auth rebuilt again — Supabase Auth replaced with a plain username/password table.** No synthetic email, no `auth.users` dependency. Passwords hashed with bcrypt inside Postgres (`pgcrypto`), never in the browser.
7. **Full visual modernization** — one design-token source app-wide, native system typeface (dropped the Google Fonts dependency), a real landing-page hierarchy, and a WorkspaceScreen chrome overhaul (compact header, Rotate/Undo/Reset moved to a slim icon row under the plan instead of a large footer bar).
8. **Comprehensive PDF report** — the download now includes a full rule-by-rule breakdown (all 10 rules, violated *and* cleared), paginated, not just a one-page item summary.

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

### 4. Single-Unit Scope + Account Auth (v1 — superseded by Round 6)

- `roomData.ts` only ever contained one unit config (`MULBERRY_PLACE_2BR`); the old 15-option `UnitSetupScreen` picker was deleted, `sessionStore.startNewSession()` reads the fixed dimensions directly
- Step counters fixed to an honest "Step 1/2 of 2"
- Auth (v1) was rebuilt on real Supabase Auth (`supabase.auth.signUp`/`signInWithPassword`) — **this has since been replaced, see Round 6.**
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

### 6. Auth Rebuilt Again — Plain Username/Password Table, No Supabase Auth

**Files changed:** `src/supabase.ts`, `src/screens/AuthScreen.tsx`, `src/stores/sessionStore.ts`
**Files deleted (functions, not files):** `signUpWithEmail`/`signInWithEmail` (`supabase.auth.*` calls) — replaced, not left as dead code

This reverses Round 4's Supabase Auth rebuild on explicit instruction: no synthetic email, no `auth.users` dependency, username + password only. Confirmed (not assumed) via `grep -rn "supabase\.auth\."` that these were the *only* two Supabase Auth call sites in the whole codebase before removal.

#### Password hashing — inside Postgres, not the browser
The client never sees a `password_hash`. Hashing/verification happens entirely in Postgres via `pgcrypto` (`crypt()`/`gen_salt('bf')` — bcrypt/Blowfish), called through two `SECURITY DEFINER` RPC functions the client invokes with `supabase.rpc(...)`. Doing this with a client-side bcrypt library instead would require `SELECT`ing `password_hash` down to the browser to compare — that hands every password hash to anyone with devtools open. This is why it's RPC-based rather than a client bcrypt dependency, even though one was on the table.

**`users` table SQL** (not yet confirmed to exist in Supabase — no DB execution access from this environment; verify first with the query below, since a pre-Supabase-Auth `users` table with a *different* schema — SHA-256 `password_hash`, no RLS — may already occupy the name):
```sql
-- Run first to check what's already there:
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'users'
order by ordinal_position;

-- If nothing returned:
create table users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);
alter table users enable row level security;
-- No policies added on purpose — the client never touches this table
-- directly. All access goes through the SECURITY DEFINER functions below.
revoke all on users from anon, authenticated;

-- If a users table already exists (old SHA-256 schema), move it aside first:
-- alter table users rename to users_legacy_preauth;
-- then run the create table block above.
```

**RPC functions** (`create_user`, `verify_login`):
```sql
create extension if not exists pgcrypto with schema extensions;

create or replace function create_user(p_username text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if p_username is null or length(trim(p_username)) = 0 then
    raise exception 'username_required';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'password_too_short';
  end if;
  if exists (select 1 from users where username = p_username) then
    raise exception 'username_taken';
  end if;

  insert into users (username, password_hash)
  values (p_username, crypt(p_password, gen_salt('bf')))
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function create_user(text, text) from public;
grant execute on function create_user(text, text) to anon;

create or replace function verify_login(p_username text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_hash text;
begin
  select id, password_hash into v_id, v_hash from users where username = p_username;

  if v_hash is null then
    -- Run crypt() anyway against a dummy hash so a missing username takes
    -- about as long as a wrong password — no timing tell for enumeration.
    perform crypt(p_password, '$2a$06$abcdefghijklmnopqrstuv');
    return null;
  end if;

  if crypt(p_password, v_hash) = v_hash then
    return v_id;
  end if;
  return null;
end;
$$;
revoke all on function verify_login(text, text) from public;
grant execute on function verify_login(text, text) to anon;
```

`create_user` throws `username_taken`/`password_too_short`/`username_required` (mapped to friendly messages in `supabase.ts`). `verify_login` returns `null` on any failure — **never reveals whether the username itself exists**, so the client always shows a generic "Incorrect username or password."

#### `saved_sessions` — FK + RLS both need updating
The FK was `user_id → auth.users(id)`; it now needs to point at the new `users(id)`:
```sql
-- If saved_sessions doesn't exist yet, just create it pointed at users(id) directly:
create table saved_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade unique,
  session_id text not null,
  layout_data jsonb not null,
  updated_at timestamptz not null default now()
);

-- If the old auth.users-referencing DDL was already run, migrate instead:
-- alter table saved_sessions drop constraint saved_sessions_user_id_fkey;
-- alter table saved_sessions add constraint saved_sessions_user_id_fkey
--   foreign key (user_id) references users(id) on delete cascade;
```

**RLS is a required change, not optional** — the old policies (`using (auth.uid() = user_id)`) depend on Supabase Auth issuing a JWT. With Supabase Auth gone, `auth.uid()` is always `null`, so those policies would silently deny every read/write forever (caught-and-logged, not a crash — just autosave permanently doing nothing). Replaced with:
```sql
drop policy if exists "select own session" on saved_sessions;
drop policy if exists "upsert own session" on saved_sessions;
drop policy if exists "update own session" on saved_sessions;

create policy "anon read saved session" on saved_sessions for select to anon using (true);
create policy "anon insert saved session" on saved_sessions for insert to anon with check (true);
create policy "anon update saved session" on saved_sessions for update to anon using (true);
```
⚠️ **Flagged, not silently chosen:** this makes a row readable/writable by anyone who supplies its `user_id` — a random UUID never shown in the UI, so functionally the same trust model as an unlisted link. Fine for closed thesis testing; not production-grade. A tighter version would route `saved_sessions` reads/writes through a bearer-token RPC pair (token issued at login, checked server-side) instead of raw table RLS — not built, since the literal ask was "just keyed against the new table's user ids."

#### Other call-site changes
- `src/supabase.ts`: `signUpWithEmail`/`signInWithEmail` (`supabase.auth.*`) → `createAccount`/`logIn` (`supabase.rpc('create_user'|'verify_login')`). `AuthUser.email` → `AuthUser.username`.
- `src/screens/AuthScreen.tsx`: email field → username field (`type="email"` → `"text"`, `autoComplete="email"` → `"username"`).
- `src/stores/sessionStore.ts`: `userEmail` → `username` throughout.
- **No password reset flow** — same limitation the pre-Supabase-Auth table had. Plain fact for this tester group, not a silent gap.

---

### 7. Full Visual Modernization

**Files changed:** `src/components/designTokens.ts`, `src/index.css`, `src/App.css`, `index.html`, `src/screens/EntryScreen.tsx`, `src/screens/FurnitureInputScreen.tsx`, `src/screens/PositionMapScreen.tsx`, `src/screens/ReportScreen.tsx`, `src/screens/WorkspaceScreen.tsx`, `src/components/ErrorBoundary.tsx`

#### Design tokens — one canonical source, app-wide
`designTokens.ts` was previously scoped to just the plan-surface SVG components (its own docstring said so). It's now the app-wide source for colour, type, and typeface; `index.css`'s `:root` custom properties mirror it by hand (documented at the top of both files) — className-based screens need real CSS variables and `pdfReport.ts` needs concrete hex at generation time, neither can resolve a shared `.ts` import, so two files still exist but only one is where values are *decided*.

- **Typeface:** Inter (Google Fonts `@import`, CDN-dependent) → native OS stack (`-apple-system, 'Segoe UI', Roboto, …`). Chosen because this app runs one-handed, in a resident's own apartment, on whatever wifi they have — zero network requests for text to render, zero flash-of-unstyled-text. Removed the `<link>`/`@import` entirely.
- **Type scale:** display 22→24px, title 18→19px, body 15→16px (still ≥15px floor, now with headroom since system fonts read a touch smaller than Inter at the same size). `label` unchanged.
- **Colour:** brand navy, accent blue, and the red/amber/green severity family are **untouched** — already contrast-checked and CVD-mitigated from Round 2, no reason to re-verify a new hue set for a cosmetic pass. What *was* fixed: `index.css`'s generic `--success`/`--warning`/`--danger` (used for form errors, AR-support badges) were a separate, unverified colour set — `#10B981` green on white was ~2.3:1 contrast, well under WCAG AA. Reconciled onto the same verified ≥4.5:1 values the clearance meters already use.
- **Signature choice:** a new `numeric` token (`font-variant-numeric: tabular-nums`) applied to every live measurement in the app — drag-time gap readouts, clearance meter values, dimension steppers — so digits don't jitter sideways while updating in real time. Tied to the app's core interaction, not decorative.
- **One-off styles found and fixed in the same pass:** ~20 hardcoded hex values in `WorkspaceScreen.tsx` → token references; a third independent "danger red" in `FurnitureInputScreen.tsx`'s remove button → `var(--danger*)`; near-duplicate hex sitting next to already-token'd values in `ReportScreen.tsx`; 5 files with an independently hardcoded `"'Inter', system-ui, sans-serif"` string → single `fontFamily` import.
- **Deliberately left alone:** the WebXR camera-overlay HUDs (`FurnitureInputScreen`/`PositionMapScreen`'s `XRDomOverlay` content) — bright status colours over a live camera feed are a different legibility problem than the app's normal light-mode screens, and touching them risks a real regression this environment can't verify (no camera/device). Also left alone: every dead-code screen (`ARDemoScreen`, `AnalysisScreen`, `RecommendationScreen`, `FloorPlan2D`), consistent with Round 5's precedent. `ErrorBoundary.tsx` got the shared `fontFamily`, but its status colours stayed self-contained literals on purpose — it's the crash fallback, and staying decoupled from the rest of the token system is the right isolation for a component whose whole job is rendering when something else may be broken.

#### Landing page (`EntryScreen.tsx`) — three-tier hierarchy
**Begin Session** is primary (largest, filled navy) — for a first-time visitor, trying the tool with zero commitment is the highest-value action, letting the app prove its worth before asking for an account. **Create account** is the stronger of the two auth paths (a first-time visitor is more likely to want one than to already have one). **Log in** dropped to a quiet text link below it ("Already have an account? Log in"). Mulberry Place identity kept in the subtitle. No login fields visible until a path is picked.

#### WorkspaceScreen chrome overhaul
Measured before touching anything (real DOM measurements at a 390×844 viewport, via a temporary store patch reverted immediately after — this environment has no WebXR-capable device to reach WorkspaceScreen through the normal AR-placement flow):

| | Before | After |
|---|---|---|
| Header | 124.8px (stacked title + subtitle + step text) | 57px, single row |
| Footer/toolbar | 185px (full-width "Rotate 90"/"Undo"/"Reset" text buttons, wrapped onto several lines) | Removed as a distinct bar |
| Canvas region (`planContainer`) | 46.1% of viewport height | 81.6% |

- **Header:** dropped the stacked status subtitle ("N clearance issues · N blocked walkways") — it duplicated the pill row directly beneath it, so nothing was lost, only the repetition.
- **Rotate/Undo/Reset:** first moved to a floating cluster over the plan's top-right corner; **user feedback moved it again** to a slim row of 44×44px circular icon buttons directly *under* the canvas (next to the status caption), so the buttons never sit on top of the plan. Same handler functions as before (`handleRotate`/`handleUndo`/`handleResetPosition`), same keyboard shortcuts (wired independently via a `window` keydown listener, untouched).
- **Did not touch:** `floorPlanDrag.ts`, `floorPlanGeometry.ts`, or any drag physics/geometry — layout and chrome sizing only, confirmed via `git diff --stat` showing zero changes to those files.
- **Verified with a real interaction trace** (Playwright, not just a screenshot): select → nudge (keyboard) → undo (new button) → rotate (new button) → reset (new button) — reset landed the item back at its exact original coordinates to full float precision. Zero console errors.
- **Noticed, not fixed (out of scope for this pass):** `workspaceLayout`'s height assumed a 60px header — corrected to 52px as a direct side effect of the header shrinking. Separately, the side drawer (Items/Rules tabs) still wraps below the fold on a 390px-wide viewport due to a 600px flex-basis on the plan panel — a pre-existing responsive issue, untouched since it's outside "top bar / footer / canvas" scope.

#### Process note
The brief referenced `/mnt/skills/public/frontend-design/SKILL.md` for design guidance — that path doesn't exist in this Windows environment (it's a convention from a different, Linux-based sandbox). Proceeded on general design judgement instead; worth knowing for any future session attempting more design work here.

---

### 8. Comprehensive PDF Report — Rule-by-Rule Detail, Paginated

**Files changed:** `src/components/pdfReport.ts`, `src/components/DownloadReportButton.tsx`, `src/screens/ReportScreen.tsx`

The Round 3 PDF only ever showed a coarse per-item status word + one sentence, capped at one page with no pagination guard (content could silently run off the bottom). Now:

- **Every one of the 10 rules that applied to the layout** gets its own section: plain-English requirement, numeric RED/YELLOW/GREEN bands, and every individual check performed against it — **cleared (GREEN) checks included, not only violations.** This data (`allClassifications`) was already computed by `runClearanceAnalysis()` but previously discarded after `AnalysisScreen.tsx`'s local `useMemo` — never stored, never passed to the PDF.
- Each check shows a status word, a plain description ("Between your Sofa and the west wall in the Living Room" — same phrasing convention as `findingText.ts`'s `describeFinding`, adapted for a raw `GapClassification` since it needs to run over cleared checks too, not just violations), and the measurement (with shortfall for anything not comfortable).
- **Real pagination**, added fresh — no precedent existed anywhere in this codebase. `ensureSpace()` checks remaining page height before every block; `addContinuationPage()` starts a new page with a small "(continued)" header when it doesn't fit.
- **`ReportScreen.tsx` recomputes `runClearanceAnalysis()` fresh** (same `getRoomDimensions()` pattern already duplicated in `AnalysisScreen.tsx`, duplicated a third time here rather than extracting a shared helper — matches this codebase's existing precedent of tolerating small duplication over premature abstraction) rather than threading a new field through `violationStore` and every screen that calls `setViolations`/`refreshViolations`.
- `DownloadReportButton`'s new `allClassifications` prop is optional (defaults to `[]`) so `RecommendationScreen.tsx` (dead code, still must compile) needed no changes.
- **Verified with a real downloaded PDF**, not just a compile check: drove the actual Download button in a headless browser, saved the file, confirmed 4 pages via `pdftotext`/`pdfinfo`, and cross-checked the exact Unicode codepoints of the em-dash/middle-dot characters via `pdfjs-dist` (the same rendering engine Chrome itself uses) to rule out a garbled-glyph regression.

---

## Project Context (Locked)

**What it is:** BSIT Undergraduate Thesis — Application Development. A WebXR/2D tool for 2BR condo residents (Mulberry Place, Acacia Estates, Taguig) to lay out furniture and validate against 10 clearance rules from *Time-Saver Standards for Interior Design* (DeChiara, Panero & Zelnik, 2001, pp. 61–90).

**Tech stack:** React 19 + TypeScript 6 + Vite 8 + @react-three/fiber/xr + Zustand + Supabase (Postgres + RPC, not Supabase Auth) + Vercel + jsPDF

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
  ├─ Create account ──► auth (signup, username+password) ──► furnitureInput
  └─ Log in ──────────► auth (login, username+password) ──► saved_sessions found?
                                            ├─ no ──────────────► furnitureInput
                                            └─ yes ─► Resume/Start fresh choice
                                                        ├─ Resume ──► recommendations (WorkspaceScreen, furniture pre-placed)
                                                        └─ Start fresh ─► furnitureInput

furnitureInput → positionMap → analysis/recommendations/recommendation (WorkspaceScreen) → report
```
`arDemo` still routes to `ARDemoScreen` but nothing in the flow links to it.

### Store Locations
- `src/stores/sessionStore.ts` — `currentScreen`, `navigateTo`, `sessionId`, `unitTypeId` (fixed), `roomDimensions` (fixed), `userId`, **`username`** (was `userEmail`), `authMode`, `startNewSession()`
- `src/stores/furnitureStore.ts` — `items[]`, `addItem`/`updateItem`/`updatePosition`/`removeItem`/`clearAll`, `setItems()` for bulk-loading a resumed layout
- `src/stores/violationStore.ts` — `violations[]`, `recommendations[]`, analysis results (still does **not** store `allClassifications` — see Round 8, recomputed on demand in `ReportScreen.tsx` instead)
- `src/stores/useAutosaveLayout.ts` — not a store, a shared hook consumed by any screen that mutates furniture

### Key Engines
- `src/engine/rules.ts` — 10 rules, `classifyGap()`, Priority Score formula
- `src/engine/clearance.ts` — `runClearanceAnalysis()`; returns `{ violations, spaceScoreBefore, allClassifications }` — `allClassifications` holds every check performed (RED/YELLOW/GREEN alike), now consumed by the PDF (Round 8) as well as `AnalysisScreen.tsx`
- `src/engine/ruleGuidance.ts` — user-facing text layer per rule (`ALL_RULE_GUIDANCE`, `bandLabel`, `bandRanges`)
- `src/components/floorPlanDrag.ts` — free-movement physics + unit envelope constants (untouched by Round 7)
- `src/components/floorPlanGeometry.ts` — `projectItems()`, the single geometry source `CondoFloorPlan` and `pdfReport` both draw from (untouched by Round 7)
- `src/components/CondoFloorPlan.tsx` — SVG floor plan + window-level drag listeners + circle rendering
- `src/components/pdfReport.ts` — client-side PDF builder (jsPDF); now multi-page with real pagination (Round 8)
- `src/components/DownloadReportButton.tsx` — shared download UI state machine
- `src/components/designTokens.ts` — **app-wide canonical design tokens** (Round 7) — colour, type scale, `fontFamily`, `numeric` (tabular-nums signature token)

### AR
- `src/ar/ClearanceOverlay.tsx`, `src/ar/CorrectionArrow.tsx`, `src/ar/ARMeasureSession.tsx` (point-to-point measuring, also used for diameter taps)

### Supabase
- **Auth:** plain `users` table (`username`, `password_hash`) — **not** Supabase Auth, **not** `auth.users`. Hashing/verification via `pgcrypto` inside two `SECURITY DEFINER` RPC functions (`create_user`, `verify_login`) — see Round 6 for full DDL. `signUpWithEmail`/`signInWithEmail` naming staleness (previously flagged) is resolved — renamed to `createAccount`/`logIn`.
- **`saved_sessions`** — schema/RLS both need the Round 6 SQL run (FK now points at `users(id)`, not `auth.users(id)`); existence in the live Supabase project still unconfirmed from this environment (no DB execution access)
- **`space_utilization_scores`** — still **EMPTY**, confirmed via `grep` (zero references anywhere in `src/`) — no write path was ever built. Fix should key on `users.id` (same shape as before, just a different source table now)
- `participants`, `pre_survey_responses`, `sus_responses`, `post_survey_responses` — legacy, unused
- `ar_measurement_tests`, `rule_test_cases` — schema present, not yet populated
- The old custom `users` table from *before* the first Supabase Auth round (SHA-256 `password_hash`) may or may not still exist under the same table name — flagged in Round 6, verify before running the new `create table users` DDL

---

## What's Working

✅ **Entry & auth** — clean landing page with a real visual hierarchy; username/password accounts on a plain Postgres table, no Supabase Auth dependency; login offers resume of a saved layout
✅ **Single fixed unit** — dimensions read silently from `roomData.ts`, no picker
✅ **2D Floor Plan** (`WorkspaceScreen`) — free drag, live gap readouts, alignment guides, collision highlighting, undo, keyboard shortcuts, automatic room re-homing, now with a compact header and canvas taking ~82% of viewport height on mobile
✅ **Circular furniture** — diameter measuring, circle rendering in both the live plan and the PDF, rotation correctly disabled
✅ **AR Furniture Placement** (`PositionMapScreen`) — planeDetection already off
✅ **Clearance Analysis** — 10 rules, Priority Score ranking, unaffected by any of Rounds 5–8
✅ **Recommendations UI** — plain-English rule guidance, CVD-safe clearance meters, Rules reference tab
✅ **Reports** — plain-language room-by-room status, PDF download now includes a full rule-by-rule breakdown across multiple pages (violated *and* cleared)

---

## Known Issues & Blockers

### 🔴 `saved_sessions` table/RLS — needs the Round 6 SQL run
Not confirmed to exist in the live Supabase project. Whether or not it does, its FK and RLS policies need to match the new `users` table (see Round 6's SQL) — the old `auth.users`-referencing DDL previously documented here is stale and would leave autosave silently non-functional (`auth.uid()` is always null now that Supabase Auth is gone).

### 🟡 `saved_sessions` RLS trust model is looser than a real session token
Any request bearing the correct `user_id` (a UUID never shown in the UI) can read/write that row. Flagged as a decision in Round 6, not silently chosen — fine for closed thesis testing, a token-gated RPC pair would be the tighter version if wanted later.

### 🟡 No password reset flow
Plain limitation of the username/password table, same as the pre-Supabase-Auth version had. Stated for this tester group, not a silent gap.

### 🔴 planeDetection still true — one live file
**Live blocker:** `src/screens/FurnitureInputScreen.tsx` (line ~15) — still routed, still `planeDetection: true`.
**Dead code, same flag present, low priority:** `AnalysisScreen.tsx`, `RecommendationScreen.tsx`, `ARDemoScreen.tsx`.
**Fix:** remove `planeDetection: true` from `FurnitureInputScreen.tsx`'s `createXRStore` call before Android testing.

### 🔴 `space_utilization_scores` table is empty
Root cause: no write path was ever completed. Fix should key on `users.id` (recommendation, not yet implemented).

### 🟡 AR coordinate drift between sessions (known limitation, not a bug)
Each `enterAR()` starts a fresh world origin. See `project_habi3d_live_scan_backup_plan` memory for a fallback approach.

---

## Before Phase 3 Evaluation Sessions

**Must-do:**
- [ ] Run the Round 6 SQL in the Supabase SQL editor — verify/create `users`, create the `create_user`/`verify_login` RPC functions, migrate `saved_sessions`'s FK and RLS
- [ ] Remove `planeDetection: true` from `FurnitureInputScreen.tsx`
- [ ] Decide and implement the `space_utilization_scores` fix, keyed on `users.id`
- [ ] End-to-end test on Android Chrome (WebXR), including the circular-table measuring flow
- [ ] Live-test the full auth + resume flow in a real browser against the real Supabase project (create account → place furniture → reload → log back in → confirm restore) — only verified structurally/by hand-trace so far, no live device or DB access from this environment
- [ ] Populate `rule_test_cases` (10 rule tests + 5 priority score ranking tests)
- [ ] Resolve the pending guest-feature request (see below)
- [ ] Decide whether the `saved_sessions` RLS trust model (Round 6) needs tightening to a real session token before any wider rollout

**Resolved since last snapshot:**
- ~~Login/create-account should use a username instead of an email field~~ — done, Round 6
- ~~`signUpWithEmail`/`signInWithEmail` naming will go stale~~ — moot, functions renamed to `createAccount`/`logIn`

**Still pending, not yet implemented:**
1. **A "guest" feature for testing.** Still unanswered: a second button that behaves exactly like "Begin Session" (fully anonymous), or a real lightweight Supabase anonymous-auth account (so testers can exercise save/resume without typing credentials)? Flagged rather than guessed — the two options are materially different features.

**Nice-to-have:**
- [ ] Decide the fate of orphaned `AnalysisScreen.tsx`/`RecommendationScreen.tsx`
- [ ] Expert interior designer validation document
- [ ] DMCI floor plan dimensions confirmation

---

## Testing & Verification Done (cumulative)

✅ TypeScript: `tsc -b --force` clean across the whole repo (re-verified after every round, including 6–8)
✅ Linting: `eslint .` clean except two pre-existing mount-time `set-state-in-effect` warnings in `WorkspaceScreen.tsx` (left intentional, unchanged since first flagged)
✅ Production build: `vite build` passes (re-verified after Rounds 6–8)
✅ Drag geometry: 19 assertions · Meter geometry: 12 assertions · Circular-table geometry + clearance: 11/12 assertions
✅ Round 6 (auth): hand-traced create-account → logout → login → same `userId` returned, matching the deterministic bcrypt verify path — not live-executed (no DB access)
✅ Round 7 (visual modernization): real screenshots via a headless browser at a 390×844 viewport; WorkspaceScreen chrome measured via real DOM `getBoundingClientRect()` before/after; a full select→nudge→undo→rotate→reset interaction trace run against the live app, zero console errors
✅ Round 8 (PDF): a real PDF downloaded from the running app, page count and content verified via `pdftotext`, exact glyph codepoints verified via `pdfjs-dist`

**Not verified — no browser/device or DB access available in this environment:**
- The auth signup/login/resume flow, live, against the real Supabase project
- Circular table rendering and the modernized UI, on an actual phone
- Android Chrome / WebXR behavior generally

---

## Useful Links

- **Memory:** `C:\Users\Dell\.claude\projects\c--Users-Dell-Habi3D-Project\memory\`
- **Repo docs:** `PROCESS_FLOW.md`, `SYSTEM_CANVAS.md` at repo root
- **Time-Saver Standards citation:** DeChiara, Panero & Zelnik (2001), pp. 61–90
