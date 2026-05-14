import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { FurnitureItem } from '../types';
import type { GapClassification } from '../engine/clearance';

const ZONE_COLORS = {
  RED: '#E24B4A',
  YELLOW: '#F0A500',
  GREEN: '#4CAF50',
} as const;

const ZONE_OPACITY = {
  RED: 0.6,
  YELLOW: 0.5,
  GREEN: 0.35,
} as const;

interface ClearanceOverlayProps {
  items: FurnitureItem[];
  classifications: GapClassification[];
  roomWidthCm: number;
  roomLengthCm: number;
}

interface ZoneDefinition {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  color: string;
  baseOpacity: number;
  classification: 'RED' | 'YELLOW' | 'GREEN';
  label?: string;
  showLabel: boolean;
}

function getBounds(item: FurnitureItem) {
  const x = item.posX * 100;
  const z = item.posZ * 100;
  return {
    minX: x - item.lengthCm / 2,
    maxX: x + item.lengthCm / 2,
    minZ: z - item.widthCm / 2,
    maxZ: z + item.widthCm / 2,
    centerX: x,
    centerZ: z,
  };
}

function clampMinimum(value: number, min: number) {
  return value > 0 ? Math.max(value, min) : min;
}

function buildZone(
  classification: GapClassification,
  itemMap: Map<string, FurnitureItem>,
  roomWidthM: number,
  roomLengthM: number,
): ZoneDefinition | null {
  const itemA = itemMap.get(classification.itemAId);
  if (!itemA) return null;
  const boundsA = getBounds(itemA);
  const color = ZONE_COLORS[classification.classification];
  const baseOpacity = ZONE_OPACITY[classification.classification];
  const label = classification.classification !== 'GREEN'
    ? `${classification.ruleCode} · ${classification.measuredCm}cm`
    : undefined;
  const showLabel = classification.classification !== 'GREEN';

  if (classification.itemBId === 'wall') {
    const wallSide = classification.wallSide ?? 'west';
    const depth = clampMinimum(classification.measuredCm, 2.5);
    let width = 0;
    let x = boundsA.centerX;
    let z = boundsA.centerZ;

    if (wallSide === 'west') {
      width = clampMinimum(boundsA.maxZ - boundsA.minZ, 8);
      x = boundsA.minX / 2;
      z = boundsA.centerZ;
    } else if (wallSide === 'east') {
      width = clampMinimum(boundsA.maxZ - boundsA.minZ, 8);
      x = (boundsA.maxX + roomWidthM * 100) / 2;
      z = boundsA.centerZ;
    } else if (wallSide === 'north') {
      width = clampMinimum(boundsA.maxX - boundsA.minX, 8);
      z = boundsA.minZ / 2;
      x = boundsA.centerX;
    } else {
      width = clampMinimum(boundsA.maxX - boundsA.minX, 8);
      z = (boundsA.maxZ + roomLengthM * 100) / 2;
      x = boundsA.centerX;
    }

    return {
      id: `wall-${classification.itemAId}-${classification.ruleCode}-${wallSide}`,
      x: x / 100,
      z: z / 100,
      width: width / 100,
      depth: depth / 100,
      color,
      baseOpacity,
      classification: classification.classification,
      label,
      showLabel,
    };
  }

  const itemB = itemMap.get(classification.itemBId);
  if (!itemB) return null;
  const boundsB = getBounds(itemB);

  const gapX = Math.max(0, Math.max(boundsA.minX, boundsB.minX) - Math.min(boundsA.maxX, boundsB.maxX));
  const gapZ = Math.max(0, Math.max(boundsA.minZ, boundsB.minZ) - Math.min(boundsA.maxZ, boundsB.maxZ));
  const overlapX = Math.max(0, Math.min(boundsA.maxX, boundsB.maxX) - Math.max(boundsA.minX, boundsB.minX));
  const overlapZ = Math.max(0, Math.min(boundsA.maxZ, boundsB.maxZ) - Math.max(boundsA.minZ, boundsB.minZ));

  if (gapX > 0) {
    const left = boundsA.centerX < boundsB.centerX ? boundsA : boundsB;
    const right = boundsA.centerX < boundsB.centerX ? boundsB : boundsA;
    const x = (left.maxX + right.minX) / 2;
    const z = (Math.max(boundsA.minZ, boundsB.minZ) + Math.min(boundsA.maxZ, boundsB.maxZ)) / 2;
    return {
      id: `${classification.itemAId}-${classification.itemBId}-${classification.ruleCode}`,
      x: x / 100,
      z: z / 100,
      width: clampMinimum(overlapZ, 8) / 100,
      depth: clampMinimum(gapX, 3) / 100,
      color,
      baseOpacity,
      classification: classification.classification,
      label,
      showLabel,
    };
  }

  if (gapZ > 0) {
    const top = boundsA.centerZ < boundsB.centerZ ? boundsA : boundsB;
    const bottom = boundsA.centerZ < boundsB.centerZ ? boundsB : boundsA;
    const z = (top.maxZ + bottom.minZ) / 2;
    const x = (Math.max(boundsA.minX, boundsB.minX) + Math.min(boundsA.maxX, boundsB.maxX)) / 2;
    return {
      id: `${classification.itemAId}-${classification.itemBId}-${classification.ruleCode}`,
      x: x / 100,
      z: z / 100,
      width: clampMinimum(overlapX, 8) / 100,
      depth: clampMinimum(gapZ, 3) / 100,
      color,
      baseOpacity,
      classification: classification.classification,
      label,
      showLabel,
    };
  }

  return null;
}

function Zone({ zone }: { zone: ZoneDefinition }) {
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: zone.color,
        transparent: true,
        opacity: zone.baseOpacity,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [zone.color, zone.baseOpacity],
  );

  const materialRef = useRef<THREE.MeshBasicMaterial>(material);

  useEffect(() => {
    materialRef.current = material;
    return () => {
      material.dispose();
    };
  }, [material]);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.opacity = zone.baseOpacity + Math.sin(clock.elapsedTime * 2) * 0.1;
    }
  });

  return (
    <group position={[zone.x, 0.005, zone.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[zone.width, zone.depth]} />
        <primitive object={material} attach="material" />
      </mesh>
      {zone.showLabel && zone.label && (
        <Text
          fontSize={0.08}
          color="#ffffff"
          outlineColor="#000000"
          outlineWidth={0.06}
          anchorX="center"
          anchorY="middle"
          position={[0, 0.2, 0]}
        >
          {zone.label}
        </Text>
      )}
    </group>
  );
}

export default function ClearanceOverlay({ items, classifications, roomWidthCm, roomLengthCm }: ClearanceOverlayProps) {
  const roomWidthM = roomWidthCm / 100;
  const roomLengthM = roomLengthCm / 100;
  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.id, item] as const)),
    [items],
  );

  const zones = useMemo(
    () =>
      classifications
        .map((classification) =>
          buildZone(classification, itemMap, roomWidthM, roomLengthM),
        )
        .filter((zone): zone is ZoneDefinition => zone !== null),
    [classifications, itemMap, roomLengthM, roomWidthM],
  );

  return <>{zones.map((zone) => <Zone key={zone.id} zone={zone} />)}</>;
}
