import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HistoryStore, Experiment } from '../types';

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
      experiments: [],
      actions: {
        saveExperiment: (experiment) => {
          const current = get();
          set({
            experiments: [experiment, ...current.experiments].slice(0, 50),
          });
        },
        deleteExperiment: (id) => {
          const current = get();
          set({
            experiments: current.experiments.filter((e) => e.id !== id),
          });
        },
        getExperiment: (id) => {
          return get().experiments.find((e) => e.id === id);
        },
        clearAll: () => {
          set({ experiments: [] });
        },
      },
    }),
    {
      name: 'railgun-history-storage',
    }
  )
);
