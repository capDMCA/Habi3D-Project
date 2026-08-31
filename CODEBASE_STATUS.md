# Habi3D Codebase — Current State, Architecture & Status

**Last updated:** 2026-08-25  
**Project phase:** Late Phase 2 → Phase 3 Readiness  
**Target Unit Scope:** Fixed Single Unit — Mulberry Place 2BR (Acacia Estates, Taguig)

---

## 1. Executive Summary

Habi3D is a **Priority-Ranked Sequential Recommendation Tool** designed for condominium residents to configure, position, and validate furniture layouts against 10 interior design clearance rules (5 living room, 5 dining room) sourced from *Time-Saver Standards for Interior Design* (DeChiara, Panero & Zelnik, 2001, pp. 61–90).

Key milestones and system capabilities include:
1. **Interactive 2D Floor Plan Engine (`WorkspaceScreen` / `CondoFloorPlan`):** Free-movement physics drag system bound by unit outer walls, delta-based coordinate tracking, live tabular-numeral gap readouts, alignment guides, collision detection, 50-step undo stack, and automatic room re-homing.
2. **WebXR AR Placement & 2D Calibration (`PositionMapScreen` / `calibration.ts`):** Two-tap AR-to-2D spatial calibration matrix calculation (NW corner + North wall vector), 3D furniture placement with real-time spatial ghosts, and mid-session recalibration retry paths.
3. **WebXR Camera Point-to-Point Measuring (`ARMeasureSession.tsx`):** AR camera measurement for physical furniture item dimensions and diameter calculations.
4. **End-to-End Circular Furniture Support:** Native handling of round/circular tables and chairs across measuring, 2D floor plan SVG rendering (`<circle>`), rotation locks, and client-side PDF document generation.
5. **Clearance Evaluation Engine (`rules.ts` / `clearance.ts`):** Automated gap analysis calculating item-to-item and item-to-wall clearances, classifying gaps into RED (violation), YELLOW (warning), and GREEN (comfortable) bands, and scoring priorities using $S = \text{SeverityWeight} \times \text{Shortfall} \times \text{EdgeLength}$.
6. **Accessible Guidance & Visual Clearance Meters (`ruleGuidance.ts` / `ClearanceMeter.tsx`):** Plain-English rule descriptions, actionable resolution steps ("DO THIS"), and color-blindness/CVD-safe clearance meters encoding metrics via shape, words, and track position.
7. **Client-Side Paginated PDF Report (`pdfReport.ts` / `DownloadReportButton.tsx`):** Multi-page vector PDF generation via `jsPDF`, drawing SVG geometry directly from `CONDO_ROOMS` and `projectItems()`, accompanied by a rule-by-rule breakdown table.
8. **Authentication & Autosave (`supabase.ts` / `AuthScreen.tsx` / `useAutosaveLayout.ts`):** Production-grade Supabase Auth using synthetic email mapping (`username@habi3d.local`), row-level security (`auth.uid() = user_id`) on the `saved_sessions` table, and 1.5-second debounced layout autosave.
9. **Visual Modernization & Design Tokens (`src/components/tokens/`):** Unified app-wide design token structure (`colors`, `type`, `spacing`, `marks`), native system typeface stack, tabular numbers (`tabular-nums`) for real-time measurements, and high-contrast dark/light responsive layouts.
10. **Session Progress Reframe (`violationStore.ts` / `ReportScreen.tsx`):** Session progress calculated via an initial snapshot diff ("You made N spots more comfortable"), eliminating arbitrary numeric scores or grades.

---

## 2. Core Modules Catalog

The codebase is organized under `src/` into decoupled, single-responsibility modules:

```
src/
 ├── types/             # Global TypeScript interfaces & domain types
 ├── stores/            # Zustand state stores & autosave hooks
 ├── engine/            # Rule definitions, clearance analysis, priority scoring & guidance
 ├── components/        # SVG plan, design tokens, UI widgets, drag physics & PDF generator
 │    └── tokens/       # Token definitions (colors, typography, spacing, markers)
 ├── ar/                # WebXR spatial math, 2-tap calibration, AR camera measure & 3D overlays
 ├── data/              # Layout data (Mulberry Place 2BR zones, dimensions & room bounds)
 ├── screens/           # Active application screen views & router targets
 ├── utils/             # Math & geometry helper utilities
 └── supabase.ts        # Supabase Auth & Postgres API wrapper
```

### 2.1 State Management (`src/stores/`)

