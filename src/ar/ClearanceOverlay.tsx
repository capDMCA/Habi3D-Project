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

const TILE_M = 0.18;

function createZoneTexture(hexColor: string, classification: GapClassificationLevel): THREE.CanvasTexture {
  const res = 128;
  const offscreen = document.createElement('canvas');
  offscreen.width = res;
  offscreen.height = res;
  const ctx = offscreen.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, res, res);

    ctx.globalAlpha = classification === 'RED' ? 0.20 : classification === 'YELLOW' ? 0.15 : 0.08;
    ctx.fillStyle = hexColor;
    ctx.fillRect(0, 0, res, res);

    ctx.globalAlpha = classification === 'RED' ? 0.88 : classification === 'YELLOW' ? 0.72 : 0.52;
    ctx.strokeStyle = hexColor;
    ctx.lineWidth = classification === 'RED' ? 2.5 : 1.8;
    ctx.lineCap = 'square';

    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(res, 0.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0.5, 0);
    ctx.lineTo(0.5, res);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = hexColor;
    ctx.beginPath();
    ctx.arc(0, 0, classification === 'RED' ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(offscreen);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

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
  const fillTexture = useMemo(() => {
    const tex = createZoneTexture(zone.color, zone.classification);
    tex.repeat.set(
      Math.max(1, Math.round(zone.sizeX / TILE_M)),
      Math.max(1, Math.round(zone.sizeZ / TILE_M)),
    );
    return tex;
  }, [zone.color, zone.classification, zone.sizeX, zone.sizeZ]);

  const fillMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: fillTexture,
        transparent: true,
        opacity: zone.baseOpacity,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [fillTexture, zone.baseOpacity],
  );

  const edgeLine = useMemo(() => {
    const hw = zone.sizeX / 2;
    const hd = zone.sizeZ / 2;
    const pts = new Float32Array([
      -hw, 0, -hd,
       hw, 0, -hd,
       hw, 0,  hd,
      -hw, 0,  hd,
      -hw, 0, -hd,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({ color: zone.color, transparent: true, opacity: 0.95 });
    const l = new THREE.Line(geo, mat);
    l.position.y = 0.004;
    return l;
  }, [zone.color, zone.sizeX, zone.sizeZ]);

  const fillRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const edgeMatRef = useRef<THREE.LineBasicMaterial | null>(null);

  useEffect(() => {
    fillRef.current = fillMaterial;
    edgeMatRef.current = edgeLine.material as THREE.LineBasicMaterial;
  }, [fillMaterial, edgeLine]);

  useEffect(
    () => () => {
      fillTexture.dispose();
      fillMaterial.dispose();
      edgeLine.geometry.dispose();
      (edgeLine.material as THREE.LineBasicMaterial).dispose();
    },
    [fillTexture, fillMaterial, edgeLine],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const speed = zone.highlighted ? 4 : zone.classification === 'RED' ? 2.5 : 1.8;
    const amplitude = zone.highlighted ? 0.18 : 0.08;
    if (fillRef.current) {
      fillRef.current.opacity = Math.max(0.08, zone.baseOpacity + Math.sin(t * speed) * amplitude);
    }
    if (edgeMatRef.current) {
      edgeMatRef.current.opacity = Math.max(0.55, 0.88 + Math.sin(t * speed + 1.0) * 0.12);
    }
  });

  return (
    <group position={[zone.centerX, 0.006, zone.centerZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[zone.sizeX, zone.sizeZ]} />
        <primitive object={fillMaterial} attach="material" />
      </mesh>
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
