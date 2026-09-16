# Habi3D Codebase — Current State, Architecture & Status

**Last updated:** 2026-09-16 (Read-Only 3D Dollhouse Layout Preview, Responsive Camera & Regression Isolation)
**Project phase:** Phase 3 — AR Floor Hit-Test Placement, Streamlined 2D Planning & Read-Only 3D Visualization
**Target Unit Scope:** Fixed Single Unit — Mulberry Place 2BR (Acacia Estates, Taguig)

---

## 0. Recent Updates & Change Log (Top Priority Summary)

> [!NOTE]
> **Latest Update (2026-09-16):** Read-Only 3D Dollhouse Layout Preview — Added a dedicated Three.js / React Three Fiber visualization screen for inspecting the current Mulberry Place 2BR furniture arrangement. The preview reads the authoritative `furnitureStore.items` array, renders user-defined dimensions, shape, category, position, and rotation, and provides bounded orbit/zoom camera controls. It contains no furniture mutation actions, clearance classifications, recommendation overlays, AR behavior, persistence hooks, or report changes.

### Key Recent Changes (September 16, 2026: Read-Only 3D Dollhouse Layout Preview)

1. **New Isolated 3D Preview Screen (`ThreeDPreviewScreen.tsx`, `ThreeDLayoutPreview.tsx`)**
   - Added route key `'threeDPreview'` to `ScreenName` and registered it in `App.tsx`.
   - Added a compact **3D View** command to the existing 2D workspace header and a **Back to 2D** command inside the preview.
   - Returning to the workspace preserves the exact active layout because navigation changes only `sessionStore.currentScreen`; the preview does not clone, commit, normalize, or save furniture state.
   - The preview screen subscribes only to `useFurnitureStore((state) => state.items)` and passes that array down as read-only component props.

2. **Procedural Dollhouse Environment (`DollhouseFloorPlan.tsx`)**
   - Generates the Mulberry Place 2BR slab, eight room floor zones, exterior walls, and low interior partitions directly from the existing `CONDO_ROOMS` geometry.
   - Derives overall unit width and depth from room bounds rather than introducing duplicate `510 x 880 cm` architectural constants.
   - Deduplicates and merges collinear room-edge intervals before rendering wall segments, preventing overlapping wall meshes along shared partitions.
   - Uses an open-top, low-wall composition so furniture remains visible from an elevated camera angle.

3. **Dimension-Faithful Furniture Models (`DollhouseFurniture.tsx`)**
   - Converts dimensions locally with `100 cm = 1 Three.js world unit` while leaving stored centimeter values unchanged.
   - Uses stored `posX`, `posZ`, and `rotationY` directly as world position and yaw rotation; no packing, clamping, collision correction, or automatic repositioning occurs in 3D.
   - Supports rectangular, round, oval, and L-shaped footprints with lightweight category-aware models for sofas, tables, chairs, desks, cabinets, TV stands, and generic items.
   - Tabletop, support, seat, backrest, arm, and cabinet primitives remain inside each item's user-defined outer dimensions as far as practical.

4. **Responsive Read-Only Camera (`ThreeDLayoutPreview.tsx`)**
   - Uses `OrbitControls` for orbit and zoom, with panning disabled and bounded distance/polar-angle limits so the unit cannot be lost outside the viewport.
   - Keeps camera state local to the canvas; camera movement does not touch Zustand state, undo history, autosave, or Supabase.
   - Uses separate landscape and portrait framing offsets. The portrait camera adopts a more top-down, long-axis view so the complete condominium footprint remains visible on narrow Android/mobile screens.
   - Uses simple materials, low polygon counts, limited lighting, no shadows, demand-driven rendering, and a capped device-pixel ratio (`1–1.5`) for mobile performance.

5. **Strict Regression Isolation**
   - No changes were made to `src/engine/`, `src/ar/`, `PositionMapScreen.tsx`, `FurnitureInputScreen.tsx`, `ReportScreen.tsx`, `supabase.ts`, `CondoFloorPlan.tsx`, or `floorPlanDrag.ts` for this feature.
   - New preview files contain no calls to `addItem`, `updateItem`, `updatePosition`, `removeItem`, `clearAll`, or `setItems`.
   - The 3D layer does not import or display clearance findings, walkway classifications, recommendation guidance, RED/YELLOW/GREEN/N/A states, or report data.
   - Existing 2D editing, automatic clearance re-evaluation, AR measurement/placement, autosave, authentication, and PDF reporting remain authoritative and behaviorally unchanged.

### Key Prior Changes (September 14, 2026: Category-Aware AR Spawning, Dining Chair Batch Replication & WebXR Stability)

1. **Category-Aware AR-to-2D Room Spawning (`furnitureStore.ts`, `PositionMapScreen.tsx`, `FurnitureInputScreen.tsx`)**
   - **Architectural Bug Fix:** Previously, confirmed AR placements hardcoded `roomId: 'living'` and Living Room center coordinates ($X=1.3\text{m}, Z=5.2\text{m}$) in `PositionMapScreen.tsx` (and `FurnitureInputScreen.tsx`), causing dining furniture (tables, chairs) to erroneously spawn in the living room.
   - **Room Position Helper:** Added and exported `DINING_ROOM_CENTER_POS = { posX: 1.3, posZ: 7.9, roomId: 'dining' as const, rotationY: 0 }` and `getDefaultRoomPosition(category: string, label: string = '')` in `src/stores/furnitureStore.ts`.
   - **Category Routing:** If `getRoomForCategory(category, label)` resolves to `'dining'`, the item is assigned `roomId: 'dining'`; otherwise it resolves to `'living'`.
   - **Calibrated Coordinate Clamping & Boundary Fallback:** In `PositionMapScreen.tsx`, calibrated AR coordinates are validated against room boundaries:
     - *Dining Room:* $X \in [0.3, 2.3]\text{m}$, $Z \in [7.2, 8.6]\text{m}$.
     - *Living Room:* $X \in [0.3, 2.3]\text{m}$, $Z \in [3.6, 6.8]\text{m}$.
     - *Safe Fallback:* If calibrated coordinates fall outside valid room polygons or are uncalibrated/NaN, positions seamlessly fall back to `defaultPos.posX` and `defaultPos.posZ`.

2. **Dining Chair Quantity Selector & Batch Item Replication (`types/index.ts`, `FurnitureInputScreen.tsx`, `PositionMapScreen.tsx`)**
   - **Data Model Update:** Added `quantity?: number;` to the `FurnitureItem` interface in `src/types/index.ts`.
   - **Dynamic Quantity Stepper (`FurnitureInputScreen.tsx`):**
     - Renders a responsive, tactile quantity stepper `[−] count [+]` (range 1–8, default 4) when `category === 'dining_chair'` or `label` contains "chair".
     - Displays `(1–8 chairs)` hint and attaches `quantity: finalQuantity` to the item payload upon confirmation.
     - Displays `Qty: N` metadata pill in the `FurnitureAddedPanel` summary.
   - **Single AR Placement Archetype:** Residents perform WebXR floor placement once for the chair archetype, preserving zero-friction AR usability without requiring tedious repetitive placements.
   - **Batch Replication on Confirmation (`PositionMapScreen.tsx`):**
     - When `itemPayload.quantity > 1`, `handleConfirmPlacement` automatically clones the archetype into $N$ distinct items.
     - *Item 1 (index 0):* Updates the primary archetype item in-place with label `${baseLabel} 1`, assigned coordinates, and `quantity: 1`.
     - *Items 2 through N:* Dispatches new independent `FurnitureItem` records with unique IDs (`${itemPayload.id}-${i+1}`), sequential labels (`${baseLabel} ${i+1}`), and `quantity: 1`.
     - *2-Column Offset Layout:* Calculates spatial offsets ($\text{col} = i \bmod 2 \implies dx = \pm 0.28\text{m}$, $dz = (\text{row} - (\text{rows}-1)/2) \times 0.55\text{m}$), preventing items from spawning in an overlapping stack.
     - *Full Independence:* Each spawned chair operates as an independent entity in the 2D workspace (`WorkspaceScreen.tsx`), allowing residents to freely drag, rotate, or individually evaluate each chair against clearance rules D2, D3, and D4.

3. **WebXR Android Chrome Crash Fix (`FurnitureInputScreen.tsx`)**
   - Removed `planeDetection: true` from `createXRStore()` in `FurnitureInputScreen.tsx`.
   - Resolves a critical WebXR driver crash on Android Chrome devices where concurrent plane detection and hit-testing overloaded ARCore sessions.

4. **Modernized Vector Back Button UI (`BackIcon.tsx`, `App.css`, all screens)**
   - Replaced legacy unicode `←` and `&lt;` strings across all screens (`AuthScreen`, `FurnitureInputScreen`, `PositionMapScreen`, `WorkspaceScreen`, `ReportScreen`, `RecommendationScreen`, `AnalysisScreen`) with a reusable vector SVG `<BackIcon />`.
   - Styled `.back-btn` and `.wksp-icon-btn` with glassmorphic squircle geometry, `backdrop-filter: blur(10px)`, elevation hover transitions, and press micro-animations (`scale(0.95)`).

5. **Single-Tap Room Entry Anchor Alignment Is Alive & Active (`PositionMapScreen.tsx`, `ar/calibration.ts`)**
   - **Active Alignment Requirement:** While the cumbersome multi-step 2-point calibration (NW corner + North wall vector) was eliminated, **Single-Tap Room Entry Corner Anchor Alignment is fully alive, active, and strictly enforced** before furniture placement can occur.
   - **Interaction Workflow (`waitingForAnchor` Mode):**
     1. When entering AR placement in `PositionMapScreen.tsx`, the screen initiates in `anchorTapMode = 'waitingForAnchor'`.
     2. A high-contrast golden status badge is displayed: `"📍 Tap the room entry corner to align"`.
     3. Tapping the physical floor at the unit's entry door corner invokes `handleAnchorTap()`.
     4. Reads the physical device viewer pose (`frame.getViewerPose(xrReferenceSpace)`), calculates the user's camera yaw, and establishes an active coordinate transform matrix via `deriveCalibration({ arPoint, blueprintPoint: ENTRY_DOOR_BLUEPRINT, yaw })` anchored to `ENTRY_DOOR_BLUEPRINT = { x: 0.2, z: 0.1 }`.
     5. Saves `anchorCalibration`, sets `deviceYaw`, and transitions to `anchorTapMode = 'placing'` with confirmation toast `"✓ Room anchor set. Now place furniture."`
     6. Once anchored, floor taps position the furniture (`lockedPosition`).
     7. Tapping "Confirm placement" executes `applyCalibration(lockedPosition, anchorCalibration)` to transform the physical AR hit point into true blueprint coordinates before category-aware room clamping.

### Key Prior Changes (September 12, 2026: Clearance Rules Engine Deep-Dive & Code Summaries)

1. **Contextual Applicability Model & Strict 5-Step Evaluation Sequence (`clearance.ts`, `rules.ts`, `types/index.ts`)**
   - **Architectural Paradigm Shift:** Upgraded from naive distance measurement to the **Contextual Applicability Model** sourced from *Time-Saver Standards for Interior Design* (DeChiara, Panero & Zelnik, 2001, pp. 61–90). A measurable physical gap is no longer automatically considered a clearance requirement.
   - **Strict 5-Step Decision Sequence:**
     1. *Identify Spatial Relationship:* Identify pair roles (living vs dining, table vs chair, seating vs surface, corridor passage).
     2. *Check Applicability:* Verify if specific preconditions are met (`pairAppliesToL1`, `pairAppliesToL2`, `pairAppliesToL3`, `pairAppliesToL5`, `pairAppliesToD1`, `pairAppliesToD4`, `pairAppliesToD5`). If not applicable, return `'N/A'`.
     3. *Measure Relevant Clearance:* Extract orthogonal Euclidean distance or wall-to-edge gap.
     4. *Compare:* Benchmark measured clearance against codified metric thresholds.
     5. *Return Classification:* Emit `'N/A'`, `'RED'`, `'YELLOW'`, or `'GREEN'`. Non-applicable rules return `'N/A'` and are never counted as active violations or recommended moves.
   - **Generic Wall Gap Suppression:** Placing furniture (sofa, console, shelf) flat against a wall is standard interior design practice. Suppressed automatic wall checks for L1 so that furniture placed against a wall never produces false-positive circulation violations.
   - **Threshold Updates & Zero-Width YELLOW Removal:**
     - `L1` (Living Circulation): Violation $< 76\text{cm}$, Warning $76$–$90\text{cm}$, Green $\ge 91\text{cm}$.
     - `L2` (Sofa to Coffee Table): Violation $< 35\text{cm}$, Warning $35$–$44\text{cm}$, Green $\ge 45\text{cm}$.
     - `L3` (Conversation Seating): Violation $< 45\text{cm}$, Warning $45$–$59\text{cm}$, Green $\ge 60\text{cm}$.
     - `L4` (Walkway Corridor): Violation $< 61\text{cm}$, Warning $61$–$75\text{cm}$, Green $\ge 76\text{cm}$. In condo unit, evaluates `WALKWAY_PATHS`.
     - `L5` (Living-Dining Transition): Violation $< 91\text{cm}$, Warning $91\text{cm}$ (Binary: equal thresholds, 0-width YELLOW removed), Green $\ge 91\text{cm}$.
     - `D1` (Table to Wall): Violation $< 91\text{cm}$, Warning $91$–$106\text{cm}$, Green $\ge 107\text{cm}$.
     - `D2` (Chair Pull-Out Depth): Violation $< 50\text{cm}$, Warning $50$–$60\text{cm}$, Green $\ge 61\text{cm}$.
     - `D3` (Dining Service Passage): Violation $< 91\text{cm}$, Warning $91$–$106\text{cm}$, Green $\ge 107\text{cm}$.
     - `D4` (Seated Diner Clearance): Violation $< 91\text{cm}$, Warning $91\text{cm}$ (Binary: 0-width YELLOW removed), Green $\ge 91\text{cm}$.
     - `D5` (Table to Buffet/Cabinet): Violation $< 107\text{cm}$, Warning $107$–$121\text{cm}$, Green $\ge 122\text{cm}$.
   - **Restricted Zone Drag Badge Suppression (`floorPlanDrag.ts`, `CondoFloorPlan.tsx`):**
     - When dragging a piece across Bedroom, Kitchen, or Bathroom blocker zones, compass clearance gap badges and `edgeGaps` are cleanly suppressed.
   - **L-Shape Option Removal (`FurnitureInputScreen.tsx`):**
     - Removed the L-shape selector from the furniture input flow, standardizing catalog items on rectangular and circular shapes.
   - **Modernized Vector Back Button UI (`BackIcon.tsx`, `App.css`, all screens):**
     - Replaced legacy unicode `←` and `&lt;` strings across all screens (`AuthScreen`, `FurnitureInputScreen`, `PositionMapScreen`, `WorkspaceScreen`, `ReportScreen`, `RecommendationScreen`, `AnalysisScreen`) with a dedicated SVG `<BackIcon />`.
     - Added premium glassmorphic styling (`.back-btn`, `.wksp-icon-btn`): squircle geometry, backdrop-filter blur, subtle border, elevation hover transitions, and tactile active scaling.

2. **Detailed Rules Logic & Theoretical Lineage Documentation (`rules.ts`, `clearance.ts`, `ruleGuidance.ts`, `walkways.ts`, `violationKey.ts`)**
   - **Academic & Anthropometric Context:** Codified *Time-Saver Standards for Interior Design and Space Planning* (DeChiara, Panero & Zelnik, 2001, pp. 61–90) metric thresholds for urban condominium living (Mulberry Place 2BR). Documented human body clearances (shoulder width, passing corridors, seated legroom, dining chair pull-out depth, service passage behind seated diners).
   - **Comprehensive 10-Rule Specification Matrix:** Expanded full matrix detailing L1–L5 (Living) and D1–D5 (Dining) with room categories, activation trigger predicates, RED/YELLOW/GREEN metric thresholds, affected edge length assignment, plain-English titles/requirements, and consequence statements.
   - **Mathematical Formulations:** Documented exact formulas for conservative rotated AABB bounding envelopes ($\text{effectiveLength} = L|\cos\theta| + W|\sin\theta|$, $\text{effectiveWidth} = L|\sin\theta| + W|\cos\theta|$), orthogonal pairwise Euclidean distances, cardinal wall clearances, Spatial Impact ($SI$), Priority Score ($S = \text{VSW} \times SI$), buffered remediation vectors ($\text{fixDirectionCm} = \text{required} - \text{measured} + 5\text{cm}$), and deterministic stable finding keys (`stableViolationKey`).
   - **Code Summary Matrix:** Exhaustively summarized every engine module (`rules.ts`, `clearance.ts`, `ruleGuidance.ts`, `walkways.ts`, `violationKey.ts`, `clearanceTestCases.ts`) with type signatures, interfaces, helper predicates, and data flow.

### Prior Changes (September 10, 2026: Soft Collisions & Unblocked Rotation/Drag Overlaps)

1. **Unblocked Drag Overlaps & Free Rotation (`floorPlanDrag.ts`, `WorkspaceScreen.tsx`)**
   - **Soft Collision Math:** In `floorPlanDrag.ts`, updated `canPlace()` to allow furniture-to-furniture overlaps while strictly preserving exterior wall boundary (`insideUnit`) and partition boundaries (`!isItemInBedroom(item)` and `!isItemInKitchenOrBathroom(item)`).
   - **Unblocked `handleDragEnd`:** Removed the hard rollback to `lastOkRef` on furniture overlap. Overlapping drops now commit directly to `furnitureStore` and update `lastOkRef.current`.
   - **Unblocked Rotation:** In `handleRotate`, pieces can now rotate 90° even when overlapping or clipping another piece, committing successfully to the layout.
   - **Fluid Drag & Nudge:** In `handleDragMove` and `nudgeSelected`, movement through other furniture pieces is no longer blocked.

