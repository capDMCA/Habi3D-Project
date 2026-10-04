import type { FurnitureItem } from '../types';
import { toBounds, effectiveWidthCm, type ItemBounds } from '../engine/clearance';
import { CONDO_ROOMS } from '../data/condoLayout';
import {
  isItemInBedroom,
  isItemInKitchenOrBathroom,
  overlappingItemIds,
  roomIdForItem,
  BEDROOM_DIVIDER_WALL_Z_M,
  UNIT_WIDTH_CM,
  UNIT_HEIGHT_CM,
} from '../components/floorPlanDrag';
import { isItemInMainWalkway } from '../engine/walkways';
import { applyCalibration, type CalibrationTransform } from './calibration';

export type PlacementStatus = 'valid' | 'warning' | 'invalid';

export interface CorrectionVector {
  /** Delta X in blueprint meters */
  dx: number;
  /** Delta Z in blueprint meters */
  dz: number;
  /** Cardinal direction in blueprint frame */
  direction: 'north' | 'south' | 'east' | 'west' | null;
  /** Suggested shift distance in centimeters */
  distanceCm: number;
  /** Delta X in AR session local space (for 3D arrow rendering) */
  arDx: number;
  /** Delta Z in AR session local space (for 3D arrow rendering) */
  arDz: number;
}

export interface PlacementValidationResult {
  status: PlacementStatus;
  title: string;
  problem: string;
  action: string;
  reason: string;
  roomName: string;
  isOverlapping: boolean;
  overlappingItemLabels: string[];
  isRestrictedZone: boolean;
  isOutOfBounds: boolean;
  isNearWall: boolean;
  isWalkwayBlocked: boolean;
  correctionVector: CorrectionVector | null;
  blueprintPosition: { x: number; z: number };
}

export interface ValidatePlacementParams {
  candidateItem: FurnitureItem;
  arPosition?: { x: number; z: number } | null;
  blueprintPosition?: { x: number; z: number } | null;
  rotationY: number;
  allExistingItems: FurnitureItem[];
  calibration: CalibrationTransform | null;
}

function rotateDeltaToAr(
  dx: number,
  dz: number,
  calibration: CalibrationTransform | null,
): { arDx: number; arDz: number } {
  if (!calibration) {
    return { arDx: dx, arDz: dz };
  }
  // Invert calibration rotation (blueprint -> AR direction)
  const arDx = dx * calibration.cosTheta + dz * calibration.sinTheta;
  const arDz = -dx * calibration.sinTheta + dz * calibration.cosTheta;
  return { arDx, arDz };
}

function getCardinalDirection(dx: number, dz: number): 'north' | 'south' | 'east' | 'west' {
  if (Math.abs(dx) >= Math.abs(dz)) {
    return dx > 0 ? 'east' : 'west';
  }
  return dz > 0 ? 'south' : 'north';
}

function computeBoundsGap(a: ItemBounds, b: ItemBounds): { gapM: number; dx: number; dz: number } {
  const gapX = Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX));
  const gapZ = Math.max(0, Math.max(a.minZ, b.minZ) - Math.min(a.maxZ, b.maxZ));
  const gapM = Math.sqrt(gapX * gapX + gapZ * gapZ);
  return {
    gapM,
    dx: a.item.posX - b.item.posX,
    dz: a.item.posZ - b.item.posZ,
  };
}

/**
 * Lightweight, real-time placement validation during AR movement.
 * Keeps responsibility separate: boundary, wall, restricted zones, and overlap checks
 * run fast per AR frame, providing resident-friendly natural language recommendations.
 */
