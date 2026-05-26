import { create } from 'zustand';
import type {
  GameState,
  Room,
  Guest,
  Cleaner,
  GameEvent,
  PlayerAction,
  HistoryRecord,
  GameStateSnapshot,
} from './types';

const initialState: GameState = {
  status: 'menu',
  currentLevel: 1,
  currentTime: 0,
  rooms: [],
  guests: [],
  cleaners: [],
  score: 0,
  complaints: 0,
  satisfaction: 100,
  events: [],
  history: [],
  replayIndex: 0,
  selectedGuestId: null,
  selectedRoomId: null,
};

interface GameActions {
  setStatus: (status: GameState['status']) => void;
  setCurrentLevel: (level: number) => void;
  setCurrentTime: (time: number) => void;
  setRooms: (rooms: Room[]) => void;
  updateRoom: (roomId: number, updates: Partial<Room>) => void;
  setGuests: (guests: Guest[]) => void;
  updateGuest: (guestId: string, updates: Partial<Guest>) => void;
  setCleaners: (cleaners: Cleaner[]) => void;
  updateCleaner: (cleanerId: string, updates: Partial<Cleaner>) => void;
  setScore: (score: number) => void;
  addScore: (delta: number) => void;
  addComplaint: () => void;
  setSatisfaction: (satisfaction: number) => void;
  addSatisfaction: (delta: number) => void;
  addEvent: (event: GameEvent) => void;
  setSelectedGuest: (guestId: string | null) => void;
  setSelectedRoom: (roomId: number | null) => void;
  setFailReason: (reason: string | undefined) => void;
  recordHistory: (action?: PlayerAction) => void;
  setReplayIndex: (index: number) => void;
  resetGame: () => void;
  loadSnapshot: (snapshot: GameStateSnapshot) => void;
}

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  ...initialState,

  setStatus: (status) => set({ status }),
  setCurrentLevel: (currentLevel) => set({ currentLevel }),
  setCurrentTime: (currentTime) => set({ currentTime }),

  setRooms: (rooms) => set({ rooms }),
  updateRoom: (roomId, updates) =>
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId ? { ...r, ...updates } : r
      ),
    })),

  setGuests: (guests) => set({ guests }),
  updateGuest: (guestId, updates) =>
    set((state) => ({
      guests: state.guests.map((g) =>
        g.id === guestId ? { ...g, ...updates } : g
      ),
    })),

  setCleaners: (cleaners) => set({ cleaners }),
  updateCleaner: (cleanerId, updates) =>
    set((state) => ({
      cleaners: state.cleaners.map((c) =>
        c.id === cleanerId ? { ...c, ...updates } : c
      ),
    })),

  setScore: (score) => set({ score }),
  addScore: (delta) => set((state) => ({ score: state.score + delta })),

  addComplaint: () => set((state) => ({ complaints: state.complaints + 1 })),

  setSatisfaction: (satisfaction) =>
    set({ satisfaction: Math.max(0, Math.min(100, satisfaction)) }),
  addSatisfaction: (delta) =>
    set((state) => ({
      satisfaction: Math.max(0, Math.min(100, state.satisfaction + delta)),
    })),

  addEvent: (event) =>
    set((state) => ({
      events: [...state.events, event].slice(-50),
    })),

  setSelectedGuest: (selectedGuestId) => set({ selectedGuestId }),
  setSelectedRoom: (selectedRoomId) => set({ selectedRoomId }),

  setFailReason: (failReason) => set({ failReason }),

  recordHistory: (action) => {
    const state = get();
    const snapshot: GameStateSnapshot = {
      currentTime: state.currentTime,
      rooms: JSON.parse(JSON.stringify(state.rooms)),
      guests: JSON.parse(JSON.stringify(state.guests)),
      cleaners: JSON.parse(JSON.stringify(state.cleaners)),
      score: state.score,
      complaints: state.complaints,
      satisfaction: state.satisfaction,
      events: JSON.parse(JSON.stringify(state.events)),
    };
    const record: HistoryRecord = {
      time: state.currentTime,
      snapshot,
      action,
    };
    set((prev) => ({
      history: [...prev.history, record],
    }));
  },

  setReplayIndex: (replayIndex) => set({ replayIndex }),

  resetGame: () =>
    set({
      ...initialState,
      currentLevel: get().currentLevel,
    }),

  loadSnapshot: (snapshot) =>
    set({
      currentTime: snapshot.currentTime,
      rooms: snapshot.rooms,
      guests: snapshot.guests,
      cleaners: snapshot.cleaners,
      score: snapshot.score,
      complaints: snapshot.complaints,
      satisfaction: snapshot.satisfaction,
      events: snapshot.events,
    }),
}));

export function getCurrentState(): GameState {
  return useGameStore.getState();
}
