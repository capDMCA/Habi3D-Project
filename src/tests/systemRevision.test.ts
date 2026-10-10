function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) throw new Error(message || 'Assertion failed');
}
assert.equal = function <T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(`${message ? message + ': ' : ''}Expected ${String(actual)} to equal ${String(expected)}`);
  }
};
assert.notEqual = function <T>(actual: T, expected: T, message?: string) {
  if (actual === expected) {
    throw new Error(`${message ? message + ': ' : ''}Expected ${String(actual)} not to equal ${String(expected)}`);
  }
};
assert.ok = function (condition: unknown, message?: string): asserts condition {
  if (!condition) throw new Error(message || 'Expected truthy value');
};

import { CONDO_ROOMS, getRoomForCategory } from '../data/condoLayout.ts';
import { getDefaultRoomPosition } from '../stores/furnitureStore.ts';
import { runClearanceAnalysis } from '../engine/clearance.ts';
import { CLEARANCE_RULES } from '../engine/rules.ts';
import { ruleGuidance } from '../engine/ruleGuidance.ts';
import { buildWorkspaceRecommendations } from '../engine/recommendations.ts';
import { canPlace, roomIdForItem } from '../components/floorPlanDrag.ts';
import { validatePlacement, AR_SENSOR_LIMITATIONS } from '../ar/placementValidation.ts';
import { applyCalibration, type CalibrationTransform } from '../ar/calibration.ts';
import { runAllClearanceTestCases } from '../engine/clearanceTestCases.ts';
import type { FurnitureItem } from '../types/index.ts';

console.log('--- Starting Habi3D System Revision Automated Tests ---');

// ============================================================================
// TEST SUITE 1: Whole-Condo Room Support & Room Model
// ============================================================================
console.log('1. Testing Whole-Condo Room Model...');

const EXPECTED_ROOM_IDS = [
  'balcony',
  'bedroom1',
  'bedroom2',
  'living',
  'storage',
  'bathroom',
  'dining',
  'kitchen',
];

assert.equal(
  CONDO_ROOMS.length,
  8,
  `Condo must support all 8 rooms, found ${CONDO_ROOMS.length}`,
);

for (const id of EXPECTED_ROOM_IDS) {
  const room = CONDO_ROOMS.find((r) => r.id === id);
  assert.ok(room, `Room ${id} must be defined in CONDO_ROOMS`);
  assert.ok(room.width > 0 && room.height > 0, `Room ${id} must have positive dimensions`);
  assert.ok(room.validationLevel, `Room ${id} must declare validationLevel`);
}

// Check validation levels
const living = CONDO_ROOMS.find((r) => r.id === 'living')!;
const dining = CONDO_ROOMS.find((r) => r.id === 'dining')!;
const bed1 = CONDO_ROOMS.find((r) => r.id === 'bedroom1')!;
const bed2 = CONDO_ROOMS.find((r) => r.id === 'bedroom2')!;
const kitchen = CONDO_ROOMS.find((r) => r.id === 'kitchen')!;
const bath = CONDO_ROOMS.find((r) => r.id === 'bathroom')!;

assert.equal(living.validationLevel, 'full', 'Living room must have full validation');
assert.equal(dining.validationLevel, 'full', 'Dining room must have full validation');
assert.equal(bed1.validationLevel, 'bedroom', 'Bedroom 1 must have bedroom validation');
assert.equal(bed2.validationLevel, 'bedroom', 'Bedroom 2 must have bedroom validation');
assert.equal(kitchen.validationLevel, 'limited', 'Kitchen must be designated limited analysis');
assert.equal(bath.validationLevel, 'limited', 'Bathroom must be designated limited analysis');
assert.ok(kitchen.validationNote.length > 0, 'Kitchen must have validation note');

console.log('  ✓ All 8 rooms defined with explicit dimensions and truthful validation levels.');

// ============================================================================
// TEST SUITE 2: Furniture Categorization & Room Assignment
// ============================================================================
console.log('2. Testing Furniture-to-Room Assignment...');

assert.equal(getRoomForCategory('bed', 'Queen Bed'), 'bedroom1');
assert.equal(getRoomForCategory('bed', 'Single Bed Kids'), 'bedroom2');
assert.equal(getRoomForCategory('wardrobe', 'Wardrobe Closet'), 'bedroom1');
assert.equal(getRoomForCategory('work_desk', 'Study Desk'), 'bedroom2');
assert.equal(getRoomForCategory('sofa', '3-Seater Sofa'), 'living');
assert.equal(getRoomForCategory('dining_table', 'Dining Table'), 'dining');

