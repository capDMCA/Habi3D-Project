import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createFurnitureShape } from './shapeLibrary';
import type { FurnitureItem } from '../types';
import type { PlacementStatus } from './placementValidation';

interface PlacementMeshProps {
  item: FurnitureItem;
  position: { x: number; z: number };
  rotationY: number;
  mode: 'ghost' | 'placed';
  status?: PlacementStatus;
  showLabel?: boolean;
}

function makeLabelTexture(label: string, status?: PlacementStatus): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;

  const context = canvas.getContext('2d');
  if (context) {
    let bgColor = 'rgba(17, 24, 39, 0.9)';
    if (status === 'valid') bgColor = 'rgba(6, 95, 70, 0.92)';
    else if (status === 'warning') bgColor = 'rgba(146, 64, 14, 0.92)';
    else if (status === 'invalid') bgColor = 'rgba(153, 27, 27, 0.92)';

    context.fillStyle = bgColor;
    context.roundRect(12, 18, 488, 92, 20);
    context.fill();

    context.fillStyle = '#ffffff';
    context.font = '700 36px Inter, -apple-system, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label.slice(0, 24), 256, 64);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function FloatingLabel({
  label,
  y,
  status,
}: {
  label: string;
  y: number;
  status?: PlacementStatus;
}) {
  const texture = useMemo(() => makeLabelTexture(label, status), [label, status]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={[0, y, 0]} scale={[0.72, 0.18, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

export default function PlacementMesh({
  item,
  position,
  rotationY,
  mode,
  status = 'valid',
  showLabel = false,
}: PlacementMeshProps) {
  const { geometry, boundingBox } = useMemo(
    () =>
      createFurnitureShape(item.shape, {
        lengthCm: item.lengthCm,
        widthCm: item.widthCm,
        heightCm: item.heightCm,
      }),
    [item.heightCm, item.lengthCm, item.shape, item.widthCm],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Visual styling based on validation feedback
  const { meshColor, emissiveColor, emissiveIntensity, opacity } = useMemo(() => {
    if (mode === 'placed') {
      return {
        meshColor: '#2B4E8C',
        emissiveColor: '#000000',
        emissiveIntensity: 0,
        opacity: 0.95,
      };
    }

    if (status === 'valid') {
      return {
        meshColor: '#10b981',
        emissiveColor: '#059669',
        emissiveIntensity: 0.22,
        opacity: 0.65,
      };
    }
    if (status === 'warning') {
      return {
        meshColor: '#f59e0b',
        emissiveColor: '#d97706',
        emissiveIntensity: 0.28,
        opacity: 0.70,
      };
    }
    // Invalid
    return {
      meshColor: '#ef4444',
      emissiveColor: '#dc2626',
      emissiveIntensity: 0.35,
      opacity: 0.72,
    };
  }, [mode, status]);

  const meshY = boundingBox.heightM / 2;
  const labelY = boundingBox.heightM + 0.26;
  const footprintLength = item.lengthCm / 100;
  const footprintWidth = item.widthCm / 100;

  return (
    <group position={[position.x, meshY, position.z]} rotation={[0, rotationY, 0]}>
      {/* 3D Furniture Ghost/Placed Mesh */}
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={meshColor}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          roughness={0.4}
          metalness={0.1}
          transparent={mode === 'ghost'}
          opacity={opacity}
          depthWrite={mode !== 'ghost'}
        />
      </mesh>

      {/* Floor Footprint Ring (Floor projection indicator) */}
      {mode === 'ghost' && (
        <mesh position={[0, -meshY + 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          {item.shape === 'round' ? (
            <ringGeometry args={[footprintLength / 2 - 0.04, footprintLength / 2, 32]} />
          ) : (
            <planeGeometry args={[footprintLength + 0.06, footprintWidth + 0.06]} />
          )}
          <meshBasicMaterial
            color={meshColor}
            transparent
            opacity={0.32}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {showLabel && <FloatingLabel label={item.label} y={labelY} status={status} />}
    </group>
  );
}
