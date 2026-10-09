# Habi3D — AR-Assisted Condo Furniture-Planning & Spatial-Layout Evaluation System

## System Objective

**To develop and evaluate Habi3D as an AR-assisted condo furniture-planning and spatial-layout evaluation system that supports furniture placement across the target condo unit, checks applicable spatial constraints and circulation requirements, and provides location-specific recommendations that help users identify and correct layout problems through an integrated AR and 2D workspace.**

---

## Core Purpose & Workflow

In compact urban condominium units, layout adjustments can drastically affect circulation, accessibility, and human comfort. Habi3D implements an integrated, cyclic layout improvement workflow:

$$\text{Place furniture} \longrightarrow \text{Evaluate layout} \longrightarrow \text{Identify problem} \longrightarrow \text{Show recommendation} \longrightarrow \text{Focus affected area} \longrightarrow \text{Adjust furniture} \longrightarrow \text{Re-evaluate layout}$$

Rather than acting as a static CAD package or conversational chatbot, Habi3D delivers actionable planning utility:
1. **Digitize Real Furniture**: Input physical dimensions directly or measure using WebXR assistive camera estimation.
2. **AR-Assisted Placement**: Preview, rotate, and validate furniture against real floor geometry and condo boundaries before committing coordinates.
3. **Multi-Room Spatial Analysis**: Evaluate layouts across the entire condo unit using room-appropriate architectural rules (*Time-Saver Standards for Interior Design*) without indiscriminate rule application.
4. **Actionable Recommendations**: Directly access findings via a mobile-friendly bottom sheet or desktop side panel, focus the problem area with camera auto-framing and directional correction arrows, and adjust furniture in 2D or AR.
5. **Dynamic Re-Analysis**: Re-evaluate the layout immediately upon furniture movement, clearing resolved findings.

---

## Target Scope & Floor Plan

Habi3D models the complete standard 2-bedroom condominium unit at **Mulberry Place, Acacia Estates, Taguig City** ($5.10\,\text{m} \times 8.80\,\text{m}$ / $510\,\text{cm} \times 880\,\text{cm}$):

### Supported Rooms & Validation Levels

1. **Living Room** ($2.60\,\text{m} \times 3.60\,\text{m}$): **Full Validation** — Codified interior design rules L1–L5 (sofa-coffee table, conversation clearances, TV rack viewing distance, and circulation).
2. **Dining Room** ($2.60\,\text{m} \times 1.80\,\text{m}$): **Full Validation** — Codified dining rules D1–D5 (chair pull-out, wall clearance, serving passage, and table boundaries).
3. **Bedroom 1 (Master)** ($2.50\,\text{m} \times 2.40\,\text{m}$): **Bedroom Circulation Standards** — Rules B1 (Bed access and side circulation, $\ge 61\,\text{cm}$) and B2 (Wardrobe door and front clearance, $\ge 61\,\text{cm}$).
4. **Bedroom 2** ($2.60\,\text{m} \times 2.40\,\text{m}$): **Bedroom Circulation Standards** — Rules B1 and B2.
5. **Kitchen** ($2.50\,\text{m} \times 2.60\,\text{m}$): **Architectural Baseline (Limited Analysis)** — Clear boundary and fixed fixture checks, clearly designated in reports.
6. **Bathroom** ($2.50\,\text{m} \times 1.60\,\text{m}$): **Sanitary Zone Baseline (Limited Analysis)** — Restricted zone for non-sanitary furniture, limited clearance analysis.
7. **Balcony** ($5.10\,\text{m} \times 1.00\,\text{m}$): **Exterior Perimeter Baseline (Limited Analysis)** — Unit boundary checks.
8. **Storage / Utility** ($2.50\,\text{m} \times 1.20\,\text{m}$): **Utility Baseline (Limited Analysis)** — Baseline boundary and storage assignment.
- **Main Walkway Corridor:** Pedestrian thoroughfare spanning from the main entrance door ($Z = 8.80\,\text{m}$) to the bedroom hall ($Z = 3.40\,\text{m}$) across $X \in [2.15, 2.95]\,\text{m}$ ($80\,\text{cm}$ width).

---

## AR Sensor Capabilities & Explicit Limitations

