import { create } from 'zustand';
import type {
  ScheduleRecord,
  HistoryVersion,
  ConflictItem,
  ScheduleStatus,
  WizardState,
} from '../types';
import {
  initialScheduleRecords,
  historyVersions as initialHistory,
  conflictItems as initialConflicts,
} from '../data/mockData';

interface ScheduleStore {
  records: ScheduleRecord[];
  historyVersions: HistoryVersion[];
  conflictItems: ConflictItem[];
  selectedRecordId: string | null;
  wizardState: WizardState;
  statusFilter: ScheduleStatus | 'all';
  conflictFilter: 'all' | 'wrong_caliber' | 'supplement' | 'pending_review';

  setSelectedRecordId: (id: string | null) => void;
  setStatusFilter: (status: ScheduleStatus | 'all') => void;
  setConflictFilter: (filter: 'all' | 'wrong_caliber' | 'supplement' | 'pending_review') => void;
  getRecordById: (id: string) => ScheduleRecord | undefined;
  getHistoryByRecordId: (recordId: string) => HistoryVersion[];
  getConflictsByRecordId: (recordId: string) => ConflictItem[];
  getRecordsByStatus: (status: ScheduleStatus | 'all') => ScheduleRecord[];
  reviewPendingItem: (conflictId: string, passed: boolean) => void;
  resetWizard: () => void;
  advanceWizardStep: () => void;
  resetToDemoData: () => void;
}

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  records: [...initialScheduleRecords],
  historyVersions: [...initialHistory],
  conflictItems: [...initialConflicts],
  selectedRecordId: null,
  wizardState: {
    currentStep: 1,
    imported: false,
    complaintsMatched: false,
    reviewTableUpdated: false,
  },
  statusFilter: 'all',
  conflictFilter: 'all',

  setSelectedRecordId: (id) => set({ selectedRecordId: id }),

  setStatusFilter: (status) => set({ statusFilter: status }),

  setConflictFilter: (filter) => set({ conflictFilter: filter }),

  getRecordById: (id) => get().records.find((r) => r.id === id),

  getHistoryByRecordId: (recordId) =>
    get()
      .historyVersions.filter((h) => h.recordId === recordId)
      .sort((a, b) => a.version - b.version),

  getConflictsByRecordId: (recordId) =>
    get().conflictItems.filter((c) => c.recordId === recordId),

  getRecordsByStatus: (status) => {
    if (status === 'all') return get().records;
    return get().records.filter((r) => r.status === status);
  },

  reviewPendingItem: (conflictId, passed) => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    set((state) => {
      const conflict = state.conflictItems.find((c) => c.id === conflictId);
      if (!conflict) return state;

      const updatedConflicts = state.conflictItems.map((c) =>
        c.id === conflictId
          ? { ...c, resolved: true, resolver: '社区书记', resolvedAt: now }
          : c
      );

      const updatedRecords = state.records.map((r) =>
        r.id === conflict.recordId
          ? {
              ...r,
              status: passed ? ('reviewed' as ScheduleStatus) : ('pending_review' as ScheduleStatus),
              remarks: passed
                ? r.remarks + ' 社区书记复核通过。'
                : r.remarks + ' 社区书记驳回，需补充材料。',
              updatedAt: now,
            }
          : r
      );

      const record = state.records.find((r) => r.id === conflict.recordId);
      if (record) {
        const newHistory: HistoryVersion = {
          id: `v${Date.now()}`,
          recordId: conflict.recordId,
          version: state.getHistoryByRecordId(conflict.recordId).length + 1,
          snapshot: updatedRecords.find((r) => r.id === conflict.recordId)!,
          operationType: 'review',
          operator: '社区书记',
          description: passed ? '社区书记复核通过' : '社区书记驳回，需补充材料',
          timestamp: now,
        };
        return {
          conflictItems: updatedConflicts,
          records: updatedRecords,
          historyVersions: [...state.historyVersions, newHistory],
        };
      }
      return { conflictItems: updatedConflicts, records: updatedRecords };
    });
  },

  resetWizard: () =>
    set({
      wizardState: {
        currentStep: 1,
        imported: false,
        complaintsMatched: false,
        reviewTableUpdated: false,
      },
    }),

  advanceWizardStep: () =>
    set((state) => {
      const nextStep = state.wizardState.currentStep + 1;
      const updates: Partial<WizardState> = { currentStep: nextStep };
      if (nextStep === 2) updates.imported = true;
      if (nextStep === 3) updates.complaintsMatched = true;
      if (nextStep > 3) updates.reviewTableUpdated = true;
      return { wizardState: { ...state.wizardState, ...updates } };
    }),

  resetToDemoData: () =>
    set({
      records: [...initialScheduleRecords],
      historyVersions: [...initialHistory],
      conflictItems: [...initialConflicts],
    }),
}));
