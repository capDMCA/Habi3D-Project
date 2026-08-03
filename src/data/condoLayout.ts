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
    allowedCategories: ['other', 'side_table'],
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
    allowedCategories: ['cabinet', 'side_table', 'work_desk', 'other'],
  },
  {
    id: 'bedroom1',
    label: 'Bedroom 1',
    x: 260,
    y: 100,
    width: 250,
    height: 240,
    bgColor: '#5A5A5A',
    textColor: '#FFFFFF',
    allowedCategories: ['cabinet', 'side_table', 'work_desk', 'other'],
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
    allowedCategories: ['sofa', 'coffee_table', 'tv_stand', 'cabinet', 'side_table', 'work_desk', 'other'],
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
    allowedCategories: ['cabinet', 'other'],
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
    allowedCategories: ['cabinet', 'other'],
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
    allowedCategories: ['dining_table', 'dining_chair', 'other'],
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
    allowedCategories: ['cabinet', 'other'],
  },
];

/**
 * Maps a furniture category and optionally its label to its allowed default room.
 */
export function getRoomForCategory(category: FurnitureCategory, label: string = ''): string {
  const normLabel = label.toLowerCase();
  
  if (normLabel.includes('balcony')) return 'balcony';
  if (normLabel.includes('storage')) return 'storage';
  if (normLabel.includes('bath') || normLabel.includes('cr') || normLabel.includes('toilet')) return 'bathroom';
  if (normLabel.includes('kitchen') || normLabel.includes('cook') || normLabel.includes('sink')) return 'kitchen';
  if (normLabel.includes('dining')) return 'dining';
  if (normLabel.includes('bed 2') || normLabel.includes('bedroom 2')) return 'bedroom2';
  if (normLabel.includes('bed 1') || normLabel.includes('bedroom 1') || normLabel.includes('bed') || normLabel.includes('wardrobe')) return 'bedroom1';

  switch (category) {
    case 'sofa':
    case 'coffee_table':
    case 'tv_stand':
      return 'living';
    case 'dining_table':
    case 'dining_chair':
      return 'dining';
    case 'work_desk':
      return 'bedroom1';
    case 'side_table':
      return 'bedroom2';
    case 'cabinet':
      return 'living'; // Default cabinet to living
    default:
      return 'living';
  }
}
