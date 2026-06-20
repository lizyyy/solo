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
  matchedBatchIds: string[];
  matchedItemIds: string[];
  loading: boolean;
  error: string | null;
  signatureMismatch: { expectedBatches: number; expectedItems: number; currentBatches: number; currentItems: number } | null;
  activeBatchDetail: null | {
    batch: ScheduleBatch;
    items: ScheduleItem[];
    photos: MaintenancePhoto[];
    overrides: OverrideRecord[];
  };
  snapshots: Snapshot[];
  replaceActions: ReplaceAction[];
  lastExportSignature: string | null;
  lastExportMeta: { matchedItemCount: number; matchedBatchCount: number; exportedAt: string } | null;

  setFilters: (f: Partial<ScheduleListFilters>) => void;
  resetFilters: () => void;
  loadList: () => Promise<void>;
  loadBatchDetail: (batchId: string) => Promise<void>;
  loadSnapshots: (batchId: string) => Promise<void>;
  loadReplaceActions: (batchId?: string) => Promise<void>;
  submitOverride: (p: api.CreateOverridePayload) => Promise<void>;
  rerunBatch: (batchId: string, notes: Array<{ note: string }>) => Promise<void>;
  patchAction: (id: string, patch: Partial<ReplaceAction>) => Promise<void>;
  exportCSV: (filters: ScheduleListFilters) => Promise<{ signature: string; fileName: string; matchedItemCount: number; matchedBatchCount: number }>;
  applySignatureFilters: (sig: string) => Promise<{
    matchedItemIds: string[];
    matchedBatchIds: string[];
    mismatch: ScheduleState['signatureMismatch'];
    exportedAt: string;
  }>;
}

const DEFAULT_FILTERS: ScheduleListFilters = {};

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  filters: { ...DEFAULT_FILTERS },
  batches: [],
  items: [],
  matchedBatchIds: [],
  matchedItemIds: [],
  loading: false,
  error: null,
  signatureMismatch: null,
  activeBatchDetail: null,
  snapshots: [],
  replaceActions: [],
  lastExportSignature: null,
  lastExportMeta: null,

  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f }, signatureMismatch: null })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS }, signatureMismatch: null }),

  loadList: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.fetchList(get().filters);
      set({
        batches: res.batches,
        items: res.items,
        matchedBatchIds: res.matchedBatchIds || [],
        matchedItemIds: res.matchedItemIds || [],
        loading: false,
      });
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
    const meta = res.signatureMeta || {};
    const matchedItemCount = Number((meta as any)?.matchedItemCount || 0);
    const matchedBatchCount = Number((meta as any)?.matchedBatchCount || 0);
    const exportedAt = String((meta as any)?.exportedAt || '');
    set({
      lastExportSignature: res.signature,
      lastExportMeta: { matchedItemCount, matchedBatchCount, exportedAt },
    });
    return { signature: res.signature, fileName, matchedItemCount, matchedBatchCount };
  },

  applySignatureFilters: async (sig) => {
    const res = await api.retrieveBySignature(sig);
    const filters = { ...res.filters };
    const expectedItems = res.matchedItemIds || [];
    const expectedBatches = res.matchedBatchIds || [];
    set({ filters, lastExportSignature: sig, signatureMismatch: null });
    await get().loadList();
    const current = get();
    const currentBatches = current.matchedBatchIds || [];
    const currentItems = current.matchedItemIds || [];
    const mismatch =
      currentBatches.length !== expectedBatches.length || currentItems.length !== expectedItems.length
        ? {
            expectedBatches: expectedBatches.length,
            expectedItems: expectedItems.length,
            currentBatches: currentBatches.length,
            currentItems: currentItems.length,
          }
        : null;
    if (mismatch) set({ signatureMismatch: mismatch });
    return {
      matchedItemIds: expectedItems,
      matchedBatchIds: expectedBatches,
      mismatch,
      exportedAt: res.exportedAt,
    };
  },
}));
