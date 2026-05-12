export type ScreenName =
  | 'entry'
  | 'arDemo'
  | 'unitSetup'
  | 'furnitureInput'
  | 'dimensionVerification'
  | 'roomScan'
  | 'positionMap'
  | 'analysis'
  | 'recommendation'
  | 'surveyEnd'
  | 'report';

export type FurnitureShape = 'rectangle' | 'l-shape' | 'round' | 'oval';

export type FurnitureCategory =
  | 'sofa'
  | 'coffee_table'
  | 'tv_stand'
  | 'dining_table'
  | 'dining_chair'
  | 'cabinet'
  | 'other';

export interface FurnitureItem {
  id: string;
  label: string;
  shape: FurnitureShape;
  category: FurnitureCategory;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  posX: number;
  posZ: number;
  rotationY: number;
}

export interface RoomDimensions {
  livingWidthCm: number;
  livingDepthCm: number;
  diningWidthCm: number;
  diningDepthCm: number;
}

export interface ClearanceRule {
  id: string;
  name: string;
  category: 'living' | 'dining';
  violationThresholdCm: number;
  warningThresholdCm: number;
  description: string;
}

export type GapClassificationLevel = 'RED' | 'YELLOW' | 'GREEN';

export interface Violation {
  id: string;
  ruleCode: string;
  ruleLabel: string;
  classification: 'RED' | 'YELLOW' | 'GREEN';
  measuredCm: number;
  requiredCm: number;
  shortfallCm: number;
  affectedEdgeLengthCm: number;
  severityWeight: 3 | 1;
  priorityScore: number;
  furnitureId: string;
  furnitureLabel: string;
  fixDirectionLabel: string;
  fixDirectionCm: number;
  resolved: boolean;
}

