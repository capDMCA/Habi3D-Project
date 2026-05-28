import { useEffect, useMemo, useRef } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GapClassification } from '../engine/clearance';
import type { FurnitureItem, GapClassificationLevel } from '../types';

interface ClearanceOverlayProps {
  items: FurnitureItem[];
  classifications: GapClassification[];
  roomWidthCm: number;
  roomLengthCm: number;
  highlightedRuleCode?: string;
}

interface BoundsM {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  lengthM: number;
  widthM: number;
}

interface ZoneDefinition {
  id: string;
  centerX: number;
  centerZ: number;
  sizeX: number;
  sizeZ: number;
  color: string;
  baseOpacity: number;
  classification: GapClassificationLevel;
  label: string;
  highlighted: boolean;
}

const ZONE_COLOR: Record<GapClassificationLevel, string> = {
  RED: '#E24B4A',
  YELLOW: '#F0A500',
  GREEN: '#4CAF50',
};

const ZONE_OPACITY: Record<GapClassificationLevel, number> = {
  RED: 0.6,
  YELLOW: 0.5,
  GREEN: 0.35,
};

function getBounds(item: FurnitureItem): BoundsM {
  const halfL = item.lengthCm / 200;
  const halfW = item.widthCm / 200;

  return {
    minX: item.posX - halfL,
    maxX: item.posX + halfL,
    minZ: item.posZ - halfW,
    maxZ: item.posZ + halfW,
    centerX: item.posX,
    centerZ: item.posZ,
    lengthM: item.lengthCm / 100,
    widthM: item.widthCm / 100,
  };
}

function zoneSize(value: number, minimum = 0.035): number {
  return Math.max(Math.abs(value), minimum);
}

function getWallZone(
  classification: GapClassification,
  item: FurnitureItem,
  bounds: BoundsM,
  roomWidthM: number,
  roomLengthM: number,
): Pick<ZoneDefinition, 'centerX' | 'centerZ' | 'sizeX' | 'sizeZ'> {
  if (classification.wallSide === 'east') {
    const gap = roomWidthM - bounds.maxX;
    return {
      centerX: (bounds.maxX + roomWidthM) / 2,
      centerZ: item.posZ,
      sizeX: zoneSize(gap),
      sizeZ: zoneSize(bounds.widthM),
    };
  }

  if (classification.wallSide === 'north') {
    return {
      centerX: item.posX,
      centerZ: bounds.minZ / 2,
      sizeX: zoneSize(bounds.lengthM),
      sizeZ: zoneSize(bounds.minZ),
    };
  }

  if (classification.wallSide === 'south') {
    const gap = roomLengthM - bounds.maxZ;
    return {
      centerX: item.posX,
      centerZ: (bounds.maxZ + roomLengthM) / 2,
      sizeX: zoneSize(bounds.lengthM),
      sizeZ: zoneSize(gap),
    };
  }

  return {
    centerX: bounds.minX / 2,
    centerZ: item.posZ,
    sizeX: zoneSize(bounds.minX),
    sizeZ: zoneSize(bounds.widthM),
  };
}

