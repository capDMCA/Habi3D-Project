import type { FurnitureItem } from '../types';

/**
 * Validates furniture dimensions against the fixed Mulberry Place 2BR Living and Dining areas.
 * - Living Room: 260 cm (width) x 360 cm (length)
 * - Dining Area: 260 cm (width) x 180 cm (length)
 * - Ceiling Height: 240 cm - 260 cm
 *
 * An item is considered unusually large if:
 * 1. Its larger horizontal dimension exceeds 360 cm (the maximum length of the living room).
 * 2. Its smaller horizontal dimension exceeds 260 cm (the maximum room width).
 * 3. Its height exceeds 260 cm (exceeds room ceiling height).
 */
export function isFurnitureDimensionOversized(item: FurnitureItem): boolean {
  const maxDim = Math.max(item.lengthCm, item.widthCm);
  const minDim = Math.min(item.lengthCm, item.widthCm);
  return maxDim > 360 || minDim > 260 || item.heightCm > 260;
}

export function findOversizedFurniture(items: FurnitureItem[]): FurnitureItem | null {
  return items.find(isFurnitureDimensionOversized) ?? null;
}
