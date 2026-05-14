import type { FurnitureItem, GapClassificationLevel } from '../types';
import type { GapClassification } from '../engine/clearance';

const ZONE_COLOR: Record<GapClassificationLevel, string> = {
  RED: '#E24B4A',
  YELLOW: '#F0A500',
  GREEN: '#4CAF50',
};

const ITEM_COLOR: Record<GapClassificationLevel, string> = {
  RED: '#E24B4A',
  YELLOW: '#F0A500',
  GREEN: '#CCCCCC',
};

function getWorstClassification(
  item: FurnitureItem,
  classifications: GapClassification[],
): GapClassificationLevel | null {
  const related = classifications.filter(
    (entry) => entry.itemAId === item.id || entry.itemBId === item.id,
  );

  if (related.some((entry) => entry.classification === 'RED')) return 'RED';
  if (related.some((entry) => entry.classification === 'YELLOW')) return 'YELLOW';
  return related.length > 0 ? 'GREEN' : null;
}

function getBoundsCm(item: FurnitureItem) {
  const x = item.posX * 100;
  const z = item.posZ * 100;
  return {
    minX: x - item.lengthCm / 2,
    maxX: x + item.lengthCm / 2,
    minZ: z - item.widthCm / 2,
    maxZ: z + item.widthCm / 2,
    centerX: x,
    centerZ: z,
  };
}

function drawRectCenter(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerZ: number,
  widthCm: number,
  depthCm: number,
  scale: number,
  offsetX: number,
  offsetY: number,
  fillStyle: string,
  alpha = 0.35,
) {
  const width = widthCm * scale;
  const height = depthCm * scale;
  const x = offsetX + centerX * scale - width / 2;
  const y = offsetY + centerZ * scale - height / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fillStyle;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

export function drawFloorPlan(
  canvas: HTMLCanvasElement,
  items: FurnitureItem[],
  classifications: GapClassification[],
  roomWidthCm: number,
  roomLengthCm: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(rect.width, 320);
  const cssHeight = Math.max(rect.height, 220);

  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const padding = 20;
  const scale = Math.min(
    (cssWidth - padding * 2) / roomWidthCm,
    (cssHeight - padding * 2) / roomLengthCm,
  );
  const planWidth = roomWidthCm * scale;
  const planHeight = roomLengthCm * scale;
  const offsetX = (cssWidth - planWidth) / 2;
  const offsetY = (cssHeight - planHeight) / 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  ctx.strokeRect(offsetX, offsetY, planWidth, planHeight);

  classifications.forEach((classification) => {
    const color = ZONE_COLOR[classification.classification];
    const alpha = classification.classification === 'GREEN' ? 0.35 : classification.classification === 'YELLOW' ? 0.5 : 0.6;

    const itemA = items.find((item) => item.id === classification.itemAId);
    if (!itemA) return;
    const boundsA = getBoundsCm(itemA);

    if (classification.itemBId === 'wall') {
      const wallSide = classification.wallSide ?? 'west';
      const depthCm = Math.max(classification.measuredCm, 3);
      const widthCm = wallSide === 'north' || wallSide === 'south'
        ? Math.max(boundsA.maxX - boundsA.minX, 8)
        : Math.max(boundsA.maxZ - boundsA.minZ, 8);
      const centerX = wallSide === 'west'
        ? boundsA.minX / 2
        : wallSide === 'east'
        ? (boundsA.maxX + roomWidthCm) / 2
        : boundsA.centerX;
      const centerZ = wallSide === 'north'
        ? boundsA.minZ / 2
        : wallSide === 'south'
        ? (boundsA.maxZ + roomLengthCm) / 2
        : boundsA.centerZ;

      drawRectCenter(ctx, centerX, centerZ, widthCm, depthCm, scale, offsetX, offsetY, color, alpha);
      return;
    }

    const itemB = items.find((item) => item.id === classification.itemBId);
    if (!itemB) return;
    const boundsB = getBoundsCm(itemB);

    const gapX = Math.max(0, Math.max(boundsA.minX, boundsB.minX) - Math.min(boundsA.maxX, boundsB.maxX));
    const gapZ = Math.max(0, Math.max(boundsA.minZ, boundsB.minZ) - Math.min(boundsA.maxZ, boundsB.maxZ));
    const overlapX = Math.max(0, Math.min(boundsA.maxX, boundsB.maxX) - Math.max(boundsA.minX, boundsB.minX));
    const overlapZ = Math.max(0, Math.min(boundsA.maxZ, boundsB.maxZ) - Math.max(boundsA.minZ, boundsB.minZ));

    if (gapX > 0) {
      const left = boundsA.centerX < boundsB.centerX ? boundsA : boundsB;
      const right = boundsA.centerX < boundsB.centerX ? boundsB : boundsA;
      const centerX = (left.maxX + right.minX) / 2;
      const centerZ = (Math.max(boundsA.minZ, boundsB.minZ) + Math.min(boundsA.maxZ, boundsB.maxZ)) / 2;
      const widthCm = Math.max(overlapZ, 8);
      const depthCm = Math.max(gapX, 3);
      drawRectCenter(ctx, centerX, centerZ, widthCm, depthCm, scale, offsetX, offsetY, color, alpha);
      return;
    }

    if (gapZ > 0) {
      const top = boundsA.centerZ < boundsB.centerZ ? boundsA : boundsB;
      const bottom = boundsA.centerZ < boundsB.centerZ ? boundsB : boundsA;
      const centerZ = (top.maxZ + bottom.minZ) / 2;
      const centerX = (Math.max(boundsA.minX, boundsB.minX) + Math.min(boundsA.maxX, boundsB.maxX)) / 2;
      const widthCm = Math.max(overlapX, 8);
      const depthCm = Math.max(gapZ, 3);
      drawRectCenter(ctx, centerX, centerZ, widthCm, depthCm, scale, offsetX, offsetY, color, alpha);
      return;
    }
  });

  items.forEach((item) => {
    const bounds = getBoundsCm(item);
    const width = Math.max(item.lengthCm, 8);
    const depth = Math.max(item.widthCm, 8);
    const worst = getWorstClassification(item, classifications);
    const fill = worst ? ITEM_COLOR[worst] : '#CCCCCC';

    drawRectCenter(ctx, bounds.centerX, bounds.centerZ, width, depth, scale, offsetX, offsetY, fill, 0.9);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    const x = offsetX + (bounds.centerX - width / 2) * scale;
    const y = offsetY + (bounds.centerZ - depth / 2) * scale;
    ctx.strokeRect(x, y, width * scale, depth * scale);

    ctx.fillStyle = '#111827';
    ctx.font = '600 10px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, x + (width * scale) / 2, y + (depth * scale) / 2);
  });
}
