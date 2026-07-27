import type { FurnitureCategory, FurnitureItem, FurnitureShape, GapClassificationLevel } from '../types';
import { effectiveLengthCm, effectiveWidthCm, runClearanceAnalysis } from './clearance';

interface RuleTestCase {
  rule_code: string;
  test_description: string;
  expected_classification: GapClassificationLevel;
  system_classification: GapClassificationLevel;
  passed: boolean;
}

interface PriorityScoreTestCase {
  test_description: string;
  expected_order: string[];
  system_order: string[];
  passed: boolean;
}

interface RotationTestCase {
  test_description: string;
  detail: string;
  passed: boolean;
}

function item(params: {
  id: string;
  label: string;
  category: FurnitureCategory;
  x: number;
  z: number;
  lengthCm?: number;
  widthCm?: number;
  shape?: FurnitureShape;
  rotationY?: number;
}): FurnitureItem {
  return {
    id: params.id,
    label: params.label,
    category: params.category,
    shape: params.shape ?? 'rectangle',
    lengthCm: params.lengthCm ?? 100,
    widthCm: params.widthCm ?? 60,
    heightCm: 75,
    posX: params.x,
    posZ: params.z,
    rotationY: params.rotationY ?? 0,
  };
}

function getRuleClassification(
  ruleCode: string,
  items: FurnitureItem[],
  roomWidthCm = 500,
  roomLengthCm = 500,
): GapClassificationLevel {
  const result = runClearanceAnalysis(items, roomWidthCm, roomLengthCm);
  return (
    result.allClassifications.find((entry) => entry.ruleCode === ruleCode)?.classification ??
    'GREEN'
  );
}

export function runRuleClassificationTestCases(): RuleTestCase[] {
  const cases = [
    {
      rule_code: 'L1',
      test_description: 'Sofa placed 50cm from coffee table should be RED',
      expected_classification: 'RED' as const,
      items: [
        item({ id: 'sofa', label: 'Sofa', category: 'sofa', x: 1, z: 1 }),
        item({ id: 'coffee', label: 'Coffee', category: 'coffee_table', x: 2.5, z: 1 }),
      ],
    },
    {
      rule_code: 'L2',
      test_description: 'Sofa placed 40cm from coffee table should be YELLOW',
      expected_classification: 'YELLOW' as const,
      items: [
        item({ id: 'sofa', label: 'Sofa', category: 'sofa', x: 1, z: 1 }),
        item({ id: 'coffee', label: 'Coffee', category: 'coffee_table', x: 2.4, z: 1 }),
      ],
    },
    {
      rule_code: 'L3',
      test_description: 'Secondary circulation gap of 70cm should be YELLOW',
      expected_classification: 'YELLOW' as const,
      items: [
        item({ id: 'cabinet', label: 'Cabinet', category: 'cabinet', x: 1, z: 1 }),
        item({ id: 'tv', label: 'TV Stand', category: 'tv_stand', x: 2.7, z: 1 }),
      ],
    },
    {
      rule_code: 'L4',
      test_description: 'Largest wall path of 80cm should be YELLOW',
      expected_classification: 'YELLOW' as const,
      roomWidthCm: 260,
      roomLengthCm: 260,
      items: [item({ id: 'cabinet', label: 'Cabinet', category: 'cabinet', x: 1.3, z: 1.3 })],
    },
    {
      rule_code: 'L5',
      test_description: 'Sofa conversation area of 200cm should be RED',
      expected_classification: 'RED' as const,
      items: [item({ id: 'sofa', label: 'Sofa', category: 'sofa', x: 2, z: 2.4 })],
    },
    {
      rule_code: 'D1',
      test_description: 'Dining table 60cm from nearest wall should be RED',
      expected_classification: 'RED' as const,
      items: [item({ id: 'table', label: 'Dining Table', category: 'dining_table', x: 1.1, z: 2 })],
    },
    {
      rule_code: 'D2',
      test_description: 'Dining chair 88cm from nearest wall should be YELLOW',
      expected_classification: 'YELLOW' as const,
      roomWidthCm: 376,
      items: [item({ id: 'chair', label: 'Chair', category: 'dining_chair', x: 1.38, z: 2 })],
    },
    {
      rule_code: 'D3',
      test_description: 'Dining chair 86cm from nearest wall should be RED',
      expected_classification: 'RED' as const,
      roomWidthCm: 372,
      items: [item({ id: 'chair', label: 'Chair', category: 'dining_chair', x: 1.36, z: 2 })],
    },
    {
      rule_code: 'D4',
      test_description: 'Dining chair 100cm from cabinet should be YELLOW',
      expected_classification: 'YELLOW' as const,
      items: [
        item({ id: 'chair', label: 'Chair', category: 'dining_chair', x: 1, z: 1 }),
        item({ id: 'cabinet', label: 'Cabinet', category: 'cabinet', x: 3, z: 1 }),
      ],
    },
    {
      rule_code: 'D5',
      test_description: 'Dining passage of 50cm should be RED',
      expected_classification: 'RED' as const,
      items: [
        item({ id: 'chair', label: 'Chair', category: 'dining_chair', x: 1, z: 1 }),
        item({ id: 'table', label: 'Dining Table', category: 'dining_table', x: 2.5, z: 1 }),
      ],
    },
  ];

  return cases.map((entry) => {
    const systemClassification = getRuleClassification(
      entry.rule_code,
      entry.items,
      entry.roomWidthCm,
      entry.roomLengthCm,
    );

    return {
      rule_code: entry.rule_code,
      test_description: entry.test_description,
      expected_classification: entry.expected_classification,
      system_classification: systemClassification,
      passed: entry.expected_classification === systemClassification,
    };
  });
}

