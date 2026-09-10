import { create } from 'zustand';
import type { FurnitureItem } from '../types';

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

/** Center of the Living Room polygon (X: 0..2.60m, Z: 3.40..7.00m) */
export const LIVING_ROOM_CENTER_POS = {
  posX: 1.3,
  posZ: 5.2,
};

export const useFurnitureStore = create<FurnitureState>((set) => ({
  items: [],
  addItem: (item) =>
    set((state) => ({
      items: [
        ...state.items,
        {
          ...item,
          posX:
            item.posX !== undefined
              ? item.posX > 10
                ? item.posX / 100
                : item.posX
              : 0,
          posZ:
            item.posZ !== undefined
              ? item.posZ > 10
                ? item.posZ / 100
                : item.posZ
              : 0,
          roomId: item.roomId ?? 'living',
        },
      ],
    })),
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
        return { ...item, ...updates, posX, posZ };
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
