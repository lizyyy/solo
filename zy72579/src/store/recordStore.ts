import { create } from 'zustand';
import type { CheckRecord, ConflictEvidence } from '@/types';
import { mockRecords } from '@/data/mockRecords';

interface RecordStore {
  records: CheckRecord[];
  selectedRecordId: string | null;
  setSelectedRecordId: (id: string | null) => void;
  getRecordById: (id: string) => CheckRecord | undefined;
  resolveConflict: (recordId: string, conflictId: string, resolution: 'confirmed' | 'rejected') => void;
  advanceStep: (recordId: string) => void;
}

export const useRecordStore = create<RecordStore>((set, get) => ({
  records: mockRecords,
  selectedRecordId: null,

  setSelectedRecordId: (id) => set({ selectedRecordId: id }),

  getRecordById: (id) => {
    return get().records.find((r) => r.id === id);
  },

  resolveConflict: (recordId, conflictId, resolution) => {
    set((state) => ({
      records: state.records.map((record) => {
        if (record.id !== recordId) return record;
        const updatedConflicts = record.conflicts.map((c: ConflictEvidence) => {
          if (c.id !== conflictId) return c;
          return {
            ...c,
            resolution,
            resolvedBy: '小乔',
            resolvedAt: new Date().toLocaleString('zh-CN'),
          };
        });
        const allResolved = updatedConflicts.every((c) => c.resolution !== null);
        const hasRejection = updatedConflicts.some((c) => c.resolution === 'rejected');
        let updatedSteps = [...record.steps];
        let updatedStatus = record.status;
        let updatedCurrentStep = record.currentStep;

        if (allResolved && !hasRejection) {
          updatedSteps = updatedSteps.map((s) => {
            if (s.key === 'review_notes') {
              return { ...s, status: 'completed' as const };
            }
            if (s.key === 'update_version') {
              return { ...s, status: 'current' as const };
            }
            return s;
          });
          updatedStatus = 'normal';
          updatedCurrentStep = 'update_version';
        } else if (hasRejection) {
          updatedSteps = updatedSteps.map((s) => {
            if (s.key === 'review_notes') {
              return { ...s, status: 'blocked' as const, blockedReason: '冲突已驳回，需重新处理' };
            }
            return s;
          });
        }

        return {
          ...record,
          conflicts: updatedConflicts,
          steps: updatedSteps,
          status: updatedStatus,
          currentStep: updatedCurrentStep,
          reviewHistory: [
            ...record.reviewHistory,
            {
              operator: '小乔',
              action: resolution === 'confirmed' ? '确认冲突' : '驳回冲突',
              time: new Date().toLocaleString('zh-CN'),
              remark: `冲突ID: ${conflictId}`,
            },
          ],
        };
      }),
    }));
  },

  advanceStep: (recordId) => {
    set((state) => ({
      records: state.records.map((record) => {
        if (record.id !== recordId) return record;
        const stepOrder = ['import_log', 'review_notes', 'update_version'] as const;
        const currentIdx = stepOrder.indexOf(record.currentStep);
        if (currentIdx >= stepOrder.length - 1) return record;
        const nextStep = stepOrder[currentIdx + 1];
        const updatedSteps = record.steps.map((s) => {
          if (s.key === record.currentStep) {
            return { ...s, status: 'completed' as const };
          }
          if (s.key === nextStep) {
            return { ...s, status: 'current' as const };
          }
          return s;
        });
        const isCompleted = nextStep === 'update_version';
        return {
          ...record,
          steps: updatedSteps,
          currentStep: nextStep,
          status: isCompleted ? 'completed' : record.status,
          updateTime: new Date().toLocaleString('zh-CN'),
          reviewHistory: [
            ...record.reviewHistory,
            {
              operator: '小乔',
              action: `完成步骤: ${record.steps.find((s) => s.key === record.currentStep)?.label}`,
              time: new Date().toLocaleString('zh-CN'),
              remark: '',
            },
          ],
        };
      }),
    }));
  },
}));
