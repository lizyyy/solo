import { create } from 'zustand';
import type {
  ScheduleBatch,
  ScheduleItem,
  ScheduleListFilters,
  OverrideRecord,
  ReplaceAction,
  Snapshot,
  MaintenancePhoto,
} from '../../shared/types';
import * as api from '../lib/api';

interface ScheduleState {
  filters: ScheduleListFilters;
  batches: ScheduleBatch[];
  items: ScheduleItem[];
  loading: boolean;
  error: string | null;
  activeBatchDetail: null | {
    batch: ScheduleBatch;
    items: ScheduleItem[];
    photos: MaintenancePhoto[];
    overrides: OverrideRecord[];
  };
  snapshots: Snapshot[];
  replaceActions: ReplaceAction[];
  lastExportSignature: string | null;

  setFilters: (f: Partial<ScheduleListFilters>) => void;
  resetFilters: () => void;
  loadList: () => Promise<void>;
  loadBatchDetail: (batchId: string) => Promise<void>;
  loadSnapshots: (batchId: string) => Promise<void>;
  loadReplaceActions: (batchId?: string) => Promise<void>;
  submitOverride: (p: api.CreateOverridePayload) => Promise<void>;
  rerunBatch: (batchId: string, notes: Array<{ note: string }>) => Promise<void>;
  patchAction: (id: string, patch: Partial<ReplaceAction>) => Promise<void>;
  exportCSV: (filters: ScheduleListFilters) => Promise<{ signature: string; fileName: string }>;
  applySignatureFilters: (sig: string) => Promise<{ matchedItemIds: string[]; matchedBatchIds: string[] }>;
}

const DEFAULT_FILTERS: ScheduleListFilters = {};

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  filters: { ...DEFAULT_FILTERS },
  batches: [],
  items: [],
  loading: false,
  error: null,
  activeBatchDetail: null,
  snapshots: [],
  replaceActions: [],
  lastExportSignature: null,

  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  loadList: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.fetchList(get().filters);
      set({ batches: res.batches, items: res.items, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  loadBatchDetail: async (batchId) => {
    set({ loading: true, error: null });
    try {
      const res = await api.fetchBatchDetail(batchId);
      set({ activeBatchDetail: res, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  loadSnapshots: async (batchId) => {
    try {
      const res = await api.fetchSnapshots(batchId);
      set({ snapshots: res });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  loadReplaceActions: async (batchId) => {
    try {
      const res = await api.fetchReplaceActions(batchId);
      set({ replaceActions: res });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  submitOverride: async (p) => {
    set({ loading: true, error: null });
    try {
      const res = await api.createOverride(p);
      // 刷新列表与批次详情（如打开）
      await get().loadList();
      if (get().activeBatchDetail && get().activeBatchDetail!.batch.batchId === p.batchId) {
        await get().loadBatchDetail(p.batchId);
      }
      // 刷新动作
      await get().loadReplaceActions(p.batchId);
      set({ loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  rerunBatch: async (batchId, notes) => {
    set({ loading: true, error: null });
    try {
      await api.postRerun(batchId, notes);
      await get().loadList();
      await get().loadSnapshots(batchId);
      set({ loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  patchAction: async (id, patch) => {
    try {
      const updated = await api.patchReplaceAction(id, patch);
      set((s) => ({
        replaceActions: s.replaceActions.map((a) => (a.id === id ? { ...a, ...updated } : a)),
      }));
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    }
  },

  exportCSV: async (filters) => {
    const res = await api.exportSchedules(filters);
    // 前端触发下载
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + res.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `电梯故障备件排程-${stamp}.csv`;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    set({ lastExportSignature: res.signature });
    return { signature: res.signature, fileName };
  },

  applySignatureFilters: async (sig) => {
    const res = await api.retrieveBySignature(sig);
    const filters = { ...res.filters };
    set({ filters });
    await get().loadList();
    return {
      matchedItemIds: res.matchedItemIds || [],
      matchedBatchIds: (filters.batchIds && filters.batchIds.length ? filters.batchIds : []),
    };
  },
}));
