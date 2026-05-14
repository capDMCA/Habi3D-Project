import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

interface CorrectionArrowProps {
  posX: number;
  posZ: number;
  fixDirectionLabel: string;
  fixDirectionCm: number;
  classification: 'RED' | 'YELLOW' | 'GREEN';
}

const COLOR_BY_CLASSIFICATION: Record<CorrectionArrowProps['classification'], string> = {
  RED: '#E24B4A',
  YELLOW: '#F0A500',
  GREEN: '#639922',
};

function getDirectionVector(label: string): THREE.Vector3 {
  const normalized = label.toLowerCase();
  if (normalized.includes('north')) return new THREE.Vector3(0, 0, -1);
  if (normalized.includes('south')) return new THREE.Vector3(0, 0, 1);
  if (normalized.includes('east')) return new THREE.Vector3(1, 0, 0);
  if (normalized.includes('west')) return new THREE.Vector3(-1, 0, 0);
  return new THREE.Vector3(0, 0, -1);
}

export default function CorrectionArrow({
  posX,
  posZ,
  fixDirectionLabel,
  fixDirectionCm,
  classification,
}: CorrectionArrowProps) {
  const color = COLOR_BY_CLASSIFICATION[classification] ?? '#E24B4A';
  const direction = useMemo(() => getDirectionVector(fixDirectionLabel), [fixDirectionLabel]);
  const quaternion = useMemo(() => {
    const unit = direction.clone().normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), unit);
  }, [direction]);

  const lengthM = Math.max(0.24, fixDirectionCm / 100);
  const headHeight = 0.1;
  const shaftLength = Math.max(0.12, lengthM - headHeight);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  useFrame(({ clock }) => {
    if (!materialRef.current) return;
    materialRef.current.opacity = 0.8 + Math.sin(clock.elapsedTime * 2.8) * 0.12;
  });

  return (
    <group position={[posX, 0.05, posZ]} quaternion={quaternion}>
      <mesh position={[0, shaftLength / 2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, shaftLength, 16]} />
        <meshStandardMaterial
          ref={materialRef}
          color={color}
          transparent
          opacity={0.9}
          roughness={0.25}
          metalness={0.3}
        />
      </mesh>
      <mesh position={[0, shaftLength + headHeight / 2, 0]}>
        <coneGeometry args={[0.05, headHeight, 16]} />
        <meshStandardMaterial color={color} transparent opacity={0.9} roughness={0.25} metalness={0.3} />
      </mesh>
      <Text
        position={[0, shaftLength + headHeight + 0.14, 0]}
        fontSize={0.08}
        color="#ffffff"
        anchorX="center"
        anchorY="bottom"
      >
        {`${fixDirectionCm} cm`}
      </Text>
    </group>
  );
}
