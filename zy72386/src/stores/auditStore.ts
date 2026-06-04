import { create } from 'zustand';
import { api } from '@/lib/api';
import type { AuditEntry } from '@/types';

interface AuditState {
  entries: AuditEntry[];
  loading: boolean;
  fetchRecordAudit: (recordId: string) => Promise<void>;
  fetchBatchAudit: (importId: string) => Promise<void>;
}

const useAuditStore = create<AuditState>((set) => ({
  entries: [],
  loading: false,

  fetchRecordAudit: async (recordId) => {
    set({ loading: true });
    try {
      const data = await api.audit.record(recordId);
      set({ entries: data, loading: false });
    } catch (e: unknown) {
      set({ loading: false });
      throw e;
    }
  },

  fetchBatchAudit: async (importId) => {
    set({ loading: true });
    try {
      const data = await api.audit.batch(importId);
      set({ entries: data, loading: false });
    } catch (e: unknown) {
      set({ loading: false });
      throw e;
    }
  },
}));

export default useAuditStore;
