import type { FurnitureCategory } from '../types';

export interface RoomZone {
  id: string;
  label: string;
  x: number; // in cm
  y: number; // in cm
  width: number; // in cm
  height: number; // in cm
  bgColor: string;
  textColor: string;
  allowedCategories: FurnitureCategory[];
  /** Spatial analysis capability level for this room */
  validationLevel: 'full' | 'bedroom' | 'limited';
  /** Human-readable note detailing the validation scope for this room */
  validationNote: string;
}

export const CONDO_ROOMS: RoomZone[] = [
  {
    id: 'balcony',
    label: 'Balcony',
    x: 0,
    y: 0,
    width: 510,
    height: 100,
    bgColor: '#B855C8',
    textColor: '#FFFFFF',
    allowedCategories: ['side_table', 'dining_table', 'dining_chair', 'storage_rack', 'plant', 'armchair', 'cabinet', 'other'],
    validationLevel: 'limited',
    validationNote: 'Unit perimeter and exterior boundary validation',
  },
  {
    id: 'bedroom2',
    label: 'Bedroom 2',
    x: 0,
    y: 100,
    width: 260,
    height: 240,
    bgColor: '#6B5B4F',
    textColor: '#FFFFFF',
    allowedCategories: ['bed', 'wardrobe', 'cabinet', 'side_table', 'work_desk', 'dining_chair', 'mirror', 'electrical', 'armchair', 'other'],
    validationLevel: 'bedroom',
    validationNote: 'Time-Saver Standards B1–B2 bedroom circulation and access checks',
  },
  {
    id: 'bedroom1',
    label: 'Bedroom 1 (Master)',
    x: 260,
    y: 100,
    width: 250,
    height: 240,
    bgColor: '#5A5A5A',
    textColor: '#FFFFFF',
    allowedCategories: ['bed', 'wardrobe', 'cabinet', 'side_table', 'work_desk', 'dining_chair', 'mirror', 'electrical', 'armchair', 'other'],
    validationLevel: 'bedroom',
    validationNote: 'Time-Saver Standards B1–B2 bedroom circulation and access checks',
  },
  {
    id: 'living',
    label: 'Living Room',
    x: 0,
    y: 340,
    width: 260,
    height: 360,
    bgColor: '#EF5350',
    textColor: '#FFFFFF',
    allowedCategories: ['sofa', 'coffee_table', 'tv_stand', 'cabinet', 'side_table', 'work_desk', 'armchair', 'electrical', 'plant', 'mirror', 'storage_rack', 'other'],
    validationLevel: 'full',
    validationNote: 'Time-Saver Standards L1–L5 living clearance and trafficway validation',
  },
  {
    id: 'storage',
    label: 'Storage',
    x: 260,
    y: 340,
    width: 250,
    height: 120,
    bgColor: '#FFB74D',
    textColor: '#16203A',
    allowedCategories: ['wardrobe', 'cabinet', 'storage_rack', 'appliance', 'other'],
    validationLevel: 'limited',
    validationNote: 'Storage room footprint and boundary checks',
  },
  {
    id: 'bathroom',
    label: 'Bathroom (CR)',
    x: 260,
    y: 460,
    width: 250,
    height: 160,
    bgColor: '#5C6BC0',
    textColor: '#FFFFFF',
    allowedCategories: ['cabinet', 'bathroom_fixture', 'mirror', 'other'],
    validationLevel: 'limited',
    validationNote: 'Utility perimeter and door clearance checks',
  },
  {
    id: 'dining',
    label: 'Dining Area',
    x: 0,
    y: 700,
    width: 260,
    height: 180,
    bgColor: '#00897B',
    textColor: '#FFFFFF',
    allowedCategories: ['dining_table', 'dining_chair', 'cabinet', 'side_table', 'armchair', 'storage_rack', 'other'],
    validationLevel: 'full',
    validationNote: 'Time-Saver Standards D1–D5 dining passage and seating clearance checks',
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    x: 260,
    y: 620,
    width: 250,
    height: 260,
    bgColor: '#CFD8DC',
    textColor: '#16203A',
    allowedCategories: ['cabinet', 'dining_table', 'appliance', 'electrical', 'storage_rack', 'other'],
    validationLevel: 'limited',
    validationNote: 'Kitchen corridor and boundary validation',
  },
];