const bedPos = getDefaultRoomPosition('bed', 'Queen Bed');
assert.equal(bedPos.roomId, 'bedroom1');
assert.ok(bedPos.posX >= 0 && bedPos.posX <= 5.1);
assert.ok(bedPos.posZ >= 0 && bedPos.posZ <= 3.4);

console.log('  ✓ Furniture categories correctly assign to bedroom, living, and dining zones.');

// ============================================================================
// TEST SUITE 3: 2D Floor Plan Boundary & Placement Validation
// ============================================================================
console.log('3. Testing 2D Floor Plan Boundaries & Placement...');

const testBed: FurnitureItem = {
  id: 'bed-1',
  label: 'Master Queen Bed',
  category: 'bed',
  shape: 'rectangle',
  lengthCm: 160,
  widthCm: 200,
  heightCm: 100,
  posX: 3.85,
  posZ: 2.2,
  rotationY: 0,
  roomId: 'bedroom1',
};

// Placing in Bedroom 1 must be permitted (not blocked)
const canPlaceInBedroom = canPlace(testBed, [testBed]);
assert.ok(canPlaceInBedroom, 'canPlace must permit valid placement inside Bedroom 1');

// Out of condo bounds check
const outOfBoundsItem: FurnitureItem = {
  ...testBed,
  posX: 6.0, // outside 5.1m unit width
  posZ: 2.0,
};
assert.equal(canPlace(outOfBoundsItem, []), false, 'canPlace must reject items outside condo boundary');

// Room ID detection from coordinates
assert.equal(roomIdForItem(testBed), 'bedroom1', 'roomIdForItem must identify bedroom1 from coords');

console.log('  ✓ Furniture placement allowed across all rooms within condo unit boundaries.');

// ============================================================================
// TEST SUITE 4: Isolated Clearance Rules & Bedroom Rules B1 & B2
// ============================================================================
console.log('4. Testing Clearance Rules (Isolation & Bedroom Rules B1/B2)...');

// Verify rules B1 and B2 exist in rule catalog
const ruleB1 = CLEARANCE_RULES.find((r) => r.id === 'B1');
const ruleB2 = CLEARANCE_RULES.find((r) => r.id === 'B2');
assert.ok(ruleB1, 'Rule B1 must exist');
assert.ok(ruleB2, 'Rule B2 must exist');
assert.equal(ruleB1.category, 'bedroom');
assert.equal(ruleB2.category, 'bedroom');
assert.ok(ruleGuidance('B1'), 'Guidance for B1 must exist');
assert.ok(ruleGuidance('B2'), 'Guidance for B2 must exist');

// Test B1: Bed side clearance
// Bedroom 1 spans x: 260..510cm (2.6..5.1m), z: 100..340cm (1.0..3.4m).
// A bed of length 120cm placed at posX = 3.30m has bounds:
// minX = 3.30 - 0.60 = 2.70m (10cm from west wall at x = 2.60m).
// 10cm is < 61cm, which is a RED violation for Rule B1!
const tightBed: FurnitureItem = {
  id: 'bed-test',
  label: 'Bedroom Bed',
  category: 'bed',
  shape: 'rectangle',
  lengthCm: 120,
  widthCm: 190,
  heightCm: 90,
  posX: 3.30,
  posZ: 2.2,
  rotationY: 0,
  roomId: 'bedroom1',
};

// Sofa in living room (x: 1.2m, z: 4.8m)
const livingSofa: FurnitureItem = {
  id: 'sofa-test',
  label: 'Living Sofa',
  category: 'sofa',
  shape: 'rectangle',
  lengthCm: 200,
  widthCm: 85,
  heightCm: 80,
  posX: 1.2,
  posZ: 4.8,
  rotationY: 0,
  roomId: 'living',
};

const fullAnalysis = runClearanceAnalysis([tightBed, livingSofa], 510, 880);

// Bedroom rules must fire on tight bed
const bedViolations = fullAnalysis.violations.filter((v) => v.furnitureId === 'bed-test');
assert.ok(bedViolations.length > 0, 'Tight bed must produce clearance violation');
assert.equal(bedViolations[0].ruleCode, 'B1', 'Violation must be Rule B1 (Bed Access & Circulation)');
assert.equal(bedViolations[0].classification, 'RED', '10cm clearance must be RED classification');
assert.equal(bedViolations[0].roomId, 'bedroom1', 'Violation must attach bedroom1 roomId');

