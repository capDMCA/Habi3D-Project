import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useXRHitTest } from '@react-three/xr';
import * as THREE from 'three';

interface ARMeasureSessionProps {
  onMeasured: (distanceCm: number) => void;
  labelDivRef?: RefObject<HTMLDivElement | null>;
}

const hitMatrix = new THREE.Matrix4();
const _scratchVec = new THREE.Vector3();

function getFloorDistanceCm(start: THREE.Vector3, end: THREE.Vector3): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  return Math.round(Math.sqrt(dx * dx + dz * dz) * 100);
}

export default function ARMeasureSession({ onMeasured, labelDivRef }: ARMeasureSessionProps) {
  const latestHitRef = useRef<THREE.Vector3 | null>(null);
  const measuredRef = useRef(false);
  const startPointRef = useRef<THREE.Vector3 | null>(null);
  const reticleGroupRef = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.Line | null>(null);

  const [startPoint, setStartPoint] = useState<THREE.Vector3 | null>(null);
  const [endPoint, setEndPoint] = useState<THREE.Vector3 | null>(null);

  const { scene } = useThree();

  useEffect(() => {
    startPointRef.current = startPoint;
  }, [startPoint]);

  // Line lives entirely outside JSX — added to scene imperatively, mutated via ref
  useEffect(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const material = new THREE.LineBasicMaterial({ color: '#ffffff', linewidth: 1 });
    const l = new THREE.Line(geometry, material);
    l.visible = false;
    l.frustumCulled = false;
    lineRef.current = l;
    scene.add(l);
    return () => {
      scene.remove(l);
      geometry.dispose();
      material.dispose();
      lineRef.current = null;
    };
  }, [scene]);

  useXRHitTest(
    useCallback((results, getWorldMatrix) => {
      if (results.length === 0) return;
      if (!getWorldMatrix(hitMatrix, results[0])) return;

      const point = new THREE.Vector3().setFromMatrixPosition(hitMatrix);
      latestHitRef.current = new THREE.Vector3(point.x, 0, point.z);

      if (reticleGroupRef.current && !measuredRef.current) {
        reticleGroupRef.current.position.set(point.x, 0.018, point.z);
        reticleGroupRef.current.visible = true;
      }
    }, []),
    'viewer',
  );

  useFrame(({ camera, size }) => {
    const l = lineRef.current;
    const start = startPointRef.current;
    const hit = latestHitRef.current;

    if (measuredRef.current || !l) return;

    if (!start || !hit) {
      l.visible = false;
      if (labelDivRef?.current) labelDivRef.current.style.display = 'none';
      return;
    }

    l.visible = true;
    const attr = l.geometry.attributes.position as THREE.BufferAttribute;
    attr.setXYZ(0, start.x, 0.025, start.z);
    attr.setXYZ(1, hit.x, 0.025, hit.z);
    attr.needsUpdate = true;
    l.geometry.computeBoundingSphere();

    if (labelDivRef?.current) {
      _scratchVec.set((start.x + hit.x) / 2, 0.06, (start.z + hit.z) / 2);
      _scratchVec.project(camera);
      const sx = ((_scratchVec.x + 1) / 2) * size.width;
      const sy = ((-_scratchVec.y + 1) / 2) * size.height;
      const distanceCm = getFloorDistanceCm(start, hit);
      const div = labelDivRef.current;
      div.textContent = `${distanceCm} cm`;
      div.style.display = 'block';
      div.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`;
    }
  });

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, input, select, textarea')) return;

      const hit = latestHitRef.current;
      if (!hit || measuredRef.current) return;

      if (!startPoint) {
        setStartPoint(hit.clone());
        if (reticleGroupRef.current) reticleGroupRef.current.visible = false;
        return;
      }

      const finalPoint = hit.clone();
      const distanceCm = getFloorDistanceCm(startPoint, finalPoint);
      measuredRef.current = true;
      setEndPoint(finalPoint);

      if (labelDivRef?.current) {
        labelDivRef.current.textContent = `${distanceCm} cm`;
        labelDivRef.current.style.display = 'block';
      }

      onMeasured(distanceCm);
    }

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [onMeasured, startPoint, labelDivRef]);

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[2, 4, 2]} intensity={0.8} />

      {/* Reticle: ring + dot composite — always mounted, moved/shown imperatively */}
      <group ref={reticleGroupRef} visible={false} rotation-x={-Math.PI / 2}>
        <mesh>
          <torusGeometry args={[0.047, 0.004, 16, 48]} />
          <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.92} depthWrite={false} />
        </mesh>
        <mesh>
          <circleGeometry args={[0.005, 16]} />
          <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.92} depthWrite={false} />
        </mesh>
      </group>

      {startPoint && (
        <mesh position={[startPoint.x, 0.04, startPoint.z]}>
          <sphereGeometry args={[0.045, 24, 16]} />
          <meshStandardMaterial color="#2563eb" roughness={0.5} />
        </mesh>
      )}

      {endPoint && (
        <mesh position={[endPoint.x, 0.04, endPoint.z]}>
          <sphereGeometry args={[0.045, 24, 16]} />
          <meshStandardMaterial color="#ef4444" roughness={0.5} />
        </mesh>
      )}
    </>
  );
}
