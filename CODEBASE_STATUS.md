# Habi3D Codebase — Current State, Architecture & Status

**Last updated:** 2026-09-10  
**Project phase:** Late Phase 2 → Phase 3 Readiness  
**Target Unit Scope:** Fixed Single Unit — Mulberry Place 2BR (Acacia Estates, Taguig)

---

## 0. Recent Updates & Change Log (Top Priority Summary)

> [!NOTE]
> **Latest Update (2026-09-10):** Resident Testing Preparation & Spatial Protection Update — Implemented Quick Visual Room Alignment (overhead ceiling wireframe), 2D Workspace Fine Position D-Pad (1 cm/tap), In-Session AR Measurement Review & Retake (1-decimal cm precision), Safe Reset Preserving Dimensions, Dimension Sanity Guard, and Architectural Bedroom Wall Blocker restricting placement to Living and Dining areas.

### Key Recent Changes (September 8 – September 10, 2026: Resident Testing Preparation & Spatial Protection)

1. **Quick Living/Dining Room Alignment (`PositionMapScreen.tsx`)**
   - **Overhead Ceiling Wireframe Guide:** Replaced physical two-point corner/wall tapping with a ceiling-height ($Y = 2.4\text{ m}$) 3D wireframe guide matching the predefined Living ($2.6\text{m} \times 3.6\text{m}$) and Dining ($2.6\text{m} \times 1.8\text{m}$) footprint, with 4 corner drop lines to the floor and floating zone name badges.
   - **Visual Touch Controls:** Added simple resident-friendly directional buttons in `XRDomOverlay` (Forward/Backward $\pm 10\text{ cm}$, Left/Right $\pm 10\text{ cm}$, Rotate Left/Right $\pm 5^\circ$ yaw, [Reset Alignment], [Confirm Alignment]).
   - **Preserved Calibration Mathematics:** Derived rigid transform (`originX, originZ, cosTheta, sinTheta`) directly from guide offset and yaw angle, strictly preserving `applyCalibration()` and `invertCalibration()` coordinate math.

2. **2D Workspace Fine Position Review & D-Pad (`WorkspaceScreen.tsx`)**
   - **On-Screen 4-Way D-Pad:** Added floating `Fine Position` card (`1 cm / tap`) in the 2D workspace when any furniture item is selected.
   - **Outer Boundary Protection:** Added unit wall collision check in `nudgeSelected`, stopping pieces at outer walls with a toast notice (`"[Item] has reached the room boundary."`).
   - **Multi-System Integration:** Fully integrated with collision prevention, room re-homing, 50-step undo/redo, debounced autosave, and live clearance re-analysis.

3. **In-Session AR Measurement Review, Retake & Floating Decimal Support (`ARMeasureSession.tsx`, `FurnitureInputScreen.tsx`)**
   - **In-Session Confirmation Card:** Displays raw AR measurement in centimeters with 1 decimal place (`AR: 97.4 cm`) with prefilled editable input, [Retake], and [Confirm Measurement] buttons.
   - **Zero-Teardown Retake:** Tapping "Retake" resets markers and line geometry via `retakeTrigger` and returns to `ready` phase without dropping the WebXR camera session.
   - **Round Table Diameter Support:** Clarifies that diameter sets both length and width simultaneously.
   - **Decimal-Safe Inputs:** Replaced regex digit stripping with `sanitizeDecimal()` and `toPositiveNumber()`, adding `inputMode="decimal"` across all dimensions. Converted `markerA` to `markerARef` to eliminate React re-render warnings.

4. **Safe Reset Without Dimension Changes (`WorkspaceScreen.tsx`)**
   - **Dimension Preservation:** Hardened `handleResetPosition()` to strictly preserve `id, label, category, shape, lengthCm, widthCm, heightCm`, updating only spatial coordinates (`posX: 0, posZ: 0, rotationY: 0, roomId: undefined`).
   - **Undo & Autosave Sync:** Pushes reset action to undo history and triggers debounced Supabase autosave.

5. **Lock Furniture Dimensions Across AR → 2D & Dimension Sanity Guard (`furnitureValidation.ts`, `PositionMapScreen.tsx`)**
   - **End-to-End Dimension Audit:** Traced and verified all 7 spatial and dimension parameters across all 6 pipeline stages (Input $\rightarrow$ AR Mesh $\rightarrow$ AR Commit $\rightarrow$ Store $\rightarrow$ `projectItems()` $\rightarrow$ SVG Render), confirming identical dimensions in centimeters.
   - **Dimension Sanity Utility:** Built `src/utils/furnitureValidation.ts` checking against Mulberry Living/Dining boundaries ($>360\text{ cm}$ length, $>260\text{ cm}$ width, $>260\text{ cm}$ height).
   - **Pre-Transition Modal Dialog:** Added warning modal in 2D and `XRDomOverlay` (*"Check Furniture Size — This furniture appears unusually large for the Living/Dining area. Please review its dimensions."*) with [Review Dimensions] and [Cancel]. Strictly preserves user dimensions without auto-clamping.

