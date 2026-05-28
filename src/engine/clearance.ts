import type { FurnitureCategory, FurnitureItem, GapClassificationLevel, Violation } from '../types';
import { CLEARANCE_RULES, classifyGap, computePriorityScore } from './rules';

export type WallSide = 'west' | 'east' | 'north' | 'south';

export interface GapClassification {
  ruleCode: string;
  itemAId: string;
  itemBId: string | 'wall';
  measuredCm: number;
  classification: GapClassificationLevel;
  wallSide?: WallSide;
}

export interface ClearanceResult {
  violations: Violation[];
  spaceScoreBefore: number;
  allClassifications: GapClassification[];
}

interface ItemBounds {
  item: FurnitureItem;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  lengthM: number;
  widthM: number;
}

interface PairGap {
  measuredCm: number;
  gapX: number;
  gapZ: number;
  directionLabel: string;
}

interface WallGap {
  measuredCm: number;
  wallSide: WallSide;
  directionLabel: string;
}

function getRule(ruleCode: string) {
  const rule = CLEARANCE_RULES.find((entry) => entry.id === ruleCode);
  if (!rule) throw new Error(`Missing clearance rule ${ruleCode}`);
  return rule;
}

function toBounds(item: FurnitureItem): ItemBounds {
  const lengthM = item.lengthCm / 100;
  const widthM = item.widthCm / 100;

  return {
    item,
    minX: item.posX - lengthM / 2,
    maxX: item.posX + lengthM / 2,
    minZ: item.posZ - widthM / 2,
    maxZ: item.posZ + widthM / 2,
    lengthM,
    widthM,
  };
}

function getPairGap(a: ItemBounds, b: ItemBounds): PairGap {
  const gapX = Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX));
  const gapZ = Math.max(0, Math.max(a.minZ, b.minZ) - Math.min(a.maxZ, b.maxZ));
  const measuredCm = Math.round(Math.sqrt(gapX * gapX + gapZ * gapZ) * 100);

  let directionLabel = 'toward the north wall';
  if (gapX >= gapZ && a.item.posX <= b.item.posX) directionLabel = 'toward the west wall';
  if (gapX >= gapZ && a.item.posX > b.item.posX) directionLabel = 'toward the east wall';
  if (gapZ > gapX && a.item.posZ <= b.item.posZ) directionLabel = 'toward the north wall';
  if (gapZ > gapX && a.item.posZ > b.item.posZ) directionLabel = 'toward the south wall';

  return { measuredCm, gapX, gapZ, directionLabel };
}

function getWallGaps(bounds: ItemBounds, roomWidthM: number, roomLengthM: number): WallGap[] {
  return [
    {
      measuredCm: Math.round(bounds.minX * 100),
      wallSide: 'west',
      directionLabel: 'toward the east wall',
    },
    {
      measuredCm: Math.round((roomWidthM - bounds.maxX) * 100),
      wallSide: 'east',
      directionLabel: 'toward the west wall',
    },
    {
      measuredCm: Math.round(bounds.minZ * 100),
      wallSide: 'north',
      directionLabel: 'toward the south wall',
    },
    {
      measuredCm: Math.round((roomLengthM - bounds.maxZ) * 100),
      wallSide: 'south',
      directionLabel: 'toward the north wall',
    },
  ];
}

function getClosestWallGap(
  bounds: ItemBounds,
  roomWidthM: number,
  roomLengthM: number,
): WallGap {
  return getWallGaps(bounds, roomWidthM, roomLengthM).sort(
    (a, b) => a.measuredCm - b.measuredCm,
  )[0];
}

function itemMatches(item: FurnitureItem, categories: FurnitureCategory[]): boolean {
  return categories.includes(item.category);
}

