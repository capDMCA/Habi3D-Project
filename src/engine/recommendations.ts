import type { FurnitureItem, Violation } from '../types';
import type { WalkwayStatus } from './walkways';
import { isItemInMainWalkway } from './walkways';
import { CONDO_ROOMS, getRoomForCategory } from '../data/condoLayout';

export interface WorkspaceRecommendation {
  id: string;
  furnitureId: string;
  furnitureLabel: string;
  actionText: string;
  severity: 'RED' | 'YELLOW';
  priorityScore: number;
  ruleCode?: string;
  ruleLabel?: string;
  wallSide?: 'west' | 'east' | 'north' | 'south';
  itemBId?: string | 'wall';
  itemBLabel?: string;
  fixDirectionLabel: string;
  fixDirectionCm: number;
  vector: { dxCm: number; dzCm: number };
  roomId: string;
  roomLabel: string;
  resolved: boolean;
}

/**
 * Direction label to delta cm vector on 2D floor plan.
 * X: West is negative X, East is positive X.
 * Z: North is negative Z, South is positive Z.
 */
function directionToVector(directionLabel: string, distanceCm: number): { dxCm: number; dzCm: number } {
  const norm = directionLabel.toLowerCase();
  if (norm.includes('north')) return { dxCm: 0, dzCm: -distanceCm };
  if (norm.includes('south')) return { dxCm: 0, dzCm: distanceCm };
  if (norm.includes('east'))  return { dxCm: distanceCm, dzCm: 0 };
  if (norm.includes('west'))  return { dxCm: -distanceCm, dzCm: 0 };
  return { dxCm: 0, dzCm: -distanceCm };
}

/**
 * Transform technical violations into concise, plain-language, actionable recommendations.
 * Avoids all technical jargon ("D1 violation", "Clearance = 42 cm", "L4 failed").
 */
export function buildWorkspaceRecommendations(
  violations: Violation[],
  items: FurnitureItem[],
  walkwayStatuses: WalkwayStatus[] = [],
): WorkspaceRecommendation[] {
  const recommendations: WorkspaceRecommendation[] = [];

  // 1. Process clearance violations
  for (const v of violations) {
    if (v.resolved) continue;

    const item = items.find((it) => it.id === v.furnitureId);
    if (!item) continue;

    const roomId = item.roomId || getRoomForCategory(item.category, item.label);
    const roomLabel = CONDO_ROOMS.find((r) => r.id === roomId)?.label ?? 'Living Room';

    let actionText: string;
    const otherItem = v.itemBId && v.itemBId !== 'wall'
      ? items.find((it) => it.id === v.itemBId)
      : null;

    if (!v.itemBId || v.itemBId === 'wall') {
      // Wall proximity
      if (v.ruleCode === 'D1' || v.ruleCode === 'D2') {
        actionText = 'Move it slightly away from the wall.';
      } else if (v.ruleCode === 'L4' || v.ruleCode === 'L1') {
        actionText = 'Open up the main walkway.';
      } else {
        actionText = 'Move it slightly away from the wall.';
      }
    } else if (otherItem) {
      // Furniture collision / crowding
      if (v.ruleCode === 'L3') {
        actionText = 'Give the seating area a little more space.';
      } else if (v.ruleCode === 'L5') {
        actionText = 'Provide more transition room between living and dining.';
      } else if (v.ruleCode === 'D5') {
        actionText = `Give more room between this and the ${otherItem.label.toLowerCase()}.`;
      } else {
        actionText = `Move it slightly away from the ${otherItem.label.toLowerCase()}.`;
      }
    } else {
      actionText = 'Adjust placement to increase clearance.';
    }

    const vector = directionToVector(v.fixDirectionLabel, v.fixDirectionCm);

    recommendations.push({
      id: v.id,
      furnitureId: v.furnitureId,
      furnitureLabel: v.furnitureLabel,
      actionText,
      severity: v.classification === 'RED' ? 'RED' : 'YELLOW',
      priorityScore: v.priorityScore,
      ruleCode: v.ruleCode,
      ruleLabel: v.ruleLabel,
      wallSide: v.wallSide,
      itemBId: v.itemBId,
      itemBLabel: otherItem?.label,
      fixDirectionLabel: v.fixDirectionLabel,
      fixDirectionCm: v.fixDirectionCm,
      vector,
      roomId,
      roomLabel,
      resolved: v.resolved,
    });
  }

  // 2. Process blocked walkways
  const blockedWalkways = walkwayStatuses.filter((w) => w.status === 'RED');
  for (const w of blockedWalkways) {
    // Find furniture currently intruding on the walkway
    const intrudingItem = items.find(isItemInMainWalkway) ?? items[0];
    if (intrudingItem) {
      // Check if we already have a major recommendation for this item
      const existing = recommendations.find((r) => r.furnitureId === intrudingItem.id && r.ruleCode === 'L4');
      if (!existing) {
        const roomId = intrudingItem.roomId || getRoomForCategory(intrudingItem.category, intrudingItem.label);
        const shiftWest = intrudingItem.posX > 2.5;
        const dirLabel = shiftWest ? 'West' : 'East';
        recommendations.push({
          id: `walkway-${w.id}-${intrudingItem.id}`,
          furnitureId: intrudingItem.id,
          furnitureLabel: intrudingItem.label,
          actionText: 'Open up the main walkway.',
          severity: 'RED',
          priorityScore: 95, // High priority
          ruleCode: 'L4',
          ruleLabel: 'Walkway Obstruction',
          fixDirectionLabel: dirLabel,
          fixDirectionCm: 35,
          vector: directionToVector(dirLabel, 35),
          roomId,
          roomLabel: 'Walkway Corridor',
          resolved: false,
        });
      }
    }
  }

  // 3. Sort by priority:
  // 1. Major obstruction/problem (RED)
  // 2. Highest priority score
  // 3. Furniture clearance issues (YELLOW)
  return recommendations.sort((a, b) => {
    if (a.severity === 'RED' && b.severity !== 'RED') return -1;
    if (a.severity !== 'RED' && b.severity === 'RED') return 1;
    return b.priorityScore - a.priorityScore;
  });
}
