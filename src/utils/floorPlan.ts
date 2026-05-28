import type { FurnitureItem, GapClassificationLevel, Violation } from '../types';

const ZONE_COLOR: Record<GapClassificationLevel, string> = {
  RED: '#E24B4A',
  YELLOW: '#F0A500',
  GREEN: '#4CAF50',
};

interface BoundsCm {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  lengthCm: number;
  widthCm: number;
}

interface DrawDomain {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  scale: number;
  originX: number;
  originY: number;
}

interface ZoneRect {
  xCm: number;
  zCm: number;
  widthCm: number;
  depthCm: number;
}

function getBoundsCm(item: FurnitureItem): BoundsCm {
  const halfL = item.lengthCm / 2;
  const halfW = item.widthCm / 2;
  const centerX = item.posX * 100;
  const centerZ = item.posZ * 100;

  return {
    minX: centerX - halfL,
    maxX: centerX + halfL,
    minZ: centerZ - halfW,
    maxZ: centerZ + halfW,
    centerX,
    centerZ,
    lengthCm: item.lengthCm,
    widthCm: item.widthCm,
  };
}

function createDomain(
  bounds: BoundsCm[],
  roomWidthCm: number,
  roomLengthCm: number,
  canvasW: number,
  canvasH: number,
): DrawDomain {
  const padding = 24;
  const itemMinX = bounds.length ? Math.min(...bounds.map((item) => item.minX)) : 0;
  const itemMaxX = bounds.length ? Math.max(...bounds.map((item) => item.maxX)) : roomWidthCm;
  const itemMinZ = bounds.length ? Math.min(...bounds.map((item) => item.minZ)) : 0;
  const itemMaxZ = bounds.length ? Math.max(...bounds.map((item) => item.maxZ)) : roomLengthCm;

  const minX = Math.min(0, itemMinX);
  const maxX = Math.max(roomWidthCm, itemMaxX);
  const minZ = Math.min(0, itemMinZ);
  const maxZ = Math.max(roomLengthCm, itemMaxZ);
  const width = Math.max(maxX - minX, 1);
  const depth = Math.max(maxZ - minZ, 1);
  const scale = Math.min((canvasW - padding * 2) / width, (canvasH - padding * 2) / depth);

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    scale,
    originX: padding + ((canvasW - padding * 2) - width * scale) / 2,
    originY: padding + ((canvasH - padding * 2) - depth * scale) / 2,
  };
}

function toCanvasX(domain: DrawDomain, xCm: number): number {
  return domain.originX + (xCm - domain.minX) * domain.scale;
}

function toCanvasY(domain: DrawDomain, zCm: number): number {
  return domain.originY + (zCm - domain.minZ) * domain.scale;
}