function makeViolation(params: {
  ruleCode: string;
  ruleLabel: string;
  classification: 'RED' | 'YELLOW';
  measuredCm: number;
  requiredCm: number;
  affectedEdgeLengthCm: number;
  item: FurnitureItem;
  itemBId?: string | 'wall';
  wallSide?: WallSide;
  fixDirectionLabel: string;
}): Violation {
  const severityWeight = params.classification === 'RED' ? 3 : 1;
  const shortfallCm = Math.max(0, Math.round(params.requiredCm - params.measuredCm));

  return {
    id: `${params.ruleCode}-${params.item.id}-${params.measuredCm}-${params.fixDirectionLabel}`,
    ruleCode: params.ruleCode,
    ruleLabel: params.ruleLabel,
    classification: params.classification,
    measuredCm: params.measuredCm,
    requiredCm: params.requiredCm,
    shortfallCm,
    affectedEdgeLengthCm: params.affectedEdgeLengthCm,
    severityWeight,
    priorityScore: computePriorityScore(
      severityWeight,
      shortfallCm,
      params.affectedEdgeLengthCm,
    ),
    furnitureId: params.item.id,
    furnitureLabel: params.item.label,
    itemBId: params.itemBId,
    wallSide: params.wallSide,
    fixDirectionLabel: params.fixDirectionLabel,
    fixDirectionCm: Math.max(0, Math.round(params.requiredCm - params.measuredCm + 5)),
    resolved: false,
  };
}

function requiredForClassification(
  classification: GapClassificationLevel,
  ruleCode: string,
): number {
  const rule = getRule(ruleCode);
  return classification === 'RED' ? rule.violationThresholdCm : rule.warningThresholdCm;
}

function addPairCheck(params: {
  ruleCode: string;
  a: ItemBounds;
  b: ItemBounds;
  classifications: GapClassification[];
  violations: Violation[];
}) {
  const rule = getRule(params.ruleCode);
  const gap = getPairGap(params.a, params.b);
  const classification = classifyGap(gap.measuredCm, rule);

  params.classifications.push({
    ruleCode: params.ruleCode,
    itemAId: params.a.item.id,
    itemBId: params.b.item.id,
    measuredCm: gap.measuredCm,
    classification,
  });

  if (classification === 'GREEN') return;

  params.violations.push(
    makeViolation({
      ruleCode: params.ruleCode,
      ruleLabel: rule.name,
      classification,
      measuredCm: gap.measuredCm,
      requiredCm: requiredForClassification(classification, params.ruleCode),
      affectedEdgeLengthCm: Math.max(params.a.item.lengthCm, params.a.item.widthCm),
      item: params.a.item,
      itemBId: params.b.item.id,
      fixDirectionLabel: gap.directionLabel,
    }),
  );
}

function addWallCheck(params: {
  ruleCode: string;
  bounds: ItemBounds;
  wallGap: WallGap;
  classifications: GapClassification[];
  violations: Violation[];
}) {
  const rule = getRule(params.ruleCode);
  const classification = classifyGap(params.wallGap.measuredCm, rule);

  params.classifications.push({
    ruleCode: params.ruleCode,
    itemAId: params.bounds.item.id,
    itemBId: 'wall',
    measuredCm: params.wallGap.measuredCm,
    classification,
    wallSide: params.wallGap.wallSide,
  });

  if (classification === 'GREEN') return;

  params.violations.push(
    makeViolation({
      ruleCode: params.ruleCode,
      ruleLabel: rule.name,
      classification,
      measuredCm: params.wallGap.measuredCm,
      requiredCm: requiredForClassification(classification, params.ruleCode),
      affectedEdgeLengthCm: Math.max(params.bounds.item.lengthCm, params.bounds.item.widthCm),
      item: params.bounds.item,
      itemBId: 'wall',
      wallSide: params.wallGap.wallSide,
      fixDirectionLabel: params.wallGap.directionLabel,
    }),
  );
}

function getSpaceScoreBefore(
  items: FurnitureItem[],
  roomWidthCm: number,
  roomLengthCm: number,
): number {
  const totalFloorAreaCm2 = roomWidthCm * roomLengthCm;
  if (totalFloorAreaCm2 <= 0) return 0;

  const furnitureFootprintCm2 = items.reduce(
    (total, item) => total + item.lengthCm * item.widthCm,
    0,
  );
  const freeAreaCm2 = Math.max(0, totalFloorAreaCm2 - furnitureFootprintCm2);
  return Math.round((freeAreaCm2 / totalFloorAreaCm2) * 1000) / 10;
}