- **Assistive Measurement Accuracy**: WebXR plane and hit-test detection provides assistive estimates of floor geometry and distances (typical accuracy $\pm 2\text{–}5\,\text{cm}$). These are assistive planning estimates, not survey-grade or guaranteed measurements.
- **Virtual Geometry Validation**: Collision, boundary, and clearance checks validate against virtual furniture geometry and the condo blueprint. Real-world dynamic physical obstacles (existing tenant belongings or moving persons) are **not** sensed by the camera or depth sensors in this version.

---

## Tech Stack

| Technology | Purpose |
| :--- | :--- |
| **React 19 + TypeScript** | Core reactive user interface, custom hooks, and strict type safety |
| **Vite 8** | Modern client bundling, fast HMR, and production optimization |
| **Zustand 5** | Lightweight, performant state management (`sessionStore`, `furnitureStore`, `violationStore`) |
| **Three.js 0.184** | 3D scene graphing, spatial transform mathematics, and geometric meshes |
| **@react-three/fiber & @react-three/drei** | Declarative Three.js scene graph in React and 3D camera controls |
| **@react-three/xr 6** | WebXR Augmented Reality integration for mobile Android Chrome |
| **Supabase Client (@supabase/supabase-js)** | Authentication and debounced background layout autosave (`saved_sessions`) |
| **jsPDF 4** | High-fidelity multi-page vector PDF session report generation |
| **Vanilla CSS & Tokens** | High-performance design token system (`src/components/tokens/`), glassmorphism, and responsive layouts |

---

## System Architecture & End-to-End User Flow

```
[EntryScreen] ──► [AuthScreen] ──► [FurnitureInputScreen] ──► [PositionMapScreen (AR)]
                                                                    │
┌───────────────────────────────────────────────────────────────────┘
▼
[WorkspaceScreen (2D Interactive Plan)] ◄──► [ThreeDPreviewScreen (3D Dollhouse)]
        │
        ▼
  [ReportScreen (PDF Export)]
```

### 1. Authentication & Session Lifecycle
- **Synthetic Email Mapping:** Users log in or sign up with a simple username. The app maps this internally to `${username}@habi3d.local` using Supabase Auth.
- **Session Resumption:** Automatically checks the `saved_sessions` table for previously saved arrangements. Users can choose to **Resume Existing Layout** or **Start Fresh**.
- **Autosave Engine (`useAutosaveLayout`):** Debounces furniture modifications (drag, rotate, delete) and persists state directly to Supabase with Row-Level Security (`auth.uid() = user_id`).

### 2. Furniture Inventory & AR Measurement
- **Catalog Categories:** Living room (sofas, coffee tables, TV consoles, side tables, work desks) and Dining room (dining tables, dining chairs, buffets/cabinets).
- **Standardized Shapes:** Rectangular, circular, and oval footprints.
- **Decimal-Safe Inputs:** Dimensions entered in centimeters with validation against maximum room dimensions.
- **Dining Chair Quantity Stepper:** Allows users to set a chair count (1–8 chairs, default 4) on a single configuration step without repetitive data entry.
- **In-Session AR Measurement (`ARMeasureSession`):** Uses WebXR camera hit-testing to measure real-world furniture dimensions via floor taps, with zero-teardown retake options.

### 3. WebXR AR Floor Placement & Single-Tap Alignment
- **Single-Tap Room Entry Corner Alignment:** Replaced complex multi-step calibration with a single tap at the unit's front entry corner (`ENTRY_DOOR_BLUEPRINT` at $X=0.2\,\text{m}, Z=0.1\,\text{m}$). The app reads the device camera yaw to establish the transformation matrix between AR space and the 2D blueprint.
- **Real-Time 3D Ghost Mesh:** Uses `useXRHitTest` on Android Chrome to project a semi-transparent blue ghost mesh onto the physical floor.
- **Tap-to-Place & Yaw Slider:** Users tap to lock position, adjust the yaw slider (0°–360°), and tap **Confirm placement**.
- **Category-Aware Routing:** Automatically routes dining furniture to dining zones and living furniture to living zones, clamping positions inside safe boundaries.
- **Batch Replication:** If a dining chair was added with quantity $N > 1$, confirming placement automatically spawns $N$ independent furniture pieces arranged in a neat, non-overlapping 2-column offset grid.
- **Safe Handoff:** Ends the AR session cleanly and navigates to the 2D interactive workspace.

