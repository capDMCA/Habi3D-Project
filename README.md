# Habi3D

Habi3D is a Web-based Augmented Reality application for furniture spatial clearance analysis in Philippine condominium units. It is built as a thesis project focused on 2-bedroom units at Mulberry Place, Acacia Estates, Taguig City.

The app is a priority-ranked sequential recommendation tool. It digitizes existing furniture, maps furniture at its current real-world position, checks clearance rules, visualizes spatial violations in AR, and presents recommended fixes one step at a time.

## Core Purpose

Habi3D is not a design-from-scratch tool. It analyzes an existing living/dining layout and answers:

- Which furniture items violate interior clearance standards?
- Which violations should be fixed first?
- How far and in what direction should the user move each item?
- How does the layout improve after following recommendations?

## Tech Stack

- React + TypeScript + Vite
- Zustand for app state
- Three.js for geometry and spatial calculations
- `@react-three/fiber` for Three.js rendering in React
- `@react-three/xr` for WebXR AR sessions
- `@react-three/drei` for AR text labels
- Supabase for survey and score storage
- jsPDF for downloadable reports
- Vercel for HTTPS deployment

## Current Feature Set

### Increment 1: WebXR Foundation

- Starts a WebXR AR session on Android Chrome
- Uses `@react-three/xr` with a connected Three.js canvas
- Detects floor planes through hit testing
- Shows a green hit-test reticle on the detected floor
- Includes an AR diagnostic/demo screen

### Increment 2: Furniture Shape Library and AR Measurement

- Supports four furniture shapes:
  - Rectangle
  - L-shape
  - Round
  - Oval
- Converts user dimensions from centimeters to meters for Three.js
- Returns both visual geometry and clearance bounding boxes
- Measures furniture length and width using two AR floor taps
- Allows manual dimension entry as fallback
- Height remains manually entered

### Increment 3: Position Mapping

- Lists furniture items that still need real-world positions
- Shows a ghost mesh that follows the AR floor hit-test cursor
- Lets users tap to lock the mesh position
- Stores `posX` and `posZ` in WebXR world meters
- Stores `rotationY` in radians
- Renders previously placed furniture while mapping new items

### Increment 4: Clearance Analysis

- Runs spatial clearance analysis using 10 locked clearance rules
- Computes item-to-item and item-to-wall gaps
- Classifies gaps as `RED`, `YELLOW`, or `GREEN`
- Computes Priority Score:

```text
Priority Score = Violation Severity Weight x Spatial Impact
Spatial Impact = Shortfall Distance x Affected Edge Length
```

- Sorts violations by descending Priority Score
- Shows a Spatial Clearance Visualization Overlay in AR
- Draws a 2D floor plan using Canvas
- Saves `score_before` to Supabase when a participant is active

### Increment 5: Sequential Recommendations and Evaluation

- Shows one violation at a time
- Displays the rule, furniture item, measured gap, required gap, fix distance, and Priority Score
- Renders an AR correction arrow from the furniture item toward the recommended direction
- Supports `Done - I moved it` and `Skip this step`
- Tracks resolved recommendation steps
- Shows final SUS and post-session survey
- Saves SUS, post-survey, and space utilization score updates to Supabase
- Generates a downloadable PDF report

## Clearance Rules

The app uses 10 clearance rules based on interior design references.

### Living Room

- `L1` General circulation
- `L2` Sofa to coffee table legroom
- `L3` Secondary circulation
- `L4` Main traffic path
- `L5` Conversation area depth

### Dining Room

- `D1` Table to wall
- `D2` Chair pull-out and access
- `D3` Passage behind seated person
- `D4` Walking past seated person
- `D5` Minimum passage

## Main User Flow

1. Start session
2. Choose 2-bedroom unit type and confirm unit dimensions
3. Add furniture category, shape, and dimensions
4. Verify living/dining dimensions
5. Map each furniture item in AR
6. Analyze layout
7. Review Spatial Clearance Visualization Overlay
8. Follow priority-ranked recommendations one by one
9. Complete end survey
10. Download PDF report

## Key Folders

```text
src/
  ar/
    ARMeasureSession.tsx
    ClearanceOverlay.tsx
    CorrectionArrow.tsx
    shapeLibrary.ts

  engine/
    clearance.ts
    clearanceTestCases.ts
    rules.ts

  screens/
    EntryScreen.tsx
    UnitSetupScreen.tsx
    FurnitureInputScreen.tsx
    DimensionVerificationScreen.tsx
    PositionMapScreen.tsx
    AnalysisScreen.tsx
    RecommendationScreen.tsx
    EndSurveyScreen.tsx

  stores/
    furnitureStore.ts
    sessionStore.ts
    violationStore.ts

  utils/
    floorPlan.ts
    pdfExport.ts
```

## Environment Variables

Create `.env.local` with:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Install and Run

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

## Android WebXR Testing

Use Android Chrome with Google Play Services for AR installed. WebXR requires HTTPS, so test through the deployed Vercel URL for full AR behavior.

Recommended test path:

1. Open the Vercel HTTPS URL on Android Chrome.
2. Start a session.
3. Confirm unit type and dimensions.
4. Add at least two furniture items.
5. Use AR measurement or manual dimensions.
6. Map furniture positions in AR.
7. Run analysis.
8. Confirm overlay zones appear between furniture edges, not at item centers.
9. Follow recommendation steps.
10. Submit evaluation and download the PDF report.

## Supabase Tables Used

- `participants`
- `sus_responses`
- `post_survey_responses`
- `space_utilization_scores`

The app can still run locally without an active participant ID, but database inserts require valid Supabase environment variables and table access.

## Notes

- Furniture positions are stored in WebXR world meters.
- Furniture dimensions are stored in centimeters.
- The clearance engine currently uses axis-aligned bounding boxes.
- L-shape clearance uses an approximate rectangular bounding box by design.
- Rotation is stored visually and for later use, but clearance math currently ignores rotated bounding boxes.
- The overlay is called the Spatial Clearance Visualization Overlay.