// Cross-room isolation check: living room rules (L1-L3) must NOT pair living sofa with bedroom bed!
const crossRoomViolations = fullAnalysis.violations.filter(
  (v) => (v.furnitureId === 'bed-test' && v.itemBId === 'sofa-test') ||
         (v.furnitureId === 'sofa-test' && v.itemBId === 'bed-test'),
);
assert.equal(
  crossRoomViolations.length,
  0,
  'Living room rules must not apply across rooms between living sofa and bedroom bed',
);

console.log('  ✓ Bedroom rules B1/B2 verified; cross-room rule isolation confirmed.');

// ============================================================================
// TEST SUITE 5: Recommendations, Directional Correction & Re-Analysis
// ============================================================================
console.log('5. Testing Recommendations, Correction Direction & Re-Analysis...');

const recommendations = buildWorkspaceRecommendations(
  fullAnalysis.violations,
  [tightBed, livingSofa],
  [],
);

assert.ok(recommendations.length > 0, 'Violations must generate workspace recommendations');
const bedRec = recommendations.find((r) => r.furnitureId === 'bed-test');
assert.ok(bedRec, 'Recommendation for bed-test must exist');
assert.equal(bedRec.roomLabel, 'Bedroom 1 (Master)', 'Recommendation must identify Bedroom 1');
assert.ok(bedRec.problemReason.length > 0, 'Problem reason must explain why current arrangement is problematic');
assert.ok(bedRec.actionText.length > 0, 'Action text must provide actionable advice');
assert.ok(bedRec.fixDirectionLabel.toLowerCase().includes('east'), 'Directional correction must suggest East away from west wall');
assert.ok(bedRec.fixDirectionCm > 0, 'Suggested adjustment distance must be positive');

// Re-analysis after adjusting furniture:
// Move bed to room center posX = 3.85m: both sides have 65cm clearance (> 61cm)
const adjustedBed: FurnitureItem = {
  ...tightBed,
  posX: 3.85,
};

const reAnalysis = runClearanceAnalysis([adjustedBed, livingSofa], 510, 880);
const adjustedBedViolations = reAnalysis.violations.filter((v) => v.furnitureId === 'bed-test');
const redBedViolations = adjustedBedViolations.filter((v) => v.classification === 'RED');
assert.equal(redBedViolations.length, 0, 'Adjusted bed must resolve RED violation upon re-analysis');

console.log('  ✓ Recommendation generation, directional arrow vectors, and re-analysis resolution verified.');

// ============================================================================
// TEST SUITE 6: AR Placement & Sensor Caveats
// ============================================================================
console.log('6. Testing AR Placement Validation & Sensor Caveats...');

// Sensor accuracy caveats check
assert.equal(AR_SENSOR_LIMITATIONS.isPhysicalObstacleDetectionSupported, false);
assert.equal(AR_SENSOR_LIMITATIONS.virtualGeometryValidationOnly, true);
assert.ok(AR_SENSOR_LIMITATIONS.measurementAccuracy.includes('Assistive Estimate'));

// AR coordinate transform
const dummyCalibration: CalibrationTransform = {
  originX: 0,
  originZ: 0,
  cosTheta: 1,
  sinTheta: 0,
};

const blueprintPoint = applyCalibration({ x: 3.85, z: 2.2 }, dummyCalibration);
assert.equal(blueprintPoint.x, 3.85);
assert.equal(blueprintPoint.z, 2.2);

// AR Placement Validation for Bedroom item in Bedroom
const arValidationBed = validatePlacement({
  candidateItem: adjustedBed,
  blueprintPosition: { x: 3.85, z: 2.2 },
  rotationY: 0,
  allExistingItems: [livingSofa],
  calibration: null,
});

assert.notEqual(
  arValidationBed.status,
  'invalid',
  'AR placement of bed inside Bedroom 1 must not be rejected',
);
assert.equal(arValidationBed.roomName, 'Bedroom 1 (Master)');

// AR Placement Validation for Bathroom (Sanitary zone)
const sofaInBathroom: FurnitureItem = {
  ...livingSofa,
  posX: 3.5,
  posZ: 5.2, // inside bathroom
};

const arValidationBath = validatePlacement({
  candidateItem: sofaInBathroom,
  blueprintPosition: { x: 3.5, z: 5.2 },
  rotationY: 0,
  allExistingItems: [],
  calibration: null,
});

