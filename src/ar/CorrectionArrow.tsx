import { useEffect, useMemo, useRef } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { FurnitureItem, Violation } from '../types';

interface CorrectionArrowProps {
  violation: Violation;
  items: FurnitureItem[];
}

function getDirectionVector(label: string): THREE.Vector3 {
  const normalized = label.toLowerCase();
  if (normalized.includes('north')) return new THREE.Vector3(0, 0, -1);
  if (normalized.includes('south')) return new THREE.Vector3(0, 0, 1);
  if (normalized.includes('east')) return new THREE.Vector3(1, 0, 0);
  if (normalized.includes('west')) return new THREE.Vector3(-1, 0, 0);
  return new THREE.Vector3(0, 0, -1);
}

function setArrowOpacity(arrow: THREE.ArrowHelper, opacity: number) {
  const lineMaterial = arrow.line.material;
  const coneMaterial = arrow.cone.material;

  if (!Array.isArray(lineMaterial)) {
    lineMaterial.transparent = true;
    lineMaterial.opacity = opacity;
  }

  if (!Array.isArray(coneMaterial)) {
    coneMaterial.transparent = true;
    coneMaterial.opacity = opacity;
  }
}

export default function CorrectionArrow({ violation, items }: CorrectionArrowProps) {
  const item = items.find((entry) => entry.id === violation.furnitureId);
  const direction = useMemo(
    () => getDirectionVector(violation.fixDirectionLabel).normalize(),
    [violation.fixDirectionLabel],
  );
  const length = Math.max(violation.fixDirectionCm / 100, 0.2);
  const color = violation.classification === 'RED' ? 0xE24B4A : 0xF0A500;
  const arrowRef = useRef<THREE.ArrowHelper | null>(null);

  const arrow = useMemo(() => {
    const origin = new THREE.Vector3(item?.posX ?? 0, 0.05, item?.posZ ?? 0);
    const helper = new THREE.ArrowHelper(direction, origin, length, color, 0.15, 0.08);
    setArrowOpacity(helper, 0.9);
    return helper;
  }, [color, direction, item?.posX, item?.posZ, length]);

  useEffect(() => {
    arrowRef.current = arrow;
    return () => {
      arrow.line.geometry.dispose();
      arrow.cone.geometry.dispose();
      const lineMaterial = arrow.line.material;
      const coneMaterial = arrow.cone.material;
      if (!Array.isArray(lineMaterial)) lineMaterial.dispose();
      if (!Array.isArray(coneMaterial)) coneMaterial.dispose();
    };
  }, [arrow]);

  useFrame(({ clock }) => {
    if (!arrowRef.current) return;
    const opacity = 0.85 + ((Math.sin(clock.elapsedTime * 3) + 1) / 2) * 0.15;
    setArrowOpacity(arrowRef.current, opacity);
  });

  if (!item) return null;

  const labelPosition = direction
    .clone()
    .multiplyScalar(length)
    .add(new THREE.Vector3(item.posX, 0.2, item.posZ));

  return (
    <>
      <primitive object={arrow} />
      <Text
        position={[labelPosition.x, labelPosition.y, labelPosition.z]}
        fontSize={0.09}
        color="white"
        outlineWidth={0.006}
        outlineColor="black"
        anchorX="center"
        anchorY="middle"
      >
        {`${violation.fixDirectionCm} cm`}
      </Text>
    </>
  );
}
