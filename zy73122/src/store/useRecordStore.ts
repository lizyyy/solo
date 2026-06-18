import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BuoyRecord, LatLonMapping, DeduplicateResult } from '../types';
import { deduplicateRecords } from '../utils/deduplicate';
import { generateSampleRecords, generateSampleMappings, generateCloudSuggestions } from '../utils/mockData';

interface RecordState {
  records: BuoyRecord[];
  mappings: LatLonMapping[];
  cloudSuggestions: { id: string; recordId: string; suggestion: string; severity: string; referenceDoc: string }[];
  selectedRecordId: string | null;
  filters: { status?: string; seaState?: number; search?: string };
  activeTab: string;

  addRecords: (newRecords: BuoyRecord[]) => DeduplicateResult;
  updateRecord: (id: string, patch: Partial<BuoyRecord>) => void;
  setSelectedRecord: (id: string | null) => void;
  setFilter: (key: string, value: any) => void;
  setActiveTab: (tab: string) => void;
  resetToSample: () => void;
}

export const useRecordStore = create<RecordState>()(
  persist(
    (set, get) => ({
      records: generateSampleRecords(),
      mappings: generateSampleMappings(),
      cloudSuggestions: generateCloudSuggestions(),
      selectedRecordId: null,
      filters: {},
      activeTab: 'import',

      addRecords: (newRecords) => {
        const existing = get().records;
        const { records: merged, result } = deduplicateRecords(existing, newRecords);
        set({ records: merged });
        return result;
      },

      updateRecord: (id, patch) => {
        set(state => ({
          records: state.records.map(r =>
            r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
          ),
        }));
      },

      setSelectedRecord: (id) => set({ selectedRecordId: id }),

      setFilter: (key, value) => {
        set(state => ({
          filters: { ...state.filters, [key]: value },
        }));
      },

      setActiveTab: (tab) => set({ activeTab: tab }),

      resetToSample: () => {
        set({
          records: generateSampleRecords(),
          mappings: generateSampleMappings(),
          cloudSuggestions: generateCloudSuggestions(),
        });
      },
    }),
    {
      name: 'buoy-annotation-storage',
    }
  ),
);
