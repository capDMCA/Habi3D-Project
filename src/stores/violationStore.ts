import { create } from 'zustand';
import { stableViolationKey } from '../engine/violationKey';
import type { Violation } from '../types';

interface ViolationState {
  violations: Violation[];
  recommendations: Violation[];
  // Source of truth for what the user has resolved. Keyed by stableViolationKey
  // (NOT Violation.id), so resolved status survives a re-analysis that changes
  // measuredCm — and therefore the ids — of every finding.
  resolvedKeys: Set<string>;
  currentStepIndex: number;
  spaceScoreBefore: number;
  spaceScoreAfter: number;
  setViolations: (violations: Violation[]) => void;
  refreshViolations: (violations: Violation[]) => void;
  resolveCurrentStep: () => void;
  resolveViolations: (ids: string[]) => void;
  advanceCurrentStep: () => void;
  setCurrentStepIndex: (index: number) => void;
  setSpaceScoreBefore: (score: number) => void;
  setSpaceScoreAfter: (score: number) => void;
  reset: () => void;
  clearViolations: () => void;
}

/** Re-derive each violation's `resolved` boolean from the resolved-key set. */
function applyResolved(list: Violation[], resolvedKeys: Set<string>): Violation[] {
  return list.map((v) => ({ ...v, resolved: resolvedKeys.has(stableViolationKey(v)) }));
}

export const useViolationStore = create<ViolationState>((set) => ({
  violations: [],
  recommendations: [],
  resolvedKeys: new Set<string>(),
  currentStepIndex: 0,
  spaceScoreBefore: 0,
  spaceScoreAfter: 0,
  setViolations: (violations) =>
    set(() => {
      // Fresh seed (first analysis of a session) — nothing resolved yet.
      const resolvedKeys = new Set<string>();
      const recommendations = [...violations].sort((a, b) => b.priorityScore - a.priorityScore);
      const firstUnresolved = recommendations.findIndex((v) => !v.resolved);
      return {
        violations,
        recommendations,
        resolvedKeys,
        currentStepIndex: firstUnresolved === -1 ? recommendations.length : firstUnresolved,
        spaceScoreBefore: 0,
        spaceScoreAfter: 0,
      };
    }),
  refreshViolations: (violations) =>
    set((state) => {
      // Resolved status carries forward via the stable key set, so a
      // re-analysis (new ids, new measuredCm) keeps prior resolutions.
      const { resolvedKeys } = state;
      const merged = applyResolved(violations, resolvedKeys);
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

      const resolvedKeys = new Set(state.resolvedKeys);
      resolvedKeys.add(stableViolationKey(current));

      const updatedRecommendations = applyResolved(state.recommendations, resolvedKeys);
      const updatedViolations = applyResolved(state.violations, resolvedKeys);

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
        resolvedKeys,
        violations: updatedViolations,
        recommendations: updatedRecommendations,
        currentStepIndex: nextIndex,
      };
    }),
  resolveViolations: (ids) =>
    set((state) => {
      const idSet = new Set(ids);
      // Resolve by STABLE key, not by id: look up the targeted violations,
      // take their stable keys, and add them to the persistent set.
      const resolvedKeys = new Set(state.resolvedKeys);
      state.recommendations
        .filter((v) => idSet.has(v.id))
        .forEach((v) => resolvedKeys.add(stableViolationKey(v)));

      const updatedRecommendations = applyResolved(state.recommendations, resolvedKeys);
      const updatedViolations = applyResolved(state.violations, resolvedKeys);
      const firstUnresolved = updatedRecommendations.findIndex((v) => !v.resolved);
      return {
        resolvedKeys,
        recommendations: updatedRecommendations,
        violations: updatedViolations,
        currentStepIndex: firstUnresolved === -1 ? updatedRecommendations.length : firstUnresolved,
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
  reset: () =>
    set({
      violations: [],
      recommendations: [],
      resolvedKeys: new Set<string>(),
      currentStepIndex: 0,
      spaceScoreBefore: 0,
      spaceScoreAfter: 0,
    }),
  clearViolations: () =>
    set({
      violations: [],
      recommendations: [],
      resolvedKeys: new Set<string>(),
      currentStepIndex: 0,
      spaceScoreBefore: 0,
      spaceScoreAfter: 0,
    }),
}));
