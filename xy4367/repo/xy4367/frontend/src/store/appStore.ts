import { create } from 'zustand';
import {
  AppState,
  ObservingSite,
  Device,
  ObservingTarget,
  TargetWindow,
  Risk,
  ObservationActivity,
  RiskSummary,
} from '../types';
import { api } from '../services/api';

export const useAppStore = create<AppState & {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchAllData: () => Promise<void>;
  fetchSites: () => Promise<void>;
  fetchDevices: () => Promise<void>;
  fetchTargets: () => Promise<void>;
  fetchWindows: () => Promise<void>;
  fetchRisks: () => Promise<void>;
  fetchActivities: () => Promise<void>;
  fetchRiskSummary: () => Promise<void>;
  setCurrentActivity: (activity: ObservationActivity | null) => void;
  updateRisk: (risk: Risk) => void;
  addRisks: (risks: Risk[]) => void;
}>((set, get) => ({
  sites: [],
  devices: [],
  targets: [],
  windows: [],
  risks: [],
  activities: [],
  riskSummary: null,
  currentActivity: null,
  loading: false,
  error: null,

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  fetchAllData: async () => {
    set({ loading: true, error: null });
    try {
      const [sites, devices, targets, windows, risks, activities] = await Promise.all([
        api.getSites(),
        api.getDevices(),
        api.getTargets(),
        api.getWindows(),
        api.getRisks(),
        api.getActivities(),
      ]);

      set({
        sites,
        devices,
        targets,
        windows,
        risks,
        activities,
        loading: false,
      });
    } catch (error) {
      set({
        error: '加载数据失败',
        loading: false,
      });
    }
  },

  fetchSites: async () => {
    set({ loading: true });
    try {
      const sites = await api.getSites();
      set({ sites, loading: false });
    } catch (error) {
      set({ error: '加载观测点失败', loading: false });
    }
  },

  fetchDevices: async () => {
    set({ loading: true });
    try {
      const devices = await api.getDevices();
      set({ devices, loading: false });
    } catch (error) {
      set({ error: '加载设备失败', loading: false });
    }
  },

  fetchTargets: async () => {
    set({ loading: true });
    try {
      const targets = await api.getTargets();
      set({ targets, loading: false });
    } catch (error) {
      set({ error: '加载目标失败', loading: false });
    }
  },

  fetchWindows: async () => {
    set({ loading: true });
    try {
      const windows = await api.getWindows();
      set({ windows, loading: false });
    } catch (error) {
      set({ error: '加载观测窗口失败', loading: false });
    }
  },

  fetchRisks: async () => {
    set({ loading: true });
    try {
      const risks = await api.getRisks();
      set({ risks, loading: false });
    } catch (error) {
      set({ error: '加载风险数据失败', loading: false });
    }
  },

  fetchActivities: async () => {
    set({ loading: true });
    try {
      const activities = await api.getActivities();
      set({ activities, loading: false });
    } catch (error) {
      set({ error: '加载活动列表失败', loading: false });
    }
  },

  fetchRiskSummary: async () => {
    set({ loading: true });
    try {
      const riskSummary = await api.getRiskSummary();
      set({ riskSummary, loading: false });
    } catch (error) {
      set({ error: '加载风险统计失败', loading: false });
    }
  },

  setCurrentActivity: (activity) => set({ currentActivity: activity }),

  updateRisk: (updatedRisk) => {
    set((state) => ({
      risks: state.risks.map((r) =>
        r.id === updatedRisk.id ? updatedRisk : r
      ),
    }));
  },

  addRisks: (newRisks) => {
    set((state) => ({
      risks: newRisks,
    }));
  },
}));
