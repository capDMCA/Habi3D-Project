import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FurnitureShape } from '../types';

export interface FurnitureShapeDimensionsCm {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface FurnitureBoundingBoxM {
  widthM: number;
  depthM: number;
  heightM: number;
}

export interface FurnitureShapeModel {
  geometry: THREE.BufferGeometry;
  boundingBox: FurnitureBoundingBoxM;
}

const CM_TO_M = 0.01;
const MIN_VISUAL_DIMENSION_M = 0.01;

function cmToMeters(valueCm: number): number {
  return Math.max(valueCm * CM_TO_M, MIN_VISUAL_DIMENSION_M);
}

function getBoundingBox({
  lengthCm,
  widthCm,
  heightCm,
}: FurnitureShapeDimensionsCm): FurnitureBoundingBoxM {
  return {
    widthM: cmToMeters(lengthCm),
    depthM: cmToMeters(widthCm),
    heightM: cmToMeters(heightCm),
  };
}

function centerAndPrepare(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

export function createRectangleGeometry(
  dimensionsCm: FurnitureShapeDimensionsCm,
): FurnitureShapeModel {
  const boundingBox = getBoundingBox(dimensionsCm);
  const geometry = new THREE.BoxGeometry(
    boundingBox.widthM,
    boundingBox.heightM,
    boundingBox.depthM,
  );

  return {
    geometry: centerAndPrepare(geometry),
    boundingBox,
  };
}

export function createLShapeGeometry(
  dimensionsCm: FurnitureShapeDimensionsCm,
): FurnitureShapeModel {
  const boundingBox = getBoundingBox(dimensionsCm);
  const legThicknessX = boundingBox.widthM * 0.45;
  const legThicknessZ = boundingBox.depthM * 0.45;

  const longLeg = new THREE.BoxGeometry(
    boundingBox.widthM,
    boundingBox.heightM,
    legThicknessZ,
  );
  longLeg.translate(0, 0, -(boundingBox.depthM - legThicknessZ) / 2);

  const sideLeg = new THREE.BoxGeometry(
    legThicknessX,
    boundingBox.heightM,
    boundingBox.depthM,
  );
  sideLeg.translate(-(boundingBox.widthM - legThicknessX) / 2, 0, 0);

  const geometry = mergeGeometries([longLeg, sideLeg], false);

  return {
    geometry: centerAndPrepare(geometry),
    boundingBox,
  };
}

export function createRoundGeometry(
  dimensionsCm: FurnitureShapeDimensionsCm,
): FurnitureShapeModel {
  const boundingBox = getBoundingBox(dimensionsCm);
  const radius = boundingBox.widthM / 2;
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius,
    boundingBox.heightM,
    32,
  );

  return {
    geometry: centerAndPrepare(geometry),
    boundingBox: {
      widthM: boundingBox.widthM,
      depthM: boundingBox.widthM,
      heightM: boundingBox.heightM,
    },
  };
}

export function createOvalGeometry(
  dimensionsCm: FurnitureShapeDimensionsCm,
): FurnitureShapeModel {
  const boundingBox = getBoundingBox(dimensionsCm);
  const geometry = new THREE.CylinderGeometry(
    0.5,
    0.5,
    boundingBox.heightM,
    32,
  );
  geometry.scale(boundingBox.widthM, 1, boundingBox.depthM);

  return {
    geometry: centerAndPrepare(geometry),
    boundingBox,
  };
}

export function createFurnitureShape(
  shape: FurnitureShape,
  dimensionsCm: FurnitureShapeDimensionsCm,
): FurnitureShapeModel {
  switch (shape) {
    case 'rectangle':
      return createRectangleGeometry(dimensionsCm);
    case 'l-shape':
      return createLShapeGeometry(dimensionsCm);
    case 'round':
      return createRoundGeometry(dimensionsCm);
    case 'oval':
      return createOvalGeometry(dimensionsCm);
    default: {
      const exhaustiveCheck: never = shape;
      throw new Error(`Unsupported furniture shape: ${exhaustiveCheck}`);
    }
  }
}
