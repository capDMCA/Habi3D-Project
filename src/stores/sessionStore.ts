import { create } from 'zustand';
import type { ScreenName, RoomDimensions } from '../types';
import { MULBERRY_PLACE_2BR, MULBERRY_PLACE_2BR_ID } from '../data/roomData';

interface SessionState {
  currentScreen: ScreenName;
  // Set once a session actually starts (anonymous "Begin Session", or after
  // sign-up/login) — never on cold load, so a stale reload can't silently
  // resume as if a session were already active.
  sessionId: string | null;
  // Fixed — this thesis scopes to one Mulberry Place unit, no picker.
  unitTypeId: string | null;
  roomDimensions: RoomDimensions | null;
  // Account identity (users table id) — null for the anonymous "Begin
  // Session" path.
  userId: string | null;
  username: string | null;
  // Which tab the auth screen opens on — set right before navigateTo('auth')
  // since screen routing carries no params of its own.
  authMode: 'login' | 'signup';
  // Actions
  navigateTo: (screen: ScreenName) => void;
  setSessionId: (id: string) => void;
  setUnitTypeId: (id: string) => void;
  setRoomDimensions: (dims: RoomDimensions) => void;
  setUser: (userId: string | null, username: string | null) => void;
  setAuthMode: (mode: 'login' | 'signup') => void;
  /** Generates a fresh sessionId and reads the fixed unit's dimensions —
   *  the single place both the anonymous and the authenticated paths start
   *  a new session from, so they can never drift out of sync. */
  startNewSession: () => void;
  reset: () => void;
}

function createSessionId(): string {
  if ('randomUUID' in crypto) return crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const useSessionStore = create<SessionState>((set) => ({
  currentScreen: 'entry',
  sessionId: null,
  unitTypeId: null,
  roomDimensions: null,
  userId: null,
  username: null,
  authMode: 'login',
  navigateTo: (screen) => set({ currentScreen: screen }),
  setSessionId: (id) => set({ sessionId: id }),
  setUnitTypeId: (id) => set({ unitTypeId: id }),
  setRoomDimensions: (dims) => set({ roomDimensions: dims }),
  setUser: (userId, username) => set({ userId, username }),
  setAuthMode: (mode) => set({ authMode: mode }),
  startNewSession: () =>
    set({
      sessionId: createSessionId(),
      unitTypeId: MULBERRY_PLACE_2BR_ID,
      roomDimensions: { ...MULBERRY_PLACE_2BR.defaultDimensions },
    }),
  reset: () =>
    set({
      currentScreen: 'entry',
      sessionId: null,
      unitTypeId: null,
      roomDimensions: null,
      userId: null,
      username: null,
    }),
}));
