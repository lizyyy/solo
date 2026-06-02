import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TrackRecord, FilterState, ValidationStatus, AppState, ImportStats } from '../types';
import { validateAllRecords, getImportStats } from '../utils/validator';
import { computeDiff } from '../utils/diff';

interface TrackStore extends AppState {
  addRecords: (records: TrackRecord[]) => void;
  updateRemark: (id: string, newRemark: string) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  clearAll: () => void;
  getFilteredRecords: () => TrackRecord[];
  getStats: () => Record<ValidationStatus | 'all', number>;
  setImportStats: (stats: ImportStats | null) => void;
  setShowImportModal: (show: boolean) => void;
}

const defaultFilters: FilterState = {
  status: 'all',
  teacherName: '',
  trackName: '',
  dateFrom: '',
  dateTo: '',
};

export const useTrackStore = create<TrackStore>()(
  persist(
    (set, get) => ({
      records: [],
      filters: defaultFilters,
      selectedIds: [],
      importStats: null,
      showImportModal: false,

      addRecords: (newRecords: TrackRecord[]) => {
        const validatedRecords = validateAllRecords(newRecords);
        set((state) => {
          const combined = [...state.records, ...validatedRecords];
          const reValidated = validateAllRecords(combined);
          const stats = getImportStats(validatedRecords);
          return {
            records: reValidated,
            importStats: stats,
            showImportModal: true,
          };
        });
      },

      updateRemark: (id: string, newRemark: string) => {
        set((state) => ({
          records: state.records.map((record) => {
            if (record.id !== id) return record;

            const oldRemark = record.remark;
            const diff = computeDiff(oldRemark, newRemark);
            const now = Date.now();

            const historyEntry = {
              timestamp: now,
              oldRemark,
              newRemark,
              diff,
            };

            return {
              ...record,
              remark: newRemark,
              lastModifiedAt: now,
              modifyHistory: [...record.modifyHistory, historyEntry],
            };
          }),
        }));
      },

      setFilters: (filters: Partial<FilterState>) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
        }));
      },

      resetFilters: () => {
        set({ filters: defaultFilters });
      },

      clearAll: () => {
        set({
          records: [],
          filters: defaultFilters,
          selectedIds: [],
          importStats: null,
          showImportModal: false,
        });
      },

      getFilteredRecords: () => {
        const { records, filters } = get();
        return records.filter((record) => {
          if (filters.status !== 'all' && record.validationStatus !== filters.status) {
            return false;
          }
          if (filters.teacherName && !record.teacherName.toLowerCase().includes(filters.teacherName.toLowerCase())) {
            return false;
          }
          if (filters.trackName && !record.trackName.toLowerCase().includes(filters.trackName.toLowerCase())) {
            return false;
          }
          if (filters.dateFrom && record.authStart && record.authStart < filters.dateFrom) {
            return false;
          }
          if (filters.dateTo && record.authEnd && record.authEnd > filters.dateTo) {
            return false;
          }
          return true;
        });
      },

      getStats: () => {
        const { records } = get();
        const stats: Record<ValidationStatus | 'all', number> = {
          all: records.length,
          normal: 0,
          auth_expired: 0,
          tc_mismatch: 0,
          duplicate: 0,
          dirty_data: 0,
        };
        records.forEach((r) => {
          stats[r.validationStatus]++;
        });
        return stats;
      },

      setImportStats: (stats: ImportStats | null) => {
        set({ importStats: stats });
      },

      setShowImportModal: (show: boolean) => {
        set({ showImportModal: show });
      },
    }),
    {
      name: 'music-teacher-track-verification',
      version: 1,
      partialize: (state) => ({
        records: state.records,
        filters: state.filters,
      }),
    }
  )
);
