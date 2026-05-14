import { create } from 'zustand';
import type { Violation } from '../types';

interface ViolationState {
  violations: Violation[];
  recommendations: Violation[];
  currentStepIndex: number;
  spaceScoreBefore: number;
  spaceScoreAfter: number;
  setViolations: (violations: Violation[]) => void;
  refreshViolations: (violations: Violation[]) => void;
  resolveCurrentStep: () => void;
  advanceCurrentStep: () => void;
  setSpaceScoreBefore: (score: number) => void;
  setSpaceScoreAfter: (score: number) => void;
  clearViolations: () => void;
}

export const useViolationStore = create<ViolationState>((set) => ({
  violations: [],
  recommendations: [],
  currentStepIndex: 0,
  spaceScoreBefore: 0,
  spaceScoreAfter: 0,
  setViolations: (violations) =>
    set({
      violations,
      recommendations: [...violations].sort(
        (a, b) => b.priorityScore - a.priorityScore,
      ),
      currentStepIndex: 0,
      spaceScoreBefore: 0,
      spaceScoreAfter: 0,
    }),
  refreshViolations: (violations) =>
    set((state) => {
      const resolvedIds = new Set(
        state.violations.filter((item) => item.resolved).map((item) => item.id),
      );
      const merged = violations.map((violation) => ({
        ...violation,
        resolved: resolvedIds.has(violation.id) ? true : violation.resolved,
      }));

      return {
        violations: merged,
        recommendations: [...merged].sort((a, b) => b.priorityScore - a.priorityScore),
        currentStepIndex: Math.min(
          state.currentStepIndex,
          Math.max(merged.length - 1, 0),
        ),
      };
    }),
  setSpaceScoreBefore: (score) => set({ spaceScoreBefore: score }),
  resolveCurrentStep: () =>
    set((state) => {
      const current = state.recommendations[state.currentStepIndex];
      if (!current) return state;

      const updatedRecommendations = state.recommendations.map((violation) =>
        violation.id === current.id ? { ...violation, resolved: true } : violation,
      );
      const nextIndex = state.currentStepIndex + 1;

      return {
        violations: state.violations.map((violation) =>
          violation.id === current.id ? { ...violation, resolved: true } : violation,
        ),
        recommendations: updatedRecommendations,
        currentStepIndex:
          nextIndex >= updatedRecommendations.length ? updatedRecommendations.length : nextIndex,
      };
    }),
  advanceCurrentStep: () =>
    set((state) => ({
      currentStepIndex: Math.min(
        state.currentStepIndex + 1,
        Math.max(state.recommendations.length, 0),
      ),
    })),
  setSpaceScoreAfter: (score) => set({ spaceScoreAfter: score }),
  clearViolations: () =>
    set({
      violations: [],
      recommendations: [],
      currentStepIndex: 0,
      spaceScoreBefore: 0,
      spaceScoreAfter: 0,
    }),
}));