### 4. Interactive 2D Workspace
The central layout optimization interface (~82% viewport canvas):
- **1:1 Metric Floor Plan (`CondoFloorPlan`):** High-precision SVG rendering with room color weighting and unit-wide wayfinding grid (A1 to F8).
- **Free-Movement Physics Drag:** Smooth dragging with a 5px drag threshold to eliminate click jitter.
- **Soft Collision Handling:** Allows overlapping furniture pieces during manual experimentation; soft toast warnings (`⚠️ Notice: Furniture pieces are overlapping`) inform the user while the clearance engine calculates $0\,\text{cm}$ gap violations.
- **Strict Architectural Confinement:**
  - Hard structural bedroom divider wall at $Z = 3.40\,\text{m}$ (`isItemInBedroom`).
  - Strict Kitchen & Bathroom blockers at $X \ge 2.60\,\text{m}, Z \ge 4.60\,\text{m}$ (`isItemInKitchenOrBathroom`).
  - Drops into invalid zones are instantly rejected and rolled back to the last valid coordinate.
- **Combined Living + Dining Directional Gap Badges:** Displays live compass badges (North, South, East, West) around the active piece. Boundary rays pass seamlessly across the open Living/Dining transition while strictly stopping at interior partition walls and exterior perimeters.
- **Main Walkway Obstruction Monitoring (`walkways.ts`):** Checks intersections with the entry corridor. Alerts users with dynamic toast notifications (`⚠️ Notice: [Item] is placed on the main walkway corridor`) and a header indicator (`N Walkways Blocked`).
- **Responsive Text Toolbar:** 90° rotation, 50-step layout undo stack, and an accessible **Delete Furniture?** confirmation dialog.
- **Tabbed Drawer Panel:**
  - **Items:** Selection, room tags, dimensions, and quick jump.
  - **Recommendations:** Actionable fix cards sorted by Priority Score with step-by-step "DO THIS" guidance and buffered move distances ($\text{shortfall} + 5\,\text{cm}$).
  - **Rules:** Live clearance status for all 10 interior design rules.

### 5. Read-Only 3D Dollhouse Layout Preview
- **Procedural 3D Environment (`ThreeDLayoutPreview`):** Generates the unit slab, low interior partition walls, and room zones directly from `CONDO_ROOMS`.
- **Open Living/Dining Transition:** Shared divider wall is excluded and marked with a subtle floor strip, preserving the open floor plan aesthetic.
- **Dimension-Faithful Models:** Category-specific 3D meshes (cushioned sofas, table tops with legs, chairs with backrests, cabinets, desks).
- **Responsive Camera & Controls:** Bounded `OrbitControls` with separate landscape and portrait framing offsets.
- **State Preservation Guard:** Workspace remount detects `previousScreen === 'threeDPreview'` and skips normalization writes, ensuring exact furniture coordinates are preserved byte-for-byte when toggling between 2D and 3D.

### 6. Constructive Evaluation & PDF Report Export
- **Affirmative Vocabulary:** Replaces punitive deficit language with constructive reassurance (e.g., *"You made N spots more comfortable"*, *"Extra space suggested"* instead of *"Needs attention"*).
- **Space Score Tracking:** Computes before-and-after space utilization scores.
- **Client-Side PDF Export (`pdfReport.ts`):** Generates downloadable vector PDF reports containing unit summary, clearance breakdown, resolved bottlenecks, and furniture inventory.

---

## Codified 10 Clearance Rules Matrix

### Contextual Applicability Model
Clearances are evaluated under the **Contextual Applicability Model** based on *Time-Saver Standards for Interior Design and Space Planning* (DeChiara, Panero & Zelnik, 2001, pp. 61–90). Rather than measuring all arbitrary pairwise distances, rules follow a strict 5-step sequence:
1. **Identify Spatial Relationship:** Determine functional roles (living vs dining, seating vs table, walking path).
2. **Check Applicability Preconditions:** Only evaluate pairs that represent functional interactions (e.g., sofa opposite coffee table). Flat against-wall placements for L1 are suppressed to prevent false positives.
3. **Measure Clearance:** Compute orthogonal Euclidean edge-to-edge distance.
4. **Compare Against Thresholds:** Classify into `RED` (violation), `YELLOW` (tight/warning), or `GREEN` (comfortable).
5. **Return Status:** Non-applicable combinations return `N/A` and are excluded from violation counts.

