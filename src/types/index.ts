export type ScreenName =
  | 'entry'
  | 'arDemo'
  | 'preSurvey'
  | 'unitSetup'
  | 'furnitureInput'
  | 'roomScan'
  | 'positionMap'
  | 'analysis'
  | 'recommendation'
  | 'surveyEnd'
  | 'report';

export type FurnitureShape = 'rectangle' | 'lshape' | 'round' | 'oval';

export interface FurnitureItem {
  id: string;
  name: string;
  shape: FurnitureShape;
  widthCm: number;
  depthCm: number;
  x: number;
  z: number;
  rotation: number;
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
