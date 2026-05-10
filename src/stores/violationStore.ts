import { create } from 'zustand';
import type { Violation } from '../types';

interface ViolationState {
  violations: Violation[];
  recommendations: Violation[];
  currentStepIndex: number;
  spaceScoreBefore: number;
  setViolations: (violations: Violation[]) => void;
  setSpaceScoreBefore: (score: number) => void;
  resolveCurrentStep: () => void;
  clearViolations: () => void;
}

export const useViolationStore = create<ViolationState>((set) => ({
  violations: [],
  recommendations: [],
  currentStepIndex: 0,
  spaceScoreBefore: 0,
  setViolations: (violations) =>
    set({
      violations,
      // Sort descending by priority score for step-by-step recommendations
      recommendations: [...violations].sort(
        (a, b) => b.priorityScore - a.priorityScore,
      ),
      currentStepIndex: 0,
    }),
  setSpaceScoreBefore: (score) => set({ spaceScoreBefore: score }),
  resolveCurrentStep: () =>
    set((state) => {
      const current = state.recommendations[state.currentStepIndex];
      if (!current) return state;

      const markResolved = (violation: Violation) =>
        violation.id === current.id ? { ...violation, resolved: true } : violation;

      return {
        violations: state.violations.map(markResolved),
        recommendations: state.recommendations.map(markResolved),
        currentStepIndex: Math.min(
          state.currentStepIndex + 1,
          Math.max(state.recommendations.length - 1, 0),
        ),
      };
    }),
  clearViolations: () =>
    set({
      violations: [],
      recommendations: [],
      currentStepIndex: 0,
      spaceScoreBefore: 0,
    }),
}));