* **[sessionStore.ts](file:///c:/Users/Dell/Habi3D-Project/src/stores/sessionStore.ts):**
  * *Purpose:* Controls active screen navigation, user identity (`userId`, `username`), authentication state (`authMode`: `'anonymous'` | `'authenticated'`), active session ID, and fixed Mulberry Place unit dimensions.
  * *Key Exports:* `useSessionStore`, `startNewSession()`, `navigateTo()`, `setAuthUser()`.
* **[furnitureStore.ts](file:///c:/Users/Dell/Habi3D-Project/src/stores/furnitureStore.ts):**
  * *Purpose:* Maintains the active layout inventory (`items: FurnitureItem[]`). Provides CRUD operations (`addItem`, `updateItem`, `updatePosition`, `removeItem`, `clearAll`) and bulk hydration (`setItems`) when loading saved sessions.
  * *Key Exports:* `useFurnitureStore`.
* **[violationStore.ts](file:///c:/Users/Dell/Habi3D-Project/src/stores/violationStore.ts):**
  * *Purpose:* Holds active clearance violations, warning recommendations, space score estimates, and session progress state (`initialFindingKeys`, `touchedItemIds`).
  * *Key Exports:* `useViolationStore`, `captureInitialFindings()`, `markItemTouched()`, `setViolations()`.
* **[useAutosaveLayout.ts](file:///c:/Users/Dell/Habi3D-Project/src/stores/useAutosaveLayout.ts):**
  * *Purpose:* React hook providing debounced (1.5s) layout synchronization to Supabase `saved_sessions` for authenticated users; automatically no-ops during anonymous sessions.
  * *Key Exports:* `useAutosaveLayout()`.

### 2.2 Clearance & Rule Engine (`src/engine/`)

* **[rules.ts](file:///c:/Users/Dell/Habi3D-Project/src/engine/rules.ts):**
  * *Purpose:* Defines the 10 interior design clearance standards (L1–L5 living, D1–D5 dining) with metric thresholds (RED violation, YELLOW warning, GREEN clear). Implements `classifyGap()` and Priority Score calculation formulas ($S = \text{SeverityWeight} \times \text{Shortfall} \times \text{EdgeLength}$).
  * *Key Exports:* `clearanceRules`, `CLEARANCE_RULES`, `classifyGap()`, `computePriorityScore()`, `calculateSpatialImpact()`, `calculatePriorityScore()`.
* **[clearance.ts](file:///c:/Users/Dell/Habi3D-Project/src/engine/clearance.ts):**
  * *Purpose:* Core spatial clearance calculation engine. Evaluates item bounding boxes and circles against living and dining room geometries, checks item-to-item and item-to-wall gaps, computes shortfall distances, and outputs classified `Violation` objects.
  * *Key Exports:* `runClearanceAnalysis()`.
* **[ruleGuidance.ts](file:///c:/Users/Dell/Habi3D-Project/src/engine/ruleGuidance.ts):**
  * *Purpose:* Maps raw rule IDs to user-friendly plain-English descriptions, actionable fix recommendations ("DO THIS"), and metric ranges for visual clearance meters.
  * *Key Exports:* `ALL_RULE_GUIDANCE`, `bandLabel()`, `bandRanges()`.
* **[walkways.ts](file:///c:/Users/Dell/Habi3D-Project/src/engine/walkways.ts):**
  * *Purpose:* Calculates unobstructed pedestrian movement corridors between key unit doors (Entry, Living, Balcony, Dining, Kitchen) and flags furniture blockages.
  * *Key Exports:* `computeWalkways()`.
* **[violationKey.ts](file:///c:/Users/Dell/Habi3D-Project/src/engine/violationKey.ts):**
  * *Purpose:* Generates deterministic, stable string keys for violations (`ruleCode:furnitureId:itemBId/wall`) to enable session diff tracking across layout edits.
  * *Key Exports:* `stableViolationKey()`.
* **[clearanceTestCases.ts](file:///c:/Users/Dell/Habi3D-Project/src/engine/clearanceTestCases.ts):**
  * *Purpose:* Verification suite containing test layouts and assertions validating clearance calculation precision.

### 2.3 2D Floor Plan & Drag Physics (`src/components/`)

* **[CondoFloorPlan.tsx](file:///c:/Users/Dell/Habi3D-Project/src/components/CondoFloorPlan.tsx):**
  * *Purpose:* Interactive SVG floor plan renderer. Renders unit boundaries, muted non-active room shading, lettered/numbered wayfinding reference grids, dimension callouts, rectangular/circular furniture shapes, rotation controls, and selection indicators.
  * *Key Exports:* `CondoFloorPlan` (React Component).
* **[floorPlanDrag.ts](file:///c:/Users/Dell/Habi3D-Project/src/components/floorPlanDrag.ts):**
  * *Purpose:* Free-movement physics and drag coordinate engine. Restricts movement within outer wall envelopes, computes live gap readouts, alignment guide snap-lines, collision detection, and auto-detects room membership based on center point drop coordinates. Includes `packItemsIntoRoom()` layout packer.
  * *Key Exports:* `unitEnvelope`, `packItemsIntoRoom()`, drag handlers.
* **[floorPlanGeometry.ts](file:///c:/Users/Dell/Habi3D-Project/src/components/floorPlanGeometry.ts):**
  * *Purpose:* Converts abstract `FurnitureItem` records into concrete 2D SVG bounding geometry (`PlanRect`), handling rotation transformations and shape types (`rectangle` vs `round`).
  * *Key Exports:* `projectItems()`, `PlanRect`.
* **[gridOverlay.ts](file:///c:/Users/Dell/Habi3D-Project/src/components/gridOverlay.ts):**
  * *Purpose:* Computes unit-wide wayfinding grid coordinates (~60cm cells labeled A1 through F8) overlaid on the 2D plan.
  * *Key Exports:* `computeGridGeometry()`.
* **[previewMove.ts](file:///c:/Users/Dell/Habi3D-Project/src/components/previewMove.ts):**
  * *Purpose:* Nudge and movement preview utilities for adjusting furniture positioning prior to committing state changes.

### 2.4 Augmented Reality & Spatial Calibration (`src/ar/` & `src/screens/PositionMapScreen.tsx`)

* **[calibration.ts](file:///c:/Users/Dell/Habi3D-Project/src/ar/calibration.ts):**
  * *Purpose:* Mathematical calibration module. Derives a rigid transformation matrix (2D rotation $\theta$ + translation vector $T$) linking an arbitrary WebXR hit-test frame to the fixed 2D plan frame using 2 reference taps (NW corner + North wall vector).
  * *Key Exports:* `deriveCalibration()`, `applyCalibration()` (AR local $\rightarrow$ Plan), `invertCalibration()` (Plan $\rightarrow$ AR local), `calibrationThetaRad()`.
* **[ARMeasureSession.tsx](file:///c:/Users/Dell/Habi3D-Project/src/ar/ARMeasureSession.tsx):**
  * *Purpose:* WebXR point-to-point camera measurement component. Allows users to measure physical room distances or furniture dimensions (writing diameter, length, width) in real-time.
* **[ClearanceOverlay.tsx](file:///c:/Users/Dell/Habi3D-Project/src/ar/ClearanceOverlay.tsx) & [CorrectionArrow.tsx](file:///c:/Users/Dell/Habi3D-Project/src/ar/CorrectionArrow.tsx):**
  * *Purpose:* 3D WebXR rendering overlays displaying spatial clearance boundaries, warning indicators, and directional arrows suggesting optimal placement moves in AR space.
* **[overlayRenderer.tsx](file:///c:/Users/Dell/Habi3D-Project/src/ar/overlayRenderer.tsx) & [shapeLibrary.ts](file:///c:/Users/Dell/Habi3D-Project/src/ar/shapeLibrary.ts):**
  * *Purpose:* Procedural 3D mesh generator rendering primitive furniture geometries (box, cylinder, L-mesh) inside `@react-three/fiber` XR scenes.

### 2.5 Design Tokens (`src/components/tokens/`)

* **[colors.ts](file:///c:/Users/Dell/Habi3D-Project/src/components/tokens/colors.ts):** Central color palette definitions (Brand Navy `#1F3864`, Accent Blue `#2B549A`, Severity RED `#B91C1C` / AMBER `#B45309` / GREEN `#047857`, Neutral ink/surface shades, Room fills).
* **[type.ts](file:///c:/Users/Dell/Habi3D-Project/src/components/tokens/type.ts):** System typeface stack (`-apple-system, Segoe UI, Roboto...`), typographic scale (Display 24px, Title 19px, Body 16px, Label 14px), and tabular numeric configuration (`font-variant-numeric: tabular-nums`).
* **[spacing.ts](file:///c:/Users/Dell/Habi3D-Project/src/components/tokens/spacing.ts):** System layout spacing increments and border-radius tokens.
* **[marks.ts](file:///c:/Users/Dell/Habi3D-Project/src/components/tokens/marks.ts):** SVG stroke, fill, and marker styles for draggable plan elements, ghosts, and infeasible drag targets.
* **[index.ts](file:///c:/Users/Dell/Habi3D-Project/src/components/tokens/index.ts):** Unified barrel export for all design tokens.

### 2.6 Reporting & UI Components (`src/components/`)

* **[pdfReport.ts](file:///c:/Users/Dell/Habi3D-Project/src/components/pdfReport.ts):** Client-side PDF document generator using `jsPDF`. Synthesizes vector floor plan drawings, session metrics, and a paginated rule-by-rule evaluation table (covering all 10 rules, cleared and violated).
* **[ClearanceMeter.tsx](file:///c:/Users/Dell/Habi3D-Project/src/components/ClearanceMeter.tsx):** CVD-safe visual clearance meter component displaying measured distance against RED/YELLOW/GREEN thresholds, plain-English guidance, and fix recommendations.
* **[DownloadReportButton.tsx](file:///c:/Users/Dell/Habi3D-Project/src/components/DownloadReportButton.tsx):** State-machine UI button (`idle` $\rightarrow$ `working` $\rightarrow$ `success` / `error`) for triggering PDF report builds.
* **[StatusRow.tsx](file:///c:/Users/Dell/Habi3D-Project/src/components/StatusRow.tsx):** UI component rendering rule evaluation findings with status badges and contextual notes.
* **[ErrorBoundary.tsx](file:///c:/Users/Dell/Habi3D-Project/src/components/ErrorBoundary.tsx):** Decoupled React error boundary fallback UI for catastrophic runtime failure recovery.

### 2.7 Data & Backend Integration (`src/data/` & `src/supabase.ts`)

* **[condoLayout.ts](file:///c:/Users/Dell/Habi3D-Project/src/data/condoLayout.ts):** Geometry specification for Mulberry Place 2BR (`CONDO_ROOMS`: 8 zones including Living, Dining, Master Bedroom, Bedroom 2, Kitchen, Balcony, CR, Storage, with allowed furniture categories and polygon coordinates).
* **[roomData.ts](file:///c:/Users/Dell/Habi3D-Project/src/data/roomData.ts):** Fixed unit dimensions (`MULBERRY_PLACE_2BR`: Living 350x450cm, Dining 300x350cm).
* **[supabase.ts](file:///c:/Users/Dell/Habi3D-Project/src/supabase.ts):** Supabase API client initializing authentication (`createAccount`, `logIn` mapping usernames to `${username}@habi3d.local`) and database persistence (`fetchSavedSession`, `saveSessionLayout`).

---

## 3. Active Screens Catalog

Screen routing is controlled by `App.tsx` matching `sessionStore.currentScreen`.

```
                        ┌────────────────────────┐
                        │   entry (EntryScreen)  │
                        └───────────┬────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
  [Begin Session]           [Create Account]             [Log In]
           │                        │                        │
           │                        ▼                        ▼
           │             ┌──────────────────────┐  ┌──────────────────────┐
           │             │  auth (AuthScreen)   │  │  auth (AuthScreen)   │
           │             └──────────┬───────────┘  └──────────┬───────────┘
           │                        │                         │
           │                        ▼                         ▼
           │              [New User Signup]        [Has Saved Session?]
           │                        │                 ├── No  ──► [Furniture Input]
           │                        │                 └── Yes ──► [Resume / Fresh?]
           │                        │                                ├── Resume ─► [Workspace]
           │                        │                                └── Fresh  ─► [Furniture Input]
           └────────────────────────┴───────────┬────────────────────┘
                                                │
                                                ▼
                                 ┌─────────────────────────────┐
                                 │ furnitureInput              │
                                 │ (FurnitureInputScreen)      │
                                 └──────────────┬──────────────┘
                                                │
                                                ▼
                                 ┌─────────────────────────────┐
                                 │ positionMap                 │
                                 │ (PositionMapScreen)         │
                                 └──────────────┬──────────────┘
                                                │
                                                ▼
                                 ┌─────────────────────────────┐
                                 │ analysis / recommendations /│
                                 │ recommendation              │
                                 │ (WorkspaceScreen)           │
                                 └──────────────┬──────────────┘
                                                │
                                                ▼
                                 ┌─────────────────────────────┐
                                 │ report (ReportScreen)       │
                                 └─────────────────────────────┘
```

### 3.1 Screen Catalog Breakdown

| Screen Name | File Path | Route Key | Status | Functionality & Key Features |
| :--- | :--- | :--- | :--- | :--- |
| **Landing / Entry** | `src/screens/EntryScreen.tsx` | `'entry'` | **Active** | Primary entry point. Two-tone gradient wordmark ("Habi3D"), frosted glass card, 3-tier action hierarchy: **Begin Session** (anonymous), **Create Account** (Auth), **Log In** (Auth text link). |
| **Authentication** | `src/screens/AuthScreen.tsx` | `'auth'` | **Active** | Manages user sign-up and login using username input mapped internally to `${username}@habi3d.local`. Checks Supabase `saved_sessions` for existing layout; prompts user to Resume existing layout or Start Fresh. |
| **Furniture Input** | `src/screens/FurnitureInputScreen.tsx` | `'furnitureInput'` | **Active** | Step 1/2 of layout setup. Furniture item catalog selection (sofa, coffee table, dining set, cabinet, etc.), shape selection (rectangle, round, l-shape, oval), custom dimension entry, and WebXR point-to-point camera measurement tool. |
| **AR Position Map** | `src/screens/PositionMapScreen.tsx` | `'positionMap'` | **Active** | Step 2/2 of layout setup. WebXR AR placement and spatial calibration screen. Executes 2-tap AR-to-2D calibration (`CalibrationScene`: NW corner + North wall tap), provides tap-retry modal review, places 3D furniture models (`PlacementScene`), and supports mid-session recalibration. |
| **Workspace (Interactive Plan)** | `src/screens/WorkspaceScreen.tsx` | `'analysis'`, `'recommendations'`, `'recommendation'` | **Active** | Core 2D interactive layout optimization hub (~82% viewport canvas). Free-movement physics drag, live tabular-numeral gap readouts, alignment guides, collision detection, unit-wide lettered/numbered grid overlay (A1-F8), muted room shading, dimension callouts, rotate/undo/reset toolbar, tabbed inspection panel (Items, Fixes/Violations with CVD ClearanceMeters, Rules reference), and walkway access indicators. |
| **Session Report** | `src/screens/ReportScreen.tsx` | `'report'` | **Active** | Client-side session report view. Computes layout progress diff from session start ("You made N spots more comfortable"), displays rule status list, and provides multi-page PDF generation via `pdfReport.ts`. |
| **Fallback Placeholder** | `src/screens/PlaceholderScreen.tsx` | `default` | **Active** | Fallback route handler for unrecognized screen state targets. |

### 3.2 Legacy & Orphaned Files Status

* **[ARDemoScreen.tsx](file:///c:/Users/Dell/Habi3D-Project/src/screens/ARDemoScreen.tsx):** **DELETED** in Round 17. Removed from `types/index.ts` and `App.tsx`.
* **[AnalysisScreen.tsx](file:///c:/Users/Dell/Habi3D-Project/src/screens/AnalysisScreen.tsx) & [RecommendationScreen.tsx](file:///c:/Users/Dell/Habi3D-Project/src/screens/RecommendationScreen.tsx):** Legacy pre-WorkspaceScreen screens. Superseded by `WorkspaceScreen.tsx`; retained in directory as unrouted references.
* **[FloorPlan2D.tsx](file:///c:/Users/Dell/Habi3D-Project/src/components/FloorPlan2D.tsx):** Early static 2D renderer. Superseded by `CondoFloorPlan.tsx`.
* **[PlanSandbox.tsx](file:///c:/Users/Dell/Habi3D-Project/src/components/PlanSandbox.tsx):** Development sandbox component; unrouted in production build.

---

## 4. Core End-to-End Processes

### 4.1 Process 1: Authentication & Session Lifecycle

```
[User Input: Username/Password]
            │
            ▼
[Construct Synthetic Email: username@habi3d.local]
            │
            ▼
[Supabase Auth: signUp() / signInWithPassword()] ──► [Receive Auth JWT & auth.uid()]
            │
            ▼
[Query Supabase saved_sessions WHERE user_id = auth.uid()]
            │
    ┌───────┴────────┐
    ▼                ▼
[No Session]   [Session Found]
    │                │
    │                ▼
    │          [Prompt User: Resume or Start Fresh]
    │                ├───────────────────────┐
    │                ▼                       ▼
    │            [Resume]              [Start Fresh]
    │                │                       │
    ▼                ▼                       ▼
[FurnitureInput] ──► [Workspace (Pre-loaded)] ──► [FurnitureInput]
```

1. **User Identity Creation:** The UI prompts for a `username` (validating that no `@` symbol is present). `supabase.ts` formats this into a synthetic email address (`username@habi3d.local`).
2. **Supabase Auth Request:** Executes `supabase.auth.signUp()` or `supabase.auth.signInWithPassword()`. Supabase returns a valid authentication session containing `auth.uid()`.
3. **Session Query & Hydration:** `fetchSavedSession(userId)` queries the `saved_sessions` table. If layout JSON exists, the user is given a choice to Resume or Start Fresh. Choosing Resume populates `furnitureStore` with saved items and jumps directly to `WorkspaceScreen`.
4. **Debounced Autosave Loop:** Whenever furniture items undergo state mutations (`posX`, `posZ`, `rotationY`), `useAutosaveLayout` triggers a 1.5-second debounced write to Supabase `saved_sessions` enforced by RLS (`auth.uid() = user_id`).

### 4.2 Process 2: AR-to-2D Coordinate Calibration & Placement

```
[Enter WebXR Session] ──► [Tap 1: Physical NW Corner] ──► [Tap 2: Point along North Wall]
                                                                     │
                                                                     ▼
                                                   [deriveCalibration(corner, wall)]
                                                                     │
                                                                     ▼
                                                    [Compute Transform Matrix: θ, T]
                                                                     │
                                                                     ▼
                                                   [Review Modal: Commit or Retap?]
                                                                     │
                                                     ┌───────────────┴───────────────┐
                                                     ▼                               ▼
                                             [Retap / Retry]                      [Commit]
                                                     │                               │
                                                     └──────► [Reset Taps] ◄─────────┼───────────────────┐
                                                                                     ▼                   │
                                                                           [Placement Scene Active]      │
                                                                                     │                   │
                                                                                     ▼                   │
                                                                         [Place 3D Ghost Model]          │
                                                                                     │                   │
                                                                                     ▼                   │
                                                                       [applyCalibration(P_AR) -> P_2D]  │
                                                                                     │                   │
                                                                                     ▼                   │
                                                                           [Save to furnitureStore]      │
                                                                                     │                   │
                                                                                     ▼                   │
                                                                           [Click Recalibrate?] ─────────┘
```

1. **AR Session Initialization:** The user starts WebXR tracking via `PositionMapScreen.tsx`.
2. **Two-Tap Spatial Anchor Capture (`CalibrationScene`):**
   * *Tap 1 (Corner):* User taps the physical room's Northwest corner in AR space ($P_{\text{corner}}^{\text{AR}}$).
   * *Tap 2 (North Wall):* User taps a second point along the physical North outer wall ($P_{\text{wall}}^{\text{AR}}$) at least 1.0m away.
3. **Transform Derivation (`calibration.ts`):** `deriveCalibration()` computes the rigid transformation:
   $$\theta = \text{atan2}(P_{\text{wall}, z}^{\text{AR}} - P_{\text{corner}, z}^{\text{AR}}, P_{\text{wall}, x}^{\text{AR}} - P_{\text{corner}, x}^{\text{AR}})$$
   $$T = P_{\text{corner}}^{\text{AR}}$$
4. **Interactive Verification & Retry:** A review overlay allows the user to accept the calibration or trigger a tap retry without destroying the WebXR session.
5. **Coordinate Mapping & Ghost Rendering (`PlacementScene`):**
   * *Write Path:* When furniture is placed in AR, `applyCalibration(P^{\text{AR}})` transforms AR hit-test coordinates to fixed 2D plan coordinates ($P^{\text{2D}}$) stored in `furnitureStore`.
   * *Read Path:* Existing 2D furniture items are converted back via `invertCalibration(P^{\text{2D}})` to render 3D ghost meshes in AR space.
6. **Mid-Session Recalibration:** Users can click "Recalibrate" at any point during AR placement to clear matrix transforms and retap room boundaries without wiping placed furniture state.

### 4.3 Process 3: Furniture Inventory & Camera Measurement

1. **Item Selection:** Users choose preset items from `FurnitureInputScreen.tsx` or specify custom labels and categories.
2. **Shape Configuration:** Selects geometry shape (`rectangle`, `round`, `l-shape`, `oval`).
3. **WebXR Point-to-Point Measurement (`ARMeasureSession.tsx`):**
   * Users can launch an AR camera session to measure physical items.
   * Two camera taps establish a 3D bounding vector. The euclidean distance in meters is calculated and converted to centimeters.
   * For circular shapes, the measured distance is automatically set as the diameter, populating both `lengthCm` and `widthCm`.
4. **Inventory Commit:** Appends the configured `FurnitureItem` object to `furnitureStore`.

### 4.4 Process 4: 2D Floor Plan Interactive Layout Physics

```
[Pointer Down on 2D Plan] ──► [Distance moved > 5px?] ──► [No]  ──► [Treat as Selection Click]
                                        │
                                        ▼ [Yes]
                            [Initialize Drag Session]
                                        │
                                        ▼
                   [Calculate Delta Drag: ΔX, ΔZ]
                                        │
                                        ▼
           [Enforce Unit Envelope Constraints (Outer Walls)]
                                        │
                                        ▼
           [Live Calculations: Snap Alignment Guides & Cm Readouts]
                                        │
                                        ▼
             [Pointer Up: Commit Drop & Detect Room Zone]
                                        │
                                        ▼
            [Record State to 50-Step Undo Stack & Mark Item Touched]
```

1. **Interaction Gate:** Pointer down on an SVG item element tracks movement. Movement under `DRAG_THRESHOLD_PX = 5` is treated as an item selection click.
2. **Free Delta Movement Dragging:** Once past 5px, `floorPlanDrag.ts` tracks delta offsets ($\Delta X, \Delta Z$). Dragging is delta-based, rendering it immune to viewport zoom shifts.
3. **Boundary & Outer Wall Constraint:** Item bounds are restricted to remain within `unitEnvelope` outer walls (West 0cm, East 650cm, North 0cm, South 800cm).
4. **Real-time Visual Feedback:** Computes alignment snap lines, live collision highlights, and tabular-numeral gap readouts in real-time.
5. **Drop & Room Re-Homing:** Pointer up commits final coordinates. `detectRoomFromPosition()` automatically assigns the item's `roomId` based on center point drop coordinates inside `CONDO_ROOMS`.
6. **Undo & Progress Recording:** Pushes the state snapshot into a 50-step undo stack and calls `markItemTouched(itemId)`.

### 4.5 Process 5: Clearance Rule Analysis & Priority Ranking

```
[Trigger Clearance Analysis: runClearanceAnalysis()]
                         │
                         ▼
  [Compute Geometry Bounding Rectangles & Circles]
                         │
                         ▼
 [Iterate 10 Standards (L1-L5 Living, D1-D5 Dining)]
                         │
                         ▼
[Calculate Measured Gap Distance (cm) vs Thresholds]
                         │
                         ▼
   [Classify Gap: RED (Violation), YELLOW (Warning), GREEN (Clear)]
                         │
                         ▼
        [Filter Active Violations & Warnings]
                         │
                         ▼
[Compute Spatial Impact (SI) & Priority Score (S)]
   SI = Shortfall (cm) × Affected Edge Length (cm)
   S  = Severity Weight (RED=3, YELLOW=1) × SI
                         │
                         ▼
   [Sort Violations by Priority Score Descending]
                         │
                         ▼
[Update violationStore & Render ClearanceMeters]
```

1. **Analysis Trigger:** Fired automatically in `WorkspaceScreen.tsx` on layout state mutations.
2. **Spatial Gap Calculation (`clearance.ts`):** Calculates shortest distance between item edges/circles and neighboring furniture or room walls.
3. **Threshold Classification (`rules.ts`):** Evaluates measured gap against metric thresholds:
   * **RED (Violation):** Measured gap < `violationThresholdCm`.
   * **YELLOW (Warning):** `violationThresholdCm` $\le$ Measured gap < `warningThresholdCm`.
   * **GREEN (Clear):** Measured gap $\ge$ `warningThresholdCm`.
4. **Spatial Impact & Priority Scoring:** Computes Spatial Impact ($SI = \text{Shortfall} \times \text{EdgeLength}$) and Priority Score ($S = VSW \times SI$, where $VSW=3$ for RED, $VSW=1$ for YELLOW).
5. **Store Update & UI Guidance:** Populates `violationStore` sorted by Priority Score descending. Renders CVD-safe `ClearanceMeter` cards and walkway blockage warnings.

### 4.6 Process 6: PDF Generation & Session Progress Reporting

```
[Navigate to ReportScreen]
            │
            ▼
[Recompute Layout Analysis & Snapshot Diff]
            │
            ▼
[Generate Headline: "You made N spots more comfortable"]
            │
            ▼
[User Clicks "Download PDF Report"]
            │
            ▼
[pdfReport.ts: Initialize jsPDF Vector Canvas]
            │
            ▼
[Draw Vector Floor Plan Diagram (Rooms + Rectangles/Circles)]
            │
            ▼
[Iterate All 10 Rules: Calculate Section Heights]
            │
            ▼
[Execute ensureSpace(): Add Contination Page if Overflow]
            │
            ▼
[Render Rule Detail Tables (Cleared + Violated)]
            │
            ▼
[Trigger Browser Client Download: habi3d-layout-report.pdf]
```

1. **Session Diff Calculation:** `ReportScreen.tsx` compares initial session findings (`initialFindingKeys`) against current active findings to construct an honest completion headline ("You made N spots more comfortable").
2. **Vector Floor Plan Draw (`pdfReport.ts`):** `jsPDF` renders a scale floor plan snapshot using pure geometry data (`CONDO_ROOMS` + `projectItems()`), drawing `<rect>` for rectangular items and `doc.circle()` for circular items.
3. **Rule Breakdown Generation:** Iterates through all 10 interior design clearance standards, building detail tables for both violated and cleared rules.
4. **Dynamic Pagination:** `ensureSpace()` monitors Y-axis page usage, automatically emitting `addContinuationPage()` headers when content exceeds single-page boundaries.
5. **Direct Download:** Triggers browser file download (`habi3d-layout-report.pdf`) directly on the client side without external server overhead.

---

## 5. Detailed Feature Breakdown Matrix

| Feature | Implementation Component(s) | Technical Strategy | Operational Status |
| :--- | :--- | :--- | :--- |
| **Free 2D Floor Plan Drag** | `CondoFloorPlan.tsx`<br>`floorPlanDrag.ts` | Delta drag tracking, `unitEnvelope` outer wall bounding, live snap lines, live cm readouts. | **Active & Verified** |
| **Auto Room Assignment** | `floorPlanDrag.ts`<br>`condoLayout.ts` | Item center coordinate spatial lookup inside `CONDO_ROOMS` polygon boundaries on drop. | **Active & Verified** |
| **Undo / Redo Stack** | `WorkspaceScreen.tsx` | 50-step state history stack recording position/rotation mutations. | **Active & Verified** |
| **AR 2-Tap Spatial Calibration** | `calibration.ts`<br>`PositionMapScreen.tsx` | Rigid transformation matrix derivation (NW corner + North wall vector) mapping AR space to 2D plan. | **Active & Verified** |
| **AR Calibration Retry & Recalibrate** | `PositionMapScreen.tsx` | Tap-retry review modal prior to commit; mid-session recalibration preserving stored item data. | **Active & Verified** |
| **AR Point-to-Point Measuring** | `ARMeasureSession.tsx` | WebXR camera hit-test distance calculations for physical item diameter and side dimensions. | **Active & Verified** |
| **Circular Furniture Support** | `floorPlanGeometry.ts`<br>`CondoFloorPlan.tsx`<br>`pdfReport.ts` | End-to-end support for round/circular tables: diameter input, SVG `<circle>` rendering, rotation locks, PDF vector circles. | **Active & Verified** |
| **10 Clearance Rules Engine** | `rules.ts`<br>`clearance.ts` | Automated gap calculation against 5 living (L1-L5) and 5 dining (D1-D5) metric standards. | **Active & Verified** |
| **Priority Score Ranking** | `rules.ts`<br>`violationStore.ts` | $S = VSW \times \text{Shortfall} \times \text{EdgeLength}$ priority ranking for layout remediation. | **Active & Verified** |
| **CVD-Safe Clearance Meters** | `ClearanceMeter.tsx`<br>`ruleGuidance.ts` | Color-blindness safe visual meters encoding clearance using track position, shapes, and plain English. | **Active & Verified** |
| **Synthetic Email Supabase Auth** | `supabase.ts`<br>`AuthScreen.tsx` | Real Supabase Auth mapping username input to `${username}@habi3d.local` with RLS (`auth.uid() = user_id`). | **Active & Verified** |
| **Debounced Layout Autosave** | `useAutosaveLayout.ts`<br>`supabase.ts` | 1.5-second debounced layout JSON syncing to Supabase `saved_sessions` table. | **Active & Verified** |
| **Session Progress Headline Diff** | `violationStore.ts`<br>`ReportScreen.tsx` | Progress computed via initial vs current finding key diffing ("You made N spots more comfortable"). | **Active & Verified** |
| **Paginated Client PDF Export** | `pdfReport.ts`<br>`DownloadReportButton.tsx` | Pure client-side `jsPDF` vector report generation featuring floor plan drawing and 10-rule paginated detail tables. | **Active & Verified** |
| **2D Plan Grid & Muting** | `gridOverlay.ts`<br>`CondoFloorPlan.tsx` | Unit-wide lettered/numbered wayfinding reference grid (A1-F8), muted shading for non-active room zones. | **Active & Verified** |
| **Tabular Numbers Formatting** | `src/components/tokens/type.ts` | `font-variant-numeric: tabular-nums` applied to gap readouts, dimensions, and meters to eliminate digit jitter. | **Active & Verified** |

---

## 6. Known Issues, Blockers & Pre-Phase 3 Checklist

### 6.1 Known Issues

* **🔴 `planeDetection: true` Blocker:** `src/screens/FurnitureInputScreen.tsx` (line ~17) retains `planeDetection: true` in `createXRStore()`. Must be removed prior to WebXR device testing on Android Chrome.
* **🟡 Lack of Password Reset Flow:** Supabase Auth with synthetic emails does not support automated email-based password resets. Documented as a known limitation for thesis evaluation.
* **🟡 Generic Sign-up Error Fallback:** Rare sign-up failures collapse into a generic user message without logging status codes; targeted for logging instrumentation if reported again.
* **🟡 Multi-Session AR Coordinate Drift:** WebXR sessions re-derive world origin per session. Mitigated by 2-tap AR calibration and mid-session recalibration options.

### 6.2 Pre-Phase 3 Evaluation Checklist

- [ ] **Must-Do:** Remove `planeDetection: true` from `FurnitureInputScreen.tsx`.
- [ ] **Must-Do:** Execute full WebXR hardware validation on Android Chrome (AR camera measurement, 2-tap calibration, calibration retry paths, circular table rendering).
- [ ] **Must-Do:** Populate `rule_test_cases` database table (10 clearance rule tests + 5 priority ranking test cases).
- [ ] **Must-Do:** Finalize decision regarding guest access feature (anonymous testing session vs lightweight anonymous auth).
- [ ] **Nice-to-Have:** Cleanup unrouted legacy files (`AnalysisScreen.tsx`, `RecommendationScreen.tsx`, `FloorPlan2D.tsx`, `PlanSandbox.tsx`).
- [ ] **Nice-to-Have:** Execute legacy database table cleanup (`participants`, `pre_survey_responses`, `sus_responses`, `post_survey_responses` in `supabase.ts`).

---

## 7. Verification & Testing Matrix

* ✅ **TypeScript Compilation:** `npx tsc -b --force` clean project-wide (0 errors).
* ✅ **ESLint Suite:** `npx eslint .` clean project-wide (0 errors, 0 warnings).
* ✅ **Production Bundle Build:** `npx vite build` successful (module output verified).
* ✅ **Drag & Layout Geometry Math:** 19/19 drag geometry assertions passing.
* ✅ **Clearance Meter Visual Geometry:** 12/12 meter layout assertions passing.
* ✅ **Circular Furniture Clearance Calculation:** 11/12 assertions passing (1 float rounding variance).
* ✅ **Auth & RLS Round Trip:** End-to-end Playwright trace verified signup $\rightarrow$ sign-out $\rightarrow$ login $\rightarrow$ identical `auth.uid()` matching `saved_sessions` RLS policies.
* ✅ **Session Progress Diffing:** Real layout trace verified progress headline ("You made N spots more comfortable") accurately tracking touched vs untouched furniture items.
* ✅ **AR Calibration & Retry Logic:** Seeded state unit tests verified tap 1 retap, tap 2 review discard, commit, and recalibration leaving stored item coordinates byte-identical.
