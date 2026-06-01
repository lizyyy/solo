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
}

export const useAppStore = create<AppState>((set, get) => ({
  batches: [mockBatch],
  currentBatchId: mockBatch.id,
  calculationRecords: mockCalculationRecords,
  samples: mockSamples,
  paramVersions: mockParamVersions,
  remarks: mockRemarks,
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
      id: `remark-${Date.now()}`,
      recordId,
      content,
      addedBy,
      addedAt: new Date().toISOString(),
      isSupplement: true,
    };
    set((state) => ({
      remarks: [...state.remarks, newRemark],
    }));
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

    set((state) => ({
      calculationRecords: newRecords,
      isLoading: false,
      batches: state.batches.map((b) =>
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
      ),
    }));
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

    set((state) => ({
      calculationRecords: state.calculationRecords.map((r) =>
        r.id === recordId ? { ...result.record, id: recordId } : r
      ),
    }));
  },
}));
