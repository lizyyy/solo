import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ReplayData, HistoryRecord } from '../game/types';
import {
  saveReplayToStorage,
  saveHistoryToStorage,
  loadReplayFromStorage,
  loadHistoryFromStorage,
  clearAllStorage,
} from '../utils/storage';

interface HistoryStore {
  history: HistoryRecord[];
  replays: Record<string, ReplayData>;
  saveHistory: (record: HistoryRecord) => void;
  saveReplay: (replay: ReplayData) => string;
  loadHistory: () => HistoryRecord[];
  loadReplay: (id: string) => ReplayData | null;
  deleteHistory: (id: string) => void;
  clearAll: () => void;
  initializeFromStorage: () => void;
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
      history: [],
      replays: {},

      initializeFromStorage: () => {
        const history = loadHistoryFromStorage();
        set({ history });
      },

      saveHistory: (record: HistoryRecord) => {
        saveHistoryToStorage(record);
        set(state => ({
          history: [record, ...state.history],
        }));
      },

      saveReplay: (replay: ReplayData): string => {
        const id = saveReplayToStorage(replay);
        set(state => ({
          replays: { ...state.replays, [id]: replay },
        }));
        return id;
      },

      loadHistory: (): HistoryRecord[] => {
        return get().history;
      },

      loadReplay: (id: string): ReplayData | null => {
        const stored = loadReplayFromStorage(id);
        if (stored) {
          return stored;
        }
        return get().replays[id] || null;
      },

      deleteHistory: (id: string) => {
        set(state => {
          const record = state.history.find(h => h.id === id);
          const newReplays = { ...state.replays };
          if (record) {
            delete newReplays[record.replayDataId];
          }
          const newHistory = state.history.filter(h => h.id !== id);
          localStorage.setItem('museum-night-patrol-storage', JSON.stringify({
            history: newHistory,
            replays: newReplays,
          }));
          return {
            history: newHistory,
            replays: newReplays,
          };
        });
      },

      clearAll: () => {
        clearAllStorage();
        set({ history: [], replays: {} });
      },
    }),
    {
      name: 'museum-night-patrol-storage',
      partialize: (state) => ({
        history: state.history,
        replays: state.replays,
      }),
    }
  )
);
