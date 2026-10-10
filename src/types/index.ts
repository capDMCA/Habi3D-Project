export type ScreenName =
  | 'entry'
  | 'auth'
  | 'furnitureInput'
  | 'positionMap'
  | 'workspace'
  | 'threeDPreview'
  | 'analysis'
  | 'recommendations'
  | 'recommendation'
  | 'report';

export type FurnitureShape = 'rectangle' | 'l-shape' | 'round' | 'oval';

export type FurnitureCategory =
  | 'sofa'
  | 'coffee_table'
  | 'tv_stand'
  | 'dining_table'
  | 'dining_chair'
  | 'bed'
  | 'wardrobe'
  | 'cabinet'
  | 'side_table'
  | 'work_desk'
  | 'armchair'
  | 'appliance'
  | 'electrical'
  | 'mirror'
  | 'plant'
  | 'bathroom_fixture'
  | 'storage_rack'
  | 'other';

export type PlacementType = 'floor' | 'wall';

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
  roomId?: string;
  quantity?: number;
  placementType?: PlacementType;
  mountHeightCm?: number;
  wallSide?: 'west' | 'east' | 'north' | 'south';
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
  category: 'living' | 'dining' | 'bedroom' | 'general';
  violationThresholdCm: number;
  warningThresholdCm: number;
  description: string;
}

export type GapClassificationLevel = 'RED' | 'YELLOW' | 'GREEN' | 'N/A';

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
  itemBId?: string | 'wall';
  wallSide?: 'west' | 'east' | 'north' | 'south';
  roomId?: string;
  fixDirectionLabel: string;
  fixDirectionCm: number;
  resolved: boolean;
}
