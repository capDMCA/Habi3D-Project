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

export const useFurnitureStore = create<FurnitureState>((set) => ({
  items: [],
  addItem: (item) =>
    set((state) => ({ items: [...state.items, item] })),
  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      ),
    })),
  updatePosition: (id, x, z, rot) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? { ...item, posX: x, posZ: z, rotationY: rot }
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
