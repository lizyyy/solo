import { create } from 'zustand';
import type { WaterQualityRecord, RecordStatus, ParameterScheme, TimelineEvent } from '@/types';
import { mockRecords, getCleaningStepsByScheme, getCleanedValueByScheme } from '@/data/records';
import { mockSchemes } from '@/data/schemes';
import { getTimelineByRecordId } from '@/data/timeline';

interface AppState {
  records: WaterQualityRecord[];
  selectedRecordId: string | null;
  schemes: ParameterScheme[];
  activeSchemeId: string;
  compareSchemeId: string | null;
  compareMode: boolean;

  setSelectedRecord: (id: string | null) => void;
  setActiveScheme: (id: string) => void;
  setCompareScheme: (id: string | null) => void;
  toggleCompareMode: () => void;
  updateRecordStatus: (id: string, status: RecordStatus) => void;
  getSelectedRecord: () => WaterQualityRecord | undefined;
  getRecordsByStatus: (status: RecordStatus) => WaterQualityRecord[];
  getMissingEvidenceCount: () => number;
  getRecordTimeline: (recordId: string) => TimelineEvent[];
  getCleanedValueForScheme: (recordId: string, schemeId: string) => number;
  getCleaningStepsForScheme: (recordId: string, schemeId: string) => { schemeId: string; steps: typeof mockRecords[0]['cleaningSteps'] }[];
}

export const useAppStore = create<AppState>((set, get) => ({
  records: mockRecords,
  selectedRecordId: 'rec-002',
  schemes: mockSchemes,
  activeSchemeId: 'scheme-standard',
  compareSchemeId: null,
  compareMode: false,

  setSelectedRecord: (id) => set({ selectedRecordId: id }),

  setActiveScheme: (id) => set({ activeSchemeId: id }),

  setCompareScheme: (id) => set({ compareSchemeId: id }),

  toggleCompareMode: () => set((state) => ({ compareMode: !state.compareMode })),

  updateRecordStatus: (id, status) =>
    set((state) => ({
      records: state.records.map((r) =>
        r.id === id ? { ...r, status } : r
      ),
    })),

  getSelectedRecord: () => {
    const { records, selectedRecordId } = get();
    return records.find((r) => r.id === selectedRecordId);
  },

  getRecordsByStatus: (status) => {
    return get().records.filter((r) => r.status === status);
  },

  getMissingEvidenceCount: () => {
    return get().records.reduce((count, r) => count + r.missingEvidence.length, 0);
  },

  getRecordTimeline: (recordId) => {
    return getTimelineByRecordId(recordId);
  },

  getCleanedValueForScheme: (recordId, schemeId) => {
    const record = get().records.find((r) => r.id === recordId);
    if (!record) return 0;
    return getCleanedValueByScheme(record, schemeId);
  },

  getCleaningStepsForScheme: (recordId, schemeId) => {
    const record = get().records.find((r) => r.id === recordId);
    if (!record) return [];
    
    const schemes = [schemeId];
    if (get().compareMode && get().compareSchemeId) {
      schemes.push(get().compareSchemeId!);
    }
    
    return schemes.map((sid) => ({
      schemeId: sid,
      steps: getCleaningStepsByScheme(record, sid),
    }));
  },
}));
