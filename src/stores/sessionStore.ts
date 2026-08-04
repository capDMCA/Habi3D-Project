import { create } from 'zustand';
import type { ScreenName, RoomDimensions } from '../types';

interface SessionState {
  currentScreen: ScreenName;
  // Anonymous session — no account, no login. Generated once when the
  // resident taps "Begin Session" on the entry screen.
  sessionId: string | null;
  // Which Mulberry Place unit type the resident confirmed on unit setup.
  unitTypeId: string | null;
  roomDimensions: RoomDimensions | null;
  // Actions
  navigateTo: (screen: ScreenName) => void;
  setSessionId: (id: string) => void;
  setUnitTypeId: (id: string) => void;
  setRoomDimensions: (dims: RoomDimensions) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  currentScreen: 'entry',
  sessionId: null,
  unitTypeId: null,
  roomDimensions: null,
  navigateTo: (screen) => set({ currentScreen: screen }),
  setSessionId: (id) => set({ sessionId: id }),
  setUnitTypeId: (id) => set({ unitTypeId: id }),
  setRoomDimensions: (dims) => set({ roomDimensions: dims }),
  reset: () =>
    set({
      currentScreen: 'entry',
      sessionId: null,
      unitTypeId: null,
      roomDimensions: null,
    }),
}));
