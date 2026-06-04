import { create } from 'zustand';
import { api } from '@/lib/api';
import type { ImportHistoryItem } from '@/types';

interface CurrentImport {
  totalRows: number;
  duplicateRows: number;
  anomalies: number;
  id: string;
}

interface ImportState {
  importHistory: ImportHistoryItem[];
  currentImport: CurrentImport | null;
  loading: boolean;
  error: string | null;
  fetchHistory: () => Promise<void>;
  uploadFile: (file: File, batchLabel: string, operator: string) => Promise<void>;
}

const useImportStore = create<ImportState>((set) => ({
  importHistory: [],
  currentImport: null,
  loading: false,
  error: null,

  fetchHistory: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.import.history();
      set({ importHistory: data, loading: false });
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Unknown error', loading: false });
    }
  },

  uploadFile: async (file, batchLabel, operator) => {
    set({ loading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('batch_label', batchLabel);
        formData.append('operator', operator);
      const data = await api.import.upload(formData);
      set({ currentImport: data, loading: false });
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Unknown error', loading: false });
    }
  },
}));

export default useImportStore;
