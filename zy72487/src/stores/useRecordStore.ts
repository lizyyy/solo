import { create } from 'zustand';
import type { AcceptanceRecord, SelfCheckResult } from '@shared/types';
import { api } from '@/lib/api';

interface RecordState {
  records: AcceptanceRecord[];
  currentRecord: AcceptanceRecord | null;
  loading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  fetchById: (id: string) => Promise<void>;
  importRecord: (data: {
    redLineNo: string;
    communityName: string;
    communityNameOld?: string;
    redLineRemark: string;
  }) => Promise<AcceptanceRecord>;
  submitReview: (id: string, gridInspection: string) => Promise<void>;
  confirmConflict: (id: string, resolution: string) => Promise<void>;
  rejectConflict: (id: string, resolution: string) => Promise<void>;
  confirmName: (id: string, confirmedName: string) => Promise<void>;
  updateSummary: (id: string, summary: string) => Promise<void>;
  recalcRecord: (id: string) => Promise<void>;
  clearCurrent: () => void;
}

export const useRecordStore = create<RecordState>((set, get) => ({
  records: [],
  currentRecord: null,
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const records = await api.records.getAll();
      set({ records, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const record = await api.records.getById(id);
      set({ currentRecord: record, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  importRecord: async (data) => {
    set({ loading: true, error: null });
    try {
      const record = await api.records.import({ ...data, operator: '小付' });
      await get().fetchAll();
      return record;
    } finally {
      set({ loading: false });
    }
  },

  submitReview: async (id, gridInspection) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.records.submitReview(id, gridInspection, '小付');
      set({ currentRecord: updated });
      await get().fetchAll();
    } finally {
      set({ loading: false });
    }
  },

  confirmConflict: async (id, resolution) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.records.confirmConflict(id, resolution, '小付');
      set({ currentRecord: updated });
      await get().fetchAll();
    } finally {
      set({ loading: false });
    }
  },

  rejectConflict: async (id, resolution) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.records.rejectConflict(id, resolution, '小付');
      set({ currentRecord: updated });
      await get().fetchAll();
    } finally {
      set({ loading: false });
    }
  },

  confirmName: async (id, confirmedName) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.records.confirmName(id, confirmedName, '小付');
      set({ currentRecord: updated });
      await get().fetchAll();
    } finally {
      set({ loading: false });
    }
  },

  updateSummary: async (id, summary) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.records.updateSummary(id, summary, '小付');
      set({ currentRecord: updated });
      await get().fetchAll();
    } finally {
      set({ loading: false });
    }
  },

  recalcRecord: async (id) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.records.recalc(id);
      set({ currentRecord: updated });
      await get().fetchAll();
    } finally {
      set({ loading: false });
    }
  },

  clearCurrent: () => set({ currentRecord: null }),
}));

interface SelfCheckState {
  result: SelfCheckResult | null;
  loading: boolean;
  error: string | null;
  runAll: () => Promise<void>;
}

export const useSelfCheckStore = create<SelfCheckState>((set) => ({
  result: null,
  loading: false,
  error: null,

  runAll: async () => {
    set({ loading: true, error: null });
    try {
      const result = await api.selfCheck.runAll();
      set({ result, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },
}));