function getWorstClassification(
  item: FurnitureItem,
  violations: Violation[],
): 'RED' | 'YELLOW' | null {
  const related = violations.filter(
    (violation) => violation.furnitureId === item.id || violation.itemBId === item.id,
  );
  if (related.some((violation) => violation.classification === 'RED')) return 'RED';
  if (related.some((violation) => violation.classification === 'YELLOW')) return 'YELLOW';
  return null;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawRectCm(
  ctx: CanvasRenderingContext2D,
  rect: ZoneRect,
  domain: DrawDomain,
  color: string,
  alpha: number,
) {
  const x = toCanvasX(domain, rect.xCm);
  const y = toCanvasY(domain, rect.zCm);
  const width = rect.widthCm * domain.scale;
  const height = rect.depthCm * domain.scale;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  drawRoundedRect(ctx, x, y, Math.max(width, 2), Math.max(height, 2), 5);
  ctx.fill();
  ctx.restore();
}

function getFallbackZoneRect(
  violation: Violation,
  bounds: BoundsCm,
  roomWidthCm: number,
  roomLengthCm: number,
): ZoneRect {
  const label = violation.fixDirectionLabel.toLowerCase();
  const gapCm = Math.max(violation.measuredCm, 4);

  if (label.includes('west')) {
    return { xCm: bounds.minX - gapCm, zCm: bounds.minZ, widthCm: gapCm, depthCm: bounds.widthCm };
  }

  if (label.includes('east')) {
    return { xCm: bounds.maxX, zCm: bounds.minZ, widthCm: gapCm, depthCm: bounds.widthCm };
  }

  if (label.includes('north')) {
    return { xCm: bounds.minX, zCm: bounds.minZ - gapCm, widthCm: bounds.lengthCm, depthCm: gapCm };
  }

  if (label.includes('south')) {
    return { xCm: bounds.minX, zCm: bounds.maxZ, widthCm: bounds.lengthCm, depthCm: gapCm };
  }

  return {
    xCm: Math.max(0, bounds.minX),
    zCm: Math.max(0, bounds.minZ),
    widthCm: Math.min(bounds.lengthCm, roomWidthCm),
    depthCm: Math.min(bounds.widthCm, roomLengthCm),
  };
}

function getWallZoneRect(
  violation: Violation,
  bounds: BoundsCm,
  roomWidthCm: number,
  roomLengthCm: number,
): ZoneRect {
  if (violation.wallSide === 'west') {
    return { xCm: 0, zCm: bounds.minZ, widthCm: Math.max(bounds.minX, 4), depthCm: bounds.widthCm };
  }

  if (violation.wallSide === 'east') {
    return {
      xCm: bounds.maxX,
      zCm: bounds.minZ,
      widthCm: Math.max(roomWidthCm - bounds.maxX, 4),
      depthCm: bounds.widthCm,
    };
  }

  if (violation.wallSide === 'north') {
    return { xCm: bounds.minX, zCm: 0, widthCm: bounds.lengthCm, depthCm: Math.max(bounds.minZ, 4) };
  }

  if (violation.wallSide === 'south') {
    return {
      xCm: bounds.minX,
      zCm: bounds.maxZ,
      widthCm: bounds.lengthCm,
      depthCm: Math.max(roomLengthCm - bounds.maxZ, 4),
    };
  }

  return getFallbackZoneRect(violation, bounds, roomWidthCm, roomLengthCm);
}

function getPairZoneRect(boundsA: BoundsCm, boundsB: BoundsCm): ZoneRect {
  if (boundsA.maxX <= boundsB.minX || boundsB.maxX <= boundsA.minX) {
    const left = boundsA.maxX <= boundsB.minX ? boundsA : boundsB;
    const right = boundsA.maxX <= boundsB.minX ? boundsB : boundsA;
    const overlapMinZ = Math.max(left.minZ, right.minZ);
    const overlapMaxZ = Math.min(left.maxZ, right.maxZ);
    const fallbackDepth = Math.min(left.widthCm, right.widthCm);
    const depthCm = Math.max(overlapMaxZ - overlapMinZ, fallbackDepth * 0.7, 4);
    const zCm = overlapMaxZ > overlapMinZ ? overlapMinZ : (left.centerZ + right.centerZ) / 2 - depthCm / 2;

    return {
      xCm: left.maxX,
      zCm,
      widthCm: Math.max(right.minX - left.maxX, 4),
      depthCm,
    };
  }

  if (boundsA.maxZ <= boundsB.minZ || boundsB.maxZ <= boundsA.minZ) {
    const near = boundsA.maxZ <= boundsB.minZ ? boundsA : boundsB;
    const far = boundsA.maxZ <= boundsB.minZ ? boundsB : boundsA;
    const overlapMinX = Math.max(near.minX, far.minX);
    const overlapMaxX = Math.min(near.maxX, far.maxX);
    const fallbackWidth = Math.min(near.lengthCm, far.lengthCm);
    const widthCm = Math.max(overlapMaxX - overlapMinX, fallbackWidth * 0.7, 4);
    const xCm = overlapMaxX > overlapMinX ? overlapMinX : (near.centerX + far.centerX) / 2 - widthCm / 2;

    return {
      xCm,
      zCm: near.maxZ,
      widthCm,
      depthCm: Math.max(far.minZ - near.maxZ, 4),
    };
  }

  return {
    xCm: Math.min(boundsA.centerX, boundsB.centerX) - 8,
    zCm: Math.min(boundsA.centerZ, boundsB.centerZ) - 8,
    widthCm: 16,
    depthCm: 16,
  };
}

function getZoneRect(
  violation: Violation,
  itemMap: Map<string, FurnitureItem>,
  boundsMap: Map<string, BoundsCm>,
  roomWidthCm: number,
  roomLengthCm: number,
): ZoneRect | null {
  const item = itemMap.get(violation.furnitureId);
  const bounds = item ? boundsMap.get(item.id) : null;
  if (!item || !bounds) return null;

  if (violation.itemBId === 'wall') {
    return getWallZoneRect(violation, bounds, roomWidthCm, roomLengthCm);
  }

  if (violation.itemBId) {
    const boundsB = boundsMap.get(violation.itemBId);
    if (boundsB) return getPairZoneRect(bounds, boundsB);
  }

  return getFallbackZoneRect(violation, bounds, roomWidthCm, roomLengthCm);
}

function drawEmptyState(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number) {
  ctx.fillStyle = '#64748b';
  ctx.font = '600 13px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('No furniture has been mapped yet', canvasW / 2, canvasH / 2);
}

export function drawFloorPlan(
  canvas: HTMLCanvasElement,
  items: FurnitureItem[],
  violations: Violation[],
  roomWidthCm: number,
  roomLengthCm: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const attrW = canvas.width > 0 ? canvas.width / dpr : 0;
  const attrH = canvas.height > 0 ? canvas.height / dpr : 0;
  const canvasW = Math.max(rect.width, attrW, 360);
  const canvasH = Math.max(rect.height, attrH, 180);

  canvas.width = Math.round(canvasW * dpr);
  canvas.height = Math.round(canvasH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const boundsList = items.map(getBoundsCm);
  const boundsMap = new Map(items.map((item, index) => [item.id, boundsList[index]] as const));
  const itemMap = new Map(items.map((item) => [item.id, item] as const));
  const domain = createDomain(boundsList, roomWidthCm, roomLengthCm, canvasW, canvasH);

  const roomX = toCanvasX(domain, 0);
  const roomY = toCanvasY(domain, 0);
  const roomW = roomWidthCm * domain.scale;
  const roomH = roomLengthCm * domain.scale;

  ctx.save();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  drawRoundedRect(ctx, roomX, roomY, roomW, roomH, 8);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#475569';
  ctx.font = '600 10px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${Math.round(roomWidthCm / 100)}m x ${Math.round(roomLengthCm / 100)}m`, roomX + 8, roomY + 14);
  ctx.restore();

  if (items.length === 0) {
    drawEmptyState(ctx, canvasW, canvasH);
    return;
  }

  violations.forEach((violation) => {
    const zone = getZoneRect(violation, itemMap, boundsMap, roomWidthCm, roomLengthCm);
    if (!zone) return;
    drawRectCm(
      ctx,
      zone,
      domain,
      ZONE_COLOR[violation.classification],
      violation.classification === 'RED' ? 0.32 : 0.24,
    );
  });

  items.forEach((item) => {
    const bounds = boundsMap.get(item.id);
    if (!bounds) return;
    const worst = getWorstClassification(item, violations);
    const fill = worst === 'RED' ? '#E24B4A' : worst === 'YELLOW' ? '#F0A500' : '#E5E7EB';
    const textColor = worst ? '#ffffff' : '#111827';
    const x = toCanvasX(domain, bounds.minX);
    const y = toCanvasY(domain, bounds.minZ);
    const width = Math.max(item.lengthCm * domain.scale, 18);
    const height = Math.max(item.widthCm * domain.scale, 18);

    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = fill;
    drawRoundedRect(ctx, x, y, width, height, 6);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, x, y, width, height, 6);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    drawRoundedRect(ctx, x, y, width, height, 6);
    ctx.clip();
    ctx.fillStyle = textColor;
    ctx.font = '700 10px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, x + width / 2, y + height / 2, Math.max(width - 8, 12));
    ctx.restore();
  });
}
