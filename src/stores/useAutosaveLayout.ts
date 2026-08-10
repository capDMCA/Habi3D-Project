import { useEffect, useRef } from 'react';
import { useSessionStore } from './sessionStore';
import { saveSessionLayout } from '../supabase';
import type { FurnitureItem } from '../types';

const AUTOSAVE_DEBOUNCE_MS = 1500;

/**
 * Debounced "leave and resume later" autosave. A no-op for the anonymous
 * "Begin Session" path (userId is null there — nothing is saved beyond the
 * sessionId, as already documented on that flow), so this hook is safe to
 * call unconditionally from any screen that mutates furnitureStore.
 *
 * Fires on every layout change rather than only at the completion state, so
 * a resident who closes the tab mid-arrangement — before ever reaching the
 * report — still has something to resume. Debounced so a fast flurry of
 * drags/nudges doesn't fire a write per frame.
 */
export function useAutosaveLayout(items: FurnitureItem[]) {
  const userId = useSessionStore((s) => s.userId);
  const sessionId = useSessionStore((s) => s.sessionId);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId || !sessionId || items.length === 0) return undefined;

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      saveSessionLayout(userId, sessionId, items).catch((err) => {
        // Autosave is best-effort — a failed write here shouldn't interrupt
        // the resident mid-arrangement. Logged for diagnosis only.
        console.warn('[autosave] could not save layout:', err);
      });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [items, userId, sessionId]);
}