6. **Bedroom Wall Blocker & Living/Dining Only Placement (`floorPlanDrag.ts`, `WorkspaceScreen.tsx`, `PositionMapScreen.tsx`, `CondoFloorPlan.tsx`, `condoLayout.ts`)**
   - **Hard Barrier Wall (`BEDROOM_DIVIDER_WALL_Z_M = 3.40m`):** Dividing wall at $Y = 340\text{ cm}$ enforced via `isItemInBedroom(item)`.
   - **Drag Blocker & Revert on Drop:** If dropped in the bedroom (or outside Living/Dining), `handleDragEnd` reverts to `lastOkRef` and displays: `⚠️ Furniture cannot be placed in the bedroom. Please place it in the Living or Dining area only.`
   - **Fine Position & AR Blocker:** `nudgeSelected` and AR `confirmPlacement()` block movements crossing into the bedroom zone.
   - **Default Category Re-homing:** Updated `getRoomForCategory` to map all furniture categories strictly to `'living'` or `'dining'`.
   - **Visual Wall Blocker Graphics:** Rendered structural wall barrier and `BEDROOM WALL BLOCKER` badge at $y = 340\text{ cm}$, plus red warning highlight when dragging over non-rule rooms.

### Key Prior Changes (September 1 – September 7, 2026)

