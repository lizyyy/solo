import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GameRecord } from '../types';

interface HistoryState {
  records: GameRecord[];
  currentRecord: GameRecord | null;

  addRecord: (record: GameRecord) => void;
  removeRecord: (id: string) => void;
  deleteRecord: (id: string) => void;
  clearAllRecords: () => void;
  getRecord: (id: string) => GameRecord | undefined;
  setCurrentRecord: (record: GameRecord | null) => void;
  getRecordsBySample: (sampleId: string) => GameRecord[];
  getSuccessfulRecords: () => GameRecord[];
  getFailedRecords: () => GameRecord[];
  searchRecords: (query: string) => GameRecord[];
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      records: [],
      currentRecord: null,

      addRecord: (record) =>
        set((state) => ({
          records: [record, ...state.records],
          currentRecord: record,
        })),

      removeRecord: (id) =>
        set((state) => ({
          records: state.records.filter((r) => r.id !== id),
          currentRecord: state.currentRecord?.id === id ? null : state.currentRecord,
        })),

      deleteRecord: (id) => {
        const { removeRecord } = get();
        removeRecord(id);
      },

      clearAllRecords: () =>
        set({
          records: [],
          currentRecord: null,
        }),

      getRecord: (id) => {
        return get().records.find((r) => r.id === id);
      },

      setCurrentRecord: (record) => set({ currentRecord: record }),

      getRecordsBySample: (sampleId) => {
        return get().records.filter((r) => r.sampleSource === sampleId);
      },

      getSuccessfulRecords: () => {
        return get().records.filter((r) => r.result.success);
      },

      getFailedRecords: () => {
        return get().records.filter((r) => !r.result.success);
      },

      searchRecords: (query) => {
        const lowerQuery = query.toLowerCase();
        return get().records.filter(
          (r) =>
            r.name.toLowerCase().includes(lowerQuery) ||
            (r.sampleSource && r.sampleSource.toLowerCase().includes(lowerQuery)) ||
            (r.result.failureReason && r.result.failureReason.toLowerCase().includes(lowerQuery))
        );
      },
    }),
    {
      name: 'particle-accelerator-history',
      partialize: (state) => ({
        records: state.records,
      }),
    }
  )
);