export function validatePlacement({
  candidateItem,
  arPosition,
  blueprintPosition: explicitBlueprintPos,
  rotationY,
  allExistingItems,
  calibration,
}: ValidatePlacementParams): PlacementValidationResult {
  // 1. Resolve blueprint coordinates
  let blueprintPos: { x: number; z: number };
  if (explicitBlueprintPos) {
    blueprintPos = explicitBlueprintPos;
  } else if (arPosition && calibration) {
    blueprintPos = applyCalibration(arPosition, calibration);
  } else if (arPosition) {
    blueprintPos = arPosition;
  } else {
    blueprintPos = { x: candidateItem.posX, z: candidateItem.posZ };
  }

  // 2. Synthesize candidate item at candidate position
  const candidate: FurnitureItem = {
    ...candidateItem,
    posX: blueprintPos.x,
    posZ: blueprintPos.z,
    rotationY,
  };

  const otherPlacedItems = allExistingItems.filter(
    (item) => item.id !== candidate.id && (item.posX !== 0 || item.posZ !== 0),
  );

  const candidateBounds = toBounds(candidate);
  const halfWidthM = effectiveWidthCm(candidate) / 200;
  const maxUnitXM = UNIT_WIDTH_CM / 100;
  const maxUnitZM = UNIT_HEIGHT_CM / 100;

  const currentRoomId = roomIdForItem(candidate);
  const currentRoom = CONDO_ROOMS.find((r) => r.id === currentRoomId);
  const roomName = currentRoom?.label ?? 'Living Room';

  // ── CHECK 1: Unit Outer Boundaries & Wall Collisions ──
  const isOutOfBounds =
    candidateBounds.minX < 0.05 ||
    candidateBounds.minZ < 0.05 ||
    candidateBounds.maxX > maxUnitXM - 0.05 ||
    candidateBounds.maxZ > maxUnitZM - 0.05;

  if (isOutOfBounds) {
    let fixDx = 0;
    let fixDz = 0;
    if (candidateBounds.minX < 0.05) fixDx = (0.2 - candidateBounds.minX);
    else if (candidateBounds.maxX > maxUnitXM - 0.05) fixDx = (maxUnitXM - 0.2 - candidateBounds.maxX);

    if (candidateBounds.minZ < 0.05) fixDz = (0.2 - candidateBounds.minZ);
    else if (candidateBounds.maxZ > maxUnitZM - 0.05) fixDz = (maxUnitZM - 0.2 - candidateBounds.maxZ);

    const distCm = Math.max(25, Math.round(Math.hypot(fixDx, fixDz) * 100));
    const cardDir = getCardinalDirection(fixDx, fixDz);
    const { arDx, arDz } = rotateDeltaToAr(fixDx, fixDz, calibration);

    return {
      status: 'invalid',
      title: 'Against outer wall',
      problem: 'The furniture is too close to or crossing the outer wall.',
      action: `Pull the ${candidate.label.toLowerCase()} a little inward toward the center of the room.`,
      reason: 'Keeps the piece comfortably inside the room boundaries.',
      roomName,
      isOverlapping: false,
      overlappingItemLabels: [],
      isRestrictedZone: false,
      isOutOfBounds: true,
      isNearWall: true,
      isWalkwayBlocked: false,
      correctionVector: {
        dx: fixDx,
        dz: fixDz,
        direction: cardDir,
        distanceCm: distCm,
        arDx,
        arDz,
      },
      blueprintPosition: blueprintPos,
    };
  }

  // ── CHECK 2: Restricted Room Zones (Bedrooms, Balcony, Kitchen, Bathroom) ──
  const inBedroom = isItemInBedroom(candidate);
  if (inBedroom) {
    // The bedroom barrier is at z = 3.40m. Needs to move south (z > 3.40m)
    const requiredZ = BEDROOM_DIVIDER_WALL_Z_M + halfWidthM + 0.2;
    const fixDz = Math.max(0.4, requiredZ - candidate.posZ);
    const distCm = Math.round(fixDz * 100);
    const { arDx, arDz } = rotateDeltaToAr(0, fixDz, calibration);

    return {
      status: 'invalid',
      title: 'Bedroom boundary',
      problem: `This area is reserved for the bedroom.`,
      action: `Move the ${candidate.label.toLowerCase()} forward into the living or dining area.`,
      reason: 'Living and dining furniture should be arranged in the main living spaces.',
      roomName: 'Bedroom',
      isOverlapping: false,
      overlappingItemLabels: [],
      isRestrictedZone: true,
      isOutOfBounds: false,
      isNearWall: false,
      isWalkwayBlocked: false,
      correctionVector: {
        dx: 0,
        dz: fixDz,
        direction: 'south',
        distanceCm: distCm,
        arDx,
        arDz,
      },
      blueprintPosition: blueprintPos,
    };
  }

  const inKitchenOrBath = isItemInKitchenOrBathroom(candidate);
  if (inKitchenOrBath) {
    // Kitchen / bath is on the east side (x > 2.6m). Needs to move west
    const fixDx = -0.55;
    const distCm = 55;
    const { arDx, arDz } = rotateDeltaToAr(fixDx, 0, calibration);

    return {
      status: 'invalid',
      title: 'Service area boundary',
      problem: `This spot intrudes into the kitchen or bathroom entry.`,
      action: `Slide the ${candidate.label.toLowerCase()} to the left into the open dining or living room.`,
      reason: 'Keeps doors, counters, and utility paths completely clear.',
      roomName: currentRoomId === 'kitchen' ? 'Kitchen' : 'Bathroom',
      isOverlapping: false,
      overlappingItemLabels: [],
      isRestrictedZone: true,
      isOutOfBounds: false,
      isNearWall: false,
      isWalkwayBlocked: false,
      correctionVector: {
        dx: fixDx,
        dz: 0,
        direction: 'west',
        distanceCm: distCm,
        arDx,
        arDz,
      },
      blueprintPosition: blueprintPos,
    };
  }

  // ── CHECK 3: Furniture Overlaps ──
  const overlappingIds = overlappingItemIds(candidate, otherPlacedItems);
  if (overlappingIds.length > 0) {
    const overlappingItems = otherPlacedItems.filter((it) => overlappingIds.includes(it.id));
    const labels = overlappingItems.map((it) => it.label);
    const primaryObstacle = overlappingItems[0];

    // Compute push-out vector away from primary obstacle center
    let pushDx = candidate.posX - primaryObstacle.posX;
    let pushDz = candidate.posZ - primaryObstacle.posZ;
    const dist = Math.hypot(pushDx, pushDz);
    if (dist < 0.05) {
      pushDx = 0.45;
      pushDz = 0;
    } else {
      pushDx = (pushDx / dist) * 0.5;
      pushDz = (pushDz / dist) * 0.5;
    }

    const distCm = Math.round(Math.hypot(pushDx, pushDz) * 100);
    const cardDir = getCardinalDirection(pushDx, pushDz);
    const { arDx, arDz } = rotateDeltaToAr(pushDx, pushDz, calibration);

    return {
      status: 'invalid',
      title: 'Pieces overlapping',
      problem: `Overlapping with your ${labels.join(' and ')}.`,
      action: `Slide the ${candidate.label.toLowerCase()} away into the open floor area.`,
      reason: 'Each piece of furniture needs its own space to be usable.',
      roomName,
      isOverlapping: true,
      overlappingItemLabels: labels,
      isRestrictedZone: false,
      isOutOfBounds: false,
      isNearWall: false,
      isWalkwayBlocked: false,
      correctionVector: {
        dx: pushDx,
        dz: pushDz,
        direction: cardDir,
        distanceCm: distCm,
        arDx,
        arDz,
      },
      blueprintPosition: blueprintPos,
    };
  }

  // ── CHECK 4: Suboptimal Placement / Warnings (Walkway or Close Clearances) ──
  const inMainWalkway = isItemInMainWalkway(candidate);
  if (inMainWalkway) {
    // Corridor spans x: 2.15..2.95m. Shift westward towards open living/dining
    const fixDx = -0.4;
    const distCm = 40;
    const { arDx, arDz } = rotateDeltaToAr(fixDx, 0, calibration);

    return {
      status: 'warning',
      title: 'Main walkway corridor',
      problem: `Sitting inside the main walkway path from the entrance.`,
      action: `Shift the ${candidate.label.toLowerCase()} slightly to the left to keep the entry open.`,
      reason: 'Maintains an unobstructed walking path through the condo.',
      roomName,
      isOverlapping: false,
      overlappingItemLabels: [],
      isRestrictedZone: false,
      isOutOfBounds: false,
      isNearWall: false,
      isWalkwayBlocked: true,
      correctionVector: {
        dx: fixDx,
        dz: 0,
        direction: 'west',
        distanceCm: distCm,
        arDx,
        arDz,
      },
      blueprintPosition: blueprintPos,
    };
  }

  // Check tight proximity to other pieces (< 45cm)
  for (const other of otherPlacedItems) {
    const otherBounds = toBounds(other);
    const { gapM, dx, dz } = computeBoundsGap(candidateBounds, otherBounds);
    if (gapM < 0.40) {
      const neededCm = Math.max(15, Math.round((0.45 - gapM) * 100));
      const dist = Math.hypot(dx, dz) || 1;
      const pushDx = (dx / dist) * (neededCm / 100);
      const pushDz = (dz / dist) * (neededCm / 100);
      const cardDir = getCardinalDirection(pushDx, pushDz);
      const { arDx, arDz } = rotateDeltaToAr(pushDx, pushDz, calibration);

      return {
        status: 'warning',
        title: 'Tight clearance',
        problem: `A bit snug against your ${other.label}.`,
        action: `Move the ${candidate.label.toLowerCase()} about ${neededCm} cm away from the ${other.label.toLowerCase()}.`,
        reason: 'Leaves enough comfortable room to pass between them.',
        roomName,
        isOverlapping: false,
        overlappingItemLabels: [],
        isRestrictedZone: false,
        isOutOfBounds: false,
        isNearWall: false,
        isWalkwayBlocked: false,
        correctionVector: {
          dx: pushDx,
          dz: pushDz,
          direction: cardDir,
          distanceCm: neededCm,
          arDx,
          arDz,
        },
        blueprintPosition: blueprintPos,
      };
    }
  }

  // Dining table wall proximity check
  if (candidate.category === 'dining_table') {
    const wallClearanceM = 0.70;
    let pushDx = 0;
    let pushDz = 0;

    if (candidateBounds.minX < wallClearanceM) {
      pushDx = wallClearanceM - candidateBounds.minX;
    }
    if (maxUnitZM - candidateBounds.maxZ < wallClearanceM) {
      pushDz = -(wallClearanceM - (maxUnitZM - candidateBounds.maxZ));
    }

    if (pushDx > 0 || pushDz < 0) {
      const distCm = Math.round(Math.hypot(pushDx, pushDz) * 100);
      const cardDir = getCardinalDirection(pushDx, pushDz);
      const { arDx, arDz } = rotateDeltaToAr(pushDx, pushDz, calibration);

      return {
        status: 'warning',
        title: 'Chair pull-out space',
        problem: `A little close to the wall for dining chairs.`,
        action: `Pull the dining table about ${distCm} cm farther away from the wall.`,
        reason: 'Leaves plenty of room to pull chairs out and sit comfortably.',
        roomName,
        isOverlapping: false,
        overlappingItemLabels: [],
        isRestrictedZone: false,
        isOutOfBounds: false,
        isNearWall: true,
        isWalkwayBlocked: false,
        correctionVector: {
          dx: pushDx,
          dz: pushDz,
          direction: cardDir,
          distanceCm: distCm,
          arDx,
          arDz,
        },
        blueprintPosition: blueprintPos,
      };
    }
  }

  // ── CHECK 5: Comfortable / Valid Placement ──
  return {
    status: 'valid',
    title: 'Comfortable spot',
    problem: 'Clear of other furniture and main walkways.',
    action: 'Looking great! Tap the floor to set this position.',
    reason: 'Maintains open circulation and comfortable room flow.',
    roomName,
    isOverlapping: false,
    overlappingItemLabels: [],
    isRestrictedZone: false,
    isOutOfBounds: false,
    isNearWall: false,
    isWalkwayBlocked: false,
    correctionVector: null,
    blueprintPosition: blueprintPos,
  };
}
