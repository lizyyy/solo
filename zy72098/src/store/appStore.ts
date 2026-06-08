import { create } from 'zustand';
import type {
  Batch,
  CalculationRecord,
  Sample,
  ParamVersion,
  Remark,
} from '@/types';
import {
  mockBatch,
  mockCalculationRecords,
  mockSamples,
  mockParamVersions,
  mockRemarks,
} from '@/data/mockData';
import { calculationEngine } from '@/engine/CalculationEngine';

const STORAGE_KEY = 'gnn-community-explainer-store';

interface PersistedState {
  remarks: Remark[];
  calculationRecords: CalculationRecord[];
  samples: Sample[];
  batches: Batch[];
}

function loadPersistedState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

function savePersistedState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

const persisted = loadPersistedState();

interface AppState {
  batches: Batch[];
  currentBatchId: string | null;
  calculationRecords: CalculationRecord[];
  samples: Sample[];
  paramVersions: ParamVersion[];
  remarks: Remark[];
  selectedRecordId: string | null;
  isLoading: boolean;

  getCurrentBatch: () => Batch | undefined;
  getCurrentRecords: () => CalculationRecord[];
  getCurrentSamples: () => Sample[];
  getRecordRemarks: (recordId: string) => Remark[];

  setCurrentBatch: (batchId: string) => void;
  selectRecord: (recordId: string | null) => void;
  addRemark: (recordId: string, content: string, addedBy: string) => void;
  runCalculation: () => Promise<void>;
  recalculateRecord: (recordId: string) => void;
  resetToDefaults: () => void;
}

function getPersistableState(state: AppState): PersistedState {
  return {
    remarks: state.remarks,
    calculationRecords: state.calculationRecords,
    samples: state.samples,
    batches: state.batches,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  batches: persisted?.batches ?? [mockBatch],
  currentBatchId: persisted?.batches?.[0]?.id ?? mockBatch.id,
  calculationRecords: persisted?.calculationRecords ?? mockCalculationRecords,
  samples: persisted?.samples ?? mockSamples,
  paramVersions: mockParamVersions,
  remarks: persisted?.remarks ?? mockRemarks,
  selectedRecordId: null,
  isLoading: false,

  getCurrentBatch: () => {
    const { batches, currentBatchId } = get();
    return batches.find((b) => b.id === currentBatchId);
  },

  getCurrentRecords: () => {
    const { calculationRecords, currentBatchId } = get();
    return calculationRecords.filter((r) => r.batchId === currentBatchId);
  },

  getCurrentSamples: () => {
    const { samples, currentBatchId } = get();
    return samples.filter((s) => s.batchId === currentBatchId);
  },

  getRecordRemarks: (recordId: string) => {
    const { remarks } = get();
    return remarks.filter((r) => r.recordId === recordId);
  },

  setCurrentBatch: (batchId: string) => {
    set({ currentBatchId: batchId });
  },

  selectRecord: (recordId: string | null) => {
    set({ selectedRecordId: recordId });
  },

  addRemark: (recordId: string, content: string, addedBy: string) => {
    const newRemark: Remark = {
      id: 'remark-' + Date.now(),
      recordId,
      content,
      addedBy,
      addedAt: new Date().toISOString(),
      isSupplement: true,
    };
    set((state) => {
      const updated = { remarks: [...state.remarks, newRemark] };
      savePersistedState({
        ...getPersistableState(state),
        ...updated,
      });
      return updated;
    });
  },

  runCalculation: async () => {
    set({ isLoading: true });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const { samples, currentBatchId } = get();
    const currentSamples = samples.filter((s) => s.batchId === currentBatchId);

    const newRecords: CalculationRecord[] = [];
    let successCount = 0;
    let pendingCount = 0;
    let legacyCount = 0;

    for (const sample of currentSamples) {
      const result = calculationEngine.calculate({
        nodeCount: sample.id === 'SAMPLE-006' ? null : 15 + Math.floor(Math.random() * 10),
        edgeCount: sample.id === 'SAMPLE-005' ? '35条' : 40 + Math.floor(Math.random() * 20),
        sampleId: sample.id,
        sampleName: sample.name,
        batchId: currentBatchId || '',
        avgDegree: 5 + Math.random() * 2,
      });

      newRecords.push(result.record);

      if (sample.status === 'legacy') {
        legacyCount++;
      } else if (result.type === 'success') {
        successCount++;
      } else {
        pendingCount++;
      }
    }

    set((state) => {
      const updatedBatches = state.batches.map((b) =>
        b.id === currentBatchId
          ? {
              ...b,
              status: 'completed' as const,
              successCount,
              pendingCount,
              legacyCount,
              errorCount: currentSamples.length - successCount - pendingCount - legacyCount,
              completedAt: new Date().toISOString(),
            }
          : b
      );
      const updated = {
        calculationRecords: newRecords,
        isLoading: false,
        batches: updatedBatches,
      };
      savePersistedState({
        ...getPersistableState(state),
        ...updated,
      });
      return updated;
    });
  },

  recalculateRecord: (recordId: string) => {
    const record = get().calculationRecords.find((r) => r.id === recordId);
    if (!record) return;

    const result = calculationEngine.calculate({
      nodeCount: 15 + Math.floor(Math.random() * 10),
      edgeCount: 40 + Math.floor(Math.random() * 20),
      sampleId: record.sampleId,
      sampleName: record.sampleName,
      batchId: record.batchId,
      avgDegree: 5 + Math.random() * 2,
    });

    set((state) => {
      const updated = {
        calculationRecords: state.calculationRecords.map((r) =>
          r.id === recordId ? { ...result.record, id: recordId } : r
        ),
      };
      savePersistedState({
        ...getPersistableState(state),
        ...updated,
      });
      return updated;
    });
  },

  resetToDefaults: () => {
    const defaults: PersistedState = {
      remarks: mockRemarks,
      calculationRecords: mockCalculationRecords,
      samples: mockSamples,
      batches: [mockBatch],
    };
    localStorage.removeItem(STORAGE_KEY);
    set({
      batches: defaults.batches,
      currentBatchId: mockBatch.id,
      calculationRecords: defaults.calculationRecords,
      samples: defaults.samples,
      remarks: defaults.remarks,
      selectedRecordId: null,
    });
  },
}));
