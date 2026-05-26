import { create } from 'zustand';
import { GameHistory } from '../types';
import { getGameHistory, clearGameHistory, deleteHistoryRecord } from '../utils/storage';

interface HistoryStore {
  histories: GameHistory[];
  selectedHistory: GameHistory | null;
  
  loadHistories: () => void;
  selectHistory: (history: GameHistory | null) => void;
  clearAll: () => void;
  deleteRecord: (id: string) => void;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  histories: [],
  selectedHistory: null,

  loadHistories: () => {
    const histories = getGameHistory();
    set({ histories });
  },

  selectHistory: (history: GameHistory | null) => {
    set({ selectedHistory: history });
  },

  clearAll: () => {
    clearGameHistory();
    set({ histories: [], selectedHistory: null });
  },

  deleteRecord: (id: string) => {
    deleteHistoryRecord(id);
    const histories = get().histories.filter(h => h.id !== id);
    set({ 
      histories,
      selectedHistory: get().selectedHistory?.id === id ? null : get().selectedHistory,
    });
  },
}));