### Rule Specifications

| Code | Rule Name | Category | RED (Violation) | YELLOW (Warning) | GREEN (Clear) | Anthropometric Basis |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **L1** | General Living Circulation | Living | $< 76\,\text{cm}$ | $76 - 90\,\text{cm}$ | $\ge 91\,\text{cm}$ | Single-person passage between seating/cabinet pieces (wall-backed pieces excluded). |
| **L2** | Sofa to Coffee Table Legroom | Living | $< 35\,\text{cm}$ | $35 - 44\,\text{cm}$ | $\ge 45\,\text{cm}$ | Seated knee and legroom clearance to low center surface. |
| **L3** | Conversation Seating Distance | Living | $< 45\,\text{cm}$ | $45 - 59\,\text{cm}$ | $\ge 60\,\text{cm}$ | Minimum space between opposing conversational seating pieces. |
| **L4** | Main Traffic Path | Living | $< 61\,\text{cm}$ | $61 - 75\,\text{cm}$ | $\ge 76\,\text{cm}$ | Central corridor passage between primary entry and bedroom areas. |
| **L5** | Living-Dining Transition | Living | $< 91\,\text{cm}$ | *N/A (Binary)* | $\ge 91\,\text{cm}$ | Clear opening width between living zone and dining room perimeter. |
| **D1** | Dining Table to Wall | Dining | $< 91\,\text{cm}$ | $91 - 106\,\text{cm}$ | $\ge 107\,\text{cm}$ | Space to push chair back and walk behind seated diner. |
| **D2** | Chair Pull-Out Depth | Dining | $< 50\,\text{cm}$ | $50 - 60\,\text{cm}$ | $\ge 61\,\text{cm}$ | Depth required to pull chair out from table and sit comfortably. |
| **D3** | Dining Service Passage | Dining | $< 91\,\text{cm}$ | $91 - 106\,\text{cm}$ | $\ge 107\,\text{cm}$ | Unobstructed route behind seated diner for serving and circulation. |
| **D4** | Seated Diner Clearance | Dining | $< 91\,\text{cm}$ | *N/A (Binary)* | $\ge 91\,\text{cm}$ | Clearance between seated dining chair back and opposing furniture. |
| **D5** | Table to Buffet / Cabinet | Dining | $< 107\,\text{cm}$ | $107 - 121\,\text{cm}$ | $\ge 122\,\text{cm}$ | Access to open drawers/doors with diner seated at table. |

### Priority Ranking & Remediation Formula

Violations are prioritized using their **Spatial Impact** and **Severity Weight**:

$$\text{Priority Score} = \text{Severity Weight} \times \text{Spatial Impact}$$

Where:
- $\text{Severity Weight} = 3$ for `RED` violations; $1$ for `YELLOW` warnings.
- $\text{Spatial Impact} = \text{Shortfall Distance (cm)} \times \text{Affected Edge Length (cm)}$.
- $\text{Shortfall Distance} = \text{Required Distance} - \text{Measured Distance}$.

**Remediation Recommendation:**
$$\text{Fix Distance} = (\text{Required Distance} - \text{Measured Distance}) + 5\,\text{cm buffer}$$

---

## Project Directory Structure

