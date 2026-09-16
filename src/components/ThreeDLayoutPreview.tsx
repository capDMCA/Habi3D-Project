import { useLayoutEffect } from 'react';
import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import type { FurnitureItem } from '../types';
import DollhouseFloorPlan from './DollhouseFloorPlan';
import DollhouseFurniture from './DollhouseFurniture';

const UNIT_CENTER: [number, number, number] = [2.55, 0.2, 4.4];
const LANDSCAPE_CAMERA_OFFSET: [number, number, number] = [7.95, 10.3, 9.6];
const PORTRAIT_CAMERA_OFFSET: [number, number, number] = [3.5, 14.5, 15];

function ResponsiveCamera() {
  const { camera, size, invalidate } = useThree();

  useLayoutEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const isPortrait = aspect < 0.8;
    const offset = isPortrait ? PORTRAIT_CAMERA_OFFSET : LANDSCAPE_CAMERA_OFFSET;
    const narrowScale = isPortrait
      ? Math.min(1.3, Math.max(1, 0.52 / aspect))
      : 1;
    camera.position.set(
      UNIT_CENTER[0] + offset[0] * narrowScale,
      UNIT_CENTER[1] + offset[1] * narrowScale,
      UNIT_CENTER[2] + offset[2] * narrowScale,
    );
    camera.lookAt(...UNIT_CENTER);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, size.height, size.width]);

  return null;
}

export default function ThreeDLayoutPreview({ items }: { items: FurnitureItem[] }) {
  return (
    <Canvas
      camera={{ position: [10.5, 10.5, 14], fov: 38, near: 0.1, far: 80 }}
      dpr={[1, 1.5]}
      frameloop="demand"
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
    >
      <color attach="background" args={['#DDE3E5']} />
      <fog attach="fog" args={['#DDE3E5', 18, 34]} />
      <hemisphereLight args={['#FFFFFF', '#879097', 1.45]} />
      <directionalLight position={[5, 12, 3]} intensity={1.25} />
      <ResponsiveCamera />

      <mesh position={[2.55, -0.22, 4.4]}>
        <boxGeometry args={[24, 0.08, 24]} />
        <meshStandardMaterial color="#AEB7BA" roughness={1} />
      </mesh>

      <DollhouseFloorPlan />
      {items.map((item) => <DollhouseFurniture key={item.id} item={item} />)}

      <OrbitControls
        makeDefault
        target={UNIT_CENTER}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={6}
        maxDistance={32}
        minPolarAngle={0.22}
        maxPolarAngle={Math.PI / 2.08}
        minAzimuthAngle={-Infinity}
        maxAzimuthAngle={Infinity}
      />
    </Canvas>
  );
}