assert.equal(arValidationBath.status, 'invalid', 'Placing living sofa in bathroom must be invalid');
assert.equal(arValidationBath.title, 'Bathroom area');

console.log('  ✓ AR placement validation and coordinate calibration verified.');

// ============================================================================
// TEST SUITE 7: Baseline Clearance Test Cases & Zero Regressions
// ============================================================================
console.log('7. Testing Baseline Clearance Regression Cases...');
const baselineResults = runAllClearanceTestCases();
assert.ok(baselineResults.allPassed, 'All baseline clearance test cases must continue passing without regression');
console.log('  ✓ All baseline clearance rules, priority rankings, and rotation cases passed with 0 regressions.');

// ============================================================================
// TEST SUITE 8: Expanded Catalog, Custom Shapes, Wall Mounting & Appliances
// ============================================================================
console.log('8. Testing Expanded Furniture Catalog, Shapes & Wall-Mounted Objects...');
import { CATALOG_PRESETS, CATALOG_DOMAINS } from '../data/furnitureCatalog.ts';
import { createFurnitureShape } from '../ar/shapeLibrary.ts';
import { projectItems } from '../components/floorPlanGeometry.ts';
import { overlappingItemIds, isVerticalOverlap } from '../components/floorPlanDrag.ts';

// 8.1 Catalog Domains and Presets Check
assert.ok(CATALOG_DOMAINS.length >= 8, 'Catalog must support all domains across the condo');
assert.ok(CATALOG_PRESETS.length >= 35, `Catalog must have comprehensive presets, found ${CATALOG_PRESETS.length}`);

// Check specific requested items exist in catalog
const requiredItems = [
  '3-Seater Sofa',
  'L-Shaped Sectional Sofa',
  'Armchair / Accent Chair',
  'Coffee Table (Rectangular)',
  'Coffee Table (Round)',
  'TV Stand / Media Console',
  'Television (Stand Mounted)',
  'Bookshelf / Display Shelf',
  'Floor Lamp',
  'Decorative Floor Plant',
  'Queen Bed',
  'Double Bed',
  'Single Bed',
  'Wardrobe / Closet',
  'Bedroom Dresser',
  'Bedside Nightstand',
  'Full-Length Standing Mirror',
  'Study Desk',
  'Dining Table (Rectangular 6-Seater)',
  'Dining Table (Square 4-Seater)',
  'Dining Table (Round 4-Seater)',
  'Dining Table (Oval 6-Seater)',
  'Dining Chair',
  'Bar Table / High Top',
  'Bar Stool',
  'Sideboard / Buffet Cabinet',
  'Refrigerator (Two-Door)',
  'Washing Machine (Front-Load)',
  'Microwave Oven',
  'Water Dispenser (Freestanding)',
  'Bathroom Vanity Unit',
  'Bathroom Storage Cabinet',
  'Laundry Basket / Hamper',
  'Shoe Rack',
  'Utility Shelf',
  'Electric Pedestal Fan',
  'Desk Fan (Compact)',
  'Wall-Mounted Air Conditioner',
  'Wall-Mounted Television',
  'Wall-Mounted Mirror',
];

for (const name of requiredItems) {
  const found = CATALOG_PRESETS.find((p) => p.label === name);
  assert.ok(found, `Catalog must include required preset: ${name}`);
  assert.ok(found.lengthCm > 0 && found.widthCm > 0 && found.heightCm > 0, `${name} must have positive dimensions`);
}

// 8.2 Category Room Mappings for New Items
assert.equal(getRoomForCategory('appliance', 'Refrigerator (Two-Door)'), 'kitchen');
assert.equal(getRoomForCategory('bathroom_fixture', 'Bathroom Vanity Unit'), 'bathroom');
assert.equal(getRoomForCategory('storage_rack', 'Shoe Rack'), 'storage');
assert.equal(getRoomForCategory('plant', 'Balcony Plant Pot'), 'balcony');
assert.equal(getRoomForCategory('mirror', 'Standing Mirror'), 'bedroom1');
assert.equal(getRoomForCategory('electrical', 'Electric Pedestal Fan'), 'living');
assert.equal(getRoomForCategory('armchair', 'Accent Armchair'), 'living');

