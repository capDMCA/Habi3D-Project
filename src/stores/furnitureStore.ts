import { create } from 'zustand';
import type { FurnitureItem, FurnitureCategory } from '../types';
import { getRoomForCategory, ROOM_CENTERS } from '../data/condoLayout';

interface FurnitureState {
  items: FurnitureItem[];
  addItem: (item: FurnitureItem) => void;
  updateItem: (id: string, updates: Partial<FurnitureItem>) => void;
  updatePosition: (id: string, x: number, z: number, rot: number) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
  /** Replaces the whole layout wholesale — used when resuming a saved
   *  session, as opposed to addItem's one-at-a-time entry flow. */
  setItems: (items: FurnitureItem[]) => void;
}

export const LIVING_ROOM_CENTER_POS = ROOM_CENTERS.living;
export const DINING_ROOM_CENTER_POS = ROOM_CENTERS.dining;

export function getDefaultRoomPosition(
  category: string,
  label: string = '',
  preferredRoomId?: string,
): { posX: number; posZ: number; roomId: string; rotationY: number } {
  const roomId = preferredRoomId || getRoomForCategory(category as FurnitureCategory, label);
  const center = ROOM_CENTERS[roomId] ?? ROOM_CENTERS.living;
  return {
    posX: center.posX,
    posZ: center.posZ,
    roomId: center.roomId,
    rotationY: 0,
  };
}

export const useFurnitureStore = create<FurnitureState>((set) => ({
  items: [],
  addItem: (item) =>
    set((state) => {
      const posX =
        item.posX !== undefined
          ? item.posX > 10
            ? item.posX / 100
            : item.posX
          : 0;
      const posZ =
        item.posZ !== undefined
          ? item.posZ > 10
            ? item.posZ / 100
            : item.posZ
          : 0;
      const targetRoom = item.roomId || getRoomForCategory(item.category, item.label);
      return {
        items: [
          ...state.items,
          {
            ...item,
            lengthCm: item.lengthCm,
            widthCm: item.widthCm,
            heightCm: item.heightCm,
            posX,
            posZ,
            roomId: targetRoom,
          },
        ],
      };
    }),
  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) => {
        if (item.id !== id) return item;
        const posX =
          updates.posX !== undefined
            ? updates.posX > 10
              ? updates.posX / 100
              : updates.posX
            : item.posX;
        const posZ =
          updates.posZ !== undefined
            ? updates.posZ > 10
              ? updates.posZ / 100
              : updates.posZ
            : item.posZ;
        return {
          ...item,
          ...updates,
          lengthCm: updates.lengthCm ?? item.lengthCm,
          widthCm: updates.widthCm ?? item.widthCm,
          heightCm: updates.heightCm ?? item.heightCm,
          posX,
          posZ,
        };
      }),
    })),
  updatePosition: (id, x, z, rot) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              posX: x > 10 ? x / 100 : x,
              posZ: z > 10 ? z / 100 : z,
              rotationY: rot,
            }
          : item,
      ),
    })),
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
  clearAll: () => set({ items: [] }),
  setItems: (items) => set({ items }),
}));
