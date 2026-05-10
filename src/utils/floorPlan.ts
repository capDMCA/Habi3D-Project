import type { FurnitureItem, GapClassificationLevel } from '../types';
import type { GapClassification } from '../engine/clearance';

const COLOR_BY_CLASSIFICATION: Record<GapClassificationLevel, string> = {
  RED: '#E24B4A',
  YELLOW: '#BA7517',
  GREEN: '#639922',
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
  if (related.some((entry) => entry.classification === 'GREEN')) return 'GREEN';
  return null;
}

export function drawFloorPlan(
  canvas: HTMLCanvasElement,
  items: FurnitureItem[],
  classifications: GapClassification[],
  roomWidthCm: number,
  roomLengthCm: number,
): void {
  const context = canvas.getContext('2d');
  if (!context) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(rect.width, 320);
  const cssHeight = Math.max(rect.height, 220);

  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);

  const padding = 20;
  const scale = Math.min(
    (cssWidth - padding * 2) / roomWidthCm,
    (cssHeight - padding * 2) / roomLengthCm,
  );
  const planWidth = roomWidthCm * scale;
  const planHeight = roomLengthCm * scale;
  const offsetX = (cssWidth - planWidth) / 2;
  const offsetY = (cssHeight - planHeight) / 2;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, cssWidth, cssHeight);

  context.strokeStyle = '#111827';
  context.lineWidth = 2;
  context.strokeRect(offsetX, offsetY, planWidth, planHeight);

  items.forEach((item) => {
    const itemXcm = item.posX * 100;
    const itemZcm = item.posZ * 100;
    const x = offsetX + (itemXcm - item.lengthCm / 2) * scale;
    const y = offsetY + (itemZcm - item.widthCm / 2) * scale;
    const width = Math.max(item.lengthCm * scale, 4);
    const height = Math.max(item.widthCm * scale, 4);
    const worst = getWorstClassification(item, classifications);

    context.fillStyle = worst ? COLOR_BY_CLASSIFICATION[worst] : '#94a3b8';
    context.globalAlpha = 0.82;
    context.fillRect(x, y, width, height);
    context.globalAlpha = 1;

    context.strokeStyle = '#334155';
    context.lineWidth = 1;
    context.strokeRect(x, y, width, height);

    context.fillStyle = '#111827';
    context.font = '600 11px Inter, Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    context.fillText(item.label, x + width / 2, y + height / 2);
    context.restore();
  });
}