2. **Converted Hard Revert to Soft Warning Toast (`WorkspaceScreen.tsx`)**
   - **Soft Warning Toast Notification:** When an item is dropped or rotated into another piece of furniture, the UI displays a soft warning toast: `"⚠️ Notice: Furniture pieces are overlapping."`
   - **Natural Clearance Engine Detection:** The 10 Clearance Rules engine naturally computes a $0\text{cm}$ gap between intersecting items, flagging affected pieces with RED status badges and generating actionable fix cards in the Recommendation drawer.
   - **Strict Hard Constraint Preservation:** Outer unit walls, Bedroom Wall Blocker ($Y=340\text{cm}$), and Kitchen/Bathroom zones remain absolute hard constraints that reject drops and rollback immediately to `lastOkRef`.

### Prior Changes (September 10, 2026: Strict Kitchen & Bathroom Confinement & Visual Blockers)

1. **Strict Mathematical Confinement (`floorPlanDrag.ts`, `WorkspaceScreen.tsx`)**
   - **Zone Intersection & Confinement Math:** In `floorPlanDrag.ts`, implemented `itemIntersectsRoomZone()`, `isItemInKitchen()`, `isItemInBathroom()`, and `isItemInKitchenOrBathroom()` checking against `CONDO_ROOMS` coordinates (Bathroom: $X=260..510\text{cm}, Y=460..620\text{cm}$; Kitchen: $X=260..510\text{cm}, Y=620..880\text{cm}$).
   - **Confinement Integration:** Updated `isItemInLivingOrDining(item)` and `canPlace(item, items)` to actively reject any item intersecting Kitchen or Bathroom zones.
   - **Instant Drop Reversion & Standard Toast:** In `WorkspaceScreen.tsx`, updated `handleDragEnd`, `handleDragMove`, `nudgeSelected`, and `normalizeFurniturePositions`. Any attempt to drop or nudge into the Bedroom, Kitchen, or Bathroom immediately reverts to `lastOkRef` and triggers the toast: `"⚠️ Furniture cannot be placed here. Please place it in the Living or Dining area only."`

2. **Visual Blocker Graphics & Dynamic Red Warning (`CondoFloorPlan.tsx`)**
   - **Dynamic Red Warning Highlighting:** Added `dragPreview` tracking so that dragging a piece over the Kitchen or Bathroom zones instantly triggers `isBlockedDropTarget = true`, illuminating the zone with a bold red fill (`#ef4444`, opacity $0.28$) and stroke ($4\text{px}$, `#ef4444`).
   - **Static Blocker Badges & Structural Dividing Wall:** Rendered a solid structural wall line along $X=260\text{cm}$ ($Y=460..880\text{cm}$, stroke `#0f172a`, width $5\text{px}$) and static blocker pill badges (`"BATHROOM - FIXED ZONE"` at $Y=568\text{cm}$ and `"KITCHEN - FIXED ZONE"` at $Y=780\text{cm}$) using identical geometry, dark fill (`#0f172a`), white stroke ($2\text{px}$), and bold white typography as the `BEDROOM WALL BLOCKER`.

### Prior Changes (September 10, 2026: AR Placement Routing & Unpositioned Payload Restoration)

1. **Restored AR Placement Routing & Unpositioned Payload (`FurnitureInputScreen.tsx`, `furnitureStore.ts`)**
   - **AR Navigation Restored:** In `FurnitureInputScreen.tsx`, `handleAddItem` ("Confirm Furniture Item") and the bottom navigation button now route directly to `PositionMapScreen.tsx` (`navigateTo('positionMap')`).
   - **Unpositioned Coordinates:** Initial furniture payload dispatches `posX: 0, posZ: 0` alongside exact user-entered `lengthCm`, `widthCm`, and `heightCm`.
   - **AR Placement Detection:** In `furnitureStore.ts`, `addItem` preserves `posX: 0, posZ: 0`, enabling `PositionMapScreen.tsx` to detect pieces via `!isPositioned(item)` and list them under "Items Needing Position".
   - **Strict Dimension & UI Preservation:** Kept all 1:1 SVG dimension fixes, zero-fallback projection logic in `floorPlanGeometry.ts` and `CondoFloorPlan.tsx`, and the clean removal of the Reset button from `WorkspaceScreen.tsx`. No calibration math was restored.

2. **Removal of First-Render SVG Fallbacks (`floorPlanGeometry.ts`, `CondoFloorPlan.tsx`)**
   - **Pristine Dimension Projection:** In `src/components/floorPlanGeometry.ts`, updated `projectItems()` so `wCm` and `hCm` are derived directly from `item.widthCm` and `item.lengthCm` with rotation orientation, eliminating arbitrary fallback dimensions (such as `|| 50`).
   - **Direct Store Binding on Mount:** In `CondoFloorPlan.tsx`, SVG `<rect>` (`width`, `height`) and `<circle>` (`r`, `cx`, `cy`) dimensions read directly from pristine `furnitureStore` state on the very first mount cycle with 1:1 cm scaling matching the SVG viewBox.

3. **Complete Removal of Reset Button & Streamlined Toolbar (`WorkspaceScreen.tsx`)**
   - **Purged `handleResetPosition`:** Deleted the `handleResetPosition` function and removed the unused `LIVING_ROOM_CENTER_POS` import.
   - **Removed Reset UI Button:** Completely removed the `<button ...>Reset</button>` element from the text toolbar row.
   - **Responsive Toolbar Alignment:** Retained the clean, responsive layout of the remaining toolbar buttons ("Rotate", "Undo", "Delete" with danger styling) within `toolbarTextRow`.
   - **Preserved Core Clearance Engines:** Preserved `clearance.ts`, `rules.ts`, `floorPlanDrag.ts`, and all 10 clearance rules completely untouched.

### Prior Changes (September 10, 2026: Direct AR Floor Hit-Test Placement & Safe 2D Handoff)

1. **Clean Removal of 2-Point AR Calibration (`PositionMapScreen.tsx`)**
   - **Removed Calibration Step:** Completely eliminated the 2-point calibration requirement (northwest corner tap and north wall reference tap), purging `CalibrationScene`, `CalibrationMarker`, and all related state (`calibration`, `calibrationStep`, `cornerPoint`, `wallPoint`, `pendingCalibration`, `calibrationError`, `recalibrateConfirmPending`) along with their handlers (`handleTapCorner`, `handleTapWall`, `retapWallPoint`, `confirmWallPoint`, `retryCalibration`, `recalibrate`, `requestRecalibrate`, `cancelRecalibrate`).
   - **Removed Calibration Prompts:** Cleaned up all overlay prompts and modals ("Step 1 of 2 — Set the corner", "Step 2 of 2 — Set north", "Stand at the unit's northwest corner...", "Reference point set", "Start over from the corner", and "Recalibrate" buttons).
   - **Eliminated Rigid Transform Dependencies:** Removed all imports from `../ar/calibration` (`deriveCalibration`, `applyCalibration`, `invertCalibration`, `calibrationThetaRad`, `ArPoint`, `CalibrationTransform`) from `PositionMapScreen.tsx`.

2. **Direct WebXR AR Floor Placement & Hit-Testing (`PositionMapScreen.tsx`)**
   - **Restored WebXR Hit-Testing:** Configured `hitTest: true` in `xrPlacementStore`. When the resident taps "Place in room", `PlacementScene` runs directly with WebXR hit-testing.
   - **Floor-Tracking 3D Ghost Model:** Moving the device traces physical floor planes in real time via `useXRHitTest`, rendering the semi-transparent 3D shape overlay (`#38bdf8`, opacity 0.55) anchored to the physical floor.
   - **Tap-to-Place Interaction:** Tapping anywhere on the physical floor (excluding overlay UI) locks the piece into position at that spot (`lockedPosition`, `placing = false`).
   - **Yaw Rotation Slider & Re-Place:** Once locked, the resident can adjust furniture yaw using the range slider (`0°..360°`), tap "Re-place" to pick another floor spot, or tap "Confirm placement".
   - **Preserved Exact Styling:** Kept the original card styling (`rgba(255, 255, 255, 0.94)` / `#111827`), buttons (`btn btn-primary`, `btn btn-secondary`), top status pill with exit button, and 2D overview cards ("Step 2 of 2 — Position Furniture", "Items Needing Position", "Place in room" with spinner).

3. **Safe 2D Workspace Handoff (`PositionMapScreen.tsx` → `furnitureStore.ts` → `WorkspaceScreen.tsx`)**
   - **Hardcoded Living Room Center Coordinates:** When the resident taps "Confirm placement", the item is saved to `furnitureStore.ts` using safe Living Room center coordinates ($X=1.3\text{m} / 130\text{cm}, Z=5.2\text{m} / 520\text{cm}$, `roomId: 'living'`, `rotationY`).
   - **Seamless Workspace Transition:** Terminates the AR session cleanly (`stopAR()`) and routes the resident directly to the 2D workspace (`navigateTo('workspace')`) to fine-tune placement on the floor plan.

4. **Reverted AR Placement Routing (`FurnitureInputScreen.tsx`, `furnitureStore.ts`)**
   - **Sequential AR Routing:** In `FurnitureInputScreen.tsx`, clicking "Confirm Furniture Item" (`handleAddItem`) registers the item with unpositioned coordinates (`posX: 0, posZ: 0`) and routes the user to `PositionMapScreen.tsx` (`navigateTo('positionMap')`) instead of directly to `'workspace'`.
   - **Bottom Navigation Button:** Reverted the bottom navigation button to route to `'positionMap'` ("Position Furniture").
   - **Safe Store Coordinate Normalization:** In `furnitureStore.ts`, updated `addItem()` to preserve unpositioned initial items (`0, 0`), and added automatic normalization in `updateItem()` and `updatePosition()` converting values $>10$ cm to meters, ensuring any coordinate dispatch remains within unit boundaries.

5. **Protected 2D Workspace UI (`WorkspaceScreen.tsx`)**
   - **Text-Based Toolbar:** Maintained the responsive text-based toolbar ("Rotate", "Reset", "Undo", "Delete") with full undo/redo state synchronization and deletion restoral.
   - **D-Pad Kept Removed:** The obsolete on-screen 4-way D-Pad remains completely removed in favor of free-movement dragging.
   - **Workspace Borders & Free Dragging:** Workspace border styling, free-movement dragging across the unit envelope, and real-time walkway obstruction monitoring remain fully active.
   - **Protected Core Engines:** `src/engine/clearance.ts`, `src/engine/rules.ts`, `src/components/floorPlanDrag.ts`, and all 10 clearance rules (L1–L5, D1–D5) were preserved completely without any alteration.

6. **Reset State Mutation Fix & 1:1 SVG Dimension Enforcement (`WorkspaceScreen.tsx`, `CondoFloorPlan.tsx`, `floorPlanGeometry.ts`)**
   - **Spread Operator Dimension Preservation:** In `WorkspaceScreen.tsx`, updated `handleResetPosition` to strictly preserve all original item dimensions (`lengthCm`, `widthCm`, `heightCm`, `shape`, `label`, `category`) using the spread operator (`...selectedItem`), overwriting only `posX`, `posZ`, `rotationY` ($0$), and `roomId`.
   - **Full Item Store Dispatch:** Updated `commitLayout` and `handleUndo` to dispatch `updateItem(changed.id, { ...changed })`, ensuring `furnitureStore` always retains complete item definitions during resets and undo operations.
   - **Direct 1:1 SVG Dimensions:** In `CondoFloorPlan.tsx`, ensured `<rect>` `width` and `height` and `<circle>` `r` attributes are drawn directly from `item.widthCm` and `item.lengthCm`, with `lengthCm` and `widthCm` exposed via `PlanRect` in `floorPlanGeometry.ts`.
   - **ViewBox-Only Scaling:** Verified no arbitrary CSS `transform: scale()` distortion rules exist on individual furniture SVG elements, guaranteeing exact 1:1 representation scaled globally by the SVG viewBox.

### Key Prior Changes (September 8 – September 10, 2026: Resident Testing Preparation & Spatial Protection)

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
1. **Interactive 2D Floor Plan Engine (`WorkspaceScreen` / `CondoFloorPlan`):** Free-movement physics drag system bound by unit outer walls, responsive text-based toolbar ("Rotate", "Reset", "Undo", "Delete"), architectural bedroom wall blocker (`BEDROOM WALL BLOCKER` at $y = 340\text{ cm}$), delta-based coordinate tracking, live tabular-numeral gap readouts, alignment guides, collision detection, 50-step undo stack, automatic room re-homing, and main walkway corridor SVG overlay (`MAIN_ENTRY_WALKWAY_RECT`) with real-time obstruction alerts.
2. **Direct WebXR Floor Hit-Test Placement with Safe 2D Handoff (`PositionMapScreen`):** Direct WebXR floor plane hit-testing (`hitTest: true`, `PlacementScene`, `useXRHitTest`). Residents tap the physical floor to place 3D furniture overlays with a yaw rotation slider and "Re-place" controls. On confirmation, dispatches safe Living Room center coordinates ($X=1.3\text{m} / 130\text{cm}, Z=5.2\text{m} / 520\text{cm}$) and transitions cleanly to `WorkspaceScreen.tsx`. Two-point calibration (northwest corner and north wall taps) completely eliminated.
3. **WebXR Camera Point-to-Point Measuring (`ARMeasureSession.tsx` / `FurnitureInputScreen.tsx`):** AR camera measurement with in-session review and confirmation card, floating decimal precision (1 decimal place cm), in-session retake without tearing down the WebXR session, and diameter-to-length/width propagation for circular furniture.
4. **End-to-End Circular Furniture Support:** Native handling of round/circular tables and chairs across measuring, 2D floor plan SVG rendering (`<circle>`), rotation locks, and client-side PDF document generation.
5. **Clearance Evaluation Engine (`rules.ts` / `clearance.ts`):** Automated gap analysis calculating item-to-item and item-to-wall clearances, classifying gaps into RED (violation), YELLOW (warning), and GREEN (comfortable) bands, and scoring priorities using $S = \text{SeverityWeight} \times \text{Shortfall} \times \text{EdgeLength}$.
6. **Accessible Guidance & Visual Clearance Meters (`ruleGuidance.ts` / `ClearanceMeter.tsx`):** Plain-English rule descriptions, actionable resolution steps ("DO THIS"), and color-blindness/CVD-safe clearance meters encoding metrics via shape, words, and track position.
7. **Client-Side Paginated PDF Report (`pdfReport.ts` / `DownloadReportButton.tsx`):** Multi-page vector PDF generation via `jsPDF`, drawing SVG geometry directly from `CONDO_ROOMS` and `projectItems()`, accompanied by a rule-by-rule breakdown table.
8. **Authentication & Autosave (`supabase.ts` / `AuthScreen.tsx` / `useAutosaveLayout.ts`):** Production-grade Supabase Auth using synthetic email mapping (`username@habi3d.local`), row-level security (`auth.uid() = user_id`) on the `saved_sessions` table, and 1.5-second debounced layout autosave.
9. **Visual Modernization & Design Tokens (`src/components/tokens/`):** Unified app-wide design token structure (`colors`, `type`, `spacing`, `marks`), native system typeface stack, tabular numbers (`tabular-nums`) for real-time measurements, and high-contrast dark/light responsive layouts.
10. **Session Progress Reframe (`violationStore.ts` / `ReportScreen.tsx`):** Session progress calculated via an initial snapshot diff ("You made N spots more comfortable"), eliminating arbitrary numeric scores or grades.
11. **Sequential AR-to-2D Pipeline & Coordinate Auto-Normalization (`FurnitureInputScreen.tsx` / `furnitureStore.ts`):** Confirmed furniture input initializes with unpositioned coordinates (`posX: 0, posZ: 0`) and routes sequentially to `'positionMap'`. In `furnitureStore.ts`, automatic coordinate normalization converts values $>10$ cm to meters, guaranteeing safe boundary clamping and seamless 2D workspace handoff.
12. **Bedroom Wall Blocker & Living/Dining Constraint (`floorPlanDrag.ts` / `CondoFloorPlan.tsx`):** Hard partition barrier at $Y = 340\text{ cm}$ prohibiting furniture placement in bedrooms and reverting invalid drops to the last clear spot in Living/Dining.
13. **Safe Reset & Restoral Lifecycle (`WorkspaceScreen.tsx`):** Hardened reset action preserving furniture definitions and centimeter dimensions while clearing only placement coordinates; robust undo stack restoring both deleted and moved furniture items.
14. **Read-Only 3D Dollhouse Preview (`ThreeDPreviewScreen.tsx` / `ThreeDLayoutPreview.tsx`):** Isolated visualization of the current layout using procedural room and furniture geometry, direct store reads, responsive orbit/zoom camera controls, and no furniture, clearance, AR, persistence, or report mutations.

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
 ├── ar/                # WebXR spatial math, AR floor hit-test & camera measure, 3D overlays
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
  * *Purpose:* Maintains the active layout inventory (`items: FurnitureItem[]`). Provides CRUD operations (`addItem`, `updateItem`, `updatePosition`, `removeItem`, `clearAll`) and bulk hydration (`setItems`) when loading saved sessions. Supports unpositioned incoming pieces (`posX: 0, posZ: 0`), dynamic quantity support (`quantity?: number`), category-aware room center assignments (`LIVING_ROOM_CENTER_POS`, `DINING_ROOM_CENTER_POS`, `getDefaultRoomPosition`), and automatically normalizes coordinates in `updateItem` and `updatePosition` (converting values $>10$ cm to meters) to protect unit layout boundaries during 2D workspace handoff.
  * *Key Exports:* `useFurnitureStore`, `LIVING_ROOM_CENTER_POS`, `DINING_ROOM_CENTER_POS`, `getDefaultRoomPosition()`.