function getPairZone(
  itemA: FurnitureItem,
  itemB: FurnitureItem,
  boundsA: BoundsM,
  boundsB: BoundsM,
): Pick<ZoneDefinition, 'centerX' | 'centerZ' | 'sizeX' | 'sizeZ'> {
  if (boundsA.maxX <= boundsB.minX || boundsB.maxX <= boundsA.minX) {
    const left = boundsA.maxX <= boundsB.minX ? boundsA : boundsB;
    const right = boundsA.maxX <= boundsB.minX ? boundsB : boundsA;
    const overlapMinZ = Math.max(left.minZ, right.minZ);
    const overlapMaxZ = Math.min(left.maxZ, right.maxZ);
    const fallbackZ = Math.min(itemA.widthCm, itemB.widthCm) / 100;
    const sizeZ = overlapMaxZ > overlapMinZ ? overlapMaxZ - overlapMinZ : fallbackZ * 0.7;

    return {
      centerX: (left.maxX + right.minX) / 2,
      centerZ: overlapMaxZ > overlapMinZ ? (overlapMinZ + overlapMaxZ) / 2 : (itemA.posZ + itemB.posZ) / 2,
      sizeX: zoneSize(right.minX - left.maxX),
      sizeZ: zoneSize(sizeZ),
    };
  }

  if (boundsA.maxZ <= boundsB.minZ || boundsB.maxZ <= boundsA.minZ) {
    const near = boundsA.maxZ <= boundsB.minZ ? boundsA : boundsB;
    const far = boundsA.maxZ <= boundsB.minZ ? boundsB : boundsA;
    const overlapMinX = Math.max(near.minX, far.minX);
    const overlapMaxX = Math.min(near.maxX, far.maxX);
    const fallbackX = Math.min(itemA.lengthCm, itemB.lengthCm) / 100;
    const sizeX = overlapMaxX > overlapMinX ? overlapMaxX - overlapMinX : fallbackX * 0.7;

    return {
      centerX: overlapMaxX > overlapMinX ? (overlapMinX + overlapMaxX) / 2 : (itemA.posX + itemB.posX) / 2,
      centerZ: (near.maxZ + far.minZ) / 2,
      sizeX: zoneSize(sizeX),
      sizeZ: zoneSize(far.minZ - near.maxZ),
    };
  }

  return {
    centerX: (itemA.posX + itemB.posX) / 2,
    centerZ: (itemA.posZ + itemB.posZ) / 2,
    sizeX: 0.16,
    sizeZ: 0.16,
  };
}

function buildZone(
  classification: GapClassification,
  itemMap: Map<string, FurnitureItem>,
  roomWidthM: number,
  roomLengthM: number,
  highlightedRuleCode?: string,
): ZoneDefinition | null {
  const itemA = itemMap.get(classification.itemAId);
  if (!itemA) return null;

  const boundsA = getBounds(itemA);
  const base = {
    id: `${classification.ruleCode}-${classification.itemAId}-${classification.itemBId}-${classification.wallSide ?? 'pair'}`,
    color: ZONE_COLOR[classification.classification],
    baseOpacity: ZONE_OPACITY[classification.classification],
    classification: classification.classification,
    label: `${classification.ruleCode} - ${classification.measuredCm}cm`,
    highlighted: highlightedRuleCode === classification.ruleCode,
  };

  if (classification.itemBId === 'wall') {
    return {
      ...base,
      ...getWallZone(classification, itemA, boundsA, roomWidthM, roomLengthM),
    };
  }

  const itemB = itemMap.get(classification.itemBId);
  if (!itemB) return null;

  return {
    ...base,
    ...getPairZone(itemA, itemB, boundsA, getBounds(itemB)),
  };
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
    [zone.baseOpacity, zone.color],
  );
  const materialRef = useRef(material);

  useEffect(() => {
    materialRef.current = material;
    return () => material.dispose();
  }, [material]);

  useFrame(({ clock }) => {
    const pulseSpeed = zone.highlighted ? 4 : 2;
    const pulseSize = zone.highlighted ? 0.16 : 0.1;
    materialRef.current.opacity = Math.max(
      0.1,
      zone.baseOpacity + Math.sin(clock.elapsedTime * pulseSpeed) * pulseSize,
    );
  });

  return (
    <group position={[zone.centerX, 0.008, zone.centerZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[zone.sizeX, zone.sizeZ]} />
        <primitive object={material} attach="material" />
      </mesh>
      {zone.classification !== 'GREEN' && (
        <Text
          position={[0, 0.25, 0]}
          fontSize={0.07}
          color="white"
          outlineWidth={0.005}
          outlineColor="black"
          anchorX="center"
          anchorY="middle"
        >
          {zone.label}
        </Text>
      )}
    </group>
  );
}

export default function ClearanceOverlay({
  items,
  classifications,
  roomWidthCm,
  roomLengthCm,
  highlightedRuleCode,
}: ClearanceOverlayProps) {
  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.id, item] as const)),
    [items],
  );
  const zones = useMemo(
    () =>
      classifications
        .map((classification) =>
          buildZone(
            classification,
            itemMap,
            roomWidthCm / 100,
            roomLengthCm / 100,
            highlightedRuleCode,
          ),
        )
        .filter((zone): zone is ZoneDefinition => zone !== null),
    [classifications, highlightedRuleCode, itemMap, roomLengthCm, roomWidthCm],
  );

  return (
    <>
      {zones.map((zone) => (
        <Zone key={zone.id} zone={zone} />
      ))}
    </>
  );
}