```text
habi3d-project/
├── public/                     # Static public assets
├── src/
│   ├── ar/                     # WebXR Augmented Reality modules
│   │   ├── ARMeasureSession.tsx   # Two-tap AR measurement tool
│   │   ├── ClearanceOverlay.tsx   # AR spatial clearance bounding visualizer
│   │   ├── CorrectionArrow.tsx    # Directional AR remediation arrow
│   │   ├── calibration.ts         # Single-tap corner anchor transformation math
│   │   ├── overlayRenderer.tsx    # WebXR Three.js overlay rendering
│   │   └── shapeLibrary.ts        # Three.js AR geometry generators
│   │
│   ├── components/             # Reusable UI & canvas components
│   │   ├── BackIcon.tsx           # Glassmorphic vector SVG back button
│   │   ├── ClearanceMeter.tsx     # Three-color band clearance bar glyph
│   │   ├── CondoFloorPlan.tsx     # Interactive SVG 2D floor plan with drag & guides
│   │   ├── DollhouseFloorPlan.tsx # Procedural 3D condominium unit walls & slabs
│   │   ├── DollhouseFurniture.tsx # Dimension-accurate 3D furniture models
│   │   ├── DownloadReportButton.tsx# PDF download action trigger
│   │   ├── ErrorBoundary.tsx      # Application error boundary
│   │   ├── FloorPlan2D.tsx        # Legacy 2D canvas renderer (retained)
│   │   ├── PlanSandbox.tsx        # Experimental layout sandbox
│   │   ├── Spinner.tsx            # Accessible loading spinner
│   │   ├── StatusRow.tsx          # Clearance status list item component
│   │   ├── ThreeDLayoutPreview.tsx# Three.js Canvas container with OrbitControls
│   │   ├── findingText.ts         # Human-readable violation text generator
│   │   ├── floorPlanDrag.ts       # Drag physics, snapping, boundaries & raycasts
│   │   ├── floorPlanGeometry.ts   # Metric coordinate projection helpers
│   │   ├── gridOverlay.ts         # A1-F8 metric wayfinding grid generator
│   │   ├── pdfReport.ts           # Client-side jsPDF multi-page vector report engine
│   │   ├── previewMove.ts         # Ghost coordinate preview utilities
│   │   ├── statusVocabulary.ts    # Constructive affirmative reporting terminology
│   │   └── tokens/                # Visual design tokens (colors, radiuses, fonts)
│   │
│   ├── data/                   # Architectural models & metadata
│   │   ├── condoLayout.ts         # Mulberry Place 2BR room coordinates & boundaries
│   │   └── roomData.ts            # Unit dimensions and metadata
│   │
│   ├── engine/                 # Core clearance & spatial analysis engines
│   │   ├── clearance.ts           # Pairwise clearance evaluation & priority ranking
│   │   ├── clearanceTestCases.ts  # Verification suite for clearance rules
│   │   ├── ruleGuidance.ts        # Actionable "DO THIS" recommendation texts
│   │   ├── rules.ts               # Codified 10 interior design rule definitions
│   │   ├── violationKey.ts        # Deterministic finding identification keys
│   │   └── walkways.ts            # Main entry-to-bedroom corridor obstruction engine
│   │
│   ├── screens/                # Active application screens
│   │   ├── EntryScreen.tsx        # High-impact landing page with branded gradient
│   │   ├── AuthScreen.tsx         # Username authentication & session resume modal
│   │   ├── FurnitureInputScreen.tsx # Catalog input, dimensioning & chair quantity
│   │   ├── PositionMapScreen.tsx  # WebXR anchor calibration & floor hit-test placement
│   │   ├── WorkspaceScreen.tsx    # 2D interactive plan, live readouts, tabs & tools
│   │   ├── ThreeDPreviewScreen.tsx# Read-only 3D dollhouse perspective screen
│   │   ├── ReportScreen.tsx       # Affirmative evaluation summary & PDF trigger
│   │   ├── AnalysisScreen.tsx     # Legacy standalone analysis screen
│   │   ├── RecommendationScreen.tsx # Legacy standalone recommendation screen
│   │   └── PlaceholderScreen.tsx  # Fallback routing placeholder
│   │
│   ├── stores/                 # Zustand state stores
│   │   ├── furnitureStore.ts      # Active furniture array, catalog & mutations
│   │   ├── sessionStore.ts        # Auth user, screen routing & previousScreen tracking
│   │   ├── useAutosaveLayout.ts   # Debounced Supabase autosave hook
│   │   └── violationStore.ts      # Clearance findings, space scores & resolved state
│   │
│   ├── types/                  # TypeScript interface definitions
│   │   └── index.ts               # Screens, furniture items, rules, and violations
│   │
│   ├── utils/                  # General utility helpers
│   │   ├── floorPlan.ts           # 2D canvas drawing utility
│   │   └── furnitureValidation.ts # Boundary dimension validation guards
│   │
│   ├── App.css                 # Application-wide styling & glassmorphism
│   ├── App.tsx                 # Root application screen router
│   ├── index.css               # Base CSS resets and font variables
│   ├── main.tsx                # React DOM root entry point
│   └── supabase.ts             # Supabase client, auth helpers & session storage
│
├── CODEBASE_STATUS.md          # Comprehensive architectural reference & test logs
├── package.json                # Project dependencies and script configurations
├── tsconfig.json               # TypeScript compiler configuration
└── vite.config.ts              # Vite configuration
```

