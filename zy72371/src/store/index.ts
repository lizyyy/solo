import { create } from 'zustand';
import { BatchRecord, ThresholdConfig, BatchStatus } from '../types';
import { mockBatches, mockThresholds } from '../data/mockData';

interface AppState {
  batches: BatchRecord[];
  thresholds: ThresholdConfig[];
  currentBatchId: string | null;
  selectedSampleType: BatchStatus | null;
  
  setCurrentBatch: (id: string | null) => void;
  setSelectedSampleType: (type: BatchStatus | null) => void;
  getBatchById: (id: string) => BatchRecord | undefined;
  getCurrentThresholds: () => ThresholdConfig[];
  getOldThresholds: () => ThresholdConfig[];
  reviewBatch: (batchId: string, reviewer: string, reason: string) => void;
  supplementBatch: (batchId: string, thresholdVersion: string) => void;
  addBatch: (batch: BatchRecord) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  batches: mockBatches,
  thresholds: mockThresholds,
  currentBatchId: null,
  selectedSampleType: null,

  setCurrentBatch: (id) => set({ currentBatchId: id }),
  setSelectedSampleType: (type) => set({ selectedSampleType: type }),

  getBatchById: (id) => {
    return get().batches.find(b => b.id === id);
  },

  getCurrentThresholds: () => {
    return get().thresholds.filter(t => t.isCurrent);
  },

  getOldThresholds: () => {
    return get().thresholds.filter(t => !t.isCurrent);
  },

  reviewBatch: (batchId, reviewer, reason) => {
    set(state => ({
      batches: state.batches.map(batch => {
        if (batch.id === batchId) {
          return {
            ...batch,
            status: 'normal' as BatchStatus,
            correctionReason: reason,
            reviewedBy: reviewer,
            reviewedAt: new Date(),
            updatedAt: new Date(),
            processLogs: [
              ...batch.processLogs,
              {
                id: Math.random().toString(36).substring(2, 11),
                batchId,
                action: 'review',
                operator: reviewer,
                description: `设备工程师复核通过，修正原因：${reason}`,
                timestamp: new Date()
              }
            ]
          };
        }
        return batch;
      })
    }));
  },

  supplementBatch: (batchId, thresholdVersion) => {
    set(state => ({
      batches: state.batches.map(batch => {
        if (batch.id === batchId) {
          return {
            ...batch,
            status: 'supplemented' as BatchStatus,
            supplementedFrom: `安全阈值表 ${thresholdVersion}`,
            supplementedAt: new Date(),
            updatedAt: new Date()
          };
        }
        return batch;
      })
    }));
  },

  addBatch: (batch) => {
    set(state => ({
      batches: [...state.batches, batch]
    }));
  }
}));