function pairAppliesToL2(a: FurnitureItem, b: FurnitureItem): boolean {
  return (
    (a.category === 'sofa' && b.category === 'coffee_table') ||
    (a.category === 'coffee_table' && b.category === 'sofa')
  );
}

function pairAppliesToD5(a: FurnitureItem, b: FurnitureItem): boolean {
  return (
    itemMatches(a, ['dining_table', 'dining_chair']) ||
    itemMatches(b, ['dining_table', 'dining_chair'])
  );
}

function pairAppliesToD4(a: FurnitureItem, b: FurnitureItem): boolean {
  return (
    (a.category === 'dining_chair' && !itemMatches(b, ['dining_table', 'dining_chair'])) ||
    (b.category === 'dining_chair' && !itemMatches(a, ['dining_table', 'dining_chair']))
  );
}

export function runClearanceAnalysis(
  items: FurnitureItem[],
  roomWidthCm: number,
  roomLengthCm: number,
): ClearanceResult {
  const bounds = items.map(toBounds);
  const roomWidthM = roomWidthCm / 100;
  const roomLengthM = roomLengthCm / 100;
  const classifications: GapClassification[] = [];
  const violations: Violation[] = [];

  for (let i = 0; i < bounds.length; i += 1) {
    for (let j = i + 1; j < bounds.length; j += 1) {
      const a = bounds[i];
      const b = bounds[j];

      addPairCheck({ ruleCode: 'L1', a, b, classifications, violations });
      addPairCheck({ ruleCode: 'L3', a, b, classifications, violations });

      if (pairAppliesToL2(a.item, b.item)) {
        addPairCheck({ ruleCode: 'L2', a, b, classifications, violations });
      }

      if (pairAppliesToD4(a.item, b.item)) {
        addPairCheck({ ruleCode: 'D4', a, b, classifications, violations });
      }

      if (pairAppliesToD5(a.item, b.item)) {
        addPairCheck({ ruleCode: 'D5', a, b, classifications, violations });
      }
    }
  }

  bounds.forEach((entry) => {
    addWallCheck({
      ruleCode: 'L1',
      bounds: entry,
      wallGap: getClosestWallGap(entry, roomWidthM, roomLengthM),
      classifications,
      violations,
    });

    if (entry.item.category === 'dining_table') {
      addWallCheck({
        ruleCode: 'D1',
        bounds: entry,
        wallGap: getClosestWallGap(entry, roomWidthM, roomLengthM),
        classifications,
        violations,
      });
    }

    if (entry.item.category === 'dining_chair') {
      const closest = getClosestWallGap(entry, roomWidthM, roomLengthM);
      addWallCheck({ ruleCode: 'D2', bounds: entry, wallGap: closest, classifications, violations });
      addWallCheck({ ruleCode: 'D3', bounds: entry, wallGap: closest, classifications, violations });
    }

    if (entry.item.category === 'sofa') {
      const centerZ = roomLengthM / 2;
      const frontGap: WallGap =
        entry.item.posZ <= centerZ
          ? {
              measuredCm: Math.round((roomLengthM - entry.maxZ) * 100),
              wallSide: 'south',
              directionLabel: 'toward the south wall',
            }
          : {
              measuredCm: Math.round(entry.minZ * 100),
              wallSide: 'north',
              directionLabel: 'toward the north wall',
            };

      addWallCheck({ ruleCode: 'L5', bounds: entry, wallGap: frontGap, classifications, violations });
    }
  });

  const largestWallGaps = bounds
    .map((entry) => ({
      bounds: entry,
      wallGap: getWallGaps(entry, roomWidthM, roomLengthM).sort(
        (a, b) => b.measuredCm - a.measuredCm,
      )[0],
    }))
    .sort((a, b) => b.wallGap.measuredCm - a.wallGap.measuredCm);

  if (largestWallGaps[0]) {
    addWallCheck({
      ruleCode: 'L4',
      bounds: largestWallGaps[0].bounds,
      wallGap: largestWallGaps[0].wallGap,
      classifications,
      violations,
    });
  }

  return {
    violations: violations.sort((a, b) => b.priorityScore - a.priorityScore),
    spaceScoreBefore: getSpaceScoreBefore(items, roomWidthCm, roomLengthCm),
    allClassifications: classifications,
  };
}
