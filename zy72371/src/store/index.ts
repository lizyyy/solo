import { create } from 'zustand';
import { BatchRecord, ThresholdConfig, BatchStatus, ReviewPayload, SupplementPayload, ProcessLog } from '../types';
import { mockBatches, mockThresholds } from '../data/mockData';

const generateId = () => Math.random().toString(36).substring(2, 11);

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
  getThresholdVersions: () => string[];
  reviewBatch: (batchId: string, payload: ReviewPayload) => void;
  supplementBatch: (batchId: string, payload: SupplementPayload) => void;
  addBatch: (batch: BatchRecord) => void;
  importBatchByType: (type: BatchStatus) => string | null;
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

  getThresholdVersions: () => {
    return [...new Set(get().thresholds.map(t => t.version))];
  },

  importBatchByType: (type) => {
    const found = get().batches.find(b => b.status === type || 
      (type === 'needs_supplement' && b.status === 'needs_supplement'));
    if (found) {
      set({ currentBatchId: found.id, selectedSampleType: type });
      return found.id;
    }
    return null;
  },

  reviewBatch: (batchId, payload) => {
    const now = new Date();
    set(state => ({
      batches: state.batches.map(batch => {
        if (batch.id !== batchId) return batch;

        const remarkChanged = !!payload.newRemark && payload.newRemark !== batch.remark;
        const finalRemark = remarkChanged ? payload.newRemark! : batch.remark;

        const newLogs: ProcessLog[] = [
          {
            id: generateId(),
            batchId,
            action: 'review',
            operator: payload.reviewer,
            description: `设备工程师复核通过，修正原因：${payload.reason}`,
            timestamp: now,
            fieldName: 'status',
            beforeValue: 'pending_review (待复核)',
            afterValue: 'normal (正常)'
          }
        ];

        if (remarkChanged) {
          newLogs.push({
            id: generateId(),
            batchId,
            action: 'remark_edit',
            operator: payload.reviewer,
            description: `设备工程师修改巡检备注，原因：${payload.reason}`,
            timestamp: now,
            fieldName: 'remark',
            beforeValue: batch.remark,
            afterValue: finalRemark
          });
        }

        const newRemarkHistory = remarkChanged
          ? [
              ...batch.remarkHistory,
              {
                id: generateId(),
                timestamp: now,
                operator: payload.reviewer,
                beforeRemark: batch.remark,
                afterRemark: finalRemark,
                reason: payload.reason
              }
            ]
          : batch.remarkHistory;

        return {
          ...batch,
          status: 'normal' as BatchStatus,
          correctionReason: payload.reason,
          reviewedBy: payload.reviewer,
          reviewedAt: now,
          remark: finalRemark,
          remarkHistory: newRemarkHistory,
          updatedAt: now,
          processLogs: [...batch.processLogs, ...newLogs]
        };
      })
    }));
  },

  supplementBatch: (batchId, payload) => {
    const now = new Date();
    set(state => ({
      batches: state.batches.map(batch => {
        if (batch.id !== batchId) return batch;

        const finalRemark = payload.supplementRemark && payload.supplementRemark.trim()
          ? payload.supplementRemark
          : batch.remark;

        const remarkChanged = finalRemark !== batch.remark;

        const zone4Threshold = state.thresholds.find(
          t => t.version === payload.thresholdVersion && t.zone === 4
        );
        const relaxedMax = zone4Threshold?.maxTemp ?? 1260;

        const newPoints = batch.temperaturePoints.map(p => {
          if (!p.isAbnormal) return p;
          const nowValid = p.temperature <= relaxedMax;
          return {
            ...p,
            isAbnormal: !nowValid,
            isCorrected: p.isAbnormal && nowValid,
            originalTemp: p.originalTemp ?? p.temperature
          };
        });

        const newLogs: ProcessLog[] = [
          {
            id: generateId(),
            batchId,
            action: 'threshold_check',
            operator: payload.operator,
            description: `质检员小白补看安全阈值表，确定适用 ${payload.thresholdVersion} 口径`,
            timestamp: now,
            fieldName: 'appliedThresholdVersion',
            beforeValue: batch.appliedThresholdVersion ?? 'v2024.01 (新口径)',
            afterValue: `${payload.thresholdVersion} (旧口径)`
          },
          {
            id: generateId(),
            batchId,
            action: 'supplement',
            operator: payload.operator,
            description: `从安全阈值表补录 ${payload.thresholdVersion} 旧口径标准，重新判定，已将状态从待补录更新为已补录`,
            timestamp: now,
            fieldName: 'status',
            beforeValue: 'needs_supplement (待补录)',
            afterValue: 'supplemented (已补录)'
          }
        ];

        if (remarkChanged) {
          newLogs.push({
            id: generateId(),
            batchId,
            action: 'remark_edit',
            operator: payload.operator,
            description: `补录同时更新巡检备注`,
            timestamp: now,
            fieldName: 'remark',
            beforeValue: batch.remark,
            afterValue: finalRemark
          });
        }

        const newRemarkHistory = remarkChanged
          ? [
              ...batch.remarkHistory,
              {
                id: generateId(),
                timestamp: now,
                operator: payload.operator,
                beforeRemark: batch.remark,
                afterRemark: finalRemark,
                reason: `阈值补录为 ${payload.thresholdVersion}，同步更新备注说明`
              }
            ]
          : batch.remarkHistory;

        return {
          ...batch,
          status: 'supplemented' as BatchStatus,
          appliedThresholdVersion: payload.thresholdVersion,
          supplementedFrom: `安全阈值表 ${payload.thresholdVersion}`,
          supplementedAt: now,
          supplementOperator: payload.operator,
          remark: finalRemark,
          remarkHistory: newRemarkHistory,
          updatedAt: now,
          temperaturePoints: newPoints,
          processLogs: [...batch.processLogs, ...newLogs]
        };
      })
    }));
  },

  addBatch: (batch) => {
    set(state => ({
      batches: [...state.batches, batch]
    }));
  }
}));
