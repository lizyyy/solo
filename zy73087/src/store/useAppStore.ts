import { create } from 'zustand';
import type { Material, MaterialStatus, HistoryRecord } from '../../shared/types';

interface AppState {
  materials: Material[];
  materialsTotal: number;
  stats: Record<string, number>;
  historyAll: HistoryRecord[];
  historyTotal: number;
  selectedMaterial: Material | null;
  selectedMaterialHistory: HistoryRecord[];
  loading: boolean;
  lastError: string | null;

  fetchStats: () => Promise<void>;
  fetchMaterials: (params?: any) => Promise<void>;
  fetchMaterialDetail: (id: string) => Promise<void>;
  fetchHistoryAll: (params?: any) => Promise<void>;
  setSelectedMaterial: (m: Material | null) => void;
  setError: (e: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  materials: [],
  materialsTotal: 0,
  stats: {},
  historyAll: [],
  historyTotal: 0,
  selectedMaterial: null,
  selectedMaterialHistory: [],
  loading: false,
  lastError: null,

  fetchStats: async () => {
    const { api } = await import('@/api/client');
    try {
      const stats = await api.getStats();
      set({ stats });
    } catch (e: any) {
      set({ lastError: e.message });
    }
  },

  fetchMaterials: async (params = {}) => {
    set({ loading: true });
    const { api } = await import('@/api/client');
    try {
      const res = await api.getMaterials(params);
      set({ materials: res.data, materialsTotal: res.total, loading: false });
    } catch (e: any) {
      set({ loading: false, lastError: e.message });
    }
  },

  fetchMaterialDetail: async (id: string) => {
    set({ loading: true });
    const { api } = await import('@/api/client');
    try {
      const res = await api.getMaterial(id);
      set({
        selectedMaterial: res.material,
        selectedMaterialHistory: res.history,
        loading: false,
      });
    } catch (e: any) {
      set({ loading: false, lastError: e.message });
    }
  },

  fetchHistoryAll: async (params = {}) => {
    set({ loading: true });
    const { api } = await import('@/api/client');
    try {
      const res = await api.getHistoryAll(params);
      set({ historyAll: res.data, historyTotal: res.total, loading: false });
    } catch (e: any) {
      set({ loading: false, lastError: e.message });
    }
  },

  setSelectedMaterial: (m: Material | null) => {
    set({ selectedMaterial: m });
  },

  setError: (e: string | null) => set({ lastError: e }),
}));
