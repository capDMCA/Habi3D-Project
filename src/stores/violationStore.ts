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
  // Session-start snapshot of finding identities (stableViolationKey), captured
  // once and never overwritten again — unlike `violations`, which is replaced
  // wholesale on every commit. This is what makes "you made N spots more
  // comfortable" on ReportScreen a real before/after, not a guess: diff this
  // against the current violations' keys. Null until the first analysis runs.
  initialFindingKeys: Set<string> | null;
  // Furniture ids the resident actually committed a change to this session
  // (drag-end, rotate, or reset — anything that reaches commitLayout).
  // Distinguishes "left this alone on purpose" from "never touched it" for a
  // finding that's still tight/needs-attention on the completion screen.
  touchedItemIds: Set<string>;
  setViolations: (violations: Violation[]) => void;
  refreshViolations: (violations: Violation[]) => void;
  resolveCurrentStep: () => void;
  resolveViolations: (ids: string[]) => void;
  advanceCurrentStep: () => void;
  setCurrentStepIndex: (index: number) => void;
  setSpaceScoreBefore: (score: number) => void;
  setSpaceScoreAfter: (score: number) => void;
  /** No-ops if a snapshot was already captured this session — call freely
   *  on every analysis without worrying about clobbering it. */
  captureInitialFindings: (violations: Violation[]) => void;
  markItemTouched: (itemId: string) => void;
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
  initialFindingKeys: null,
  touchedItemIds: new Set<string>(),
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
  captureInitialFindings: (violations) =>
    set((state) => {
      if (state.initialFindingKeys !== null) return state; // already captured this session
      return { initialFindingKeys: new Set(violations.map(stableViolationKey)) };
    }),
  markItemTouched: (itemId) =>
    set((state) => {
      if (state.touchedItemIds.has(itemId)) return state;
      const touchedItemIds = new Set(state.touchedItemIds);
      touchedItemIds.add(itemId);
      return { touchedItemIds };
    }),
  reset: () =>
    set({
      violations: [],
      recommendations: [],
      resolvedKeys: new Set<string>(),
      currentStepIndex: 0,
      spaceScoreBefore: 0,
      spaceScoreAfter: 0,
      initialFindingKeys: null,
      touchedItemIds: new Set<string>(),
    }),
  clearViolations: () =>
    set({
      violations: [],
      recommendations: [],
      resolvedKeys: new Set<string>(),
      currentStepIndex: 0,
      spaceScoreBefore: 0,
      spaceScoreAfter: 0,
      initialFindingKeys: null,
      touchedItemIds: new Set<string>(),
    }),
}));