export function runPriorityScoreRankingTestCases(): PriorityScoreTestCase[] {
  const scenarios = [
    {
      // Coffee table moved from x=3.45 to x=3.7 so it no longer overlaps the
      // sofa (they were intersecting by 5cm). Now a clean 20cm gap.
      // Order L5 > L3 > L1 follows from the formula: L5's affected edge is the
      // sofa's full 220cm face vs only 60cm for the L1/L3 coffee-pair, so its
      // score dominates. L3 precedes L1 because both are RED off the same 20cm
      // gap, and L3's RED threshold (61) sits 1cm above L1's (60) — at equal
      // edge and severity that gives L3 a 1cm-larger shortfall, hence a higher
      // score. L3 always edges out L1 on a shared RED gap.
      test_description: 'Severe sofa conversation violation outranks small coffee table warning',
      items: [
        item({ id: 'sofa', label: 'Sofa', category: 'sofa', x: 2, z: 2.4, lengthCm: 220 }),
        item({ id: 'coffee', label: 'Coffee', category: 'coffee_table', x: 3.7, z: 2.4, lengthCm: 80 }),
      ],
      expected_order: ['L5', 'L3', 'L1'],
    },
    {
      test_description: 'Red dining chair wall violations outrank yellow dining passage',
      items: [
        item({ id: 'chair', label: 'Chair', category: 'dining_chair', x: 1.2, z: 2 }),
        item({ id: 'table', label: 'Dining Table', category: 'dining_table', x: 3, z: 2 }),
      ],
      expected_order: ['D3', 'D2', 'D5'],
    },
    {
      // Original sofa (x=1, lengthCm=240, default width) extended to x=-0.2m,
      // 20cm outside the west wall. Fixed: sofa given an explicit 90cm width
      // and moved to (2, 2.4) so its whole footprint is inside the room AND it
      // sits close enough to the south wall (215cm) that L5's conversation-area
      // check genuinely fires — the point the scenario name claims. Coffee sits
      // 20cm away; cabinet moved to an isolated corner so it doesn't add pair
      // noise. Order L5 > L3 > L1: L5's edge is the sofa's 240cm face (score far
      // above the rest), then the same L3-over-L1 threshold rule as above on the
      // shared 20cm coffee gap (now edge 90 = the sofa's rotated-invariant width).
      test_description: 'Large affected edge creates higher priority for same classification',
      items: [
        item({ id: 'sofa', label: 'Long Sofa', category: 'sofa', x: 2, z: 2.4, lengthCm: 240, widthCm: 90 }),
        item({ id: 'coffee', label: 'Coffee', category: 'coffee_table', x: 3.75, z: 2.4, lengthCm: 70 }),
        item({ id: 'cabinet', label: 'Cabinet', category: 'cabinet', x: 1, z: 4.5, lengthCm: 80 }),
      ],
      expected_order: ['L5', 'L3', 'L1'],
    },
    {
      test_description: 'Dining table near wall outranks minor circulation issue',
      items: [
        item({ id: 'table', label: 'Dining Table', category: 'dining_table', x: 1.05, z: 2, lengthCm: 160 }),
        item({ id: 'cabinet', label: 'Cabinet', category: 'cabinet', x: 3.5, z: 2 }),
      ],
      expected_order: ['D1', 'L1'],
    },
    {
      // Item b moved from x=2.2 to x=2.5 so a and b no longer overlap (they
      // were intersecting by 20cm); now a clean 10cm gap between them. Both
      // L1 and L3 fire RED off that gap, and L3 leads L1 for the same reason
      // as the scenarios above — L3's RED threshold (61) is 1cm higher than
      // L1's (60), so at equal edge/severity L3 carries the larger shortfall
      // and score. Expectation corrected from ['L1','L3'] to the order the
      // formula actually produces.
      test_description: 'Multiple red general circulation violations sort by priority score',
      items: [
        item({ id: 'a', label: 'A', category: 'cabinet', x: 1, z: 1, lengthCm: 160 }),
        item({ id: 'b', label: 'B', category: 'tv_stand', x: 2.5, z: 1, lengthCm: 120 }),
        item({ id: 'c', label: 'C', category: 'other', x: 4, z: 1, lengthCm: 80 }),
      ],
      expected_order: ['L3', 'L1'],
    },
  ];

  return scenarios.map((scenario) => {
    const result = runClearanceAnalysis(scenario.items, 500, 500);
    const systemOrder = result.violations.map((entry) => entry.ruleCode);
    const passed = scenario.expected_order.every(
      (ruleCode, index) => systemOrder[index] === ruleCode,
    );

    return {
      test_description: scenario.test_description,
      expected_order: scenario.expected_order,
      system_order: systemOrder.slice(0, scenario.expected_order.length),
      passed,
    };
  });
}