1. **Main Walkway Obstruction Notification Engine & Verification Suite (`walkways.ts`, `WorkspaceScreen.tsx`, `CondoFloorPlan.tsx`)**
   - **Real-Time Warning Toast Alert:** Implemented dynamic toast notification (`⚠️ Notice: [Item Label] is placed on the main walkway corridor.`) triggered upon dropping any furniture piece intersecting the central entry-to-bedroom corridor. Rendered via a high-contrast floating dark banner (`top: 50px`, auto-dismiss after 2.5s).
   - **Geometric Walkway Boundaries:** Defined `MAIN_ENTRY_WALKWAY_RECT` ($x=215\text{ cm}$ to $295\text{ cm}$, width $80\text{ cm}$; $y=340\text{ cm}$ to $880\text{ cm}$, height $540\text{ cm}$) in [`walkways.ts`](file:///c:/Users/Dell/Habi3D-Project/src/engine/walkways.ts). Overlap detection requires both $\text{overlap}_X > 0.01\text{m}$ and $\text{overlap}_Z > 0.01\text{m}$ to prevent false positives on adjacent edge alignment.
   - **Multi-Corridor Clearance Computation:** `computeWalkways()` continuously evaluates 5 distinct unit pedestrian paths (`Living → Dining`, `Living → Balcony`, `Living → Bedroom`, `Dining → Kitchen`, `Bedroom → Bathroom`) against standard clearance thresholds ($<60\text{ cm}$ RED/Blocked, $60$–$90\text{ cm}$ YELLOW/Tight, $\ge 91\text{ cm}$ GREEN/Clear).
   - **Multi-Surface UI Synchronization:** Walkway obstruction state immediately updates:
     - **Canvas Header Pill:** Displays dynamic red counter badge `[N] Walkways Blocked` when any corridor clearance drops below $60\text{ cm}$.
     - **Side Drawer "Walkway Access" List:** Renders per-corridor clearance badges (`Blocked`, `Tight`, `Clear`) with measured vs target ($91\text{ cm}$) clearance readouts.
     - **Clearance Engine Integration:** Sits alongside Rule **L4** ("Main walkway width", DeChiara et al., 2001) which flags room-level circulation bottlenecks and generates actionable "DO THIS" fix cards.
   - **Standardized Functionality Test Suite:** Authored formal test specifications (`TC-WKSP-WALKWAY-001` through `005`) covering nominal obstruction, boundary tolerance ($1\text{ cm}$ threshold), corridor evacuation, collision rollback precedence, and 50-step undo stack reversal.

2. **Empathetic & Constructive Reporting Vocabulary Reframe (`ReportScreen.tsx`, `pdfReport.ts`, `statusVocabulary.ts`)**
   - **Constructive Framing:** Replaced punitive and deficit-focused wording with positive, reassuring terminology:
     - Replaced `"Needs attention"` with `"Extra space suggested"` for RED status items.
     - Replaced `"No tight spots were resolved this session"` with `"Current room layout reviewed and preserved"`.
     - Replaced ambiguous outcome messages with calm, affirming reassurance: *"Your furniture arrangement has been saved. Every room is unique — you can always come back and keep adjusting anytime."*
   - **Visual Palette Harmonization:** Replaced harsh alert reds in summary cards and PDF vector reports with brand navy tones (`t.brand` / `t.brandTint`), maintaining clear visual categorization without inducing user anxiety.

### Key Prior Changes (August 24 – August 31, 2026)

1. **2D Workspace Main Walkway Corridor Overlay & Real-Time Warning (`CondoFloorPlan.tsx`, `walkways.ts`, `WorkspaceScreen.tsx`)**
   - **Walkway Corridor Geometry:** Defined `MAIN_ENTRY_WALKWAY_RECT` in [`walkways.ts`](file:///c:/Users/Dell/Habi3D-Project/src/engine/walkways.ts) spanning from the unit's front entrance door ($y=880\text{ cm}$) up to the bedroom hallway entrance ($y=340\text{ cm}$) with a width of $80\text{ cm}$ ($x=215\text{ cm}$ to $x=295\text{ cm}$).
   - **SVG Visual Corridor Overlay:** Rendered a semi-transparent dashed corridor overlay (`<g>` element with `fill="rgba(43, 84, 154, 0.05)"`, `strokeDasharray="6 4"`, and rotated "MAIN WALKWAY" text label) directly onto [`CondoFloorPlan.tsx`](file:///c:/Users/Dell/Habi3D-Project/src/components/CondoFloorPlan.tsx) with `pointer-events: none`.
   - **Real-Time Obstruction Warnings:** Created `isItemInMainWalkway()` bounds intersection check in [`walkways.ts`](file:///c:/Users/Dell/Habi3D-Project/src/engine/walkways.ts) and integrated real-time toast alerts (`⚠️ Notice: [Item] is placed on the main walkway corridor.`) in [`WorkspaceScreen.tsx`](file:///c:/Users/Dell/Habi3D-Project/src/screens/WorkspaceScreen.tsx) upon dropping furniture items on the corridor.

2. **Authentication Flow Streamlining & Guest Mode Deprecation (`EntryScreen.tsx`, `sessionStore.ts`, `useAutosaveLayout.ts`)**
   - Deprecated anonymous guest session ("Begin Session") mode on [`EntryScreen.tsx`](file:///c:/Users/Dell/Habi3D-Project/src/screens/EntryScreen.tsx) to ensure all active user sessions map cleanly to authenticated Supabase accounts using synthetic email mapping (`username@habi3d.local`).
   - Enforced database persistence and Row-Level Security (`auth.uid() = user_id`) on the `saved_sessions` table across all active sessions.

3. **System-Wide UI Modernization & Visual Polish (`App.css`, `EntryScreen.tsx`, `AuthScreen.tsx`, `FurnitureInputScreen.tsx`, `PositionMapScreen.tsx`, `WorkspaceScreen.tsx`, `ReportScreen.tsx`)**
   - Redesigned visual aesthetics across all app screens with frosted glass card styling, brand gradient typography ("Habi3D"), responsive dark/light layouts, neutral workspace color tones, and tabular numerals (`tabular-nums`) for jitter-free live readouts.
   - Introduced [`Spinner.tsx`](file:///c:/Users/Dell/Habi3D-Project/src/components/Spinner.tsx) component for loading feedback and produced comprehensive project audit documentation ([`METHODOLOGY.md`](file:///c:/Users/Dell/Habi3D-Project/METHODOLOGY.md), [`SUPABASE_TABLE_AUDIT.md`](file:///c:/Users/Dell/Habi3D-Project/SUPABASE_TABLE_AUDIT.md), [`WORKSPACE_VS_RECOMMENDATION_AUDIT.md`](file:///c:/Users/Dell/Habi3D-Project/WORKSPACE_VS_RECOMMENDATION_AUDIT.md)).

4. **WebXR AR Spatial Calibration Retry Path (`PositionMapScreen.tsx`)**
   - Implemented an interactive review modal and tap-retry path during 2-tap AR spatial calibration ($NW\text{ corner} + North\text{ wall vector}$), permitting re-tapping without destroying active WebXR camera sessions.

---

## 1. Executive Summary

Habi3D is a **Priority-Ranked Sequential Recommendation Tool** designed for condominium residents to configure, position, and validate furniture layouts against 10 interior design clearance rules (5 living room, 5 dining room) sourced from *Time-Saver Standards for Interior Design* (DeChiara, Panero & Zelnik, 2001, pp. 61–90).

Key milestones and system capabilities include:
1. **Interactive 2D Floor Plan Engine (`WorkspaceScreen` / `CondoFloorPlan`):** Free-movement physics drag system bound by unit outer walls, on-screen 4-way Fine Position D-pad (`1 cm / tap`), architectural bedroom wall blocker (`BEDROOM WALL BLOCKER` at $y = 340\text{ cm}$), delta-based coordinate tracking, live tabular-numeral gap readouts, alignment guides, collision detection, 50-step undo stack, automatic room re-homing, and main walkway corridor SVG overlay (`MAIN_ENTRY_WALKWAY_RECT`) with real-time obstruction alerts.
2. **Quick Living/Dining Room Alignment & AR Placement (`PositionMapScreen` / `calibration.ts`):** Overhead visual room alignment using a ceiling-height ($Y = 2.4\text{ m}$) wireframe guide and directional touch controls (deriving rigid transformation matrix without corner/wall tapping), 3D furniture placement with spatial ghosts, dimension sanity checks, and mid-session recalibration retry paths.
3. **WebXR Camera Point-to-Point Measuring (`ARMeasureSession.tsx` / `FurnitureInputScreen.tsx`):** AR camera measurement with in-session review and confirmation card, floating decimal precision (1 decimal place cm), in-session retake without tearing down the WebXR session, and diameter-to-length/width propagation for circular furniture.
4. **End-to-End Circular Furniture Support:** Native handling of round/circular tables and chairs across measuring, 2D floor plan SVG rendering (`<circle>`), rotation locks, and client-side PDF document generation.
5. **Clearance Evaluation Engine (`rules.ts` / `clearance.ts`):** Automated gap analysis calculating item-to-item and item-to-wall clearances, classifying gaps into RED (violation), YELLOW (warning), and GREEN (comfortable) bands, and scoring priorities using $S = \text{SeverityWeight} \times \text{Shortfall} \times \text{EdgeLength}$.
6. **Accessible Guidance & Visual Clearance Meters (`ruleGuidance.ts` / `ClearanceMeter.tsx`):** Plain-English rule descriptions, actionable resolution steps ("DO THIS"), and color-blindness/CVD-safe clearance meters encoding metrics via shape, words, and track position.
7. **Client-Side Paginated PDF Report (`pdfReport.ts` / `DownloadReportButton.tsx`):** Multi-page vector PDF generation via `jsPDF`, drawing SVG geometry directly from `CONDO_ROOMS` and `projectItems()`, accompanied by a rule-by-rule breakdown table.
8. **Authentication & Autosave (`supabase.ts` / `AuthScreen.tsx` / `useAutosaveLayout.ts`):** Production-grade Supabase Auth using synthetic email mapping (`username@habi3d.local`), row-level security (`auth.uid() = user_id`) on the `saved_sessions` table, and 1.5-second debounced layout autosave.
9. **Visual Modernization & Design Tokens (`src/components/tokens/`):** Unified app-wide design token structure (`colors`, `type`, `spacing`, `marks`), native system typeface stack, tabular numbers (`tabular-nums`) for real-time measurements, and high-contrast dark/light responsive layouts.
10. **Session Progress Reframe (`violationStore.ts` / `ReportScreen.tsx`):** Session progress calculated via an initial snapshot diff ("You made N spots more comfortable"), eliminating arbitrary numeric scores or grades.
11. **Dimension Lock Across AR → 2D & Sanity Guard (`furnitureValidation.ts` / `PositionMapScreen.tsx`):** Verified bit-identical dimensions across all 6 pipeline stages; enforces boundary checks stopping oversized entries ($>360\text{ cm}$ length, $>260\text{ cm}$ width, $>260\text{ cm}$ height) before completing AR placement.
12. **Bedroom Wall Blocker & Living/Dining Constraint (`floorPlanDrag.ts` / `CondoFloorPlan.tsx`):** Hard partition barrier at $Y = 340\text{ cm}$ prohibiting furniture placement in bedrooms and reverting invalid drops to the last clear spot in Living/Dining.
13. **Safe Reset Lifecycle (`WorkspaceScreen.tsx`):** Hardened reset action preserving furniture definitions and centimeter dimensions while clearing only placement coordinates (`posX: 0, posZ: 0, rotationY: 0, roomId: undefined`).

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
  * *Purpose:* Defines main unit corridor geometries (`MAIN_ENTRY_WALKWAY_RECT`: $x=215, y=340, w=80, h=540\text{ cm}$ spanning entrance $y=880$ to bedroom $y=340$), calculates unobstructed pedestrian movement corridors between key unit doors (5 paths in `WALKWAY_PATHS`: Living $\rightarrow$ Dining, Living $\rightarrow$ Balcony, Living $\rightarrow$ Bedroom, Dining $\rightarrow$ Kitchen, Bedroom $\rightarrow$ Bathroom), detects main walkway furniture blockages (`isItemInMainWalkway` with $>0.01\text{m}$ overlap threshold), and classifies clearance statuses (RED $<60\text{ cm}$, YELLOW $60$–$90\text{ cm}$, GREEN $\ge 91\text{ cm}$).
  * *Key Exports:* `computeWalkways()`, `MAIN_ENTRY_WALKWAY_RECT`, `WALKWAY_PATHS`, `isItemInMainWalkway()`, `WalkwayPath`, `WalkwayStatus`.
* **[violationKey.ts](file:///c:/Users/Dell/Habi3D-Project/src/engine/violationKey.ts):**
  * *Purpose:* Generates deterministic, stable string keys for violations (`ruleCode:furnitureId:itemBId/wall`) to enable session diff tracking across layout edits.
  * *Key Exports:* `stableViolationKey()`.
* **[clearanceTestCases.ts](file:///c:/Users/Dell/Habi3D-Project/src/engine/clearanceTestCases.ts):**
  * *Purpose:* Verification suite containing test layouts and assertions validating clearance calculation precision.

### 2.3 2D Floor Plan & Drag Physics (`src/components/`)

* **[CondoFloorPlan.tsx](file:///c:/Users/Dell/Habi3D-Project/src/components/CondoFloorPlan.tsx):**
  * *Purpose:* Interactive SVG floor plan renderer. Renders unit boundaries, muted non-active room shading, lettered/numbered wayfinding reference grids, dimension callouts, rectangular/circular furniture shapes, rotation controls, selection indicators, main walkway corridor overlay, and the architectural bedroom wall blocker (`BEDROOM WALL BLOCKER` along $y = 340\text{ cm}$) with dynamic red warning highlighting for non-allowed room drop targets.
  * *Key Exports:* `CondoFloorPlan` (React Component).
* **[floorPlanDrag.ts](file:///c:/Users/Dell/Habi3D-Project/src/components/floorPlanDrag.ts):**
  * *Purpose:* Free-movement physics and drag coordinate engine. Restricts movement within outer wall envelopes, computes live gap readouts, alignment guide snap-lines, collision detection, auto-detects room membership based on center point drop coordinates, and enforces the bedroom boundary barrier (`BEDROOM_DIVIDER_WALL_Z_M = 3.40`, `isItemInBedroom()`, `isItemInLivingOrDining()`). Includes `packItemsIntoRoom()` layout packer.
  * *Key Exports:* `unitEnvelope`, `packItemsIntoRoom()`, `BEDROOM_DIVIDER_WALL_Z_M`, `isItemInBedroom()`, `isItemInLivingOrDining()`, `canPlace()`, drag handlers.
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
  * *Purpose:* Mathematical calibration module. Derives a rigid transformation matrix (2D rotation $\theta$ + translation vector $T$) linking an arbitrary WebXR hit-test frame to the fixed 2D plan frame. In Phase 3, this is driven directly by the visual ceiling wireframe room guide without physical corner/wall tapping.
  * *Key Exports:* `deriveCalibration()`, `applyCalibration()` (AR local $\rightarrow$ Plan), `invertCalibration()` (Plan $\rightarrow$ AR local), `calibrationThetaRad()`.
* **[ARMeasureSession.tsx](file:///c:/Users/Dell/Habi3D-Project/src/ar/ARMeasureSession.tsx):**
  * *Purpose:* WebXR point-to-point camera measurement component. Allows users to measure physical room distances or furniture dimensions with 1-decimal floating cm precision, supporting immediate in-session retakes via `retakeTrigger` and optimized Three.js `markerARef` handling.
  * *Key Exports:* `ARMeasureSession` (React Component), `MeasurePhase`.
* **[ClearanceOverlay.tsx](file:///c:/Users/Dell/Habi3D-Project/src/ar/ClearanceOverlay.tsx) & [CorrectionArrow.tsx](file:///c:/Users/Dell/Habi3D-Project/src/ar/CorrectionArrow.tsx):**
  * *Purpose:* 3D WebXR rendering overlays displaying spatial clearance boundaries, warning indicators, and directional arrows suggesting optimal placement moves in AR space.
* **[overlayRenderer.tsx](file:///c:/Users/Dell/Habi3D-Project/src/ar/overlayRenderer.tsx) & [shapeLibrary.ts](file:///c:/Users/Dell/Habi3D-Project/src/ar/shapeLibrary.ts):**
  * *Purpose:* Procedural 3D mesh generator rendering primitive furniture geometries (box, cylinder, L-mesh) inside `@react-three/fiber` XR scenes from stored centimeter dimensions ($M = \text{cm} / 100$).

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

### 2.7 Geometry, Validation & Backend Integration (`src/data/`, `src/utils/` & `src/supabase.ts`)

* **[condoLayout.ts](file:///c:/Users/Dell/Habi3D-Project/src/data/condoLayout.ts):** Geometry specification for Mulberry Place 2BR (`CONDO_ROOMS`: 8 zones). `getRoomForCategory()` strictly routes all furniture categories to `'living'` or `'dining'` only, eliminating accidental bedroom default assignments.
* **[furnitureValidation.ts](file:///c:/Users/Dell/Habi3D-Project/src/utils/furnitureValidation.ts):** Dimension validation guard evaluating furniture against Mulberry Living ($260\text{ cm} \times 360\text{ cm}$) and Dining ($260\text{ cm} \times 180\text{ cm}$) boundaries. Identifies oversized pieces ($>360\text{ cm}$ length, $>260\text{ cm}$ width, $>260\text{ cm}$ height).
  * *Key Exports:* `isFurnitureDimensionOversized()`, `findOversizedFurniture()`.
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
| **Landing / Entry** | `src/screens/EntryScreen.tsx` | `'entry'` | **Active** | Primary entry point. Two-tone gradient wordmark ("Habi3D"), frosted glass card, clean authentication hierarchy: **Create Account** (Auth), **Log In** (Auth text link). |
| **Authentication** | `src/screens/AuthScreen.tsx` | `'auth'` | **Active** | Manages user sign-up and login using username input mapped internally to `${username}@habi3d.local`. Checks Supabase `saved_sessions` for existing layout; prompts user to Resume existing layout or Start Fresh. |
| **Furniture Input** | `src/screens/FurnitureInputScreen.tsx` | `'furnitureInput'` | **Active** | Step 1/2 of layout setup. Furniture item catalog selection (sofa, coffee table, dining set, cabinet, etc.), shape selection (rectangle, round, l-shape, oval), custom dimension entry with decimal-safe inputs (`inputMode="decimal"`), WebXR point-to-point camera measurement with in-session confirmation dialog (1-decimal cm precision), immediate retake, and circular furniture diameter synchronization. |
| **AR Position Map** | `src/screens/PositionMapScreen.tsx` | `'positionMap'` | **Active** | Step 2/2 of layout setup. WebXR AR placement and spatial alignment screen. Executes overhead visual room alignment (`RoomAlignmentScene`: Living & Dining ceiling wireframe guide with touch controls and yaw rotation), places 3D furniture models (`PlacementScene`), enforces dimension sanity checks against oversized items before completing placement, blocks bedroom placement, and supports mid-session recalibration. |
| **Workspace (Interactive Plan)** | `src/screens/WorkspaceScreen.tsx` | `'analysis'`, `'recommendations'`, `'recommendation'` | **Active** | Core 2D interactive layout optimization hub (~82% viewport canvas). Free-movement physics drag, on-screen 4-way Fine Position D-pad (`1 cm / tap`), architectural bedroom wall blocker reverting invalid drops to last clear spot in Living/Dining, live tabular-numeral gap readouts, alignment guides, collision detection, unit-wide lettered/numbered grid overlay (A1-F8), muted room shading, dimension callouts, rotate/undo toolbar, safe reset preserving dimensions, tabbed inspection panel (Items, Fixes/Violations with CVD ClearanceMeters, Rules reference), and walkway access indicators. |
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

### 4.2 Process 2: AR-to-2D Coordinate Calibration & Quick Visual Room Alignment

```
[Enter WebXR Session] ──► [Overhead Ceiling Wireframe Guide (Y = 2.4m)]
                                    │
                                    ▼
       [Directional Controls: Forward/Back, Left/Right (±10cm), Rotate (±5°)]
                                    │
                                    ▼
       [Align Predefined Living (2.6x3.6m) & Dining (2.6x1.8m) Footprint]
                                    │
                                    ▼
                         [Derive Rigid Transform]
              originX = guideOffset.x, originZ = guideOffset.z
              cosTheta = cos(guideYaw), sinTheta = sin(guideYaw)
                                    │
                                    ▼
                      [Confirm Living/Dining Alignment]
                                    │
                                    ▼
                        [Placement Scene Active]
                                    │
                                    ▼
                         [Place 3D Ghost Model]
                                    │
                                    ▼
                       [Dimension Sanity Guard Check]
            Is piece > 360cm length, > 260cm width, or > 260cm height?
                       ├── Yes ──► [Show Size Warning Modal: Review / Cancel]
                       └── No
                                    │
                                    ▼
                      [applyCalibration(P_AR) -> P_2D]
                                    │
                                    ▼
                        [Is Position in Bedroom?]
                       ├── Yes ──► [Block Placement: Show Warning Toast]
                       └── No  ──► [Save to furnitureStore]
                                    │
                                    ▼
                         [Click Recalibrate?] ─────────┘
```

1. **AR Session Initialization:** The user starts WebXR tracking via `PositionMapScreen.tsx`.
2. **Quick Visual Room Alignment (`RoomAlignmentScene`):**
   * Displays an overhead ceiling-height ($Y = 2.4\text{ m}$) wireframe matching the predefined Living ($2.6\text{m} \times 3.6\text{m}$) and Dining ($2.6\text{m} \times 1.8\text{m}$) boundaries, complete with 4 corner drop lines descending to the floor and floating room name labels.
   * Eliminates the need for resident users to physically walk and tap inaccessible physical corners or walls.
   * `XRDomOverlay` provides simple directional controls: Forward/Backward ($\pm 10\text{ cm}$), Left/Right ($\pm 10\text{ cm}$), and Yaw Rotation ($\pm 5^\circ$), along with [Reset Alignment] and [Confirm Alignment].
3. **Transform Derivation (`calibration.ts`):** Directly computes the rigid coordinate transformation parameters:
   $$\text{originX} = \text{guideOffset.x}, \quad \text{originZ} = \text{guideOffset.z}, \quad \cos\theta = \cos(\text{yaw}), \quad \sin\theta = \sin(\text{yaw})$$
   Preserves the underlying mathematical model so `applyCalibration()` and `invertCalibration()` function identically.
4. **Dimension Sanity Pre-Transition Check:** Prior to committing placement or analyzing the layout, `findOversizedFurniture()` inspects dimensions. If an item exceeds unit room boundaries ($>360\text{ cm}$ length, $>260\text{ cm}$ width, $>260\text{ cm}$ height), a non-blocking modal alerts the user (*"Check Furniture Size — This furniture appears unusually large for the Living/Dining area. Please review its dimensions."*) with `[Review Dimensions]` and `[Cancel]` buttons.
5. **Bedroom Placement Prevention:** Validates that the transformed 2D coordinates do not fall beyond the bedroom dividing wall ($Z < 3.40\text{ m}$). If in the bedroom, placement is blocked and a warning toast advises placing in the Living or Dining area.
6. **Coordinate Mapping & Ghost Rendering (`PlacementScene`):**
   * *Write Path:* When furniture is placed in AR, `applyCalibration(P^{\text{AR}})` transforms AR hit-test coordinates to fixed 2D plan coordinates ($P^{\text{2D}}$) stored in `furnitureStore`. Centimeter dimensions (`lengthCm`, `widthCm`, `heightCm`) are bit-locked and preserved without modification.
   * *Read Path:* Existing 2D furniture items are converted back via `invertCalibration(P^{\text{2D}})` to render 3D ghost meshes in AR space.
7. **Mid-Session Recalibration:** Users can tap "Recalibrate" at any time during placement to realign the room wireframe without discarding placed items.

### 4.3 Process 3: Furniture Inventory, Camera Measurement & Dimension Locking

1. **Item Selection:** Users choose preset items from `FurnitureInputScreen.tsx` or specify custom labels and categories.
2. **Shape Configuration:** Selects geometry shape (`rectangle`, `round`, `l-shape`, `oval`). For round items, diameter configuration automatically synchronizes both `lengthCm` and `widthCm`.
3. **Decimal-Safe Input Sanitization:** Replaced regex-based integer stripping with `sanitizeDecimal()` and `toPositiveNumber()`, adding `inputMode="decimal"` across all dimensions for seamless mobile numeric keypad entry with single-decimal-place precision (e.g. `97.4 cm`).
4. **WebXR Point-to-Point Measurement (`ARMeasureSession.tsx`):**
   * Users launch an AR camera session to measure physical items point-to-point.
   * Two camera taps establish a 3D bounding vector; euclidean distance is calculated in meters and converted to centimeters with 1 decimal place.
   * **In-Session Confirmation Card:** Displays raw AR measurement in centimeters with an editable input field, `[Retake]`, and `[Confirm Measurement]` buttons.
   * **Zero-Teardown Retake:** Tapping `[Retake]` resets markers and line geometry via `retakeTrigger` and returns to `ready` phase without destroying or restarting the WebXR camera session.
5. **Dimension Locking Across AR → 2D:** Ensures that dimensions entered in Furniture Input remain stored exclusively in centimeters and are transferred verbatim to `furnitureStore`, `projectItems()`, and `CondoFloorPlan`, preventing AR scaling distortions.
6. **Inventory Commit:** Appends the configured `FurnitureItem` object to `furnitureStore`.

### 4.4 Process 4: 2D Floor Plan Interactive Layout Physics, Fine D-Pad & Wall Blocker

```
[Pointer Down on 2D Plan] ──► [Distance moved > 5px?] ──► [No]  ──► [Treat as Selection Click]
                                        │
                                        ▼ [Yes]
                            [Initialize Drag Session]
                                        │
                                        ▼
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

### 4.7 Process 7: Walkway Obstruction Monitoring & Multi-Surface Notification Lifecycle

```
[User Drags & Drops Furniture Item on 2D Plan]
                        │
                        ▼
      [Execute handleDragEnd() in WorkspaceScreen]
                        │
                        ▼
            [Overlaps Another Piece?]
           ├── Yes ──► [Snap back to lastOkRef + Show Collision Toast]
           └── No
                        │
                        ▼
            [Check isItemInMainWalkway(rehomed)]
           ├── Yes ──► [Trigger Toast: "⚠️ Notice: [Item] is placed on the main walkway corridor."]
           └── No  ──► [Trigger Room Transition Toast if rehomed to new room]
                        │
                        ▼
             [commitLayout() to furnitureStore]
                        │
                        ▼
     [recompute walkwayStatuses = computeWalkways(preview)]
                        │
                        ▼
    ┌───────────────────┴───────────────────┐
    ▼                                       ▼
[Header Pill Row Update]            [Side Drawer: Fixes Tab]
If any corridor < 60cm:             Update "Walkway Access" cards:
Display: "[N] Walkways Blocked"     - Red Badge: "Blocked" (<60cm)
                                    - Yellow Badge: "Tight" (60-90cm)
                                    - Green Badge: "Clear" (≥91cm)
                                    - Measured vs Target (≥91cm)
```

1. **Drop Event Evaluation:** Pointer release triggers `handleDragEnd()`. Collision detection with existing pieces is checked first; if collision occurs, the piece reverts to `lastOkRef` with a collision notice (`"[Item] would overlap another piece — moved to the last clear spot."`), taking precedence over walkway checks.
2. **Main Walkway Bounds Check (`isItemInMainWalkway`):** Evaluates if the dropped piece overlaps `MAIN_ENTRY_WALKWAY_RECT` ($x \in [2.15\text{m}, 2.95\text{m}]$, $z \in [3.40\text{m}, 8.80\text{m}]$) by $> 0.01\text{m}$ along both X and Z axes.
3. **Toast Notification Trigger:** If obstructed, displays `⚠️ Notice: [Item Label] is placed on the main walkway corridor.` for 2.5 seconds via a top-centered floating banner (`#16203A`, rounded pill).
4. **Multi-Corridor Recalculation (`computeWalkways`):** Assesses max protrusion into each of the 5 key corridors (`Living → Dining`, `Living → Balcony`, `Living → Bedroom`, `Dining → Kitchen`, `Bedroom → Bathroom`). Clearance is derived as $\max(0, \text{corridorWidth} - \text{maxOverlap})$.
5. **Multi-Surface UI Synchronization:**
   - **Header Pill Counter:** The top summary pill row dynamically displays the count of blocked corridors (`[N] Walkways Blocked`, $<60\text{ cm}$ clearance).
   - **Drawer "Walkway Access" List:** The Fixes drawer updates status badges (`Blocked`, `Tight`, `Clear`) and exact gap readouts in real-time.
   - **Clearance Engine Rule L4:** If the room's main path width falls below $91\text{ cm}$, Rule **L4** generates a priority-ranked clearance violation card with explicit remediation steps ("DO THIS: Move [direction] by [X] cm").

---

## 5. Detailed Feature Breakdown Matrix

| Feature | Implementation Component(s) | Technical Strategy | Operational Status |
| :--- | :--- | :--- | :--- |
| **Free 2D Floor Plan Drag** | `CondoFloorPlan.tsx`<br>`floorPlanDrag.ts` | Delta drag tracking, `unitEnvelope` outer wall bounding, live snap lines, live cm readouts. | **Active & Verified** |
| **Main Walkway Corridor & Real-Time Alert System** | `CondoFloorPlan.tsx`<br>`walkways.ts`<br>`WorkspaceScreen.tsx` | SVG dashed corridor overlay (`MAIN_ENTRY_WALKWAY_RECT`), real-time toast alert (`isItemInMainWalkway`), 5-path clearance monitoring (`computeWalkways`), header blocked pill, drawer status badges, and comprehensive test suite (`TC-WKSP-WALKWAY-001`–`005`). | **Active & Verified** |
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
| **Session Progress & Constructive Reporting** | `violationStore.ts`<br>`ReportScreen.tsx`<br>`pdfReport.ts` | Session progress computed via initial snapshot diffing ("You made N spots more comfortable"). Constructive phrasing ("Extra space suggested", "Layout preserved"), brand navy visual accents, and multi-page vector PDF download. | **Active & Verified** |
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
* ✅ **Main Walkway Obstruction Suite:** 5/5 boundary, precedence, and notification test cases (`TC-WKSP-WALKWAY-001`–`005`) verified passing.

### 7.1 Walkway Obstruction Functionality Test Matrix (TC-WKSP-WALKWAY-001 to 005)

| Test Case ID | Test Scenario | Preconditions & Inputs | Expected System Notification & UI Reaction | Status |
| :--- | :--- | :--- | :--- | :--- |
| **`TC-WKSP-WALKWAY-001`** | **Nominal Walkway Placement & Multi-Surface Notification** | User drags an item (e.g. Sofa) into central entry corridor ($x \in [215, 295]\text{ cm}$, $y \in [340, 880]\text{ cm}$, overlap $>1\text{ cm}$) and drops. | 1. Toast banner appears: `⚠️ Notice: [Item] is placed on the main walkway corridor.`<br>2. Toast auto-dismisses after 2.5s.<br>3. Canvas header pill updates: `N Walkways Blocked` (red badge).<br>4. Drawer "Walkway Access" list flips affected path to `Blocked` (red) or `Tight` (yellow).<br>5. Rule **L4** generates clearance card if room circulation path $<91\text{ cm}$. | **Passed** |
| **`TC-WKSP-WALKWAY-002`** | **Sub-Threshold Boundary Proximity** | User places item tangent to corridor boundary with overlap $\le 1\text{ cm}$ ($0.01\text{m}$ epsilon). | No walkway warning triggers; standard room move toast displayed. Walkway clearance remains classified as `Clear` ($\ge 91\text{ cm}$). | **Passed** |
| **`TC-WKSP-WALKWAY-003`** | **Walkway Evacuation & Status Restoration** | User drags obstructed item out of corridor back into room interior. | Standard room toast appears (`"[Item] moved to Living Room"`). Walkway blockage pill decrements/disappears, and drawer badge returns to green `Clear`. | **Passed** |
| **`TC-WKSP-WALKWAY-004`** | **Collision Precedence Over Walkway Warning** | User attempts to drop a piece overlapping another furniture piece within the walkway zone. | Collision protection takes precedence: piece reverts to last valid spot with toast `"[Item] would overlap another piece — moved to the last clear spot."` Walkway toast is suppressed. | **Passed** |
| **`TC-WKSP-WALKWAY-005`** | **Undo Stack Reversion (`Ctrl+Z` / Undo Button)** | User places item on walkway, then triggers Undo. | Layout rolls back to prior history snapshot; blocked walkway count decrements immediately, restoring prior clearance state. | **Passed** |

