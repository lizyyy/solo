import { create } from 'zustand';
import type {
  Service,
  Dependency,
  DegradeRule,
  DrillPlan,
  DrillResult,
} from './types';
import { topologyApi, rulesApi, drillApi } from './api';

interface AppState {
  services: Service[];
  dependencies: Dependency[];
  rules: DegradeRule[];
  drillPlans: DrillPlan[];
  drillResults: DrillResult[];
  currentDrill: DrillResult | null;
  selectedPlanId: string | null;
  selectedResultId: string | null;
  loading: boolean;
  error: string | null;

  fetchAll: () => Promise<void>;
  fetchTopology: () => Promise<void>;
  fetchRules: () => Promise<void>;
  fetchPlans: () => Promise<void>;
  fetchResults: () => Promise<void>;
  fetchCurrentDrill: () => Promise<void>;

  createRule: (rule: Partial<DegradeRule>) => Promise<void>;
  updateRule: (id: string, rule: Partial<DegradeRule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;

  createPlan: (plan: Partial<DrillPlan>) => Promise<void>;
  updatePlan: (id: string, plan: Partial<DrillPlan>) => Promise<void>;

  startDrill: (planId: string) => Promise<DrillResult>;
  runRecovery: (resultId: string) => Promise<DrillResult>;

  setSelectedPlan: (id: string | null) => void;
  setSelectedResult: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  services: [],
  dependencies: [],
  rules: [],
  drillPlans: [],
  drillResults: [],
  currentDrill: null,
  selectedPlanId: null,
  selectedResultId: null,
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      await Promise.all([
        get().fetchTopology(),
        get().fetchRules(),
        get().fetchPlans(),
        get().fetchResults(),
        get().fetchCurrentDrill(),
      ]);
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  fetchTopology: async () => {
    const res = await topologyApi.get();
    set({ services: res.data.services, dependencies: res.data.dependencies });
  },

  fetchRules: async () => {
    const res = await rulesApi.list();
    set({ rules: res.data });
  },

  fetchPlans: async () => {
    const res = await drillApi.listPlans();
    set({ drillPlans: res.data });
  },

  fetchResults: async () => {
    const res = await drillApi.listResults();
    set({ drillResults: res.data });
  },

  fetchCurrentDrill: async () => {
    const res = await drillApi.getCurrent();
    set({ currentDrill: res.data });
  },

  createRule: async (rule) => {
    await rulesApi.create(rule);
    await get().fetchRules();
  },

  updateRule: async (id, rule) => {
    await rulesApi.update(id, rule);
    await get().fetchRules();
  },

  deleteRule: async (id) => {
    await rulesApi.delete(id);
    await get().fetchRules();
  },

  createPlan: async (plan) => {
    await drillApi.createPlan(plan);
    await get().fetchPlans();
  },

  updatePlan: async (id, plan) => {
    await drillApi.updatePlan(id, plan);
    await get().fetchPlans();
  },

  startDrill: async (planId) => {
    const res = await drillApi.start(planId);
    await get().fetchResults();
    await get().fetchCurrentDrill();
    set({ selectedResultId: res.data.id });
    return res.data;
  },

  runRecovery: async (resultId) => {
    const res = await drillApi.runRecovery(resultId);
    await get().fetchResults();
    return res.data;
  },

  setSelectedPlan: (id) => set({ selectedPlanId: id }),
  setSelectedResult: (id) => set({ selectedResultId: id }),
}));
