import { create } from 'zustand';
import type { ExportHistoryItem, ExportDiff } from '../../shared/types.js';
import { api } from '@/services/api.js';

interface ExportState {
  history: ExportHistoryItem[];
  diffs: ExportDiff[];
  selectedDiffId: string | null;
  summary: string;
  loading: Record<string, boolean>;

  fetchHistory: () => Promise<void>;
  fetchDiff: (id: string) => Promise<void>;
  selectDiff: (id: string | null) => void;

  runReport: () => Promise<{ fileName: string; preview: Record<string, unknown>[]; message: string } | null>;
  runExceptions: () => Promise<{ fileName: string; warning: string; inconsistentCount: number } | null>;
  downloadReportFile: () => Promise<void>;
  downloadExceptionsFile: () => Promise<void>;
}

const setLoading = (set: any, key: string, value: boolean) =>
  set((s: ExportState) => ({ loading: { ...s.loading, [key]: value } }));

export const useExportStore = create<ExportState>((set, get) => ({
  history: [],
  diffs: [],
  selectedDiffId: null,
  summary: '',
  loading: {},

  fetchHistory: async () => {
    setLoading(set, 'history', true);
    try {
      const data = await api.getExportHistory();
      set({ history: data });
    } finally {
      setLoading(set, 'history', false);
    }
  },

  fetchDiff: async id => {
    setLoading(set, 'diff', true);
    try {
      const data = await api.getExportDiff(id);
      set({ diffs: data.diff, summary: data.summary, selectedDiffId: id });
    } finally {
      setLoading(set, 'diff', false);
    }
  },

  selectDiff: id => set({ selectedDiffId: id, diffs: [], summary: '' }),

  runReport: async () => {
    setLoading(set, 'report', true);
    try {
      const data = await api.exportReport();
      await get().fetchHistory();
      return { fileName: data.download.fileName, preview: data.preview, message: data.message };
    } catch {
      return null;
    } finally {
      setLoading(set, 'report', false);
    }
  },

  runExceptions: async () => {
    setLoading(set, 'exceptions', true);
    try {
      const data = await api.exportExceptions();
      await get().fetchHistory();
      return { fileName: data.download.fileName, warning: data.consistencyWarning, inconsistentCount: data.inconsistentCount };
    } catch {
      return null;
    } finally {
      setLoading(set, 'exceptions', false);
    }
  },

  downloadReportFile: async () => {
    setLoading(set, 'dlReport', true);
    try {
      await api.downloadReport();
    } finally {
      setLoading(set, 'dlReport', false);
    }
  },

  downloadExceptionsFile: async () => {
    setLoading(set, 'dlExc', true);
    try {
      await api.downloadExceptions();
    } finally {
      setLoading(set, 'dlExc', false);
    }
  },
}));
