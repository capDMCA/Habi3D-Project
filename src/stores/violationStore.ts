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
  setCurrentStepIndex: (index: number) => void;
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
    set(() => {
      const recommendations = [...violations].sort((a, b) => b.priorityScore - a.priorityScore);
      const firstUnresolved = recommendations.findIndex((v) => !v.resolved);
      return {
        violations,
        recommendations,
        currentStepIndex: firstUnresolved === -1 ? recommendations.length : firstUnresolved,
        spaceScoreBefore: 0,
        spaceScoreAfter: 0,
      };
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

      const recommendations = [...merged].sort((a, b) => b.priorityScore - a.priorityScore);

      // find next unresolved starting at the previous index
      let nextIndex = recommendations.length;
      for (let i = state.currentStepIndex; i < recommendations.length; i += 1) {
        if (!recommendations[i].resolved) {
          nextIndex = i;
          break;
        }
      }

      // if previous index was out of range, pick first unresolved
      if (nextIndex === recommendations.length) {
        const firstUnresolved = recommendations.findIndex((v) => !v.resolved);
        nextIndex = firstUnresolved === -1 ? recommendations.length : firstUnresolved;
      }

      return {
        violations: merged,
        recommendations,
        currentStepIndex: nextIndex,
      };
    }),
  setCurrentStepIndex: (index) =>
    set((state) => ({
      currentStepIndex: Math.max(0, Math.min(index, state.recommendations.length)),
    })),
  setSpaceScoreBefore: (score) => set({ spaceScoreBefore: score }),
  resolveCurrentStep: () =>
    set((state) => {
      const current = state.recommendations[state.currentStepIndex];
      if (!current) return state;

      const updatedRecommendations = state.recommendations.map((violation) =>
        violation.id === current.id ? { ...violation, resolved: true } : violation,
      );

      const updatedViolations = state.violations.map((violation) =>
        violation.id === current.id ? { ...violation, resolved: true } : violation,
      );

      // find next unresolved after current index
      let nextIndex = updatedRecommendations.length;
      for (let i = state.currentStepIndex + 1; i < updatedRecommendations.length; i += 1) {
        if (!updatedRecommendations[i].resolved) {
          nextIndex = i;
          break;
        }
      }

      // if none found, set to length to indicate completion
      return {
        violations: updatedViolations,
        recommendations: updatedRecommendations,
        currentStepIndex: nextIndex,
      };
    }),
  advanceCurrentStep: () =>
    set((state) => {
      const len = state.recommendations.length;
      let nextIndex = len;
      for (let i = state.currentStepIndex + 1; i < len; i += 1) {
        if (!state.recommendations[i].resolved) {
          nextIndex = i;
          break;
        }
      }
      return { currentStepIndex: nextIndex };
    }),
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
