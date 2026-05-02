import { create } from 'zustand';
import type { Violation } from '../types';

interface ViolationState {
  violations: Violation[];
  recommendations: Violation[];
  setViolations: (violations: Violation[]) => void;
  clearViolations: () => void;
}

export const useViolationStore = create<ViolationState>((set) => ({
  violations: [],
  recommendations: [],
  setViolations: (violations) =>
    set({
      violations,
      // Sort descending by priority score for step-by-step recommendations
      recommendations: [...violations].sort(
        (a, b) => b.priorityScore - a.priorityScore,
      ),
    }),
  clearViolations: () => set({ violations: [], recommendations: [] }),
}));