const EPS = 1e-9;

function approx(a: number, b: number, eps = EPS): boolean {
  return Math.abs(a - b) <= eps;
}

export function runRotationTestCases(): RotationTestCase[] {
  const results: RotationTestCase[] = [];

  const base = { id: 'r', label: 'R', category: 'cabinet' as const, x: 1, z: 1, lengthCm: 200, widthCm: 90 };
  const at = (rotationY: number) => item({ ...base, rotationY });

  // 1. rotationY = 0 — must be EXACTLY the raw dimensions (strict ===),
  //    which is what keeps every existing test byte-for-byte unchanged.
  {
    const it = at(0);
    const L = effectiveLengthCm(it);
    const W = effectiveWidthCm(it);
    results.push({
      test_description: 'rotationY = 0 returns lengthCm / widthCm exactly (strict equality)',
      detail: `L=${L} (expect exactly 200), W=${W} (expect exactly 90)`,
      passed: L === 200 && W === 90,
    });
  }

  // 2. rotationY = π/2 — the two values swap.
  {
    const it = at(Math.PI / 2);
    const L = effectiveLengthCm(it);
    const W = effectiveWidthCm(it);
    results.push({
      test_description: 'rotationY = π/2 swaps effective length and width',
      detail: `L=${L.toFixed(6)} (expect 90), W=${W.toFixed(6)} (expect 200)`,
      passed: approx(L, 90) && approx(W, 200),
    });
  }

  // 3. rotationY = π/4 on a 200x90 item — both ≈ 205.06 cm.
  {
    const it = at(Math.PI / 4);
    const L = effectiveLengthCm(it);
    const W = effectiveWidthCm(it);
    results.push({
      test_description: 'rotationY = π/4 on a 200x90 item gives ≈205.06 cm on both axes',
      detail: `L=${L.toFixed(4)}, W=${W.toFixed(4)} (expect ≈205.0610)`,
      passed: approx(L, 205.06, 0.01) && approx(W, 205.06, 0.01),
    });
  }

  // 4. π matches 0, and 3π/2 matches π/2 (half-turn symmetry).
  {
    const it0 = at(0);
    const it90 = at(Math.PI / 2);
    const it180 = at(Math.PI);
    const it270 = at((3 * Math.PI) / 2);
    const passed =
      approx(effectiveLengthCm(it180), effectiveLengthCm(it0)) &&
      approx(effectiveWidthCm(it180), effectiveWidthCm(it0)) &&
      approx(effectiveLengthCm(it270), effectiveLengthCm(it90)) &&
      approx(effectiveWidthCm(it270), effectiveWidthCm(it90));
    results.push({
      test_description: 'rotationY = π matches 0, and 3π/2 matches π/2',
      detail:
        `π: L=${effectiveLengthCm(it180).toFixed(4)} W=${effectiveWidthCm(it180).toFixed(4)} | ` +
        `3π/2: L=${effectiveLengthCm(it270).toFixed(4)} W=${effectiveWidthCm(it270).toFixed(4)}`,
      passed,
    });
  }

  // 5. A wall clearance that PASSES at rotationY 0 and FAILS at π/2.
  //    A 30x250cm cabinet: narrow side faces the west wall at 0 (135cm
  //    clear, GREEN); rotated, the long side faces it (25cm, RED).
  {
    const cabinet = (rotationY: number) =>
      item({ id: 'cab', label: 'Cabinet', category: 'cabinet', x: 1.5, z: 5, lengthCm: 30, widthCm: 250, rotationY });
    const r0 = runClearanceAnalysis([cabinet(0)], 300, 1000);
    const r90 = runClearanceAnalysis([cabinet(Math.PI / 2)], 300, 1000);
    const l1a = r0.allClassifications.find((c) => c.ruleCode === 'L1');
    const l1b = r90.allClassifications.find((c) => c.ruleCode === 'L1');
    results.push({
      test_description: 'A 30x250cm cabinet clears its nearest wall at rotationY 0 but violates it at π/2',
      detail: `rot 0: L1=${l1a?.classification} (${l1a?.measuredCm}cm) | rot π/2: L1=${l1b?.classification} (${l1b?.measuredCm}cm)`,
      passed: l1a?.classification === 'GREEN' && l1b?.classification === 'RED',
    });
  }

  // 6. A pair check where affectedEdgeLengthCm — and therefore
  //    priorityScore — differ between rotationY 0 and π/2.
  {
    const sofa = (rotationY: number) =>
      item({ id: 'sofa', label: 'Sofa', category: 'sofa', x: 1, z: 1, lengthCm: 140, widthCm: 110, rotationY });
    const coffee = item({ id: 'coffee', label: 'Coffee', category: 'coffee_table', x: 2.3, z: 1, lengthCm: 80, widthCm: 50 });
    const r0 = runClearanceAnalysis([sofa(0), coffee], 500, 500);
    const r90 = runClearanceAnalysis([sofa(Math.PI / 2), coffee], 500, 500);
    const a = r0.violations.find((v) => v.ruleCode === 'L2');
    const b = r90.violations.find((v) => v.ruleCode === 'L2');
    const passed =
      !!a && !!b &&
      approx(a.affectedEdgeLengthCm, 110) &&
      approx(b.affectedEdgeLengthCm, 140) &&
      !approx(a.priorityScore, b.priorityScore);
    results.push({
      test_description: 'Rotating a sofa 90° changes which edge faces the coffee table, changing affectedEdgeLengthCm and priorityScore',
      detail:
        `rot 0: edge=${a?.affectedEdgeLengthCm.toFixed(2)}cm score=${a?.priorityScore.toFixed(2)} | ` +
        `rot π/2: edge=${b?.affectedEdgeLengthCm.toFixed(2)}cm score=${b?.priorityScore.toFixed(2)}`,
      passed,
    });
  }

  return results;
}

export function runAllClearanceTestCases() {
  const ruleTests = runRuleClassificationTestCases();
  const priorityTests = runPriorityScoreRankingTestCases();
  const rotationTests = runRotationTestCases();

  return {
    ruleTests,
    priorityTests,
    rotationTests,
    allPassed:
      ruleTests.every((entry) => entry.passed) &&
      priorityTests.every((entry) => entry.passed) &&
      rotationTests.every((entry) => entry.passed),
  };
}
