import type { FurnitureItem } from '../types';
import { toBounds } from './clearance';

export interface WalkwayPath {
  id: string;
  label: string;
  // Bounding box of the walkway corridor in cm
  x: number;
  y: number;
  width: number;
  height: number;
}

export const WALKWAY_PATHS: WalkwayPath[] = [
  { id: 'living_dining', label: 'Living → Dining', x: 80, y: 660, width: 90, height: 80 },
  { id: 'living_balcony', label: 'Living → Balcony', x: 80, y: 100, width: 90, height: 280 },
  { id: 'living_bedroom', label: 'Living → Bedroom', x: 215, y: 280, width: 90, height: 100 },
  { id: 'dining_kitchen', label: 'Dining → Kitchen', x: 220, y: 720, width: 80, height: 90 },
  { id: 'bedroom_bathroom', label: 'Bedroom → Bathroom', x: 215, y: 380, width: 90, height: 100 },
];

export interface WalkwayStatus {
  id: string;
  label: string;
  status: 'RED' | 'YELLOW' | 'GREEN';
  clearanceCm: number;
}

export function computeWalkways(items: FurnitureItem[]): WalkwayStatus[] {
  const boundsList = items.map(toBounds);
  
  return WALKWAY_PATHS.map((path) => {
    // Walkway path in metres
    const pathMinX = path.x / 100;
    const pathMaxX = (path.x + path.width) / 100;
    const pathMinZ = path.y / 100;
    const pathMaxZ = (path.y + path.height) / 100;
    
    let maxOverlapCm = 0;
    
    for (const b of boundsList) {
      const overlapX = Math.min(b.maxX, pathMaxX) - Math.max(b.minX, pathMinX);
      const overlapZ = Math.min(b.maxZ, pathMaxZ) - Math.max(b.minZ, pathMinZ);
      
      if (overlapX > 0 && overlapZ > 0) {
        // It intersects the corridor.
        // The protrusion is the overlap on the narrower axis of the corridor
        const protrusionCm = Math.round(Math.min(overlapX, overlapZ) * 100);
        if (protrusionCm > maxOverlapCm) {
          maxOverlapCm = protrusionCm;
        }
      }
    }
    
    const maxCorridorDim = Math.min(path.width, path.height);
    const clearanceCm = Math.max(0, maxCorridorDim - maxOverlapCm);
    
    let status: 'RED' | 'YELLOW' | 'GREEN' = 'GREEN';
    if (clearanceCm < 60) {
      status = 'RED';
    } else if (clearanceCm < 91) {
      status = 'YELLOW';
    }
    
    return {
      id: path.id,
      label: path.label,
      status,
      clearanceCm,
    };
  });
}
