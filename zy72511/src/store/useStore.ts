import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AttributionSample,
  OperationLog,
  AttributionStatus,
  OperationType,
  AppState
} from '../types';
import { initialSamples } from '../data/samples';
import { initialOperations } from '../data/operations';

interface StoreState extends AppState {
  setSamples: (samples: AttributionSample[]) => void;
  updateSample: (id: string, updates: Partial<AttributionSample>) => void;
  addOperationLog: (log: Omit<OperationLog, 'id' | 'operationTime'>) => void;
  confirmSample: (sampleId: string, remark: string, operator: string, operatorRole: string) => void;
  rejectSample: (sampleId: string, remark: string, operator: string, operatorRole: string) => void;
  submitForReview: (sampleId: string, operator: string, operatorRole: string) => void;
  getSampleById: (id: string) => AttributionSample | undefined;
  getLogsBySampleId: (sampleId: string) => OperationLog[];
  getConflicts: () => AttributionSample[];
  getStatistics: () => {
    total: number;
    normal: number;
    conflict: number;
    pendingReview: number;
    confirmed: number;
  };
  resetToInitial: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);
const getCurrentTime = () => new Date().toLocaleString('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
}).replace(/\//g, '-');

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      samples: initialSamples,
      operationLogs: initialOperations,
      currentUser: {
        name: '阿宁',
        role: 'AI产品经理'
      },

      setSamples: (samples) => set({ samples }),

      updateSample: (id, updates) => {
        const sample = get().getSampleById(id);
        if (!sample) return;

        const beforeState = { ...sample };
        const afterState = { ...sample, ...updates, updatedAt: getCurrentTime() };

        set((state) => ({
          samples: state.samples.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: getCurrentTime() } : s
          )
        }));

        const log: Omit<OperationLog, 'id' | 'operationTime'> = {
          sampleId: id,
          operationType: OperationType.UPDATE,
          operator: get().currentUser.name,
          operatorRole: get().currentUser.role,
          description: `更新样本 ${sample.sampleNo} 信息`,
          beforeState,
          afterState,
          affectedSamples: [id]
        };
        get().addOperationLog(log);
      },

      addOperationLog: (log) => {
        const newLog: OperationLog = {
          ...log,
          id: generateId(),
          operationTime: getCurrentTime()
        };
        set((state) => ({
          operationLogs: [newLog, ...state.operationLogs]
        }));
      },

      confirmSample: (sampleId, remark, operator, operatorRole) => {
        const sample = get().getSampleById(sampleId);
        if (!sample) return;

        const beforeState = JSON.parse(JSON.stringify(sample));
        
        const finalModelVersion = sample.desensitizationRule 
          ? sample.originalModelVersion || sample.modelVersion 
          : sample.modelVersion;
        
        const afterState = {
          ...sample,
          status: AttributionStatus.CONFIRMED,
          modelVersion: finalModelVersion,
          reviewBy: operator,
          reviewTime: getCurrentTime(),
          decisionRemark: `【确认脱敏规则主张】${remark}。最终模型版本：${finalModelVersion}`,
          currentStep: 3,
          updatedAt: getCurrentTime(),
          hasConflict: true,
          conflictEvidence: sample.conflictEvidence,
          originalModelVersion: sample.originalModelVersion || sample.modelVersion
        };

        set((state) => ({
          samples: state.samples.map((s) =>
            s.id === sampleId ? afterState : s
          )
        }));

        const log: Omit<OperationLog, 'id' | 'operationTime'> = {
          sampleId,
          operationType: OperationType.CONFIRM,
          operator,
          operatorRole,
          description: `确认样本 ${sample.sampleNo} 归因结果（以脱敏规则主张为准）`,
          reason: remark,
          beforeState,
          afterState,
          affectedSamples: [sampleId]
        };
        get().addOperationLog(log);
      },

      rejectSample: (sampleId, remark, operator, operatorRole) => {
        const sample = get().getSampleById(sampleId);
        if (!sample) return;

        const beforeState = JSON.parse(JSON.stringify(sample));
        
        const finalModelVersion = sample.grayBatch 
          ? sample.grayBatch.modelVersion 
          : sample.modelVersion;
        
        const afterState = {
          ...sample,
          status: AttributionStatus.CONFIRMED,
          modelVersion: finalModelVersion,
          reviewBy: operator,
          reviewTime: getCurrentTime(),
          decisionRemark: `【确认灰度批次主张】${remark}。最终模型版本：${finalModelVersion}`,
          currentStep: 3,
          updatedAt: getCurrentTime(),
          hasConflict: true,
          conflictEvidence: sample.conflictEvidence,
          originalModelVersion: sample.originalModelVersion || sample.modelVersion
        };

        set((state) => ({
          samples: state.samples.map((s) =>
            s.id === sampleId ? afterState : s
          )
        }));

        const log: Omit<OperationLog, 'id' | 'operationTime'> = {
          sampleId,
          operationType: OperationType.REJECT,
          operator,
          operatorRole,
          description: `确认样本 ${sample.sampleNo} 归因结果（以灰度批次主张为准）`,
          reason: remark,
          beforeState,
          afterState,
          affectedSamples: [sampleId]
        };
        get().addOperationLog(log);
      },

      submitForReview: (sampleId, operator, operatorRole) => {
        const sample = get().getSampleById(sampleId);
        if (!sample) return;

        const beforeState = JSON.parse(JSON.stringify(sample));
        const afterState = {
          ...sample,
          status: AttributionStatus.PENDING_REVIEW,
          updatedAt: getCurrentTime(),
          hasConflict: true,
          conflictEvidence: sample.conflictEvidence
        };

        set((state) => ({
          samples: state.samples.map((s) =>
            s.id === sampleId ? afterState : s
          )
        }));

        const log: Omit<OperationLog, 'id' | 'operationTime'> = {
          sampleId,
          operationType: OperationType.SUBMIT_REVIEW,
          operator,
          operatorRole,
          description: `提交样本 ${sample.sampleNo} 运营复核`,
          reason: '模型版本换了但样本编号没变，存在冲突，需运营复核最终确认',
          beforeState,
          afterState,
          affectedSamples: [sampleId]
        };
        get().addOperationLog(log);
      },

      getSampleById: (id) => {
        return get().samples.find((s) => s.id === id);
      },

      getLogsBySampleId: (sampleId) => {
        return get().operationLogs
          .filter((log) => log.sampleId === sampleId)
          .sort((a, b) => new Date(b.operationTime).getTime() - new Date(a.operationTime).getTime());
      },

      getConflicts: () => {
        return get().samples.filter((s) => s.hasConflict);
      },

      getStatistics: () => {
        const samples = get().samples;
        return {
          total: samples.length,
          normal: samples.filter((s) => s.status === AttributionStatus.NORMAL).length,
          conflict: samples.filter((s) => s.status === AttributionStatus.CONFLICT).length,
          pendingReview: samples.filter((s) => s.status === AttributionStatus.PENDING_REVIEW).length,
          confirmed: samples.filter((s) => s.status === AttributionStatus.CONFIRMED).length
        };
      },

      resetToInitial: () => {
        set({
          samples: initialSamples,
          operationLogs: initialOperations
        });
      }
    }),
    {
      name: 'attribution-store',
      partialize: (state) => ({
        samples: state.samples,
        operationLogs: state.operationLogs
      })
    }
  )
);
