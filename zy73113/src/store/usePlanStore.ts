import { create } from 'zustand';
import type { Plan, PlanDetail, PlanStatus } from '../../shared/types';
import { api } from '../lib/api';

interface PlanState {
  plans: Plan[];
  currentPlan: PlanDetail | null;
  loading: boolean;
  error: string | null;
  filters: {
    status?: PlanStatus;
    keyword: string;
  };
  fetchPlans: () => Promise<void>;
  fetchPlanDetail: (id: string) => Promise<void>;
  setFilters: (filters: Partial<PlanState['filters']>) => void;
  updateRemark: (id: string, remark: string, changeReason: string, operator: string) => Promise<void>;
  updateJudgment: (id: string, newJudgment: any, changeReason: string, operator: string) => Promise<void>;
  updateStatus: (id: string, status: PlanStatus, operator: string) => Promise<void>;
  addMaterial: (id: string, batchNo: string, materialName: string, quantity: number, supplementReason: string, operator: string) => Promise<void>;
  clearCurrentPlan: () => void;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  plans: [],
  currentPlan: null,
  loading: false,
  error: null,
  filters: {
    keyword: '',
  },

  fetchPlans: async () => {
    set({ loading: true, error: null });
    try {
      const { filters } = get();
      const plans = await api.getPlans(filters);
      set({ plans, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchPlanDetail: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const plan = await api.getPlanDetail(id);
      set({ currentPlan: plan, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  updateRemark: async (id, remark, changeReason, operator) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.updateRemark(id, { remark, changeReason, operator });
      set((state) => ({
        plans: state.plans.map((p) => (p.id === id ? updated : p)),
        loading: false,
      }));
      if (get().currentPlan?.id === id) {
        await get().fetchPlanDetail(id);
      }
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  updateJudgment: async (id, newJudgment, changeReason, operator) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.updateJudgment(id, { newJudgment, changeReason, operator });
      set((state) => ({
        plans: state.plans.map((p) => (p.id === id ? updated : p)),
        loading: false,
      }));
      if (get().currentPlan?.id === id) {
        await get().fetchPlanDetail(id);
      }
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  updateStatus: async (id, status, operator) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.updateStatus(id, { status, operator });
      set((state) => ({
        plans: state.plans.map((p) => (p.id === id ? updated : p)),
        loading: false,
      }));
      if (get().currentPlan?.id === id) {
        await get().fetchPlanDetail(id);
      }
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  addMaterial: async (id, batchNo, materialName, quantity, supplementReason, operator) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.addMaterial(id, { batchNo, materialName, quantity, supplementReason, operator });
      set((state) => ({
        plans: state.plans.map((p) => (p.id === id ? updated : p)),
        loading: false,
      }));
      if (get().currentPlan?.id === id) {
        await get().fetchPlanDetail(id);
      }
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  clearCurrentPlan: () => {
    set({ currentPlan: null });
  },
}));
