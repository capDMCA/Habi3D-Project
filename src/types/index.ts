export type ScreenName =
  | 'entry'
  | 'arDemo'
  | 'preSurvey'
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

export interface Violation {
  ruleId: string;
  ruleName: string;
  severity: 'red' | 'yellow';
  severityWeight: number;
  shortfallCm: number;
  affectedEdgeLengthCm: number;
  spatialImpactCm2: number;
  priorityScore: number;
  description: string;
  furnitureIds: string[];
}

export interface PreSurveyData {
  residencyLength: string;
  rearrangementFrequency: string;
  priorAppUse: string;
  baselineConfidence: number;
  baselineStandardAwareness: number;
  mainFrustration: string;
}
