import type { FurnitureItem, GapClassificationLevel, Violation } from '../types';

const ZONE_COLOR: Record<GapClassificationLevel, string> = {
  RED: '#E24B4A',
  YELLOW: '#F0A500',
  GREEN: '#4CAF50',
};

function getBoundsCm(item: FurnitureItem) {
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
  };
}

function getWorstClassification(
  item: FurnitureItem,
  violations: Violation[],
): 'RED' | 'YELLOW' | null {
  const related = violations.filter((violation) => violation.furnitureId === item.id);
  if (related.some((violation) => violation.classification === 'RED')) return 'RED';
  if (related.some((violation) => violation.classification === 'YELLOW')) return 'YELLOW';
  return null;
}

function drawRectCm(
  ctx: CanvasRenderingContext2D,
  rect: { xCm: number; zCm: number; widthCm: number; depthCm: number },
  scaleX: number,
  scaleZ: number,
  offsetX: number,
  offsetY: number,
  color: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(
    offsetX + rect.xCm * scaleX,
    offsetY + rect.zCm * scaleZ,
    rect.widthCm * scaleX,
    rect.depthCm * scaleZ,
  );
  ctx.restore();
}

function getZoneRect(violation: Violation, item: FurnitureItem, roomWidthCm: number, roomLengthCm: number) {
  const bounds = getBoundsCm(item);
  const label = violation.fixDirectionLabel.toLowerCase();
  const gapCm = Math.max(violation.measuredCm, 3);

  if (label.includes('west')) {
    return {
      xCm: label.includes('away') ? bounds.minX - gapCm : 0,
      zCm: bounds.minZ,
      widthCm: gapCm,
      depthCm: item.widthCm,
    };
  }

  if (label.includes('east')) {
    return {
      xCm: label.includes('away') ? bounds.maxX : roomWidthCm - gapCm,
      zCm: bounds.minZ,
      widthCm: gapCm,
      depthCm: item.widthCm,
    };
  }

  if (label.includes('north')) {
    return {
      xCm: bounds.minX,
      zCm: label.includes('away') ? bounds.minZ - gapCm : 0,
      widthCm: item.lengthCm,
      depthCm: gapCm,
    };
  }

  return {
    xCm: bounds.minX,
    zCm: label.includes('away') ? bounds.maxZ : roomLengthCm - gapCm,
    widthCm: item.lengthCm,
    depthCm: gapCm,
  };
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
  const canvasW = Math.max(rect.width, canvas.width / dpr, 320);
  const canvasH = Math.max(rect.height, canvas.height / dpr, 160);

  canvas.width = Math.round(canvasW * dpr);
  canvas.height = Math.round(canvasH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const padding = 20;
  const scaleX = (canvasW - 40) / roomWidthCm;
  const scaleZ = (canvasH - 40) / roomLengthCm;
  const roomX = padding;
  const roomZ = padding;

  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(roomX, roomZ, roomWidthCm * scaleX, roomLengthCm * scaleZ);

  violations.forEach((violation) => {
    const item = items.find((entry) => entry.id === violation.furnitureId);
    if (!item) return;
    const zone = getZoneRect(violation, item, roomWidthCm, roomLengthCm);
    drawRectCm(
      ctx,
      zone,
      scaleX,
      scaleZ,
      roomX,
      roomZ,
      ZONE_COLOR[violation.classification],
      violation.classification === 'RED' ? 0.45 : 0.35,
    );
  });

  items.forEach((item) => {
    const bounds = getBoundsCm(item);
    const worst = getWorstClassification(item, violations);
    const fill = worst === 'RED' ? '#E24B4A' : worst === 'YELLOW' ? '#F0A500' : '#E0E0E0';
    const textColor = worst ? '#ffffff' : '#111827';
    const x = roomX + bounds.minX * scaleX;
    const y = roomZ + bounds.minZ * scaleZ;
    const width = item.lengthCm * scaleX;
    const height = item.widthCm * scaleZ;

    ctx.fillStyle = fill;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.fillStyle = textColor;
    ctx.font = '600 10px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, x + width / 2, y + height / 2);
    ctx.restore();
  });
}
