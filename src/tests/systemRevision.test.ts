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

console.log('\n=======================================================');
console.log('ALL SYSTEM REVISION AUTOMATED TESTS PASSED SUCCESSFULLY!');
console.log('=======================================================');
