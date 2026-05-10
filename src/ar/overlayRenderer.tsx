import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { FurnitureItem, GapClassificationLevel } from '../types';
import type { GapClassification, WallSide } from '../engine/clearance';

interface OverlaySceneProps {
  items: FurnitureItem[];
  classifications: GapClassification[];
  roomWidthCm: number;
  roomLengthCm: number;
}

interface OverlayPlane {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  color: string;
  opacity: number;
}

const COLORS: Record<GapClassificationLevel, string> = {
  RED: '#E24B4A',
  YELLOW: '#BA7517',
  GREEN: '#639922',
};

const OPACITY: Record<GapClassificationLevel, number> = {
  RED: 0.55,
  YELLOW: 0.45,
  GREEN: 0.35,
};

function getBounds(item: FurnitureItem) {
  const lengthM = item.lengthCm / 100;
  const widthM = item.widthCm / 100;

  return {
    minX: item.posX - lengthM / 2,
    maxX: item.posX + lengthM / 2,
    minZ: item.posZ - widthM / 2,
    maxZ: item.posZ + widthM / 2,
    centerX: item.posX,
    centerZ: item.posZ,
  };
}

function wallPlane(
  item: FurnitureItem,
  wallSide: WallSide,
  classification: GapClassification,
  roomWidthM: number,
  roomLengthM: number,
): OverlayPlane {
  const bounds = getBounds(item);
  const color = COLORS[classification.classification];
  const opacity = OPACITY[classification.classification];
  const gapM = Math.max(0.03, classification.measuredCm / 100);

  if (wallSide === 'west') {
    return {
      id: `${classification.ruleCode}-${item.id}-west`,
      x: bounds.minX / 2,
      z: item.posZ,
      width: Math.max(bounds.minX, 0.03),
      depth: Math.max(bounds.maxZ - bounds.minZ, 0.08),
      color,
      opacity,
    };
  }

  if (wallSide === 'east') {
    return {
      id: `${classification.ruleCode}-${item.id}-east`,
      x: (bounds.maxX + roomWidthM) / 2,
      z: item.posZ,
      width: gapM,
      depth: Math.max(bounds.maxZ - bounds.minZ, 0.08),
      color,
      opacity,
    };
  }

  if (wallSide === 'north') {
    return {
      id: `${classification.ruleCode}-${item.id}-north`,
      x: item.posX,
      z: bounds.minZ / 2,
      width: Math.max(bounds.maxX - bounds.minX, 0.08),
      depth: Math.max(bounds.minZ, 0.03),
      color,
      opacity,
    };
  }

  return {
    id: `${classification.ruleCode}-${item.id}-south`,
    x: item.posX,
    z: (bounds.maxZ + roomLengthM) / 2,
    width: Math.max(bounds.maxX - bounds.minX, 0.08),
    depth: gapM,
    color,
    opacity,
  };
}

function pairPlane(
  itemA: FurnitureItem,
  itemB: FurnitureItem,
  classification: GapClassification,
): OverlayPlane {
  const a = getBounds(itemA);
  const b = getBounds(itemB);
  const gapX = Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX));
  const gapZ = Math.max(0, Math.max(a.minZ, b.minZ) - Math.min(a.maxZ, b.maxZ));
  const overlapX = Math.max(0.08, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const overlapZ = Math.max(0.08, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ));
  const color = COLORS[classification.classification];
  const opacity = OPACITY[classification.classification];

  if (gapX >= gapZ && gapX > 0) {
    const left = a.centerX <= b.centerX ? a : b;
    const right = a.centerX <= b.centerX ? b : a;
    return {
      id: `${classification.ruleCode}-${itemA.id}-${itemB.id}`,
      x: (left.maxX + right.minX) / 2,
      z: (itemA.posZ + itemB.posZ) / 2,
      width: Math.max(gapX, 0.03),
      depth: overlapZ,
      color,
      opacity,
    };
  }

  if (gapZ > 0) {
    const top = a.centerZ <= b.centerZ ? a : b;
    const bottom = a.centerZ <= b.centerZ ? b : a;
    return {
      id: `${classification.ruleCode}-${itemA.id}-${itemB.id}`,
      x: (itemA.posX + itemB.posX) / 2,
      z: (top.maxZ + bottom.minZ) / 2,
      width: overlapX,
      depth: Math.max(gapZ, 0.03),
      color,
      opacity,
    };
  }

  return {
    id: `${classification.ruleCode}-${itemA.id}-${itemB.id}`,
    x: (itemA.posX + itemB.posX) / 2,
    z: (itemA.posZ + itemB.posZ) / 2,
    width: 0.16,
    depth: 0.16,
    color,
    opacity,
  };
}

function PulsingPlane({ plane }: { plane: OverlayPlane }) {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (!materialRef.current) return;
    const pulse = (Math.sin(clock.elapsedTime * 2.4) + 1) / 2;
    materialRef.current.opacity = plane.opacity - pulse * 0.15;
  });

  return (
    <mesh position={[plane.x, 0.01, plane.z]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[plane.width, plane.depth]} />
      <meshBasicMaterial
        ref={materialRef}
        color={plane.color}
        transparent
        opacity={plane.opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default function OverlayScene({
  items,
  classifications,
  roomWidthCm,
  roomLengthCm,
}: OverlaySceneProps) {
  const planes = useMemo(() => {
    const roomWidthM = roomWidthCm / 100;
    const roomLengthM = roomLengthCm / 100;
    const itemById = new Map(items.map((item) => [item.id, item]));

    return classifications
      .map((classification) => {
        const itemA = itemById.get(classification.itemAId);
        if (!itemA) return null;

        if (classification.itemBId === 'wall') {
          return wallPlane(
            itemA,
            classification.wallSide ?? 'west',
            classification,
            roomWidthM,
            roomLengthM,
          );
        }

        const itemB = itemById.get(classification.itemBId);
        if (!itemB) return null;
        return pairPlane(itemA, itemB, classification);
      })
      .filter((plane): plane is OverlayPlane => plane !== null);
  }, [classifications, items, roomLengthCm, roomWidthCm]);

  return (
    <>
      {planes.map((plane) => (
        <PulsingPlane key={plane.id} plane={plane} />
      ))}
    </>
  );
}
