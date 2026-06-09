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
  RED:    '#E24B4A',
  YELLOW: '#F0A500',
  GREEN:  '#4CAF50',
};

// Light enough to see the floor, vivid enough to read severity
const ZONE_OPACITY: Record<GapClassificationLevel, number> = {
  RED:    0.20,
  YELLOW: 0.15,
  GREEN:  0.09,
};

// Height of the 3D tile block (metres)
const BOX_H = 0.012;

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function getBounds(item: FurnitureItem): BoundsM {
  const halfL = item.lengthCm / 200;
  const halfW = item.widthCm  / 200;
  return {
    minX:    item.posX - halfL,
    maxX:    item.posX + halfL,
    minZ:    item.posZ - halfW,
    maxZ:    item.posZ + halfW,
    centerX: item.posX,
    centerZ: item.posZ,
    lengthM: item.lengthCm / 100,
    widthM:  item.widthCm  / 100,
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
    return { centerX: (bounds.maxX + roomWidthM) / 2, centerZ: item.posZ, sizeX: zoneSize(gap), sizeZ: zoneSize(bounds.widthM) };
  }
  if (classification.wallSide === 'north') {
    return { centerX: item.posX, centerZ: bounds.minZ / 2, sizeX: zoneSize(bounds.lengthM), sizeZ: zoneSize(bounds.minZ) };
  }
  if (classification.wallSide === 'south') {
    const gap = roomLengthM - bounds.maxZ;
    return { centerX: item.posX, centerZ: (bounds.maxZ + roomLengthM) / 2, sizeX: zoneSize(bounds.lengthM), sizeZ: zoneSize(gap) };
  }
  return { centerX: bounds.minX / 2, centerZ: item.posZ, sizeX: zoneSize(bounds.minX), sizeZ: zoneSize(bounds.widthM) };
}

function getPairZone(
  itemA: FurnitureItem,
  itemB: FurnitureItem,
  boundsA: BoundsM,
  boundsB: BoundsM,
): Pick<ZoneDefinition, 'centerX' | 'centerZ' | 'sizeX' | 'sizeZ'> {
  if (boundsA.maxX <= boundsB.minX || boundsB.maxX <= boundsA.minX) {
    const left  = boundsA.maxX <= boundsB.minX ? boundsA : boundsB;
    const right = boundsA.maxX <= boundsB.minX ? boundsB : boundsA;
    const overlapMinZ = Math.max(left.minZ, right.minZ);
    const overlapMaxZ = Math.min(left.maxZ, right.maxZ);
    const fallbackZ   = Math.min(itemA.widthCm, itemB.widthCm) / 100;
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
    const far  = boundsA.maxZ <= boundsB.minZ ? boundsB : boundsA;
    const overlapMinX = Math.max(near.minX, far.minX);
    const overlapMaxX = Math.min(near.maxX, far.maxX);
    const fallbackX   = Math.min(itemA.lengthCm, itemB.lengthCm) / 100;
    const sizeX = overlapMaxX > overlapMinX ? overlapMaxX - overlapMinX : fallbackX * 0.7;
    return {
      centerX: overlapMaxX > overlapMinX ? (overlapMinX + overlapMaxX) / 2 : (itemA.posX + itemB.posX) / 2,
      centerZ: (near.maxZ + far.minZ) / 2,
      sizeX: zoneSize(sizeX),
      sizeZ: zoneSize(far.minZ - near.maxZ),
    };
  }
  return { centerX: (itemA.posX + itemB.posX) / 2, centerZ: (itemA.posZ + itemB.posZ) / 2, sizeX: 0.16, sizeZ: 0.16 };
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
    id:             `${classification.ruleCode}-${classification.itemAId}-${classification.itemBId}-${classification.wallSide ?? 'pair'}`,
    color:          ZONE_COLOR[classification.classification],
    baseOpacity:    ZONE_OPACITY[classification.classification],
    classification: classification.classification,
    label:          `${classification.ruleCode} · ${classification.measuredCm}cm`,
    highlighted:    highlightedRuleCode === classification.ruleCode,
  };
  if (classification.itemBId === 'wall') {
    return { ...base, ...getWallZone(classification, itemA, boundsA, roomWidthM, roomLengthM) };
  }
  const itemB = itemMap.get(classification.itemBId);
  if (!itemB) return null;
  return { ...base, ...getPairZone(itemA, itemB, boundsA, getBounds(itemB)) };
}

// ─── Zone — thin 3D colour tile + crisp outline ───────────────────────────────

function Zone({ zone }: { zone: ZoneDefinition }) {
  // MeshStandardMaterial so the box gets proper depth shading from scene lights
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color:       new THREE.Color(zone.color),
        transparent: true,
        opacity:     zone.baseOpacity,
        roughness:   0.9,
        metalness:   0.0,
        depthWrite:  false,
      }),
    [zone.color, zone.baseOpacity],
  );

  // Outline on top face of the tile
  const edgeLine = useMemo(() => {
    const hw = zone.sizeX / 2;
    const hd = zone.sizeZ / 2;
    const y  = BOX_H + 0.003;
    const pts = new Float32Array([
      -hw, y, -hd,
       hw, y, -hd,
       hw, y,  hd,
      -hw, y,  hd,
      -hw, y, -hd,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({ color: zone.color, transparent: true, opacity: 0.90 });
    return new THREE.Line(geo, mat);
  }, [zone.color, zone.sizeX, zone.sizeZ]);

  // Refs let useFrame mutate opacity without hitting React compiler restrictions
  const matRef     = useRef<THREE.MeshStandardMaterial | null>(null);
  const edgeMatRef = useRef<THREE.LineBasicMaterial | null>(null);

  useEffect(() => {
    matRef.current     = material;
    edgeMatRef.current = edgeLine.material as THREE.LineBasicMaterial;
  }, [material, edgeLine]);

  useEffect(
    () => () => {
      material.dispose();
      edgeLine.geometry.dispose();
      (edgeLine.material as THREE.LineBasicMaterial).dispose();
    },
    [material, edgeLine],
  );

  useFrame(({ clock }) => {
    const t         = clock.elapsedTime;
    const speed     = zone.highlighted ? 4    : zone.classification === 'RED' ? 2.5 : 1.8;
    const amplitude = zone.highlighted ? 0.10 : 0.04;
    if (matRef.current) {
      matRef.current.opacity = Math.max(0.04, zone.baseOpacity + Math.sin(t * speed) * amplitude);
    }
    if (edgeMatRef.current) {
      edgeMatRef.current.opacity = Math.max(0.5, 0.90 + Math.sin(t * speed + 1.0) * 0.10);
    }
  });

  return (
    <group position={[zone.centerX, 0, zone.centerZ]}>
      {/* Thin box — sits on the floor, gives 3D depth */}
      <mesh position={[0, BOX_H / 2, 0]}>
        <boxGeometry args={[zone.sizeX, BOX_H, zone.sizeZ]} />
        <primitive object={material} attach="material" />
      </mesh>

      {/* Outline on top face */}
      <primitive object={edgeLine} />

      {zone.classification !== 'GREEN' && (
        <Text
          position={[0, 0.22, 0]}
          fontSize={0.065}
          color="white"
          outlineWidth={0.006}
          outlineColor={zone.color}
          anchorX="center"
          anchorY="middle"
        >
          {zone.label}
        </Text>
      )}
    </group>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

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
        .map((c) => buildZone(c, itemMap, roomWidthCm / 100, roomLengthCm / 100, highlightedRuleCode))
        .filter((z): z is ZoneDefinition => z !== null),
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
