import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { CorrectionVector, PlacementStatus } from './placementValidation';

interface ARCorrectionIndicatorProps {
  position: { x: number; z: number };
  correctionVector: CorrectionVector | null;
  status: PlacementStatus;
}

export default function ARCorrectionIndicator({
  position,
  correctionVector,
  status,
}: ARCorrectionIndicatorProps) {
  const groupRef = useRef<THREE.Group | null>(null);

  // Status colors
  const colorHex = status === 'invalid' ? '#ef4444' : '#f59e0b';
  const threeColor = useMemo(() => new THREE.Color(colorHex), [colorHex]);

  // Compute direction and angle in AR session space
  const { angleRad, lengthM } = useMemo(() => {
    if (!correctionVector) return { angleRad: 0, lengthM: 0.4 };
    const dx = correctionVector.arDx;
    const dz = correctionVector.arDz;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return { angleRad: 0, lengthM: 0.4 };
    // Angle in XZ plane around Y axis: 0 is +X, -PI/2 is +Z
    const angle = Math.atan2(dx, dz);
    const clampedLen = Math.max(0.35, Math.min(0.75, len));
    return { angleRad: angle, lengthM: clampedLen };
  }, [correctionVector]);

  // Dynamic subtle pulse animation
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    const bob = Math.sin(t * 4) * 0.02;
    groupRef.current.position.y = 0.04 + bob;
  });

  if (!correctionVector || status === 'valid') {
    return null;
  }

  const shaftLength = lengthM * 0.65;
  const headLength = lengthM * 0.35;

  return (
    <group
      ref={groupRef}
      position={[position.x, 0.04, position.z]}
      rotation={[0, angleRad, 0]}
    >
      {/* 3D Arrow Shaft */}
      <mesh position={[0, 0, shaftLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, shaftLength, 16]} />
        <meshStandardMaterial
          color={threeColor}
          emissive={threeColor}
          emissiveIntensity={0.35}
          roughness={0.3}
          metalness={0.1}
          transparent
          opacity={0.88}
        />
      </mesh>

      {/* 3D Arrow Head (Cone) */}
      <mesh position={[0, 0, shaftLength + headLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.065, headLength, 16]} />
        <meshStandardMaterial
          color={threeColor}
          emissive={threeColor}
          emissiveIntensity={0.45}
          roughness={0.3}
          metalness={0.1}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Floating Guidance Text in 3D */}
      <Text
        position={[0, 0.12, shaftLength / 2]}
        rotation={[-Math.PI / 4, 0, 0]}
        fontSize={0.07}
        color="#ffffff"
        outlineWidth={0.008}
        outlineColor="#111827"
        anchorX="center"
        anchorY="bottom"
      >
        {`Shift ${correctionVector.distanceCm} cm`}
      </Text>
    </group>
  );
}
