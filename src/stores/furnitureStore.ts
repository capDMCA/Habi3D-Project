import { create } from 'zustand';
import type { FurnitureItem } from '../types';

interface FurnitureState {
  items: FurnitureItem[];
  addItem: (item: FurnitureItem) => void;
  updateItem: (id: string, updates: Partial<FurnitureItem>) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
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
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
  clearAll: () => set({ items: [] }),
}));
