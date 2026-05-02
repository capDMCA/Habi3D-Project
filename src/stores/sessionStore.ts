import { create } from 'zustand';
import type { ScreenName, RoomDimensions } from '../types';

interface SessionState {
  currentScreen: ScreenName;
  participantCode: string;
  participantId: string | null;
  roomDimensions: RoomDimensions | null;
  navigateTo: (screen: ScreenName) => void;
  setParticipantCode: (code: string) => void;
  setParticipantId: (id: string) => void;
  setRoomDimensions: (dims: RoomDimensions) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  currentScreen: 'entry',
  participantCode: '',
  participantId: null,
  roomDimensions: null,
  navigateTo: (screen) => set({ currentScreen: screen }),
  setParticipantCode: (code) => set({ participantCode: code }),
  setParticipantId: (id) => set({ participantId: id }),
  setRoomDimensions: (dims) => set({ roomDimensions: dims }),
  reset: () =>
    set({
      currentScreen: 'entry',
      participantCode: '',
      participantId: null,
      roomDimensions: null,
    }),
}));