// 8.3 Nonstandard Shapes & 3D Geometry
const rectShape = createFurnitureShape('rectangle', { lengthCm: 210, widthCm: 90, heightCm: 85 });
assert.ok(rectShape.geometry, 'Rectangle geometry must generate');
assert.equal(rectShape.boundingBox.widthM, 2.1);
assert.equal(rectShape.boundingBox.depthM, 0.9);

const roundShape = createFurnitureShape('round', { lengthCm: 110, widthCm: 110, heightCm: 75 });
assert.ok(roundShape.geometry, 'Round cylinder geometry must generate');
assert.equal(roundShape.boundingBox.widthM, 1.1);

const ovalShape = createFurnitureShape('oval', { lengthCm: 180, widthCm: 100, heightCm: 75 });
assert.ok(ovalShape.geometry, 'Oval cylinder geometry must generate');
assert.equal(ovalShape.boundingBox.widthM, 1.8);

const lShape = createFurnitureShape('l-shape', { lengthCm: 240, widthCm: 160, heightCm: 85 });
assert.ok(lShape.geometry, 'L-Shape merged geometry must generate');
assert.equal(lShape.boundingBox.widthM, 2.4);

// 8.4 Wall-Mounted vs Floor-Standing Height & Overlap Separation
const floorConsole: FurnitureItem = {
  id: 'tv-console',
  label: 'Media Console',
  category: 'tv_stand',
  shape: 'rectangle',
  lengthCm: 160,
  widthCm: 45,
  heightCm: 50,
  posX: 1.3,
  posZ: 4.0,
  rotationY: 0,
  roomId: 'living',
  placementType: 'floor',
};

const wallMountedTV: FurnitureItem = {
  id: 'wall-tv',
  label: 'Wall-Mounted Television',
  category: 'electrical',
  shape: 'rectangle',
  lengthCm: 125,
  widthCm: 10,
  heightCm: 72,
  posX: 1.3, // identical X/Z center directly above the floor console!
  posZ: 4.0,
  rotationY: 0,
  roomId: 'living',
  placementType: 'wall',
  mountHeightCm: 120, // mounted at 120cm elevation, above 50cm console
};

assert.equal(
  isVerticalOverlap(floorConsole, wallMountedTV),
  false,
  'Floor console (0-50cm) and Wall TV (120-192cm) must NOT overlap vertically',
);

const consoleOverlaps = overlappingItemIds(floorConsole, [floorConsole, wallMountedTV]);
assert.equal(
  consoleOverlaps.length,
  0,
  'Elevated wall-mounted TV must NOT trigger floor collision with console below it',
);

// Two floor items at same spot MUST overlap
const duplicateFloorItem: FurnitureItem = {
  ...floorConsole,
  id: 'console-dup',
};
const floorOverlaps = overlappingItemIds(floorConsole, [floorConsole, duplicateFloorItem]);
assert.equal(floorOverlaps.length, 1, 'Two floor items occupying same footprint must trigger collision overlap');

// 8.5 2D Plan Projections
const projected = projectItems([floorConsole, wallMountedTV, roundShape as unknown as FurnitureItem]);
assert.equal(projected[0].shape, 'rectangle');
assert.equal(projected[0].placementType, 'floor');
assert.equal(projected[1].placementType, 'wall');
assert.equal(projected[1].mountHeightCm, 120);

// 8.6 Clearance Isolation: Appliance in kitchen does not trigger bed/dining rules
const fridge: FurnitureItem = {
  id: 'fridge-1',
  label: 'Kitchen Refrigerator',
  category: 'appliance',
  shape: 'rectangle',
  lengthCm: 70,
  widthCm: 68,
  heightCm: 178,
  posX: 3.85,
  posZ: 7.5,
  rotationY: 0,
  roomId: 'kitchen',
};

const kitchenAnalysis = runClearanceAnalysis([fridge], 510, 880);
const badApplianceViolations = kitchenAnalysis.violations.filter(
  (v) => v.furnitureId === 'fridge-1' && (v.ruleCode === 'B1' || v.ruleCode === 'B2' || v.ruleCode.startsWith('D')),
);
assert.equal(
  badApplianceViolations.length,
  0,
  'Kitchen refrigerator must not trigger irrelevant bedroom or dining clearance rules',
);

console.log('  ✓ Catalog presets verified, nonstandard shapes generated, wall vs floor overlap validated.');

console.log('\n=======================================================');
console.log('ALL SYSTEM REVISION AUTOMATED TESTS PASSED SUCCESSFULLY!');
console.log('=======================================================');