---

## Changelog & System Evolution

### September 30, 2026: Combined Living + Dining Boundary Directional Gap Readouts
- **Architectural Raycast Fix (`floorPlanDrag.ts`, `condoLayout.ts`):** Fixed live 4-way directional gap compass badges. Previously, boundary rays were checked against the entire $5.10\,\text{m} \times 8.80\,\text{m}$ unit envelope, causing false clearances across the kitchen and bedroom partitions. The system now computes the geometric union of the active Living + Dining rooms, cancelling the internal divider and strictly terminating at interior partition walls (Bedroom $Z = 3.40\,\text{m}$, Kitchen/Bathroom $X = 2.60\,\text{m}$) and exterior perimeters.

### September 17, 2026: 3D State Preservation, Shared Boundary Fix & Confirmed Delete Modal
- **State Preservation Guard (`sessionStore.ts`, `WorkspaceScreen.tsx`):** Added `previousScreen` tracking to `sessionStore`. Returning to 2D from the 3D preview bypasses the mount-time normalization and room-packing pipeline, preserving user-edited coordinates byte-for-byte.
- **Shared Room Boundary in 3D (`DollhouseFloorPlan.tsx`):** Excluded the internal divider between Living and Dining from 3D wall mesh generation and replaced it with a floor-level strip.
- **Accessible Delete Confirmation (`WorkspaceScreen.tsx`):** Added an accessible confirmation dialog (**Delete Furniture?**) to prevent accidental deletions while keeping full 50-step undo restoration.

### September 16, 2026: Read-Only 3D Dollhouse Layout Preview
- **3D Dollhouse Screen (`ThreeDPreviewScreen.tsx`, `ThreeDLayoutPreview.tsx`):** Introduced a read-only 3D view rendering the Mulberry Place 2BR layout directly from `CONDO_ROOMS` with low exterior walls and room partitions.
- **Dimension-Accurate Furniture Models (`DollhouseFurniture.tsx`):** Procedural 3D models for sofas, tables, chairs, cabinets, and desks that mirror exact stored centimeter dimensions and rotations.
- **Responsive Camera Framing:** Integrated `OrbitControls` with separate portrait and landscape viewport offsets for mobile ergonomics.

### September 14, 2026: Category-Aware AR Spawning, Dining Chair Batch Replication & WebXR Stability
- **Category-Aware Placement (`furnitureStore.ts`, `PositionMapScreen.tsx`):** Automated room assignment based on item category (`'dining'` vs `'living'`), preventing dining items from spawning in the living room.
- **Batch Chair Replication (`FurnitureInputScreen.tsx`, `PositionMapScreen.tsx`):** Added a dining chair quantity stepper (1–8 chairs). Users place one chair archetype in AR, which automatically replicates into $N$ distinct items arranged in a 2-column offset grid upon confirmation.
- **Android WebXR Crash Fix:** Removed `planeDetection: true` from `createXRStore()` to resolve driver-level crashes on Android Chrome devices.
- **Vector Back Button UI (`BackIcon.tsx`):** Replaced legacy unicode arrows across all screens with a glassmorphic SVG vector component.

### September 12, 2026: Clearance Rules Engine Revamp — Contextual Applicability Model
- **Anthropometric Model (`clearance.ts`, `rules.ts`):** Sourced thresholds from *Time-Saver Standards for Interior Design* (DeChiara et al., 2001).
- **Contextual Preconditions:** Suppressed false-positive wall checks for furniture placed against walls (Rule L1) and eliminated zero-width yellow thresholds on binary rules (L5, D4).
- **Spatial Impact Formulation:** Codified the weighted impact formula ($S = VSW \times \text{Shortfall} \times \text{Edge Length}$).