export interface RoomCenterPosition {
  posX: number;
  posZ: number;
  roomId: string;
}

export const ROOM_CENTERS: Record<string, RoomCenterPosition> = {
  balcony: { posX: 2.55, posZ: 0.50, roomId: 'balcony' },
  bedroom2: { posX: 1.30, posZ: 2.20, roomId: 'bedroom2' },
  bedroom1: { posX: 3.85, posZ: 2.20, roomId: 'bedroom1' },
  living: { posX: 1.30, posZ: 5.20, roomId: 'living' },
  storage: { posX: 3.85, posZ: 4.00, roomId: 'storage' },
  bathroom: { posX: 3.85, posZ: 5.40, roomId: 'bathroom' },
  dining: { posX: 1.30, posZ: 7.90, roomId: 'dining' },
  kitchen: { posX: 3.85, posZ: 7.50, roomId: 'kitchen' },
};

export function getRoomZone(roomId: string): RoomZone | undefined {
  return CONDO_ROOMS.find((r) => r.id === roomId);
}

/**
 * Maps a furniture category and optionally its label to its target condo room.
 * Supports all 8 rooms across the Mulberry Place 2-Bedroom unit.
 */
export function getRoomForCategory(category: FurnitureCategory, label: string = ''): string {
  const normLabel = label.toLowerCase();

  // Explicit label-based targeting takes priority
  if (normLabel.includes('bedroom 2') || normLabel.includes('bed 2') || normLabel.includes('single') || normLabel.includes('kids') || normLabel.includes('guest')) return 'bedroom2';
  if (normLabel.includes('bedroom 1') || normLabel.includes('bed 1') || normLabel.includes('master')) return 'bedroom1';
  if (normLabel.includes('balcony')) return 'balcony';
  if (normLabel.includes('storage')) return 'storage';
  if (normLabel.includes('bath') || normLabel.includes('cr') || normLabel.includes('toilet')) return 'bathroom';
  if (normLabel.includes('kitchen')) return 'kitchen';
  if (normLabel.includes('dining')) return 'dining';
  if (normLabel.includes('living')) return 'living';
  if (normLabel.includes('bedroom')) return 'bedroom1';

  // Category defaults
  switch (category) {
    case 'bed':
      return 'bedroom1';
    case 'wardrobe':
      return 'bedroom1';
    case 'dining_table':
    case 'dining_chair':
      return 'dining';
    case 'sofa':
    case 'coffee_table':
    case 'tv_stand':
    case 'armchair':
      return 'living';
    case 'work_desk':
      return 'bedroom2';
    case 'appliance':
      return normLabel.includes('wash') || normLabel.includes('laundry') ? 'kitchen' : 'kitchen';
    case 'bathroom_fixture':
      return 'bathroom';
    case 'storage_rack':
      return normLabel.includes('shoe') ? 'storage' : normLabel.includes('balcony') ? 'balcony' : 'storage';
    case 'plant':
      return normLabel.includes('balcony') || normLabel.includes('pot') ? 'balcony' : 'living';
    case 'mirror':
      return normLabel.includes('bath') ? 'bathroom' : 'bedroom1';
    case 'electrical':
      return normLabel.includes('desk') || normLabel.includes('bed') ? 'bedroom2' : 'living';
    case 'cabinet':
      return normLabel.includes('kitchen') ? 'kitchen' : normLabel.includes('storage') ? 'storage' : normLabel.includes('bath') ? 'bathroom' : 'living';
    case 'side_table':
      return 'living';
    case 'other':
    default:
      return 'living';
  }
}
