import { create } from 'zustand';
import type { RecordItem, RunHistoryItem, ConfirmStatus, AnomalyHandlingStatus } from '../types';
import { MOCK_RECORDS, MOCK_RUN_HISTORY, MOCK_BATCH } from '../data/mockData';

interface AppState {
  records: RecordItem[];
  runHistory: RunHistoryItem[];
  batch: typeof MOCK_BATCH;
  selectedSourceFilter: string[];
  selectedStatusFilter: string[];
  searchKeyword: string;
  isDirtyDataLoaded: boolean;

  setSourceFilter: (sources: string[]) => void;
  setStatusFilter: (statuses: string[]) => void;
  setSearchKeyword: (kw: string) => void;
  toggleSourceFilter: (source: string) => void;
  toggleStatusFilter: (status: string) => void;
  loadDirtyDemoData: () => void;

  updateRecordStatus: (recordId: string, status: ConfirmStatus, confirmBy?: string) => void;
  updateRecordRemark: (recordId: string, remark: string) => void;
  updateAnomalyStatus: (
    recordId: string,
    handlingStatus: AnomalyHandlingStatus,
    handlingRemark?: string,
    handledBy?: string
  ) => void;

  addNewRun: (triggerReason: string, remarkBefore: string, remarkAfter: string) => void;
  toggleRunSelection: (runId: string) => void;

  getFilteredRecords: () => RecordItem[];
  getStats: () => {
    total: number;
    normal: number;
    anomaly: number;
    oldVisa: number;
    verbal: number;
    confirmed: number;
    pending: number;
    processing: number;
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  records: [],
  runHistory: [],
  batch: MOCK_BATCH,
  selectedSourceFilter: [],
  selectedStatusFilter: [],
  searchKeyword: '',
  isDirtyDataLoaded: false,

  setSourceFilter: (sources) => set({ selectedSourceFilter: sources }),
  setStatusFilter: (statuses) => set({ selectedStatusFilter: statuses }),
  setSearchKeyword: (kw) => set({ searchKeyword: kw }),

  toggleSourceFilter: (source) =>
    set((s) => {
      const exists = s.selectedSourceFilter.includes(source);
      return {
        selectedSourceFilter: exists
          ? s.selectedSourceFilter.filter((x) => x !== source)
          : [...s.selectedSourceFilter, source],
      };
    }),

  toggleStatusFilter: (status) =>
    set((s) => {
      const exists = s.selectedStatusFilter.includes(status);
      return {
        selectedStatusFilter: exists
          ? s.selectedStatusFilter.filter((x) => x !== status)
          : [...s.selectedStatusFilter, status],
      };
    }),

  loadDirtyDemoData: () =>
    set({
      records: JSON.parse(JSON.stringify(MOCK_RECORDS)),
      runHistory: JSON.parse(JSON.stringify(MOCK_RUN_HISTORY)),
      isDirtyDataLoaded: true,
      selectedSourceFilter: [],
      selectedStatusFilter: [],
      searchKeyword: '',
    }),

  updateRecordStatus: (recordId, status, confirmBy) =>
    set((s) => ({
      records: s.records.map((r) =>
        r.id === recordId
          ? {
              ...r,
              status,
              confirmBy: confirmBy ?? r.confirmBy,
              confirmAt: status === 'confirmed' ? new Date().toLocaleString('zh-CN') : r.confirmAt,
            }
          : r
      ),
    })),

  updateRecordRemark: (recordId, remark) =>
    set((s) => ({
      records: s.records.map((r) => (r.id === recordId ? { ...r, remark } : r)),
    })),

  updateAnomalyStatus: (recordId, handlingStatus, handlingRemark, handledBy) =>
    set((s) => ({
      records: s.records.map((r) =>
        r.id === recordId && r.anomaly
          ? {
              ...r,
              anomaly: {
                ...r.anomaly,
                handlingStatus,
                handlingRemark: handlingRemark ?? r.anomaly.handlingRemark,
                handledBy: handledBy ?? r.anomaly.handledBy,
                handledAt: new Date().toLocaleString('zh-CN'),
              },
            }
          : r
      ),
    })),

  addNewRun: (triggerReason, remarkBefore, remarkAfter) => {
    const { records, runHistory } = get();
    const newRun: RunHistoryItem = {
      id: `run-${Date.now()}`,
      batchId: MOCK_BATCH.batchId,
      runIndex: runHistory.length + 1,
      runAt: new Date().toLocaleString('zh-CN'),
      runBy: '当前用户',
      triggerReason,
      remarkBefore,
      remarkAfter,
      recordCount: records.length,
      anomalyCount: records.filter((r) => r.source === 'anomaly').length,
      pendingCount: records.filter((r) => r.status === 'pending_evidence').length,
      confirmedCount: records.filter((r) => r.status === 'confirmed').length,
      summary: `用户重跑：${triggerReason}`,
    };
    set({ runHistory: [...runHistory, newRun] });
  },

  toggleRunSelection: (runId) =>
    set((s) => {
      const currentSelected = s.runHistory.filter((r) => r.isSelected).map((r) => r.id);
      const targetRun = s.runHistory.find((r) => r.id === runId);
      const isCurrentlySelected = targetRun?.isSelected ?? false;

      if (isCurrentlySelected) {
        return {
          runHistory: s.runHistory.map((r) =>
            r.id === runId ? { ...r, isSelected: false } : r
          ),
        };
      }

      if (currentSelected.length < 2) {
        return {
          runHistory: s.runHistory.map((r) =>
            r.id === runId ? { ...r, isSelected: true } : r
          ),
        };
      }

      const earliestId = currentSelected[0];
      return {
        runHistory: s.runHistory.map((r) => {
          if (r.id === earliestId) return { ...r, isSelected: false };
          if (r.id === runId) return { ...r, isSelected: true };
          return r;
        }),
      };
    }),

  getFilteredRecords: () => {
    const { records, selectedSourceFilter, selectedStatusFilter, searchKeyword } = get();
    return records.filter((r) => {
      if (selectedSourceFilter.length > 0 && !selectedSourceFilter.includes(r.source)) return false;
      if (selectedStatusFilter.length > 0 && !selectedStatusFilter.includes(r.status)) return false;
      if (searchKeyword) {
        const kw = searchKeyword.toLowerCase();
        if (
          !r.code.toLowerCase().includes(kw) &&
          !r.title.toLowerCase().includes(kw) &&
          !r.content.toLowerCase().includes(kw)
        )
          return false;
      }
      return true;
    });
  },

  getStats: () => {
    const { records } = get();
    return {
      total: records.length,
      normal: records.filter((r) => r.source === 'normal').length,
      anomaly: records.filter((r) => r.source === 'anomaly').length,
      oldVisa: records.filter((r) => r.source === 'old_visa').length,
      verbal: records.filter((r) => r.source === 'verbal').length,
      confirmed: records.filter((r) => r.status === 'confirmed').length,
      pending: records.filter((r) => r.status === 'pending_evidence').length,
      processing: records.filter((r) => r.status === 'processing').length,
    };
  },
}));