### September 10, 2026: Soft Collisions, Overlap Warnings & Architectural Confinement
- **Soft Collision Math (`floorPlanDrag.ts`):** Replaced hard drag rollbacks with soft overlap warnings (`⚠️ Notice: Furniture pieces are overlapping`), allowing residents to freely adjust pieces while the clearance engine detects $0\,\text{cm}$ gaps.
- **Strict Bedroom, Kitchen & Bathroom Confinement:** Enforced absolute hard barriers at the bedroom divider ($Z = 3.40\,\text{m}$) and kitchen/bathroom boundary ($X = 2.60\,\text{m}$), rejecting invalid drops with instant rollback.
- **Single-Tap Room Entry Corner Anchor Alignment:** Streamlined AR placement by replacing the cumbersome 2-point calibration with a single tap at the unit's entry door corner.
- **Removed Obsolete UI:** Purged the on-screen 4-way D-Pad and Reset button in favor of direct dragging and the 50-step undo stack.

### September 1–7, 2026: Main Walkway Obstruction Engine & Empathetic Reporting Vocabulary
- **Walkway Obstruction Alerts (`walkways.ts`, `WorkspaceScreen.tsx`):** Geometric corridor tracking ($X \in [2.15, 2.95]\,\text{m}$) with real-time toast alerts on obstruction.
- **Empathetic Reporting Reframe (`ReportScreen.tsx`, `statusVocabulary.ts`):** Replaced deficit terminology with constructive guidance (*"Extra space suggested"* instead of *"Needs attention"*; *"You made N spots more comfortable"*).

### August 2026: Authentication Overhaul, Supabase Layout Autosave & UI Modernization
- **Streamlined Auth:** Removed guest mode; introduced username auth mapped to Supabase with debounced layout autosave (`useAutosaveLayout`) and session resume capability.
- **Visual Modernization:** Added frosted glassmorphism, brand gradient typography, and custom design tokens across all views.

---

## Environment Configuration & Setup

### Prerequisites

- **Node.js:** v18.0.0 or higher
- **Package Manager:** `npm` (v9+)
- **Mobile Device (for AR):** Android device running Google Chrome with Google Play Services for AR (ARCore) installed.

### Environment Variables

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Installation

```bash
# Clone the repository
git clone https://github.com/capDMCA/Habi3D-Project.git
cd Habi3D-Project

# Install dependencies
npm install

# Start local development server
npm run dev
```

### Build & Lint

```bash
# Type check and production build
npm run build

# Run ESLint checks
npm run lint
```

---

## Testing & WebXR Verification

1. **Local Desktop Testing:**
   - Launch `npm run dev` and open `http://localhost:5173`.
   - Log in with any username (e.g., `resident1`).
   - Add furniture items in `FurnitureInputScreen` (e.g., 1 Sofa, 1 Dining Table, 4 Dining Chairs).
   - In `PositionMapScreen`, click **Place in room** (desktop fallback simulates coordinates) or confirm items.
   - In `WorkspaceScreen`, drag pieces across the floor plan, inspect directional gap compass badges, test walkway corridor notifications, toggle into the 3D dollhouse preview, and export the PDF report.

2. **WebXR AR Device Testing (Android Chrome):**
   - WebXR requires **HTTPS**. Test using the deployed production URL (e.g., on Vercel) or forward your local port over HTTPS (e.g., via `ngrok` or Chrome remote debugging).
   - Open Chrome on your Android device and navigate to the HTTPS URL.
   - Log in and proceed to **Position Furniture**.
   - Tap **Place in room** to launch the WebXR AR session.
   - Tap the room's physical entrance corner when prompted: `"📍 Tap the room entry corner to align"`.
   - Aim the device at the floor to track the semi-transparent ghost mesh, tap to lock position, adjust the yaw slider, and confirm.
   - Verify that dining chairs batch-replicate into distinct, non-overlapping items upon returning to the 2D workspace.
