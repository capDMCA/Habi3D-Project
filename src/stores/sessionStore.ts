import { create } from 'zustand';
import type { ScreenName, RoomDimensions } from '../types';

interface SessionState {
  currentScreen: ScreenName;
  // Auth
  userId: string | null;
  username: string;
  isAdmin: boolean;
  // Evaluation session
  participantCode: string;
  participantId: string | null;
  roomDimensions: RoomDimensions | null;
  // Actions
  navigateTo: (screen: ScreenName) => void;
  setUserId: (id: string | null) => void;
  setUsername: (name: string) => void;
  setIsAdmin: (value: boolean) => void;
  setParticipantCode: (code: string) => void;
  setParticipantId: (id: string) => void;
  setRoomDimensions: (dims: RoomDimensions) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  currentScreen: 'auth',
  userId: null,
  username: '',
  isAdmin: false,
  participantCode: '',
  participantId: null,
  roomDimensions: null,
  navigateTo: (screen) => set({ currentScreen: screen }),
  setUserId: (id) => set({ userId: id }),
  setUsername: (name) => set({ username: name }),
  setIsAdmin: (value) => set({ isAdmin: value }),
  setParticipantCode: (code) => set({ participantCode: code }),
  setParticipantId: (id) => set({ participantId: id }),
  setRoomDimensions: (dims) => set({ roomDimensions: dims }),
  reset: () =>
    set({
      currentScreen: 'auth',
      userId: null,
      username: '',
      isAdmin: false,
      participantCode: '',
      participantId: null,
      roomDimensions: null,
    }),
}));
