import { create } from 'zustand';
import type { HistoryEntry, ReviewSession } from '../types/history';

interface HistoryState {
  sessions: ReviewSession[];
  currentSessionId: string | null;

  createSession: (name: string) => string;
  addEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void;
  setCurrentSession: (sessionId: string) => void;
  getCurrentSession: () => ReviewSession | null;
  getCurrentEntry: () => HistoryEntry | null;
  goToEntry: (index: number) => void;
  goToPrevious: () => void;
  goToNext: () => void;
  clearSessions: () => void;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
}

const STORAGE_KEY = 'surface_integral_history';

export const useHistoryStore = create<HistoryState>((set, get) => ({
  sessions: [],
  currentSessionId: null,

  createSession: (name) => {
    const session: ReviewSession = {
      id: `session_${Date.now()}`,
      name,
      createdAt: Date.now(),
      entries: [],
      currentEntryIndex: -1,
    };
    set((state) => ({
      sessions: [...state.sessions, session],
      currentSessionId: session.id,
    }));
    return session.id;
  },

  addEntry: (entryData) => {
    const { currentSessionId, sessions } = get();
    if (!currentSessionId) return;

    const entry: HistoryEntry = {
      ...entryData,
      id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    set({
      sessions: sessions.map((s) =>
        s.id === currentSessionId
          ? {
              ...s,
              entries: [...s.entries, entry],
              currentEntryIndex: s.entries.length,
            }
          : s
      ),
    });
  },

  setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),

  getCurrentSession: () => {
    const { sessions, currentSessionId } = get();
    return sessions.find((s) => s.id === currentSessionId) || null;
  },

  getCurrentEntry: () => {
    const session = get().getCurrentSession();
    if (!session || session.currentEntryIndex < 0) return null;
    return session.entries[session.currentEntryIndex] || null;
  },

  goToEntry: (index) => {
    const { currentSessionId, sessions } = get();
    if (!currentSessionId) return;

    set({
      sessions: sessions.map((s) =>
        s.id === currentSessionId
          ? { ...s, currentEntryIndex: Math.max(0, Math.min(index, s.entries.length - 1)) }
          : s
      ),
    });
  },

  goToPrevious: () => {
    const session = get().getCurrentSession();
    if (!session) return;
    get().goToEntry(session.currentEntryIndex - 1);
  },

  goToNext: () => {
    const session = get().getCurrentSession();
    if (!session) return;
    get().goToEntry(session.currentEntryIndex + 1);
  },

  clearSessions: () => set({ sessions: [], currentSessionId: null }),

  saveToLocalStorage: () => {
    const { sessions } = get();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  },

  loadFromLocalStorage: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const sessions = JSON.parse(stored) as ReviewSession[];
        set({ sessions });
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  },
}));
