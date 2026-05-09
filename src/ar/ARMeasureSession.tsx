import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useXRHitTest } from '@react-three/xr';
import * as THREE from 'three';

interface ARMeasureSessionProps {
  onMeasured: (distanceCm: number) => void;
}

const hitMatrix = new THREE.Matrix4();

function cloneFloorPoint(point: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(point.x, 0, point.z);
}

function getFloorDistanceCm(start: THREE.Vector3, end: THREE.Vector3): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  return Math.round(Math.sqrt(dx * dx + dz * dz) * 100);
}

function MeasurementLine({
  start,
  end,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
}) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(start.x, 0.025, start.z),
      new THREE.Vector3(end.x, 0.025, end.z),
    ]);
    const material = new THREE.LineBasicMaterial({ color: '#2563eb' });
    return new THREE.Line(geometry, material);
  }, [start, end]);

  useEffect(
    () => () => {
      line.geometry.dispose();
      const material = line.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose());
      } else {
        material.dispose();
      }
    },
    [line],
  );

  return <primitive object={line} />;
}

function DistanceLabel({
  position,
  distanceCm,
}: {
  position: THREE.Vector3;
  distanceCm: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;

    const context = canvas.getContext('2d');
    if (!context) return new THREE.CanvasTexture(canvas);

    context.fillStyle = 'rgba(17, 24, 39, 0.88)';
    context.roundRect(8, 8, 240, 80, 18);
    context.fill();
    context.fillStyle = '#ffffff';
    context.font = '700 34px Inter, Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(`${distanceCm} cm`, 128, 48);

    const canvasTexture = new THREE.CanvasTexture(canvas);
    canvasTexture.needsUpdate = true;
    return canvasTexture;
  }, [distanceCm]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={[position.x, 0.28, position.z]} scale={[0.42, 0.16, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

export default function ARMeasureSession({
  onMeasured,
}: ARMeasureSessionProps) {
  const latestHitRef = useRef<THREE.Vector3 | null>(null);
  const measuredRef = useRef(false);
  const [startPoint, setStartPoint] = useState<THREE.Vector3 | null>(null);
  const [endPoint, setEndPoint] = useState<THREE.Vector3 | null>(null);
  const [previewPoint, setPreviewPoint] = useState<THREE.Vector3 | null>(null);

  useXRHitTest(
    useCallback((results, getWorldMatrix) => {
      if (results.length === 0) return;

      const hasMatrix = getWorldMatrix(hitMatrix, results[0]);
      if (!hasMatrix) return;

      const point = new THREE.Vector3().setFromMatrixPosition(hitMatrix);
      const floorPoint = cloneFloorPoint(point);
      latestHitRef.current = floorPoint;
      setPreviewPoint(floorPoint.clone());
    }, []),
    'viewer',
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, input, select, textarea')) return;

      const hit = latestHitRef.current;
      if (!hit || measuredRef.current) return;

      if (!startPoint) {
        setStartPoint(hit.clone());
        return;
      }

      const finalPoint = hit.clone();
      const distanceCm = getFloorDistanceCm(startPoint, finalPoint);
      measuredRef.current = true;
      setEndPoint(finalPoint);
      onMeasured(distanceCm);
    }

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [onMeasured, startPoint]);

  const activeEndPoint = endPoint ?? previewPoint;
  const distanceCm =
    startPoint && activeEndPoint ? getFloorDistanceCm(startPoint, activeEndPoint) : null;
  const labelPosition =
    startPoint && activeEndPoint
      ? new THREE.Vector3(
          (startPoint.x + activeEndPoint.x) / 2,
          0,
          (startPoint.z + activeEndPoint.z) / 2,
        )
      : null;

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[2, 4, 2]} intensity={0.8} />

      {previewPoint && !endPoint && (
        <mesh position={[previewPoint.x, 0.018, previewPoint.z]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.07, 0.08, 32]} />
          <meshBasicMaterial color="#22c55e" side={THREE.DoubleSide} transparent opacity={0.9} />
        </mesh>
      )}

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

      {startPoint && activeEndPoint && (
        <MeasurementLine start={startPoint} end={activeEndPoint} />
      )}

      {distanceCm !== null && labelPosition && (
        <DistanceLabel position={labelPosition} distanceCm={distanceCm} />
      )}
    </>
  );
}
