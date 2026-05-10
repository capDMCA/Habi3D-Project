import type { FurnitureCategory, FurnitureItem, FurnitureShape, GapClassificationLevel } from '../types';
import { runClearanceAnalysis } from './clearance';

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

function item(params: {
  id: string;
  label: string;
  category: FurnitureCategory;
  x: number;
  z: number;
  lengthCm?: number;
  widthCm?: number;
  shape?: FurnitureShape;
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
    rotationY: 0,
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
      test_description: 'Severe sofa conversation violation outranks small coffee table warning',
      items: [
        item({ id: 'sofa', label: 'Sofa', category: 'sofa', x: 2, z: 2.4, lengthCm: 220 }),
        item({ id: 'coffee', label: 'Coffee', category: 'coffee_table', x: 3.45, z: 2.4, lengthCm: 80 }),
      ],
      expected_order: ['L5', 'L1', 'L3'],
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
      test_description: 'Large affected edge creates higher priority for same classification',
      items: [
        item({ id: 'sofa', label: 'Long Sofa', category: 'sofa', x: 1, z: 1, lengthCm: 240 }),
        item({ id: 'coffee', label: 'Coffee', category: 'coffee_table', x: 2.6, z: 1, lengthCm: 70 }),
        item({ id: 'cabinet', label: 'Cabinet', category: 'cabinet', x: 4, z: 1, lengthCm: 80 }),
      ],
      expected_order: ['L5', 'L1'],
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
      test_description: 'Multiple red general circulation violations sort before yellow warnings',
      items: [
        item({ id: 'a', label: 'A', category: 'cabinet', x: 1, z: 1, lengthCm: 160 }),
        item({ id: 'b', label: 'B', category: 'tv_stand', x: 2.2, z: 1, lengthCm: 120 }),
        item({ id: 'c', label: 'C', category: 'other', x: 4, z: 1, lengthCm: 80 }),
      ],
      expected_order: ['L1', 'L3'],
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

export function runAllClearanceTestCases() {
  const ruleTests = runRuleClassificationTestCases();
  const priorityTests = runPriorityScoreRankingTestCases();

  return {
    ruleTests,
    priorityTests,
    allPassed:
      ruleTests.every((entry) => entry.passed) &&
      priorityTests.every((entry) => entry.passed),
  };
}