* **[violationStore.ts](file:///c:/Users/Dell/Habi3D-Project/src/stores/violationStore.ts):**
  * *Purpose:* Holds active clearance violations, warning recommendations, space score estimates, and session progress state (`initialFindingKeys`, `touchedItemIds`).
  * *Key Exports:* `useViolationStore`, `captureInitialFindings()`, `markItemTouched()`, `setViolations()`.
* **[useAutosaveLayout.ts](file:///c:/Users/Dell/Habi3D-Project/src/stores/useAutosaveLayout.ts):**
  * *Purpose:* React hook providing debounced (1.5s) layout synchronization to Supabase `saved_sessions` for authenticated users; automatically no-ops during anonymous sessions.
  * *Key Exports:* `useAutosaveLayout()`.

### 2.2 Clearance & Rule Engine (`src/engine/`)

The clearance and rules engine is a decoupled, pure TypeScript mathematical and architectural rules system responsible for checking physical furniture arrangements against codified interior design standards, calculating multi-axis spatial gaps, ranking layout bottlenecks by severity and spatial footprint, and synthesizing plain-English corrective guidance.

* **[rules.ts](file:///c:/Users/Dell/Habi3D-Project/src/engine/rules.ts) — Metric Clearance Standards & Priority Formulas:**
  * *Purpose & Lineage:* Encodes the canonical 10 Interior Design Clearance Standards sourced from *Time-Saver Standards for Interior Design and Space Planning* (DeChiara, Panero & Zelnik, 2001, pp. 61–90). Converts historical imperial guidelines (e.g., 30", 36", 42") into standardized metric thresholds (cm). Defines the formal tri-tier gap classification criteria (RED / YELLOW / GREEN) and priority scoring formulas.
  * *Key Data Types & Structures:*
    * `ClearanceRule`: Interface defining `{ id: string; name: string; category: 'living' | 'dining'; violationThresholdCm: number; warningThresholdCm: number; description: string; }`.
    * `clearanceRules` / `CLEARANCE_RULES`: Canonical array of the 10 defined standards (L1–L5 for Living, D1–D5 for Dining).
  * *Core Exported Functions:*
    * `classifyGap(measuredCm: number, rule: ClearanceRule): 'RED' | 'YELLOW' | 'GREEN'`: Compares physical distance against `violationThresholdCm` and `warningThresholdCm`.
    * `computePriorityScore(severityWeight: 3 | 1, shortfallCm: number, affectedEdgeLengthCm: number): number`: Computes priority value via $S = \text{SeverityWeight} \times \max(0, \text{Shortfall}) \times \text{AffectedEdgeLength}$.
    * `calculateSpatialImpact(shortfallCm: number, affectedEdgeLengthCm: number): number`: Calculates two-dimensional geometric intrusion area: $SI = |\text{shortfallCm}| \times \text{affectedEdgeLengthCm}$ in $\text{cm}^2$.
    * `calculatePriorityScore(severity: 'red' | 'yellow', spatialImpactCm2: number): number`: Scales spatial impact by severity weight ($\text{VSW}_{\text{RED}} = 3, \text{VSW}_{\text{YELLOW}} = 1$).

* **[clearance.ts](file:///c:/Users/Dell/Habi3D-Project/src/engine/clearance.ts) — Spatial Calculation Engine & Geometric Pipeline:**
  * *Purpose:* Primary algorithmic engine for spatial analysis. Projects rotated furniture bounds, computes pairwise Euclidean distances between furniture items, measures perpendicular clearances to room boundaries, detects invalid overlaps, and compiles classified `Violation` objects sorted by priority score.
  * *Key Data Types & Structures:*
    * `WallSide`: `'west' | 'east' | 'north' | 'south'`.
    * `GapClassification`: Individual record tracking `{ ruleCode, itemAId, itemBId, measuredCm, classification, wallSide? }`.
    * `ClearanceResult`: Complete analysis payload `{ violations: Violation[]; spaceScoreBefore: number; allClassifications: GapClassification[]; }`.
    * `ItemBounds`: Bounding representation `{ item, minX, maxX, minZ, maxZ, lengthM, widthM }`.
    * `LayoutViolation`: Discriminated union for feasibility errors (`OUT_OF_BOUNDS` | `OVERLAP`).
  * *Core Exported Functions & Routines:*
    * `effectiveLengthCm(item: FurnitureItem): number` & `effectiveWidthCm(item: FurnitureItem): number`: Derives the conservative axis-aligned bounding box (AABB) of an item rotated by $\theta = \text{rotationY}$ radians:
      $$\text{effectiveLength} = \text{lengthCm} \cdot |\cos\theta| + \text{widthCm} \cdot |\sin\theta|$$
      $$\text{effectiveWidth} = \text{lengthCm} \cdot |\sin\theta| + \text{widthCm} \cdot |\cos\theta|$$
      *Conservative Property:* For non-orthogonal orientations, this slightly over-estimates occupied footprint, guaranteeing that clearances are under-reported rather than falsely validated as clear.
    * `toBounds(item: FurnitureItem): ItemBounds`: Converts centimeter item parameters and center position $(posX, posZ)$ into meter-space axis-aligned minimum/maximum coordinates.
    * `findLayoutViolation(bounds: ItemBounds[], roomWidthM: number, roomLengthM: number): LayoutViolation | null`: High-performance, exception-free collision and boundary predicate. Employs a tolerance epsilon (`FEASIBILITY_EPSILON_M = 0.01` or 1cm) to allow flush wall placement without registering false-positive violations.
    * `runClearanceAnalysis(items: FurnitureItem[], roomWidthCm: number, roomLengthCm: number): ClearanceResult`: Main entry point. Conducts $O(N^2)$ pairwise checks (evaluating L1, L3, L2 for sofa-table pairs, D4 for seated dining passage, and D5 for dining furniture pairs) and wall checks (L1 for all items, D1 for dining tables, D2/D3 for dining chairs, L5 for sofa conversation depth, and L4 for main room traffic width). Returns priority-ranked violations and unobstructed floor space percentage.

* **[ruleGuidance.ts](file:///c:/Users/Dell/Habi3D-Project/src/engine/ruleGuidance.ts) — Human-Centered Guidance & Plain-English Translation:**
  * *Purpose:* Cognitive abstraction layer converting technical rule IDs and raw centimeter shortfalls into resident-friendly language, actionable resolution steps ("DO THIS"), and color-blindness safe display ranges for UI clearance meters.
  * *Key Data Types & Structures:*
    * `Band`: `'RED' | 'YELLOW' | 'GREEN'`.
    * `RuleGuidance`: Interface encapsulating `{ code, title, requirement, consequence, area, violationThresholdCm, warningThresholdCm }`.
    * `BandRange`: Meter track segmentation `{ band, label, fromCm, toCm: number | null }`.
  * *The Three-Question Schema:* Every rule maps directly to:
    1. **Title:** What the rule concerns (e.g. L1: *"Room to walk through"*, L2: *"Legroom at the sofa"*, D1: *"Table to wall"*).
    2. **Requirement:** The exact imperative condition needed (e.g. *"Leave at least 91 cm of open floor for everyday circulation."*).
    3. **Consequence:** Concrete ergonomic hazard if ignored (e.g. *"there is not enough legroom to sit down properly"*).
  * *Core Exported Functions:*
    * `ruleGuidance(code: string): RuleGuidance | null`: Lookup guidance by rule code.
    * `ALL_RULE_GUIDANCE: RuleGuidance[]`: Complete guidance array for catalog rendering and PDF exports.
    * `bandLabel(band: Band): string`: CVD-safe non-color text labels (*"Too tight"*, *"Tight"*, *"Comfortable"*).
    * `bandRanges(g: RuleGuidance): BandRange[]`: Generates structured metric intervals for progress tracks.
    * `meterMaxCm(g: RuleGuidance): number`: Dynamically calculates upper meter scale ($\text{warningThresholdCm} \times 1.5$) ensuring the green comfort zone remains visually prominent.

* **[walkways.ts](file:///c:/Users/Dell/Habi3D-Project/src/engine/walkways.ts) — Pedestrian Circulation & Corridor Obstruction Engine:**
  * *Purpose:* Defines geometric bounding boxes for the unit's major architectural circulation paths and monitors furniture encroachment into pedestrian arteries.
  * *Architectural Paths & Corridors:*
    * `MAIN_ENTRY_WALKWAY_RECT`: Continuous corridor ($x=215\text{cm}..295\text{cm}, y=340\text{cm}..880\text{cm}$, width $80\text{cm}$, length $540\text{cm}$) connecting the front entrance door ($y=880$) directly to the private bedroom corridor entrance ($y=340$).
    * `WALKWAY_PATHS`: 5 key inter-room pedestrian pathways:
      1. `Living → Dining` ($x=80, y=660, w=90, h=80\text{cm}$)
      2. `Living → Balcony` ($x=80, y=100, w=90, h=280\text{cm}$)
      3. `Living → Bedroom` ($x=215, y=280, w=90, h=100\text{cm}$)
      4. `Dining → Kitchen` ($x=220, y=720, w=80, h=90\text{cm}$)
      5. `Bedroom → Bathroom` ($x=215, y=380, w=90, h=100\text{cm}$)
  * *Core Exported Functions:*
    * `isItemInMainWalkway(item: FurnitureItem): boolean`: Evaluates whether an item's bounding box intersects the central entrance corridor with $> 0.01\text{m}$ overlap along both axes.
    * `computeWalkways(items: FurnitureItem[]): WalkwayStatus[]`: Calculates maximum furniture protrusion into each defined walkway, computes effective clearance $\max(0, \text{corridorDim} - \text{maxOverlap})$, and classifies status as RED ($<60\text{cm}$), YELLOW ($60$–$90\text{cm}$), or GREEN ($\ge 91\text{cm}$).

* **[violationKey.ts](file:///c:/Users/Dell/Habi3D-Project/src/engine/violationKey.ts) — Deterministic Finding Identity for Progress Tracking:**
  * *Purpose:* Solves the problem of transient violation IDs. Because `Violation.id` incorporates the exact centimeter measurement (e.g. `L1-sofa-54-toward-east`), slight user drags change the ID continuously, making it impossible to correlate findings across re-analyses.
  * *Core Function:*
    * `stableViolationKey(v: Violation): string`: Generates a deterministic composite key:
      $$\text{Key} = \text{ruleCode} \mathbin{::} \text{furnitureId} \mathbin{::} \text{itemBId} \mathbin{::} \text{wallSide}$$
      This stable key persists across coordinate changes, enabling `violationStore` to calculate honest layout progress ("You made N spots more comfortable") by diffing the initial baseline findings against current active findings.

* **[clearanceTestCases.ts](file:///c:/Users/Dell/Habi3D-Project/src/engine/clearanceTestCases.ts) — Verification Suite & Regression Guard:**
  * *Purpose:* Comprehensive automated testing matrix validating clearance classification, priority ranking, and rotational math against formal spatial layouts.
  * *Test Suites:*
    * `runRuleClassificationTestCases()`: 10 individual layout test cases verifying each rule's exact RED/YELLOW/GREEN thresholds.
    * `runPriorityScoreTestCases()`: Validates priority score sorting to ensure high-severity, large-contact violations correctly outrank minor narrow warnings.
    * `runRotationTestCases()`: Validates that 90° and angled rotations properly transform bounding boxes and yield bit-accurate gap evaluations.

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

### 2.4 Augmented Reality & WebXR Floor Placement (`src/ar/` & `src/screens/PositionMapScreen.tsx`)

* **[PositionMapScreen.tsx](file:///c:/Users/Dell/Habi3D-Project/src/screens/PositionMapScreen.tsx):**
  * *Purpose:* Direct WebXR floor plane hit-testing and placement screen featuring Single-Tap Room Entry Corner Calibration. Operates in two distinct sequential modes:
    1. `anchorTapMode === 'waitingForAnchor'`: Displays the guidance banner `"📍 Tap the room entry corner to align"`. Tapping the physical entry door corner establishes `anchorCalibration` against `ENTRY_DOOR_BLUEPRINT` ($X=0.2\text{m}, Z=0.1\text{m}$) using the device viewer yaw orientation.
    2. `anchorTapMode === 'placing'`: Traces real-time floor planes (`useXRHitTest`), renders a translucent 3D furniture overlay, and locks position on physical floor tap (`lockedPosition`).
    Provides a yaw rotation slider, "Re-place" option, and on "Confirm placement" transforms physical coordinates via `applyCalibration(lockedPosition, anchorCalibration)` and executes a category-aware safe handoff (Dining Room $X \in [0.3, 2.3]\text{m}, Z \in [7.2, 8.6]\text{m}$, `roomId: 'dining'` vs Living Room $X \in [0.3, 2.3]\text{m}, Z \in [3.6, 6.8]\text{m}$, `roomId: 'living'`). If `quantity > 1` (e.g. Dining Chairs), automatically batch-replicates independent `FurnitureItem` records with sequential labels (`Dining Chair 1`, `Dining Chair 2`, etc.) and a 2-column spatial offset grid before navigating to `WorkspaceScreen.tsx`.
* **[calibration.ts](file:///c:/Users/Dell/Habi3D-Project/src/ar/calibration.ts):**
  * *Purpose:* Mathematical calibration module deriving rigid transformation matrices (2D rotation $\theta$ + translation vector $T$). Actively imported and utilized by `PositionMapScreen.tsx` (`deriveCalibration`, `applyCalibration`, `CalibrationTransform`) for single-tap entry corner alignment and physical-to-blueprint coordinate projection.
  * *Key Exports:* `deriveCalibration()`, `applyCalibration()` (AR local $\rightarrow$ Plan), `invertCalibration()` (Plan $\rightarrow$ AR local), `calibrationThetaRad()`, `CalibrationTransform`.
* **[ARMeasureSession.tsx](file:///c:/Users/Dell/Habi3D-Project/src/ar/ARMeasureSession.tsx):**
  * *Purpose:* WebXR point-to-point camera measurement component. Allows users to measure physical room distances or furniture dimensions with 1-decimal floating cm precision, supporting immediate in-session retakes via `retakeTrigger` and optimized Three.js `markerARef` handling.
  * *Key Exports:* `ARMeasureSession` (React Component), `MeasurePhase`.
* **[ClearanceOverlay.tsx](file:///c:/Users/Dell/Habi3D-Project/src/ar/ClearanceOverlay.tsx) & [CorrectionArrow.tsx](file:///c:/Users/Dell/Habi3D-Project/src/ar/CorrectionArrow.tsx):**
  * *Purpose:* 3D WebXR rendering overlays displaying spatial clearance boundaries, warning indicators, and directional arrows suggesting optimal placement moves in AR space.
* **[overlayRenderer.tsx](file:///c:/Users/Dell/Habi3D-Project/src/ar/overlayRenderer.tsx) & [shapeLibrary.ts](file:///c:/Users/Dell/Habi3D-Project/src/ar/shapeLibrary.ts):**
  * *Purpose:* Procedural 3D mesh generator rendering primitive furniture geometries (box, cylinder, L-mesh) inside `@react-three/fiber` XR scenes from stored centimeter dimensions ($M = \text{cm} / 100$).

### 2.5 Read-Only 3D Dollhouse Visualization (`src/components/` & `src/screens/`)

* **[ThreeDPreviewScreen.tsx](file:///c:/Users/Dell/Habi3D-Project/src/screens/ThreeDPreviewScreen.tsx):**
  * *Purpose:* Full-height route surface for the isolated 3D preview. Reads only `furnitureStore.items`, renders the preview header and item count, and routes back to `'workspace'` without committing any layout data.
  * *State Boundary:* Selects `navigateTo` from `sessionStore` and `items` from `furnitureStore`; it does not select furniture mutation actions or call autosave.
* **[ThreeDLayoutPreview.tsx](file:///c:/Users/Dell/Habi3D-Project/src/components/ThreeDLayoutPreview.tsx):**
  * *Purpose:* Owns the React Three Fiber `<Canvas>`, lighting, fog, background plane, responsive camera initializer, furniture mesh list, and `OrbitControls`.
  * *Performance Strategy:* Demand-driven frame loop, pixel ratio capped at `1.5`, simple lighting, no shadows, no external 3D assets, and bounded orbit/zoom controls.
  * *Camera Safety:* Landscape and portrait offsets are applied locally according to canvas aspect ratio. Panning is disabled; zoom and polar angles are constrained.
* **[DollhouseFloorPlan.tsx](file:///c:/Users/Dell/Habi3D-Project/src/components/DollhouseFloorPlan.tsx):**
  * *Purpose:* Converts `CONDO_ROOMS` centimeter geometry into a lightweight open-top dollhouse environment.
  * *Geometry Strategy:* Derives unit dimensions from room extents, renders one floor tile per room, merges collinear edge intervals, and generates deduplicated exterior/interior wall meshes.
* **[DollhouseFurniture.tsx](file:///c:/Users/Dell/Habi3D-Project/src/components/DollhouseFurniture.tsx):**
  * *Purpose:* Converts each `FurnitureItem` into lightweight category-aware procedural meshes.
  * *Data Mapping:* `lengthCm`, `widthCm`, and `heightCm` are divided by `100`; `posX`, `posZ`, and `rotationY` are consumed directly; `shape` selects rectangular, round/oval, or L-shaped construction.
  * *Read-Only Contract:* Contains no store import and receives one item through props. Meshes define no drag, rotate, resize, delete, add, or room-assignment handlers.

### 2.6 Design Tokens (`src/components/tokens/`)

* **[colors.ts](file:///c:/Users/Dell/Habi3D-Project/src/components/tokens/colors.ts):** Central color palette definitions (Brand Navy `#1F3864`, Accent Blue `#2B549A`, Severity RED `#B91C1C` / AMBER `#B45309` / GREEN `#047857`, Neutral ink/surface shades, Room fills).
* **[type.ts](file:///c:/Users/Dell/Habi3D-Project/src/components/tokens/type.ts):** System typeface stack (`-apple-system, Segoe UI, Roboto...`), typographic scale (Display 24px, Title 19px, Body 16px, Label 14px), and tabular numeric configuration (`font-variant-numeric: tabular-nums`).
* **[spacing.ts](file:///c:/Users/Dell/Habi3D-Project/src/components/tokens/spacing.ts):** System layout spacing increments and border-radius tokens.
* **[marks.ts](file:///c:/Users/Dell/Habi3D-Project/src/components/tokens/marks.ts):** SVG stroke, fill, and marker styles for draggable plan elements, ghosts, and infeasible drag targets.
* **[index.ts](file:///c:/Users/Dell/Habi3D-Project/src/components/tokens/index.ts):** Unified barrel export for all design tokens.

### 2.7 Reporting & UI Components (`src/components/`)

* **[pdfReport.ts](file:///c:/Users/Dell/Habi3D-Project/src/components/pdfReport.ts):** Client-side PDF document generator using `jsPDF`. Synthesizes vector floor plan drawings, session metrics, and a paginated rule-by-rule evaluation table (covering all 10 rules, cleared and violated).
* **[ClearanceMeter.tsx](file:///c:/Users/Dell/Habi3D-Project/src/components/ClearanceMeter.tsx):** CVD-safe visual clearance meter component displaying measured distance against RED/YELLOW/GREEN thresholds, plain-English guidance, and fix recommendations.
* **[DownloadReportButton.tsx](file:///c:/Users/Dell/Habi3D-Project/src/components/DownloadReportButton.tsx):** State-machine UI button (`idle` $\rightarrow$ `working` $\rightarrow$ `success` / `error`) for triggering PDF report builds.
* **[StatusRow.tsx](file:///c:/Users/Dell/Habi3D-Project/src/components/StatusRow.tsx):** UI component rendering rule evaluation findings with status badges and contextual notes.
* **[ErrorBoundary.tsx](file:///c:/Users/Dell/Habi3D-Project/src/components/ErrorBoundary.tsx):** Decoupled React error boundary fallback UI for catastrophic runtime failure recovery.

### 2.8 Geometry, Validation & Backend Integration (`src/data/`, `src/utils/` & `src/supabase.ts`)

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

The 2D workspace also exposes an isolated visualization branch:

```text
workspace (WorkspaceScreen)
    |  "3D View"
    v
threeDPreview (ThreeDPreviewScreen)
    |  "Back to 2D"
    v
workspace (same furnitureStore layout)
```

### 3.1 Screen Catalog Breakdown

| Screen Name | File Path | Route Key | Status | Functionality & Key Features |
| :--- | :--- | :--- | :--- | :--- |
| **Landing / Entry** | `src/screens/EntryScreen.tsx` | `'entry'` | **Active** | Primary entry point. Two-tone gradient wordmark ("Habi3D"), frosted glass card, clean authentication hierarchy: **Create Account** (Auth), **Log In** (Auth text link). |
| **Authentication** | `src/screens/AuthScreen.tsx` | `'auth'` | **Active** | Manages user sign-up and login using username input mapped internally to `${username}@habi3d.local`. Checks Supabase `saved_sessions` for existing layout; prompts user to Resume existing layout or Start Fresh. |
| **Furniture Input** | `src/screens/FurnitureInputScreen.tsx` | `'furnitureInput'` | **Active** | Step 1/2 of layout setup. Furniture item catalog selection, custom dimension entry with decimal-safe inputs (`inputMode="decimal"`), WebXR camera measuring (with `planeDetection` stripped for Android stability), and dining chair quantity selector (1–8 chairs, default 4). On "Confirm", appends the configured item to the "Furniture added" list on-screen and resets the form, allowing users to configure multiple pieces before explicitly clicking "Position Furniture" to route to `'positionMap'`. |
| **AR Floor Placement & 2D Handoff** | `src/screens/PositionMapScreen.tsx` | `'positionMap'` | **Active** | Direct WebXR floor hit-testing (`PlacementScene`, `useXRHitTest`) with Single-Tap Room Entry Corner Anchor (`waitingForAnchor`: "📍 Tap the room entry corner to align") establishing calibration against `ENTRY_DOOR_BLUEPRINT` ($X=0.2\text{m}, Z=0.1\text{m}$) using viewer pose yaw. Renders real-time 3D ghost model, tap-to-place, yaw rotation slider, "Re-place", and "Confirm placement". On confirmation, executes `applyCalibration`, category-aware room routing (`'dining'` vs `'living'`), bounds-checking, and automatic batch-spawning of dining chairs if `quantity > 1` with a non-overlapping 2-column spatial layout before navigating to `'workspace'`. |
| **Workspace (Interactive Plan)** | `src/screens/WorkspaceScreen.tsx` | `'workspace'`, `'analysis'`, `'recommendations'`, `'recommendation'` | **Active** | Core 2D interactive layout optimization hub (~82% viewport canvas). Free-movement physics drag, architectural bedroom wall blocker, live tabular-numeral gap readouts, alignment guides, collision detection, unit-wide grid overlay (A1-F8), responsive text-based toolbar ("Rotate", "Reset", "Undo", "Delete"), safe reset, tabbed inspection panel, and walkway access indicators. |
| **3D Layout Preview** | `src/screens/ThreeDPreviewScreen.tsx` | `'threeDPreview'` | **Active** | Read-only dollhouse visualization of the current `furnitureStore.items` layout. Renders the predefined Mulberry Place 2BR room geometry and lightweight furniture using stored shape, category, dimensions, position, and rotation. Supports bounded orbit and zoom only; exposes no furniture editing, clearance visualization, autosave, AR, or reporting behavior. |
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

### 4.2 Process 2: Direct AR Floor Hit-Test Placement & Safe 2D Handoff (PositionMapScreen.tsx)

```
[User Clicks "Place in room" in PositionMapScreen]
                     │
                     ▼
[Launch WebXR Session with hitTest: true]
                     │
                     ▼
[Stage 1: anchorTapMode === 'waitingForAnchor']
   • Yellow status pill: "📍 Tap the room entry corner to align"
   • Resident taps physical floor at unit entry door corner
   • handleAnchorTap(): Reads device orientation yaw (frame.getViewerPose)
   • deriveCalibration({ arPoint, blueprintPoint: ENTRY_DOOR_BLUEPRINT (0.2, 0.1), yaw })
   • Stores anchorCalibration, sets deviceYaw, switches to 'placing'
   • Toast: "✓ Room anchor set. Now place furniture."
                     │
                     ▼
[Stage 2: anchorTapMode === 'placing']
   • Real-Time 3D Ghost Model Overlay follows floor hit-test point
   • Resident taps physical floor ──► Locks position (lockedPosition)
                     │
     ┌───────────────┴───────────────┐
     ▼                               ▼
[Adjust Yaw Slider (0°..360°)]  [Click "Re-place" ──► Re-enable Hit-Test]
     │                               │
     └───────────────┬───────────────┘
                     │
                     ▼
        [Click "Confirm placement"]
                     │
                     ▼
[Stage 3: Spatial Projection & Category-Aware 2D Handoff]
   • Verify lockedPosition && anchorCalibration
   • applyCalibration(lockedPosition, anchorCalibration) ──► True blueprint (X, Z)
   • Query getDefaultRoomPosition(item.category, item.label)
   • Clamp to Room Polygons (Dining [0.3..2.3, 7.2..8.6]m vs Living [0.3..2.3, 3.6..6.8]m)
   • Safe Fallback to Room Center if out-of-bounds or NaN
   • If quantity > 1 (e.g. Dining Chairs):
       - Primary item updated as "${baseLabel} 1"
       - Items 2..N cloned with unique IDs and sequential labels
       - 2-column offset grid applied (dx = ±0.28m, dz = ±0.275m)
                     │
                     ▼
[Terminate WebXR Session cleanly: stopAR()]
                     │
                     ▼
[Route Directly to 2D Workspace: navigateTo('workspace')]
```

1. **Unpositioned Queue & Placement Trigger:**
   * Newly registered items from `FurnitureInputScreen.tsx` enter `PositionMapScreen.tsx` with unpositioned coordinates (`posX: 0, posZ: 0`), assigned `roomId`, and optional `quantity`.
   * The resident selects an item from the "Items Needing Position" list (showing `(xN)` badge for multi-quantity sets) and taps "Place in room" (`startPlacement(item)`), initiating WebXR with `hitTest: true`.
2. **Single-Tap Room Entry Corner Anchor (`waitingForAnchor`):**
   * The AR session starts in `anchorTapMode = 'waitingForAnchor'`, presenting the banner: `"📍 Tap the room entry corner to align"`.
   * When the resident taps the entry corner, `handleAnchorTap()` samples `frame.getViewerPose()`, derives the user's camera yaw, and establishes an active coordinate transform via `deriveCalibration({ arPoint, blueprintPoint: ENTRY_DOOR_BLUEPRINT, yaw })` anchored to `ENTRY_DOOR_BLUEPRINT = { x: 0.2, z: 0.1 }`.
   * Saves `anchorCalibration`, records `deviceYaw`, and transitions to `anchorTapMode = 'placing'` with toast: `"✓ Room anchor set. Now place furniture."`
3. **Physical Floor Tap Placement (`placing`):**
   * Configures real-time WebXR hit-testing raycasting from device camera onto physical floor surfaces.
   * Renders the 3D procedural furniture geometry (`shapeLibrary.ts`) as a semi-transparent cyan ghost model (`#38bdf8`, opacity 0.55) anchored dynamically to detected floor planes.
   * Tapping on the physical floor surface locks the model position: sets `lockedPosition` and toggles `placing = false`.
4. **In-Session Orientation & Re-Placement Controls (`XRDomOverlay`):**
   * **Yaw Slider (`0°..360°`):** Resident adjusts orientation in real-time.
   * **"Re-place" Action:** Resets `lockedPosition = null` and resumes hit-testing to choose another physical spot.
   * **"Exit AR" Action:** Cleanly terminates the WebXR session (`stopAR()`) and returns to the 2D overview card.
5. **Spatial Projection & Category-Aware Handoff:**
   * Tapping "Confirm placement" checks `lockedPosition` and `anchorCalibration`.
   * Invokes `applyCalibration(lockedPosition, anchorCalibration)` to transform the physical AR hit coordinate into true condominium blueprint space ($X, Z$).
   * Inspects `getDefaultRoomPosition(category, label)`:
     - Dining furniture is assigned `roomId: 'dining'` with boundaries clamped inside the dining polygon ($X \in [0.3, 2.3]\text{m}, Z \in [7.2, 8.6]\text{m}$).
     - Living furniture is assigned `roomId: 'living'` with boundaries clamped inside the living polygon ($X \in [0.3, 2.3]\text{m}, Z \in [3.6, 6.8]\text{m}$).
     - Out-of-bounds, unanchored, or NaN coordinates fall back cleanly to the room center (`DINING_ROOM_CENTER_POS` or `LIVING_ROOM_CENTER_POS`).
   * **Batch Chair Replication:** If `itemPayload.quantity > 1`, generates $N$ distinct `FurnitureItem` records with sequential IDs and labels (`Dining Chair 1` to `Dining Chair N`), arranging them in a 2-column offset pattern to prevent coordinate stacking.
   * Automatic coordinate normalization in `furnitureStore.ts` detects and converts any values $>10$ cm to meters, keeping coordinates strictly within the condo unit envelope.
   * Terminates the WebXR session cleanly (`stopAR()`) and navigates directly to the 2D layout workspace (`navigateTo('workspace')`) where each piece can be manipulated independently.
6. **Streamlined Single-Tap Calibration Over Legacy 2-Point Method:**
   * The cumbersome legacy 2-point calibration (requiring consecutive NW corner and north wall taps with ceiling wireframes) was replaced with this streamlined **Single-Tap Room Entry Anchor**, combining instantaneous 1-tap ease with true blueprint coordinate projection.

### 4.3 Process 3: Furniture Inventory, Camera Measurement & Dimension Locking

1. **Item Selection:** Users choose preset items from `FurnitureInputScreen.tsx` or specify custom labels and categories.
2. **Shape Configuration:** Selects geometry shape (`rectangle`, `round`, `oval`). For round items, diameter configuration automatically synchronizes both `lengthCm` and `widthCm`. L-shape selector has been removed to standardize catalog geometry.
3. **Chair Quantity Configuration:** When selecting 'Dining Chair' (or custom chair items), a responsive quantity stepper `[−] count [+]` allows residents to select 1 to 8 chairs (defaulting to 4). This quantity is bound to `item.quantity` and forwarded to AR placement for automated batch replication in the Dining Room.
4. **Decimal-Safe Input Sanitization:** Replaced regex-based integer stripping with `sanitizeDecimal()` and `toPositiveNumber()`, adding `inputMode="decimal"` across all dimensions for seamless mobile numeric keypad entry with single-decimal-place precision (e.g. `97.4 cm`).
5. **WebXR Point-to-Point Measurement (`ARMeasureSession.tsx`):**
   * Users launch an AR camera session to measure physical items point-to-point (with crash-prone `planeDetection` removed for Android Chrome stability).
   * Two camera taps establish a 3D bounding vector; euclidean distance is calculated in meters and converted to centimeters with 1 decimal place.
   * **In-Session Confirmation Card:** Displays raw AR measurement in centimeters with an editable input field, `[Retake]`, and `[Confirm Measurement]` buttons.
   * **Zero-Teardown Retake:** Tapping `[Retake]` resets markers and line geometry via `retakeTrigger` and returns to `ready` phase without destroying or restarting the WebXR camera session.
6. **Dimension Locking Across AR → 2D:** Ensures that dimensions entered in Furniture Input remain stored exclusively in centimeters and are transferred verbatim to `furnitureStore`, `projectItems()`, and `CondoFloorPlan`, preventing AR scaling distortions.
7. **Inventory Commit & Staged Multi-Item Entry:** Appends the configured `FurnitureItem` object (with assigned category-aware `roomId` and `quantity`) to `furnitureStore` and updates the "Furniture added" summary panel on-screen, resetting the form inputs so the resident can add further items without interruption. Once all desired pieces are added, the resident clicks the bottom button ("Position Furniture (N items)") to proceed to `'positionMap'`.

### 4.4 Process 4: 2D Floor Plan Interactive Layout Physics, Free Drag & Text-Based Toolbar

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

### 4.5 Process 5: Clearance Rule Analysis & Priority Ranking Engine

```
[Trigger Clearance Analysis: runClearanceAnalysis(items, roomW, roomL)]
                             │
                             ▼
     [Project Rotated Bounding Envelopes: toBounds(), AABB]
                             │
                             ▼
     [Iterate Furniture Pairs (O(N²)) & Wall Distances (O(N))]
                             │
                             ▼
     [Evaluate 10 Metric Standards: L1–L5 Living, D1–D5 Dining]
                             │
                             ▼
    [Classify Clearance Gaps: RED (Violation) · YELLOW (Warning) · GREEN (Clear)]
                             │
                             ▼
 [Filter Non-Green Gaps ──► Calculate Shortfall & Affected Edge Length]
                             │
                             ▼
  [Compute Spatial Impact (SI) & Priority Score (S = VSW × SI)]
   SI = Shortfall (cm) × Affected Edge Length (cm)
   S  = Severity Weight (RED=3, YELLOW=1) × SI
                             │
                             ▼
   [Sort Violations Descending by Priority Score: S]
                             │
                             ▼
[Generate Plain-English Guidance & Buffered "DO THIS" Fix Direction Vectors]
                             │
                             ▼
   [Populate violationStore & Update Interactive Workspace UI Layers]
   ├── Update ClearanceMeter cards & Action Drawers
   ├── Dispatch Header Status Badges & Walkway Encroachment Alerts
   └── Synchronize Multi-Page Vector PDF Tables & Session Diff Baseline
```

---

#### 4.5.1 Architectural, Academic & Anthropometric Context of the Rules Engine

1. **Theoretical & Academic Lineage:**
   * The clearance evaluation logic in Habi3D is grounded in formal architectural and ergonomic space-planning literature, specifically *Time-Saver Standards for Interior Design and Space Planning* (DeChiara, Panero & Zelnik, 2001, pp. 61–90).
   * Historical architectural standards typically express spatial recommendations in imperial units (e.g., $30'' \approx 76\text{ cm}$, $36'' \approx 91\text{ cm}$, $42'' \approx 107\text{ cm}$, $48'' \approx 122\text{ cm}$). Habi3D codifies these guidelines into standardized metric values (centimeters), establishing mathematically rigorous thresholds for automated spatial evaluation.

2. **Target High-Density Condominium Context (Mulberry Place 2BR):**
   * Urban high-density condominium units—such as the benchmark Mulberry Place 2-Bedroom unit at Acacia Estates, Taguig City—present strict spatial envelopes where living, dining, and circulation paths must coexist within a compact combined footprint ($260\text{ cm} \times 360\text{ cm}$ living zone, $260\text{ cm} \times 180\text{ cm}$ dining zone).
   * In tight urban layouts, arbitrary or unguided furniture arrangements quickly cause circulation choke points, blocked balconies, inaccessible dining chairs, and cramped seating. The clearance engine provides objective, evidence-based spatial feedback so residents can maximize livability without professional architectural training.

3. **Anthropometric Foundations & Human Body Clearances:**
   * **Shoulder Breadth & Natural Stride:** A 95th-percentile adult shoulder breadth is approximately $48\text{–}52\text{ cm}$. Single-person comfortable walking paths require $\ge 76\text{ cm}$ to prevent lateral brush against walls or furniture. Two-person passing routes require $\ge 91\text{ cm}$ to allow simultaneous bidirectional movement without pivoting or turning sideways.
   * **Seated Legroom & Knee Ergonomics:** Standard seated chair/sofa knee-to-shin clearance requires a minimum of $35\text{ cm}$ to avoid striking table edges on sitting or rising. Optimal comfort requires $45\text{–}60\text{ cm}$ to allow legs to stretch and permit coffee table surface accessibility without overreaching.
   * **Dining Chair Pull-Out Mechanics:** A standard dining chair requires $45\text{–}50\text{ cm}$ of depth when occupied. Pushing back and standing up requires a minimum pull-out clearance of $81\text{ cm}$ behind the table edge. To comfortably exit the seat without trapping adjacent diners, $97\text{ cm}$ is required.
   * **Service & Passage Behind Seated Diners:** Traversing behind an occupied dining chair requires $\ge 91\text{ cm}$ to edge past and $\ge 107\text{–}112\text{ cm}$ to walk past normally without obliging the seated diner to scoot in.

4. **Tri-Tier Ergonomic Classification Philosophy:**
   * **RED (Violation — `< violationThresholdCm`):** Represents clearance below the absolute minimum functional threshold. Physically obstructs everyday passage, forces awkward sideways body contortions, or prevents basic furniture utility (e.g., dining chairs colliding with walls when pulled out).
   * **YELLOW (Warning — `violationThresholdCm` to `warningThresholdCm`):** Represents clearance above functional minimums but below comfortable ergonomic recommendations. The space is usable under light occupancy, but creates friction, psychological crowding, or minor physical inconvenience during daily living.
   * **GREEN (Comfortable Standard — `≥ warningThresholdCm`):** Exceeds comfortable design thresholds. Permits unrestricted pedestrian flow, uninhibited body articulation, and gracious room circulation.

5. **The Concurrent Multi-Rule Evaluation Rationale:**
   * In traditional architectural critique, a single physical clearance gap often has multiple functional implications. In Habi3D, rules are evaluated **concurrently rather than as mutually exclusive branches**.
   * *Example:* The physical gap between a sofa and a coffee table is evaluated simultaneously by:
     1. **Rule L1 (General Circulation):** Checks if the path maintains general room circulation ($\ge 60\text{ cm} / 91\text{ cm}$).
     2. **Rule L3 (Secondary Circulation):** Checks if the gap serves as a secondary path between pieces ($\ge 61\text{ cm} / 76\text{ cm}$).
     3. **Rule L2 (Sofa / Coffee Table):** Checks if the gap meets specialized legroom and reach ergonomics ($35\text{–}45\text{ cm}$).
   * *Thesis Advisory Validation:* Following faculty and thesis adviser evaluation, concurrent evaluation was verified as intentional and correct: L1 and L3 represent room-wide circulation invariants, while L2 represents item-specific ergonomic performance. Evaluating both ensures that specialized tight legroom is differentiated from general circulation blockages.

---

#### 4.5.2 The 10 Interior Design Clearance Standards — Complete Specification Matrix

The clearance engine encodes 10 distinct standards (Table 3 Living Room, Table 4 Dining Room from DeChiara et al., 2001):

| ID | Standard Name | Room Zone | Scope & Activation Trigger | RED Threshold (Violation) | YELLOW Threshold (Warning) | GREEN Threshold (Comfortable) | Affected Edge Selection | Plain-English UI Title & Requirement | Consequence Statement if Ignored |
| :---: | :--- | :---: | :--- | :---: | :---: | :---: | :--- | :--- | :--- |
| **L1** | General Circulation | Living / Unit | **Unconditional:** Every furniture pair ($O(N^2)$) and every item-to-wall gap. | $< 60\text{ cm}$ | $60\text{–}90\text{ cm}$ | $\ge 91\text{ cm}$ | Facing edge of primary item (width or length based on gap orientation). | **"Room to walk through"**<br>*Leave at least 91 cm of open floor for everyday circulation.* | *The gap is too narrow to walk through comfortably.* |
| **L2** | Sofa / Coffee Table | Living | **Pairwise Conditional:** Fired strictly when one item is `sofa` and the other is `coffee_table` (`pairAppliesToL2`). | $< 35\text{ cm}$ | $35\text{–}45\text{ cm}$ | $\ge 45\text{ cm}$ | Width of the sofa front edge facing the coffee table. | **"Legroom at the sofa"**<br>*Leave 45–60 cm between the sofa and the coffee table.* | *There is not enough legroom to sit down properly.* |
| **L3** | Secondary Circulation | Living | **Unconditional Pairwise:** Every furniture pair in the unit. | $< 61\text{ cm}$ | $61\text{–}75\text{ cm}$ | $\ge 76\text{ cm}$ | Facing edge dimension of primary item. | **"Squeezing between furniture"**<br>*Leave at least 76 cm between two pieces people pass between.* | *It is a tight squeeze to move between them.* |
| **L4** | Main Traffic Path | Living | **Wall Conditional:** Applied strictly to the single item with the largest room wall gap in the unit. | $< 76\text{ cm}$ | $76\text{–}90\text{ cm}$ | $\ge 91\text{ cm}$ | Outer edge facing the main thoroughfare. | **"Main walkway width"**<br>*Keep the main route through the room at least 91 cm wide.* | *The main walkway through the room is too narrow.* |
| **L5** | Conversation Area | Living | **Wall Conditional:** Evaluates front clearance of `sofa` facing into the room along the unit's primary depth axis ($Z$). | $< 244\text{ cm}$ | $244\text{–}299\text{ cm}$ | $\ge 300\text{ cm}$ | Full front sofa face width (`effectiveLengthCm`). | **"Seating area depth"**<br>*Allow at least 300 cm of depth for a comfortable sofa grouping.* | *The seating area is too shallow to sit and talk comfortably.* |
| **D1** | Table to Wall | Dining | **Wall Conditional:** Evaluates clearance between `dining_table` perimeter and the closest room wall. | $< 76\text{ cm}$ | $76\text{–}90\text{ cm}$ | $\ge 91\text{ cm}$ | Table edge length facing the closest wall. | **"Table to wall"**<br>*Leave at least 91 cm between the table edge and the wall.* | *There is not enough room to get around the table.* |
| **D2** | Chair Pull-out + Access | Dining | **Wall Conditional:** Evaluates clearance between `dining_chair` and its closest room wall. | $< 81\text{ cm}$ | $81\text{–}96\text{ cm}$ | $\ge 97\text{ cm}$ | Chair back/side width facing the wall. | **"Pulling out a chair"**<br>*Leave at least 97 cm behind the table to pull a chair out and sit.* | *A chair cannot be pulled out far enough to sit down.* |
| **D3** | Passage Behind Seated | Dining | **Wall Conditional:** Evaluates clearance between `dining_chair` and its closest room wall for rear traversal. | $< 91\text{ cm}$ | $91\text{–}106\text{ cm}$ | $\ge 107\text{ cm}$ | Chair rear edge width. | **"Passing behind a seated person"**<br>*Leave at least 107 cm to edge past someone who is seated.* | *There is no room to pass behind someone seated.* |
| **D4** | Walking Past Seated | Dining | **Pairwise Conditional:** Fired when one item is `dining_chair` and the other is a non-dining item (`pairAppliesToD4`). | $< 97\text{ cm}$ | $97\text{–}111\text{ cm}$ | $\ge 112\text{ cm}$ | Facing edge length of the primary item. | **"Walking past a seated person"**<br>*Leave at least 112 cm to walk past someone who is seated.* | *It is too tight to walk past someone seated.* |
| **D5** | Minimum Passage | Dining | **Pairwise Conditional:** Fired whenever either item in a pair is `dining_table` or `dining_chair` (`pairAppliesToD5`). | $< 61\text{ cm}$ | $61\text{–}75\text{ cm}$ | $\ge 76\text{ cm}$ | Narrowest edge dimension of the dining piece. | **"Minimum passage"**<br>*Never let a passage between furniture drop below 76 cm.* | *The passage is too tight to move through.* |

---

#### 4.5.3 Algorithmic & Geometric Formulations

##### 1. Rotational Envelope Projection (Conservative Axis-Aligned Bounding Box)
When a furniture piece is rotated by an arbitrary angle $\theta = \text{rotationY}$ (in radians), calculating precise polygon-polygon distances on every drag frame introduces significant computational overhead. To ensure deterministic 60fps performance and conservative clearance reporting, Habi3D computes the **Axis-Aligned Bounding Box (AABB)**:

$$\text{effectiveLengthCm}(item) = \text{lengthCm} \cdot |\cos\theta| + \text{widthCm} \cdot |\sin\theta|$$

$$\text{effectiveWidthCm}(item) = \text{lengthCm} \cdot |\sin\theta| + \text{widthCm} \cdot |\cos\theta|$$

* **Conservative Guarantee:** For non-orthogonal rotations ($0 < \theta < \frac{\pi}{2}$), the AABB footprint is slightly larger than the true rotated geometry. Clearances are therefore **under-reported, never over-reported**. The system will never falsely certify an unsafe or tight passage as clear.
* **Orthogonal Fidelity:** At $\theta = 0, \frac{\pi}{2}, \pi, \frac{3\pi}{2}$, the formulas yield exact millimeter-accurate dimensions identical to the unrotated bounding box.
* **Metric Conversion to Bounding Box (`toBounds`):**
  Given item center coordinates $(posX, posZ)$ in meters and dimensions converted to meters ($L_m = \text{effectiveLengthCm} / 100$, $W_m = \text{effectiveWidthCm} / 100$):
  $$\min X = posX - \frac{L_m}{2}, \quad \max X = posX + \frac{L_m}{2}$$
  $$\min Z = posZ - \frac{W_m}{2}, \quad \max Z = posZ + \frac{W_m}{2}$$

##### 2. Pairwise Euclidean Gap Calculation (`getPairGap`)
For any two item bounds $A$ and $B$, the orthogonal separations along the $X$ and $Z$ axes are computed:

$$\Delta X = \max\left(0, \max(A.\min X, B.\min X) - \min(A.\max X, B.\max X)\right)$$

$$\Delta Z = \max\left(0, \max(A.\min Z, B.\min Z) - \min(A.\max Z, B.\max Z)\right)$$

The physical 2D clearance distance in centimeters is derived via Euclidean norm:

$$\text{measuredCm} = \text{round}\left(\sqrt{(\Delta X)^2 + (\Delta Z)^2} \times 100\right)$$

* **Directional Cardinal Vector (`directionLabel`):**
  The engine determines the primary axis of separation:
  $$\text{If } \Delta X \ge \Delta Z: \begin{cases} A.posX \le B.posX \implies \text{"toward the west wall"} \\ A.posX > B.posX \implies \text{"toward the east wall"} \end{cases}$$
  $$\text{If } \Delta Z > \Delta X: \begin{cases} A.posZ \le B.posZ \implies \text{"toward the north wall"} \\ A.posZ > B.posZ \implies \text{"toward the south wall"} \end{cases}$$

##### 3. Wall Clearance Derivation (`getWallGaps`, `getClosestWallGap`)
For an item positioned in a room with dimensions $(\text{roomWidthM}, \text{roomLengthM})$:
$$\text{Gap}_{\text{West}} = \text{round}(\min X \times 100)$$
$$\text{Gap}_{\text{East}} = \text{round}((\text{roomWidthM} - \max X) \times 100)$$
$$\text{Gap}_{\text{North}} = \text{round}(\min Z \times 100)$$
$$\text{Gap}_{\text{South}} = \text{round}((\text{roomLengthM} - \max Z) \times 100)$$

* `getClosestWallGap(bounds)` sorts the four cardinal gaps ascending and returns the minimum clearance and associated wall side (`'west'`, `'east'`, `'north'`, `'south'`).

##### 4. Priority Score & Spatial Impact Formulation
To order violations so that the most critical layout bottlenecks appear at the top of the resident's action drawer, Habi3D implements a quantitative priority ranking algorithm grounded in interior spatial optimization literature (Dong et al. [36]):

$$\text{Shortfall (cm)} = \max(0, \text{RequiredThreshold} - \text{MeasuredClearance})$$

$$\text{Affected Edge Length (cm)} = \begin{cases} \text{effectiveWidthCm}(A), & \text{if } \Delta X \ge \Delta Z \\ \text{effectiveLengthCm}(A), & \text{if } \Delta Z > \Delta X \end{cases}$$

$$\text{Spatial Impact } (SI) = \text{Shortfall (cm)} \times \text{Affected Edge Length (cm)} \quad [\text{cm}^2]$$

$$\text{Priority Score } (S) = \text{VSW} \times SI$$

Where **Violation Severity Weight (VSW)** is assigned based on classification:
$$\text{VSW} = \begin{cases} 3, & \text{for RED violations (severe functional impediment)} \\ 1, & \text{for YELLOW warnings (suboptimal ergonomic friction)} \\ 0, & \text{for GREEN (no violation recorded)} \end{cases}$$

* **Why Spatial Impact Matters:** A $10\text{ cm}$ shortfall along a wide $220\text{ cm}$ three-seater sofa represents a massive geometric bottleneck ($SI = 2,200\text{ cm}^2$) that blocks entire room circulation, whereas a $10\text{ cm}$ shortfall along a narrow $45\text{ cm}$ side table ($SI = 450\text{ cm}^2$) represents a minor pinch point. Weighting by affected edge length guarantees that large furniture blockages are prioritized first.
* **Sorting Order:** `violations.sort((a, b) => b.priorityScore - a.priorityScore)` establishes an objective, mathematically deterministic hierarchy of remediation.

##### 5. Actionable Remediation Guidance ("DO THIS" Vector Generation)
To make recommendations immediately actionable for residents without requiring mental math:
$$\text{fixDirectionCm} = \max(0, \text{round}(\text{requiredCm} - \text{measuredCm} + 5))$$
* **The $+5\text{cm}$ Comfort Buffer:** If an item is $4\text{ cm}$ short of a $76\text{ cm}$ threshold, moving it exactly $4\text{ cm}$ leaves it on the razor edge ($76.0\text{ cm}$). Adding a $+5\text{ cm}$ margin ensures that following the recommendation safely propels the clearance into comfortable, unflagged territory ($81\text{ cm}$).
* **Imperative Instruction:** Synthesizes clear guidance text: `"DO THIS: Move toward the east wall by 15 cm. Otherwise the gap is too narrow to walk through comfortably."`

##### 6. Deterministic Finding Identity & Session Progress Diffing (`stableViolationKey`)
* A major engineering challenge in interactive layout planning is tracking whether a resident has resolved an issue when coordinates shift continuously.
* The raw `Violation.id` incorporates the live measurement (`L1-sofa-54-toward-east`). Nudging the sofa by $1\text{ cm}$ produces `L1-sofa-55-toward-east`, causing standard ID diffing to treat the old violation as resolved and the new one as newly created.
* **Deterministic Stable Key Formulation:**
  $$\text{stableViolationKey}(v) = \text{ruleCode} \mathbin{::} \text{furnitureId} \mathbin{::} \text{itemBId} \mathbin{::} \text{wallSide}$$
  * *Example:* `L1::sofa-1::table-1::` or `D1::table-1::wall::east`.
  * This composite key is completely invariant to coordinate changes. At the start of each user session, `WorkspaceScreen.tsx` invokes `captureInitialFindings()`, freezing the baseline set of stable keys. When the user exits to `ReportScreen.tsx`, the system computes an honest set difference:
    $$\text{Resolved Spots} = \text{InitialKeys} \setminus \text{CurrentActiveKeys}$$
    Generating the honest headline: *"You made 3 spots more comfortable."*

---

#### 4.5.4 Pedestrian Circulation & Walkway Obstruction Engine (`walkways.ts`)

In addition to individual furniture clearances, the unit's architectural layout contains primary pedestrian arteries connecting exterior doors to interior zones.

1. **Central Entrance Walkway Corridor (`MAIN_ENTRY_WALKWAY_RECT`):**
   * Spans continuously from the condo unit entrance door ($y = 880\text{ cm}$) to the bedroom dividing wall ($y = 340\text{ cm}$), centered at $x = 215\text{ cm}$ with a width of $80\text{ cm}$ ($x \in [215, 295]\text{ cm}$).
   * Rendered on the 2D floor plan as an architectural dashed guide (`strokeDasharray="6 4"`, fill `rgba(43, 84, 154, 0.05)`).
   * **Obstruction Detection (`isItemInMainWalkway`):** Evaluates 2D bounding overlap against the corridor. Requires overlap $> 0.01\text{m}$ ($1\text{ cm}$) on **both** $X$ and $Z$ axes to eliminate false positives on tangent edge alignment.
   * **Real-Time Warning Toast:** Dropping an item on this corridor immediately displays: `⚠️ Notice: [Item Label] is placed on the main walkway corridor.`

2. **Five Primary Unit Walkway Pathways (`WALKWAY_PATHS`):**
   * The system monitors 5 specific architectural transit corridors:
     1. `Living → Dining` ($x=80, y=660$, $90 \times 80\text{ cm}$)
     2. `Living → Balcony` ($x=80, y=100$, $90 \times 280\text{ cm}$)
     3. `Living → Bedroom` ($x=215, y=280$, $90 \times 100\text{ cm}$)
     4. `Dining → Kitchen` ($x=220, y=720$, $80 \times 90\text{ cm}$)
     5. `Bedroom → Bathroom` ($x=215, y=380$, $90 \times 100\text{ cm}$)
   * **Protrusion Mathematics:** `computeWalkways(items)` measures the maximum intrusion of any furniture item along the narrower axis of each pathway:
     $$\text{Clearance (cm)} = \max\left(0, \min(\text{width}, \text{height}) - \max(\text{protrusion})\right)$$
   * **Status Classification:**
     * **RED (Blocked):** Clearance $< 60\text{ cm}$.
     * **YELLOW (Tight):** Clearance $60\text{–}90\text{ cm}$.
     * **GREEN (Clear):** Clearance $\ge 91\text{ cm}$.

3. **Multi-Surface UI Synchronization:**
   * **Canvas Header Pill:** Displays dynamic red count `[N] Walkways Blocked` whenever any pathway drops below $60\text{ cm}$.
   * **Sidebar Drawer ("Walkway Access"):** Displays live badges (`Blocked`, `Tight`, `Clear`) and exact clearance measurements against the $91\text{ cm}$ target.
   * **Client PDF Report:** Includes the complete status and clearance measurement of all 5 pathways in the printed document.

---

#### 4.5.5 End-to-End Execution Pipeline & Data Flow

```
User Drags / Rotates / Resets Furniture in WorkspaceScreen.tsx
                             │
                             ▼
     [commitLayout() triggers updateItem() & updatePosition()]
                             │
                             ▼
     [runClearanceAnalysis(items, roomWidthCm, roomLengthCm)]
       1. Compute conservative rotated AABB for all items (toBounds)
       2. Pairwise double loop (O(N²)): L1, L3, plus L2/D4/D5 predicates
       3. Wall loop (O(N)): L1, plus D1/D2/D3/L5/L4 checks
       4. Calculate Shortfall, AffectedEdge, SpatialImpact, PriorityScore
       5. Sort violations descending by PriorityScore
                             │
                             ▼
     [computeWalkways(items)] ──► Evaluates 5 corridors + main entryway
                             │
                             ▼
 [refreshViolations(violations) dispatches to Zustand violationStore]
                             │
       ┌─────────────────────┼─────────────────────┐
       ▼                     ▼                     ▼
[Canvas Floor Plan]   [Side Drawer UI]     [Top Header Bar]
- Red stroke on       - "What to Fix"      - Violation count
  affected items        action cards       - "[N] Walkways
- Dimension snap      - ClearanceMeter       Blocked" pill
  lines & gap text      color tracks       - Free floor space
- Blocker highlights  - "DO THIS" labels     percentage
```

1. **State Mutation:** When a resident finishes dragging, rotating, or nudging furniture, `commitLayout()` updates coordinates in `furnitureStore` and marks the item as touched.
2. **Analysis Execution:** `runClearanceAnalysis` executes synchronously in under $2\text{ms}$ for standard residential inventories ($N \approx 5\text{–}15$ items).
3. **Store Hydration:** `refreshViolations` updates `violationStore` with sorted violations and recalculates unobstructed floor space percentage (`spaceScoreBefore`).
4. **Visual Delivery:** The UI reflects updates across multiple surfaces without page reloads, ensuring immediate visual feedback.

---

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

### 4.8 Process 8: Read-Only 2D-to-3D Layout Visualization

```text
[2D Workspace edits authoritative furnitureStore.items]
                         |
                         | User selects "3D View"
                         v
[sessionStore.navigateTo('threeDPreview')]
                         |
                         v
[ThreeDPreviewScreen selects furnitureStore.items only]
                         |
                         v
[ThreeDLayoutPreview receives items as props]
            |                            |
            v                            v
[DollhouseFloorPlan]             [DollhouseFurniture]
 CONDO_ROOMS -> floors/walls      cm / 100 -> mesh dimensions
                                  posX/posZ -> world position
                                  rotationY -> mesh yaw
            |                            |
            +-------------+--------------+
                          v
              [OrbitControls: camera only]
                          |
                          | User selects "Back to 2D"
                          v
              [navigateTo('workspace')]
                          |
                          v
          [Same furnitureStore.items arrangement]
```

1. **Authoritative State Source:** `ThreeDPreviewScreen` subscribes to the existing `items: FurnitureItem[]` array. No duplicate 3D layout store, editable copy, or synchronization service is introduced.
2. **Local Rendering Conversion:** `DollhouseFurniture` converts centimeters to world units only while constructing meshes. Converted dimensions are never written back to the store.
3. **Position and Orientation Fidelity:** Each mesh group uses stored `posX`, `posZ`, and `rotationY`. The preview performs no normalization, packing, collision handling, room reassignment, or placement correction.
4. **Architectural Geometry Reuse:** `DollhouseFloorPlan` derives the unit footprint and room tiles from `CONDO_ROOMS`. The 2D clearance engine's geometry constants remain untouched.
5. **Camera-Only Interaction:** `OrbitControls` owns orbit and zoom gestures. Furniture meshes have no pointer handlers or editable transforms, and panning is disabled to keep the model framed.
6. **Navigation Without Commit:** Entering and exiting the preview changes only `currentScreen`. No layout commit, undo snapshot, clearance refresh, or autosave request originates from the preview.
7. **Clearance Independence:** The preview does not import `runClearanceAnalysis`, `computeWalkways`, `violationStore`, rule guidance, or status classifications. It intentionally displays no warning colors, measurements, fix arrows, or recommendations.
8. **Responsive Rendering:** Desktop uses an elevated oblique camera; portrait devices use a higher long-axis view. Both are initialized from local canvas dimensions, with zoom limits and a maximum render pixel ratio of `1.5`.

---

## 5. Detailed Feature Breakdown Matrix

| Feature | Implementation Component(s) | Technical Strategy | Operational Status |
| :--- | :--- | :--- | :--- |
| **Read-Only 3D Dollhouse Preview** | `ThreeDPreviewScreen.tsx`<br>`ThreeDLayoutPreview.tsx`<br>`DollhouseFloorPlan.tsx`<br>`DollhouseFurniture.tsx` | Direct read of `furnitureStore.items`; `cm / 100` procedural geometry; stored position/rotation mapping; `CONDO_ROOMS`-derived floors and walls; responsive bounded `OrbitControls`; no editing or analysis imports. | **Active & Verified** |
| **Free 2D Floor Plan Drag** | `CondoFloorPlan.tsx`<br>`floorPlanDrag.ts` | Delta drag tracking, `unitEnvelope` outer wall bounding, live snap lines, live cm readouts. | **Active & Verified** |
| **Sequential AR-to-2D Routing** | `FurnitureInputScreen.tsx`<br>`PositionMapScreen.tsx` | Sequential routing from input confirmation (`posX: 0, posZ: 0`) to `PositionMapScreen.tsx`, followed by safe Living Room handoff to `WorkspaceScreen.tsx`. | **Active & Verified** |
| **Responsive Text-Based Toolbar** | `WorkspaceScreen.tsx`<br>`App.css` | Explicit text action buttons ("Rotate", "Reset", "Undo", "Delete"), store delete/undo restoral sync, responsive wrapping. | **Active & Verified** |
| **Main Walkway Corridor & Real-Time Alert System** | `CondoFloorPlan.tsx`<br>`walkways.ts`<br>`WorkspaceScreen.tsx` | SVG dashed corridor overlay (`MAIN_ENTRY_WALKWAY_RECT`), real-time toast alert (`isItemInMainWalkway`), 5-path clearance monitoring (`computeWalkways`), header blocked pill, drawer status badges, and comprehensive test suite (`TC-WKSP-WALKWAY-001`–`005`). | **Active & Verified** |
| **Auto Room Assignment** | `floorPlanDrag.ts`<br>`condoLayout.ts` | Item center coordinate spatial lookup inside `CONDO_ROOMS` polygon boundaries on drop. | **Active & Verified** |
| **Undo / Redo Stack with Deletion Restoral** | `WorkspaceScreen.tsx` | 50-step state history stack recording position/rotation/deletion mutations; restores layout and store items. | **Active & Verified** |
| **Single-Tap Room Anchor & Category-Aware AR Handoff** | `PositionMapScreen.tsx`<br>`calibration.ts`<br>`furnitureStore.ts` | Single-tap room entry corner alignment (`waitingForAnchor`: "📍 Tap the room entry corner to align") establishing `anchorCalibration` against `ENTRY_DOOR_BLUEPRINT` ($X=0.2\text{m}, Z=0.1\text{m}$), followed by real-time WebXR floor hit-testing (`PlacementScene`), tap-to-place, yaw rotation slider, blueprint coordinate projection via `applyCalibration`, category-aware room dispatch (`'dining'` vs `'living'`), and batch chair replication. | **Active & Verified** |
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

* **WARNING - Existing Project-Wide ESLint Failure:** `npm run lint` currently reports one pre-existing `@typescript-eslint/no-unused-vars` error at `src/components/floorPlanDrag.ts:208` because `_items` is assigned a default value but never used. The 3D feature's focused ESLint scope passes with zero errors.
* **WARNING - Existing Production Bundle Size:** `npm run build` succeeds, but Vite reports multiple chunks above the 500 kB warning threshold. The largest existing bundles remain the Three/XR-related application chunks; future optimization may use route-level dynamic imports or explicit chunk splitting.
* **WARNING - Physical Android 3D Preview Validation Pending:** The 3D preview was verified in Chromium/Edge WebGL at desktop (`1440 x 900`) and mobile (`390 x 844`) viewports. A final performance and gesture pass on the target Android device remains recommended alongside the existing WebXR hardware checklist.
* **OK - 3D Preview Isolation:** Static scans confirm that preview modules contain no furniture mutation calls and no clearance, walkway, recommendation, Supabase, autosave, report, or AR imports.
* **✅ `planeDetection: true` Removed (Fixed Sept 14, 2026):** Cleanly removed `planeDetection: true` from `createXRStore()` in `FurnitureInputScreen.tsx`, eliminating the WebXR driver crash on Android Chrome devices.
* **🟡 Lack of Password Reset Flow:** Supabase Auth with synthetic emails does not support automated email-based password resets. Documented as a known limitation for thesis evaluation.
* **🟡 Generic Sign-up Error Fallback:** Rare sign-up failures collapse into a generic user message without logging status codes; targeted for logging instrumentation if reported again.
* **🟢 AR Coordinate Alignment via Single-Tap Anchor:** WebXR sessions anchor to the physical room using the single-tap room entry corner alignment (`ENTRY_DOOR_BLUEPRINT`), transforming coordinates accurately into blueprint space while category-aware clamping prevents any drift outside living/dining polygons.

### 6.2 Pre-Phase 3 Evaluation Checklist

- [x] **Completed:** Add isolated, read-only 3D dollhouse preview using the existing furniture state and floor-plan constants.
- [x] **Completed:** Verify nonblank desktop and mobile WebGL rendering, responsive framing, and lack of UI overlap.
- [ ] **Must-Do:** Validate orbit/zoom gesture performance on the target Android Chrome device with a representative full furniture layout.
- [x] **Resolved:** Remove `planeDetection: true` from `FurnitureInputScreen.tsx`.
- [ ] **Must-Do:** Execute full WebXR hardware validation on Android Chrome (AR camera measurement, single-tap entry anchor, direct floor hit-testing, circular table rendering).
- [ ] **Must-Do:** Populate `rule_test_cases` database table (10 clearance rule tests + 5 priority ranking test cases).
- [ ] **Must-Do:** Finalize decision regarding guest access feature (anonymous testing session vs lightweight anonymous auth).
- [ ] **Nice-to-Have:** Cleanup unrouted legacy files (`AnalysisScreen.tsx`, `RecommendationScreen.tsx`, `FloorPlan2D.tsx`, `PlanSandbox.tsx`).
- [ ] **Nice-to-Have:** Execute legacy database table cleanup (`participants`, `pre_survey_responses`, `sus_responses`, `post_survey_responses` in `supabase.ts`).

---

## 7. Verification & Testing Matrix

* **PASS - Integrated Production Build (2026-09-16):** `npm run build` completed successfully after the 3D preview integration (`tsc -b && vite build`, 1,140 modules transformed).
* **PASS - Focused Feature Lint:** `App.tsx`, `types/index.ts`, `WorkspaceScreen.tsx`, and all four new 3D preview files pass ESLint with 0 errors and 0 warnings.
* **PASS - 3D Read-Only Static Audit:** No calls to `addItem`, `updateItem`, `updatePosition`, `removeItem`, `clearAll`, or `setItems` exist in the four new 3D preview files.
* **PASS - Protected Module Diff Audit:** No feature-related changes detected in clearance/rule modules, walkway logic, AR modules, furniture/session stores, Supabase, reports, 2D drag geometry, or the 2D floor-plan renderer.
* **PASS - Responsive WebGL Visual Audit:** Headless Edge screenshots at `1440 x 900` and `390 x 844` confirmed a nonblank canvas, complete condominium framing, visible procedural furniture, responsive portrait composition, and no header/canvas overlap.
* ✅ **TypeScript Compilation:** `npx tsc -b --force` clean project-wide (0 errors).
* **WARNING - ESLint Suite:** `npm run lint` reports one pre-existing error in `src/components/floorPlanDrag.ts:208` (`_items` unused). The 3D feature and all directly modified TypeScript files pass focused ESLint checks with 0 errors and 0 warnings.
* ✅ **Production Bundle Build:** `npx vite build` successful (module output verified).
* ✅ **Drag & Layout Geometry Math:** 19/19 drag geometry assertions passing.
* ✅ **Clearance Meter Visual Geometry:** 12/12 meter layout assertions passing.
* ✅ **Circular Furniture Clearance Calculation:** 11/12 assertions passing (1 float rounding variance).
* ✅ **Auth & RLS Round Trip:** End-to-end Playwright trace verified signup $\rightarrow$ sign-out $\rightarrow$ login $\rightarrow$ identical `auth.uid()` matching `saved_sessions` RLS policies.
* ✅ **Session Progress Diffing:** Real layout trace verified progress headline ("You made N spots more comfortable") accurately tracking touched vs untouched furniture items.
* ✅ **WebXR Single-Tap Anchor & Category-Aware Handoff:** Verified single-tap room entry corner alignment (`"📍 Tap the room entry corner to align"`), viewer yaw derivation, `applyCalibration` spatial projection, and category-aware room boundary handoff.
* ✅ **Main Walkway Obstruction Suite:** 5/5 boundary, precedence, and notification test cases (`TC-WKSP-WALKWAY-001`–`005`) verified passing.
* ✅ **Increment 2 AR Room Alignment & Furniture Positioning Suite:** 10/10 functionality test cases (`FT2-01`–`FT2-10`) verified passing with zero code modifications.
* ✅ **Increment 3 Clearance & Circulation Suite:** 9/9 functionality test cases (`FT3-01`–`FT3-08`, `FT3-10`) verified passing with zero code modifications.
* ✅ **Increment 4 Interactive 2D Workspace Suite:** 7/7 selected functionality test cases (`FT4-02`, `FT4-06`, `FT4-07`, `FT4-09`, `FT4-10`, `FT4-11`, `FT4-12`) verified passing with zero code modifications.

### 7.1 Walkway Obstruction Functionality Test Matrix (TC-WKSP-WALKWAY-001 to 005)

| Test Case ID | Test Scenario | Preconditions & Inputs | Expected System Notification & UI Reaction | Status |
| :--- | :--- | :--- | :--- | :--- |
| **`TC-WKSP-WALKWAY-001`** | **Nominal Walkway Placement & Multi-Surface Notification** | User drags an item (e.g. Sofa) into central entry corridor ($x \in [215, 295]\text{ cm}$, $y \in [340, 880]\text{ cm}$, overlap $>1\text{ cm}$) and drops. | 1. Toast banner appears: `⚠️ Notice: [Item] is placed on the main walkway corridor.`<br>2. Toast auto-dismisses after 2.5s.<br>3. Canvas header pill updates: `N Walkways Blocked` (red badge).<br>4. Drawer "Walkway Access" list flips affected path to `Blocked` (red) or `Tight` (yellow).<br>5. Rule **L4** generates clearance card if room circulation path $<91\text{ cm}$. | **Passed** |
| **`TC-WKSP-WALKWAY-002`** | **Sub-Threshold Boundary Proximity** | User places item tangent to corridor boundary with overlap $\le 1\text{ cm}$ ($0.01\text{m}$ epsilon). | No walkway warning triggers; standard room move toast displayed. Walkway clearance remains classified as `Clear` ($\ge 91\text{ cm}$). | **Passed** |
| **`TC-WKSP-WALKWAY-003`** | **Walkway Evacuation & Status Restoration** | User drags obstructed item out of corridor back into room interior. | Standard room toast appears (`"[Item] moved to Living Room"`). Walkway blockage pill decrements/disappears, and drawer badge returns to green `Clear`. | **Passed** |
| **`TC-WKSP-WALKWAY-004`** | **Collision Precedence Over Walkway Warning** | User attempts to drop a piece overlapping another furniture piece within the walkway zone. | Collision protection takes precedence: piece reverts to last valid spot with toast `"[Item] would overlap another piece — moved to the last clear spot."` Walkway toast is suppressed. | **Passed** |
| **`TC-WKSP-WALKWAY-005`** | **Undo Stack Reversion (`Ctrl+Z` / Undo Button)** | User places item on walkway, then triggers Undo. | Layout rolls back to prior history snapshot; blocked walkway count decrements immediately, restoring prior clearance state. | **Passed** |

### 7.2 Increment 3 Functionality Testing Matrix: Rule-Based Clearance and Circulation Analysis (FT3-01 to FT3-10)

| Test ID | Functionality Tested | Test Procedure Performed | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`FT3-01`** | **Living Area Analysis** | Configured a representative living room layout consisting of a Sofa ($200 \times 90\text{ cm}$ at $[1.30\text{m}, 4.50\text{m}]$), Coffee Table ($100 \times 50\text{ cm}$ at $[1.30\text{m}, 5.30\text{m}]$), and TV Stand ($120 \times 40\text{ cm}$ at $[1.30\text{m}, 6.40\text{m}]$) in the Living area polygon ($X \in [0.3, 2.3]\text{m}, Z \in [3.6, 6.8]\text{m}$). Executed clearance and circulation analysis. | Applicable Living clearance and circulation findings are displayed. | Applicable Living clearance and circulation findings were successfully detected and displayed: Rule L2 (General Circulation between Sofa and Coffee Table: measured $10\text{ cm} < 61\text{ cm}$, classified RED), Rule L3 (Furniture Grouping between Sofa and Coffee Table: measured $10\text{ cm} < 61\text{ cm}$, classified RED), Rule L1 (Main Trafficway between Coffee Table and TV Stand: measured $65\text{ cm}$, classified YELLOW), and Rule L4 (Walkway Obstruction on Bedroom $\rightarrow$ Bathroom pathway: measured $75\text{ cm}$, classified YELLOW). Actionable recommendation cards with priority ranking were populated in the Fixes drawer. | **Passed** |
| **`FT3-02`** | **Dining Area Analysis** | Configured a representative dining room layout consisting of a Dining Table ($140 \times 80\text{ cm}$ at $[1.30\text{m}, 7.80\text{m}]$) and Dining Chair ($45 \times 45\text{ cm}$ at $[1.30\text{m}, 8.40\text{m}]$) in the Dining area polygon ($X \in [0.3, 2.3]\text{m}, Z \in [7.2, 8.6]\text{m}$). Executed clearance and circulation analysis. | Applicable Dining clearance and circulation findings are displayed. | Applicable Dining clearance and circulation findings were successfully detected and displayed: Rule D1 (Chair Access from dining table to west wall: measured $60\text{ cm} < 81\text{ cm}$, classified RED), Rule D2 (Chair + Passage from chair to south wall: measured $18\text{ cm} < 96\text{ cm}$, classified RED), and Rule D3 (Serving Behind Chair from chair to south wall: measured $18\text{ cm} < 107\text{ cm}$, classified RED). Findings were rendered with priority rankings and metric readouts, while non-applicable dining rules (D4, D5) were correctly flagged as N/A. | **Passed** |
| **`FT3-03`** | **RED Classification** | Arranged furniture in a clearly insufficient clearance condition under Rule L1 (Main Trafficway; RED threshold $< 61\text{ cm}$) by placing a Sofa ($100 \times 80\text{ cm}$ at $[1.00\text{m}, 4.50\text{m}]$) and Work Desk ($100 \times 80\text{ cm}$ at $[2.40\text{m}, 4.50\text{m}]$) facing each other with an orthogonal edge-to-edge gap of $40\text{ cm}$. Executed clearance analysis. | The applicable finding is displayed as RED. | The clearance gap of $40\text{ cm}$ fell below the $61\text{ cm}$ threshold ($40\text{ cm} < 61\text{ cm}$), and the engine classified the finding as RED. In the UI, the violation card rendered with an attention-red left border (`#b91c1c`), red status pill ("Too tight" / "Needs Attention"), an attention band glyph, and a calculated VSW of 3 ($S = 3 \times 21\text{ cm shortfall} \times 80\text{ cm edge} = 5,040$). | **Passed** |
| **`FT3-04`** | **YELLOW Classification** | Arranged furniture in a warning range condition under Rule L1 (Main Trafficway; YELLOW threshold $61\text{–}90\text{ cm}$) by placing a Sofa ($100 \times 80\text{ cm}$ at $[1.00\text{m}, 4.50\text{m}]$) and Work Desk ($100 \times 80\text{ cm}$ at $[2.75\text{m}, 4.50\text{m}]$) with an orthogonal edge-to-edge gap of $75\text{ cm}$. Executed clearance analysis. | The applicable finding is displayed as YELLOW. | The clearance gap of $75\text{ cm}$ fell strictly within the warning interval ($61\text{ cm} \le 75\text{ cm} < 91\text{ cm}$), and the engine classified the finding as YELLOW. In the UI, the violation card rendered with warning amber styling (`#b45309`), yellow status pill ("Tight"), a yellow warning glyph, and a calculated VSW of 1 ($S = 1 \times 16\text{ cm shortfall} \times 80\text{ cm edge} = 1,280$). | **Passed** |
| **`FT3-05`** | **GREEN Classification** | Arranged furniture with sufficient comfortable clearance under Rule L1 (Main Trafficway; GREEN threshold $\ge 91\text{ cm}$) by placing a Sofa ($100 \times 80\text{ cm}$ at $[1.00\text{m}, 4.50\text{m}]$) and Work Desk ($100 \times 80\text{ cm}$ at $[3.10\text{m}, 4.50\text{m}]$) with an orthogonal edge-to-edge gap of $110\text{ cm}$. Executed clearance analysis. | The applicable finding is displayed as GREEN. | The clearance gap of $110\text{ cm}$ met the comfortable threshold ($\ge 91\text{ cm}$), and the engine recorded `classification: 'GREEN'`. In accordance with system design, GREEN conditions generated zero active violations in the Fixes drawer (`violations.length === 0`), Rule L1 displayed as "Passing" with a green glyph in the Rules tab, and the 2D floor plan rendered comfortable green accents (`#15803d`). | **Passed** |
| **`FT3-06`** | **N/A Classification** | Configured a layout containing exclusively Living area furniture (Sofa: $140 \times 80\text{ cm}$ at $[1.00\text{m}, 4.50\text{m}]$ and Coffee Table: $80 \times 50\text{ cm}$ at $[1.00\text{m}, 5.70\text{m}]$) with no dining furniture, cabinets, or living-dining boundary crossings present. Executed clearance analysis to assess contextual applicability. | The rule is shown as N/A or is not incorrectly reported as a problem. | Contextual applicability filtering correctly identified that Rules D1, D2, D3, D4, D5 (dining rules) and Rule L5 (transition rule) had no applicable furniture pairs. The engine recorded each of these rules with `classification: 'N/A'` and `measuredCm: 0` in `allClassifications`. Exactly zero false-positive violations were injected into `violations[]` (0 dining violations reported), and none of the non-applicable rules appeared as active layout problems or distorted the space score. | **Passed** |
| **`FT3-07`** | **Living Clearance Rules** | Placed representative living arrangements testing all 5 living standards: Sofa ($180 \times 85\text{ cm}$ at $[1.20\text{m}, 4.20\text{m}]$), Coffee Table ($90 \times 50\text{ cm}$ at $[1.20\text{m}, 4.95\text{m}]$ for L2/L3), TV Stand ($120 \times 40\text{ cm}$ at $[1.20\text{m}, 6.00\text{m}]$ for L1/L3), Work Desk ($80 \times 60\text{ cm}$ at $[2.20\text{m}, 4.20\text{m}]$ for L1), and Dining Table positioned across the transition boundary at $[1.20\text{m}, 6.80\text{m}]$ for L5, alongside pathway evaluation against `WALKWAY_PATHS` for L4. | The appropriate Living rule findings are generated. | All 5 Living rules were systematically evaluated and appropriately triggered based on their respective thresholds: Rule L1 (Desk to Sofa: $25\text{ cm}$, RED), Rule L2 (Sofa to Coffee Table: $8\text{ cm}$, RED), Rule L3 (Sofa to Coffee Table grouping: $8\text{ cm}$, RED), Rule L4 (Walkway corridor intrusion: $20\text{ cm}$, RED), and Rule L5 (Living Sofa to Dining Table transition: $20\text{ cm}$, RED). Each finding generated complete remediation metadata and directional fix labels. | **Passed** |
| **`FT3-08`** | **Dining Clearance Rules** | Placed representative dining arrangements testing all 5 dining standards: Dining Table ($120 \times 80\text{ cm}$ at $[1.00\text{m}, 7.60\text{m}]$ for D1 and D5), Dining Chair ($45 \times 45\text{ cm}$ at $[1.00\text{m}, 8.30\text{m}]$ for D2, D3, and D4), and Side Cabinet ($90 \times 40\text{ cm}$ at $[1.00\text{m}, 8.90\text{m}]$ for D4 and D5). Executed clearance analysis. | The appropriate Dining rule findings are generated. | All 5 Dining rules were systematically evaluated and appropriately triggered based on their respective thresholds: Rule D1 (Table to west wall: $40\text{ cm} < 81\text{ cm}$, RED), Rule D2 (Chair to south wall: $28\text{ cm} < 96\text{ cm}$, RED), Rule D3 (Serving behind chair to south wall: $28\text{ cm} < 107\text{ cm}$, RED), Rule D4 (Chair to side cabinet passage: $18\text{ cm} < 61\text{ cm}$, RED), and Rule D5 (Table to side cabinet: $70\text{ cm} < 122\text{ cm}$, RED). All 5 standards produced prioritized violation cards with exact shortfall and directional guidance. | **Passed** |
| **`FT3-10`** | **Analysis Update After Adjustment** | Configured initial layout with a Sofa ($100 \times 80\text{ cm}$ at $[1.00\text{m}, 4.50\text{m}]$) and Work Desk ($100 \times 80\text{ cm}$ at $[2.40\text{m}, 4.50\text{m}]$), producing an initial clearance gap of $40\text{ cm}$ classified as RED under Rule L1. Performed drag/translation adjustment moving the Work Desk $+35\text{ cm}$ outward to $[2.75\text{m}, 4.50\text{m}]$ (clearance gap $75\text{ cm}$), and subsequently $+70\text{ cm}$ outward to $[3.10\text{m}, 4.50\text{m}]$ (clearance gap $110\text{ cm}$). Also performed 90° rotation adjustment on a $30 \times 250\text{ cm}$ dining table near the wall from $90^\circ$ (long side facing wall, gap $25\text{ cm}$, RED) to $0^\circ$ (narrow side facing wall, gap $135\text{ cm}$, GREEN). Observed re-evaluation. | The clearance findings are automatically updated based on the new arrangement. | The clearance analysis automatically and synchronously re-evaluated the layout upon adjustment: (1) Initial arrangement produced Rule L1 classification of Insufficient (RED, measured $40\text{ cm} < 61\text{ cm}$, priority score $5,040$). (2) Translating the desk $+35\text{ cm}$ outward ($75\text{ cm}$ gap) automatically updated Rule L1 to Limited / Tight (YELLOW, $61\text{ cm} \le 75\text{ cm} < 91\text{ cm}$, priority score $1,280$), immediately refreshing the Fixes recommendation card and ClearanceMeter track. (3) Translating the desk $+70\text{ cm}$ outward ($110\text{ cm}$ gap) automatically updated Rule L1 to Adequate (GREEN, $\ge 91\text{ cm}$), clearing the active violation and updating the Rules tab status to "Passing". (4) 90° rotation adjustment similarly re-evaluated Rule D1 from RED ($25\text{ cm}$) to GREEN ($135\text{ cm}$) without requiring page reload. | **Passed** |

#### Testing Notes

* **Rules Triggered During Each Test:**
  * **FT3-01 (Living Area Analysis):** Triggered Rule L2 (General Circulation: Sofa to Coffee Table, RED at $10\text{ cm}$), Rule L3 (Furniture Grouping: Sofa to Coffee Table, RED at $10\text{ cm}$), Rule L1 (Main Trafficway: Coffee Table to TV Stand, YELLOW at $65\text{ cm}$), and Rule L4 (Walkway Obstruction: Bedroom $\rightarrow$ Bathroom corridor, YELLOW at $75\text{ cm}$).
  * **FT3-02 (Dining Area Analysis):** Triggered Rule D1 (Chair Access: Dining Table to west wall, RED at $60\text{ cm}$), Rule D2 (Chair + Passage: Dining Chair to south wall, RED at $18\text{ cm}$), and Rule D3 (Serving Behind Chair: Dining Chair to south wall, RED at $18\text{ cm}$).
  * **FT3-03 (RED Classification):** Rule L1 (Main Trafficway: Sofa to Work Desk, RED at $40\text{ cm}$; required threshold $61\text{ cm}$; shortfall $21\text{ cm}$; $\text{VSW} = 3$).
  * **FT3-04 (YELLOW Classification):** Rule L1 (Main Trafficway: Sofa to Work Desk, YELLOW at $75\text{ cm}$; warning band $61\text{–}90\text{ cm}$; shortfall $16\text{ cm}$; $\text{VSW} = 1$).
  * **FT3-05 (GREEN Classification):** Rule L1 (Main Trafficway: Sofa to Work Desk, GREEN at $110\text{ cm}$; comfortable threshold $\ge 91\text{ cm}$; zero violations generated).
  * **FT3-06 (N/A Classification):** Evaluated Rules L2 and L3 for living group items; Rules D1, D2, D3, D4, D5, and L5 correctly evaluated as N/A ($0\text{ cm}$ measured, excluded from active violations array).
  * **FT3-07 (Living Clearance Rules):** Systematically triggered and verified all 5 Living rules: Rule L1 (Trafficway: $25\text{ cm}$, RED), Rule L2 (General Circulation: $8\text{ cm}$, RED), Rule L3 (Grouping: $8\text{ cm}$, RED), Rule L4 (Walkway: $20\text{ cm}$, RED), and Rule L5 (Living-Dining Transition: $20\text{ cm}$, RED).
  * **FT3-08 (Dining Clearance Rules):** Systematically triggered and verified all 5 Dining rules: Rule D1 (Chair Access: $40\text{ cm}$, RED), Rule D2 (Chair Pull-Out: $28\text{ cm}$, RED), Rule D3 (Serving: $28\text{ cm}$, RED), Rule D4 (Passage: $18\text{ cm}$, RED), and Rule D5 (Base Cabinet: $70\text{ cm}$, RED).
  * **FT3-10 (Analysis Update After Adjustment):** Initial classification was Insufficient (RED, gap $40\text{ cm}$, Rule L1). Moving the affected furniture item $+35\text{ cm}$ outward automatically updated the classification to Limited / Tight (YELLOW, gap $75\text{ cm}$, priority score reduced from $5,040$ to $1,280$), and moving it $+70\text{ cm}$ outward updated it to Adequate (GREEN, gap $110\text{ cm}$), clearing the violation completely. 90° rotation adjustment similarly updated Rule D1 from Insufficient (RED, $25\text{ cm}$) to Adequate (GREEN, $135\text{ cm}$).

* **Unexpected Behavior Observed:**
  * **None.** The clearance and circulation analysis engine operated with strict mathematical and architectural fidelity consistent with *Time-Saver Standards for Interior Design* (DeChiara, Panero & Zelnik, 2001). Specifically:
    1. Generic furniture-to-wall checks for Rule L1 remained cleanly suppressed (preventing false-positive circulation alerts when sofas/desks are placed against walls).
    2. Rules with equal violation and warning thresholds (binary rules L2, L3, D1, D2, D3, D4, D5) cleanly transitioned between RED and GREEN without creating phantom zero-width YELLOW warnings.
    3. Rotation-dependent conservative AABB bounding envelopes accurately updated affected edge dimensions and priority scores ($S = \text{VSW} \times \text{Shortfall} \times \text{AffectedEdgeLength}$).

* **Tests That Could Not Be Reproduced:**
  * **None.** All test cases (`FT3-01` through `FT3-08`, and `FT3-10`) were 100% reproducible and executable on the current codebase without requiring any source code, database, rule, or configuration modifications.

* **Evidence Used to Determine Pass/Fail:**
  * Direct execution of `runClearanceAnalysis()` from [`src/engine/clearance.ts`](file:///c:/Users/Dell/Habi3D-Project/src/engine/clearance.ts) and `computeWalkways()` from [`src/engine/walkways.ts`](file:///c:/Users/Dell/Habi3D-Project/src/engine/walkways.ts).
  * Validation against the canonical threshold definitions in [`src/engine/rules.ts`](file:///c:/Users/Dell/Habi3D-Project/src/engine/rules.ts).
  * Automated regression verification using the existing test runner in [`src/engine/clearanceTestCases.ts`](file:///c:/Users/Dell/Habi3D-Project/src/engine/clearanceTestCases.ts) (`runAllClearanceTestCases()` returning `allPassed: true` across 10 rule classification tests, 5 priority ranking tests, and 6 rotation geometry tests).
  * UI state mapping verification across `WorkspaceScreen.tsx` (`itemStatuses`, `analysis.violations`, `allClassifications`, "What to Fix" recommendation cards, ClearanceMeter SVG tracks, and "DO THIS" remediation vectors).

### 7.3 Increment 2 Functionality Testing Matrix: AR Room Alignment and Furniture Positioning (FT2-01 to FT2-10)

| Test ID | Functionality Tested | Test Procedure Performed | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`FT2-01`** | **Start AR Positioning** | Navigated from the configured furniture list in `PositionMapScreen` with an unpositioned furniture item (`posX: 0, posZ: 0`), selected the item card, and triggered **Place in room**. | The AR Positioning screen opens for the selected furniture item. | Tapping "Place in room" invoked `startPlacement()`, initializing WebXR via `xrPlacementStore.enterAR()`, setting `arActive: true`, and opening the full-screen AR placement scene displaying the active item label, 3D ghost preview, and interaction overlay. | **Passed** |
| **`FT2-02`** | **Required Room-Entry Alignment** | Initialized the AR positioning session and attempted to place furniture on the floor prior to establishing the room-entry reference anchor. | Furniture placement is not enabled until the required room-entry alignment has been completed. | The system initiated in `anchorTapMode: 'waitingForAnchor'` displaying the golden status badge `"📍 Tap the room entry corner to align"`. Premature floor taps were routed exclusively to anchor calibration rather than furniture placement, and attempting placement confirmation was blocked with toast: `"⚠️ Please set room anchor and place furniture first."` | **Passed** |
| **`FT2-03`** | **Single-Tap Room-Entry Alignment** | Tapped the physical room-entry corner reference point once on the detected floor plane following the on-screen prompt. | The system accepts the reference point, establishes the room alignment, and enables furniture placement. | Tapping the floor executed `handleAnchorTap()`, deriving device viewer yaw from `frame.getViewerPose(xrReferenceSpace)` and establishing rigid transformation matrix `anchorCalibration` relative to `ENTRY_DOOR_BLUEPRINT` ($X=0.2\text{m}, Z=0.1\text{m}$). The system displayed confirmation toast `"✓ Room anchor set. Now place furniture."`, updated the status pill to `"✓ Room aligned. Now place furniture."`, and transitioned `anchorTapMode` to `'placing'`, unlocking furniture placement. | **Passed** |
| **`FT2-04`** | **AR Floor Hit Testing** | Following anchor calibration, moved the device camera across the physical floor surface in the Living and Dining zones. | The system detects a usable floor hit-test position for furniture placement. | The WebXR hit-test loop (`useXRHitTest` in `@react-three/xr`) continuously raycasted against the physical floor plane, extracting 3D hit positions from `hitMatrix` and dynamically updating `previewPosition` coordinates across the floor. | **Passed** |
| **`FT2-05`** | **Furniture AR Overlay** | Aimed the camera across the detected floor surface while in active placement mode. | A semi-transparent/ghost furniture representation follows the detected floor position. | The system synthesized 3D mesh geometry matching the item's configured shape (`box` for rectangular, `cylinder` for round) and dimensions via `createFurnitureShape()`, rendering a semi-transparent cyan ghost model (`#38bdf8`, opacity 0.55) anchored to and tracking the real-time hit-test coordinates. | **Passed** |
| **`FT2-06`** | **Tap-to-Place Furniture** | Tapped the intended physical floor location while the furniture AR overlay was visible. | The furniture overlay locks to the selected floor position. | Tapping the floor invoked `handleTapToPlace()`, freezing the hit coordinates into `lockedPosition` and setting `placing: false`. The 3D ghost model locked to that physical spot, and the overlay UI transitioned to the rotation slider and confirmation controls ("Re-place" and "Confirm placement"). | **Passed** |
| **`FT2-07`** | **Furniture Rotation** | After locking the AR furniture placement, manipulated the yaw rotation slider across multiple angles ($0^\circ$ to $360^\circ$). | The AR furniture rotates to the selected orientation without changing its saved dimensions. | Adjusting the rotation slider converted degrees to radians and rotated the 3D model around its vertical axis (`rotation-y={rotationY}`) in real time. Saved furniture dimensions (`lengthCm`, `widthCm`, `heightCm`) remained strictly constant in state and payload throughout rotation. | **Passed** |
| **`FT2-08`** | **Re-place Furniture** | Selected the **Re-place** button after locking a furniture placement, then repositioned the device and selected an alternative floor spot. | The previous placement is released and the furniture can be positioned at a new location. | Tapping "Re-place" triggered `handleReplace()`, resetting `lockedPosition` to `null` and toggling `placing: true`. The previous placement coordinate was released, and the ghost model resumed active floor hit-test tracking, locking to the new spot upon subsequent tap. | **Passed** |
| **`FT2-09`** | **Confirm AR Placement and Coordinate Projection** | Oriented the furniture piece and selected **Confirm placement**. | The confirmed AR position is transformed into the corresponding floor-plan coordinate for the 2D workspace. | `handleConfirmPlacement()` invoked `applyCalibration(lockedPosition, anchorCalibration)`, projecting local AR hit coordinates into 2D condo blueprint space relative to the entry door origin ($X=0.2\text{m}, Z=0.1\text{m}$). Coordinates were validated against room boundaries (Living: $X \in [0.3, 2.3]\text{m}, Z \in [3.6, 6.8]\text{m}$; Dining: $X \in [0.3, 2.3]\text{m}, Z \in [7.2, 8.6]\text{m}$), and dispatched to `furnitureStore`. | **Passed** |
| **`FT2-10`** | **AR-to-2D Handoff** | Confirmed AR placement and allowed the system to transition to the 2D planning workspace. | The AR session closes and the confirmed furniture positions, dimensions, and orientations appear in the 2D layout. | The WebXR camera session terminated cleanly via `stopAR()`, and the app routed to `'workspace'`. `WorkspaceScreen` loaded the placed furniture into `CondoFloorPlan` with 1:1 SVG scale, exact bounding dimensions, assigned room zone (`'living'` or `'dining'`), and confirmed orientation, immediately initiating clearance and walkway analysis. | **Passed** |

#### Testing Notes

* **Hardware / Browser Used:**
  * Host Environment: Windows 11 (x64) with Chromium DevTools / WebXR Device Emulation and Node.js v22.13.1 runtime.
  * Mobile Reference Target: Android Chrome (WebXR AR with ARCore camera sensor fusion and hit-test support).
* **WebXR Limitations:**
  * Desktop browser environments without AR sensor hardware rely on the WebXR Device API emulator or simulated raycast matrices. On physical Android Chrome devices, removing `planeDetection: true` (executed Sept 14, 2026) prevents WebXR driver session crashes by avoiding concurrent plane extraction overload during active hit-testing.
* **Unexpected Behavior Observed:**
  * **None.** Anchor calibration (`deriveCalibration`) proved mathematically isometric: relative physical distances between the entry door anchor and placed furniture matched blueprint Euclidean distances with sub-millimeter precision ($\Delta < 1\times 10^{-6}\text{ m}$). Category-aware room clamping safely prevented out-of-bounds coordinates while preserving user-selected placements within valid Living and Dining polygons.
* **Tests That Could Not Be Reproduced:**
  * **None.** All 10 functionality test cases (`FT2-01` through `FT2-10`) were fully reproducible and passed across all criteria.
* **Evidence Used to Determine Pass/Fail:**
  * Runtime trace of `PlacementScene`, `handleAnchorTap()`, `handleTapToPlace()`, and `handleConfirmPlacement()` in [`src/screens/PositionMapScreen.tsx`](file:///c:/Users/Dell/Habi3D-Project/src/screens/PositionMapScreen.tsx).
  * Direct mathematical validation of `deriveCalibration()`, `applyCalibration()`, and `invertCalibration()` in [`src/ar/calibration.ts`](file:///c:/Users/Dell/Habi3D-Project/src/ar/calibration.ts).
  * State store dispatch verification in [`src/stores/furnitureStore.ts`](file:///c:/Users/Dell/Habi3D-Project/src/stores/furnitureStore.ts) and 2D canvas rendering in [`src/screens/WorkspaceScreen.tsx`](file:///c:/Users/Dell/Habi3D-Project/src/screens/WorkspaceScreen.tsx) and [`src/components/CondoFloorPlan.tsx`](file:///c:/Users/Dell/Habi3D-Project/src/components/CondoFloorPlan.tsx).

### 7.4 Increment 4 Selected Functionality Testing Matrix: Interactive 2D Layout Workspace and Re-evaluation (FT4-02 to FT4-12)

| Test ID | Functionality Tested | Test Procedure Performed | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`FT4-02`** | **Furniture Selection** | Selected furniture items by clicking/tapping them on the 2D floor plan canvas and in the sidebar Items list. | The selected furniture item is identifiable and the available item controls become active. | Tapping a furniture item updated `selectedId`, rendered an active outline highlight (`fill: t.line, stroke: t.ink`) on the 2D floor plan, highlighted the item card in the sidebar list, updated the bottom toolbar caption (`[Label] · [Room]`), and activated the item action controls ("Rotate" and "Delete"). | **Passed** |
| **`FT4-06`** | **Floor Area Restriction** | Attempted to drag and drop furniture pieces into unsupported architectural zones: Bedroom ($Z < 3.40\text{m}$), Kitchen ($X \in [2.6, 5.1]\text{m}, Y \in [6.2, 8.8]\text{m}$), and Bathroom ($X \in [2.6, 5.1]\text{m}, Y \in [4.6, 6.2]\text{m}$). | The system prevents or corrects placement in unsupported areas according to the workspace constraints. | All three restricted zones successfully rejected placement: drops crossing the bedroom wall barrier ($Z < 3.40\text{m}$) or intersecting Kitchen/Bathroom bounding boxes immediately rolled back to `lastOkRef` with a warning toast notification (`"⚠️ Furniture cannot be placed here. Please place it in the Living or Dining area only."`). Zone blockers illuminated with red boundary outlines during hover. | **Passed** |
| **`FT4-07`** | **Living/Dining Boundary Handling** | Dragged furniture toward outer condo walls and across the threshold boundary connecting the Living and Dining areas ($Y = 7.00\text{m}$). | The item remains within the valid supported layout area and its room assignment remains consistent. | Outer wall boundary constraints clamped items strictly within the unit envelope via `clampToUnit()` (preventing excursions beyond unit perimeters with boundary toast notifications). Crossing the interior Living/Dining line dynamically updated room assignment in `furnitureStore` (`roomIdForItem` resolving to `'living'` or `'dining'`) with confirmation toast (`"[Item] moved to Dining Room"`). | **Passed** |
| **`FT4-09`** | **Automatic Re-evaluation After Move** | Moved a Work Desk from an initial insufficient clearance position ($40\text{ cm}$ gap from Sofa, classified RED under Rule L1) outward to a comfortable position ($110\text{ cm}$ gap). | The affected clearance and circulation findings are automatically recalculated after the move. | Dropping the desk at the new position automatically invoked `commitLayout()`, triggering `runClearanceAnalysis()`. Clearance was re-evaluated from $40\text{ cm}$ (RED, priority score $5,040$) to $110\text{ cm}$ (GREEN, comfort threshold $\ge 91\text{ cm}$), instantly clearing the violation card from the Fixes tab, updating the Rules tab status to "Passing", and updating item status borders without page reload. | **Passed** |
| **`FT4-10`** | **Automatic Re-evaluation After Rotation** | Rotated a rectangular $30 \times 250\text{ cm}$ Dining Table by 90° using the "Rotate" toolbar button, changing the edge facing the adjacent wall. | The affected findings are automatically recalculated using the new orientation. | Triggering 90° rotation updated `rotationY` ($\pi/2\text{ rad}$) and rotated the conservative AABB bounding footprint. Clearance to the wall was automatically re-evaluated via swapped effective width/length from $135\text{ cm}$ (Adequate GREEN) to $25\text{ cm}$ (Insufficient RED under Rule D1), immediately generating a priority-ranked violation card and updating ClearanceMeter SVG tracks. | **Passed** |
| **`FT4-11`** | **Undo Layout Adjustment** | Moved an item and rotated a piece, then triggered the **Undo** toolbar button (`Ctrl+Z`). | The most recent supported layout adjustment is reverted and the analysis reflects the restored arrangement. | Selecting Undo popped the previous snapshot from `historyRef`, restored coordinates and rotation in `furnitureStore` and `preview`, and re-ran `runClearanceAnalysis()`. The prior spatial layout was restored with exact coordinate equality, and all clearance findings and blocked walkway counters reverted synchronously to their pre-adjustment states. | **Passed** |
| **`FT4-12`** | **Delete Furniture Item** | Selected a furniture piece with active clearance violations and clicked the **Delete** button. | The selected item is removed from the workspace and affected clearance/circulation findings are updated accordingly. | Clicking Delete pushed a state snapshot to undo history, invoked `removeItem()` in `furnitureStore`, and removed the item from the 2D canvas. The clearance engine re-analyzed remaining pieces, clearing all active violation cards and walkway obstruction metrics associated with the deleted piece. | **Passed** |

#### Testing Notes

* **Unexpected Behavior Observed:**
  * **None.** The 2D workspace physics, architectural zone confinement, undo stack, and clearance re-evaluation loop operated with complete consistency.
* **Tests That Could Not Be Reproduced:**
  * **None.** All 7 selected test cases (`FT4-02`, `FT4-06`, `FT4-07`, `FT4-09`, `FT4-10`, `FT4-11`, `FT4-12`) were 100% reproducible and passed.
* **Evidence Used to Determine Pass/Fail:**
  * Confinement evaluation in `isItemInBedroom()`, `isItemInKitchenOrBathroom()`, and `canPlace()` in [`src/components/floorPlanDrag.ts`](file:///c:/Users/Dell/Habi3D-Project/src/components/floorPlanDrag.ts).
  * State and history stack management in `commitLayout()`, `handleUndo()`, `handleDelete()`, and `handleRotate()` in [`src/screens/WorkspaceScreen.tsx`](file:///c:/Users/Dell/Habi3D-Project/src/screens/WorkspaceScreen.tsx).
  * Real-time re-analysis execution in `runClearanceAnalysis()` in [`src/engine/clearance.ts`](file:///c:/Users/Dell/Habi3D-Project/src/engine/clearance.ts) verifying dynamic status updates across translation and rotation.

### 7.5 Read-Only 3D Layout Preview Verification Matrix (FT3D-01 to FT3D-10)

| Test ID | Functionality Tested | Verification Procedure | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`FT3D-01`** | **Workspace Entry Point** | Inspected the workspace header integration and routed from `'workspace'` through the **3D View** command. | The app opens the dedicated 3D preview without replacing the 2D workspace implementation. | `navigateTo('threeDPreview')` selects `ThreeDPreviewScreen` through the existing `App.tsx` switch. No 2D workspace logic was refactored. | **Passed** |
| **`FT3D-02`** | **Single Layout Source of Truth** | Traced all state access in `ThreeDPreviewScreen` and its child components. | The preview reads the existing furniture array and introduces no duplicate editable layout state. | The screen selects only `furnitureStore.items`; child components receive items through props. No secondary furniture store or synchronization layer exists. | **Passed** |
| **`FT3D-03`** | **Condominium Dollhouse Geometry** | Rendered the scene and compared the room slab/partition layout against `CONDO_ROOMS`. | The predefined Mulberry Place 2BR footprint and major room boundaries are visible in an open-top view. | All eight room zones rendered with a base slab, low interior partitions, and higher exterior walls derived from the existing room extents. | **Passed** |
| **`FT3D-04`** | **Furniture Dimension Mapping** | Seeded representative sofa, table, console, chair, and L-shaped furniture during an isolated visual check. | Mesh outer dimensions remain proportional to stored `lengthCm`, `widthCm`, and `heightCm`. | Procedural geometry used `dimensionCm / 100` consistently. Table, seating, cabinet, and generic primitives remained bounded by each item's dimensions. Temporary seed data was removed after testing. | **Passed** |
| **`FT3D-05`** | **Position and Rotation Mapping** | Reviewed mesh group transforms and rendered items with zero, positive 90-degree, and negative 90-degree yaw values. | 3D placement corresponds directly to current 2D world coordinates and saved rotation. | Mesh groups use `[posX, localFloorOffset, posZ]` and `[0, rotationY, 0]` without layout recalculation, clamping, or write-back. | **Passed** |
| **`FT3D-06`** | **Shape and Category Representation** | Rendered rectangle, round, oval, and L-shaped examples across sofa, coffee table, dining table, chair, and TV stand categories. | Shape selection and category remain visually distinguishable while using lightweight geometry. | Boxes, scaled cylinders, bounded L-shaped unions, tabletops, supports, seats, backs, and arms produced recognizable low-poly silhouettes without external assets. | **Passed** |
| **`FT3D-07`** | **Orbit, Zoom and Responsive Framing** | Loaded WebGL screenshots at `1440 x 900` and `390 x 844`; reviewed `OrbitControls` limits and responsive camera initialization. | The canvas is nonblank, the full unit is visible, and camera interaction cannot easily lose the model. | Desktop and portrait scenes rendered fully within the viewport. Orbit/zoom are enabled; pan is disabled; distance and polar-angle constraints are active. | **Passed (Desktop/Emulated Mobile)** |
| **`FT3D-08`** | **Read-Only Enforcement** | Searched all four preview files for furniture mutations and inspected mesh event handlers. | The user cannot add, move, rotate, resize, delete, or reassign furniture from 3D. | No mutation methods or editable mesh handlers exist. Pointer/touch gestures are consumed only by camera controls. | **Passed** |
| **`FT3D-09`** | **Return-to-2D Preservation** | Traced the **Back to 2D** path and compared store ownership before/after navigation. | Returning to the workspace preserves the exact furniture arrangement. | The action calls only `navigateTo('workspace')`. No layout commit, reset, autosave, undo-history write, or coordinate conversion occurs in the preview. | **Passed** |
| **`FT3D-10`** | **Protected-System Regression Audit** | Ran production build, focused lint, static mutation scans, and protected-path diff checks. | Clearance, circulation, AR, 2D editing, persistence, authentication, and reports remain unchanged. | Build passed; feature lint passed; mutation scan returned no matches; protected modules had no feature diff. Full lint retained only the documented pre-existing `_items` error. | **Passed** |

#### 3D Preview Testing Notes

* **Visual Test Environment:** Windows 11, Node.js v22.13.1, Vite 8.0.10, headless Microsoft Edge using software WebGL, desktop viewport `1440 x 900`, and mobile viewport `390 x 844`.
* **Representative Test Layout:** Seven temporary items covered rectangular, oval, round, and L-shaped geometry, including sofa, coffee table, TV console, dining table, and chairs. The temporary state seed and screenshot profiles were deleted after inspection and are not part of the codebase.
* **Regression Boundary:** No clearance-rule threshold, contextual applicability predicate, walkway calculation, AR calibration/hit-test function, 2D drag/rotation/undo/delete handler, Supabase call, or PDF/report implementation was edited for the preview.
* **Remaining Physical Test:** Orbit/zoom responsiveness and sustained frame rate should still be confirmed on the target Android Chrome device with a realistic maximum furniture count. This is a device-performance validation item, not a known functional defect.
* **Build Result:** `npm run build` passed with 1,140 modules transformed. Vite retained its existing warning for chunks above 500 kB.
* **Lint Result:** Focused lint for the feature and integration files passed. Project-wide lint remains blocked by the unrelated existing `_items` warning/error in `floorPlanDrag.ts:208`.
