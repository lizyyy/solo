import { create } from 'zustand';
import { api } from '@/lib/api';
import type { SelfcheckResult } from '@/types';

interface SelfcheckState {
  results: SelfcheckResult[];
  loading: boolean;
  runChecks: (importId: string) => Promise<void>;
  fetchResults: (importId: string) => Promise<void>;
}

const useSelfcheckStore = create<SelfcheckState>((set) => ({
  results: [],
  loading: false,

  runChecks: async (importId) => {
    set({ loading: true });
    try {
      const data = await api.selfcheck.run(importId);
      set({ results: data, loading: false });
    } catch (e: unknown) {
      set({ loading: false });
      throw e;
    }
  },

  fetchResults: async (importId) => {
    set({ loading: true });
    try {
      const data = await api.selfcheck.results(importId);
      set({ results: data, loading: false });
    } catch (e: unknown) {
      set({ loading: false });
      throw e;
    }
  },
}));

export default useSelfcheckStore;
