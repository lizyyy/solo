import { create } from 'zustand';
import { Warning, WarningDetail, FilterOptions } from '../types';
import { getMockWarnings, refreshMockWarnings, filterWarnings, generateMockWarningDetail } from '../services/mockData';
import { detectFault } from '../services/faultDetection';

interface WarningState {
  warnings: Warning[];
  filteredWarnings: Warning[];
  selectedWarningId: string | null;
  warningDetail: WarningDetail | null;
  filters: FilterOptions;
  loading: boolean;
  error: string | null;
  
  fetchWarnings: () => void;
  refreshWarnings: () => void;
  setFilters: (filters: FilterOptions) => void;
  selectWarning: (id: string | null) => void;
  fetchWarningDetail: (id: string) => void;
  updateNextStep: (warningId: string, stepId: string, completed: boolean) => void;
}

export const useWarningStore = create<WarningState>((set, get) => ({
  warnings: [],
  filteredWarnings: [],
  selectedWarningId: null,
  warningDetail: null,
  filters: {},
  loading: false,
  error: null,

  fetchWarnings: () => {
    set({ loading: true });
    try {
      const warnings = getMockWarnings();
      const filtered = filterWarnings(warnings, get().filters);
      set({ warnings, filteredWarnings: filtered, loading: false });
    } catch {
      set({ error: '加载预警数据失败', loading: false });
    }
  },

  refreshWarnings: () => {
    set({ loading: true });
    try {
      const warnings = refreshMockWarnings();
      const filtered = filterWarnings(warnings, get().filters);
      set({ warnings, filteredWarnings: filtered, loading: false });
    } catch {
      set({ error: '刷新预警数据失败', loading: false });
    }
  },

  setFilters: (filters: FilterOptions) => {
    const filtered = filterWarnings(get().warnings, filters);
    set({ filters, filteredWarnings: filtered });
  },

  selectWarning: (id: string | null) => {
    set({ selectedWarningId: id });
    if (id) {
      get().fetchWarningDetail(id);
    } else {
      set({ warningDetail: null });
    }
  },

  fetchWarningDetail: (id: string) => {
    set({ loading: true });
    try {
      const warning = get().warnings.find(w => w.id === id);
      if (warning) {
        const detail = generateMockWarningDetail(warning);
        const judgment = detectFault(detail);
        detail.faultJudgment = judgment;
        set({ warningDetail: detail, loading: false });
      } else {
        set({ error: '未找到预警记录', loading: false });
      }
    } catch {
      set({ error: '加载预警详情失败', loading: false });
    }
  },

  updateNextStep: (warningId: string, stepId: string, completed: boolean) => {
    const { warningDetail } = get();
    if (warningDetail && warningDetail.id === warningId) {
      const updatedNextSteps = warningDetail.foremanData.nextSteps.map(step =>
        step.id === stepId ? { ...step, completed } : step
      );
      set({
        warningDetail: {
          ...warningDetail,
          foremanData: {
            ...warningDetail.foremanData,
            nextSteps: updatedNextSteps,
          },
        },
      });
    }
  },
}));
