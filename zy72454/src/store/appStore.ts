import { create } from 'zustand';
import {
  Breakpoint,
  BreakpointWithDetails,
  BreakpointStatus,
  HistoryRecord,
  ImportBatch,
  BoundaryRule,
  FriendlyError,
  ImportPreviewResult,
} from '../../shared/types';
import api from '../lib/apiClient';

interface AppState {
  breakpoints: Breakpoint[];
  currentBreakpoint: BreakpointWithDetails | null;
  historyRecords: HistoryRecord[];
  importBatches: ImportBatch[];
  rules: BoundaryRule[];
  loading: Record<string, boolean>;
  error: FriendlyError | null;
  notifications: Array<{ id: string; type: 'success' | 'error' | 'info'; message: string }>;

  fetchBreakpoints: (filters?: {
    status?: BreakpointStatus;
    hasConstructionDetour?: boolean;
    search?: string;
  }) => Promise<void>;
  fetchBreakpoint: (id: string) => Promise<void>;
  updateBreakpoint: (
    id: string,
    updates: {
      redlineNote?: string;
      status?: BreakpointStatus;
      hasConstructionDetour?: boolean;
      updatedBy?: string;
    }
  ) => Promise<void>;
  markDetour: (id: string) => Promise<void>;
  confirmBreakpoint: (id: string) => Promise<void>;

  previewImport: (content: string, format?: 'csv' | 'json') => Promise<ImportPreviewResult>;
  executeImport: (
    content: string,
    format?: 'csv' | 'json',
    fileName?: string
  ) => Promise<ImportBatch>;
  fetchImportBatches: () => Promise<void>;

  fetchHistory: () => Promise<void>;
  rollbackHistory: (historyId: string) => Promise<void>;

  fetchRules: () => Promise<void>;
  toggleRule: (id: string, isActive: boolean) => Promise<void>;

  clearError: () => void;
  addNotification: (type: 'success' | 'error' | 'info', message: string) => void;
  removeNotification: (id: string) => void;
  setLoading: (key: string, value: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  breakpoints: [],
  currentBreakpoint: null,
  historyRecords: [],
  importBatches: [],
  rules: [],
  loading: {},
  error: null,
  notifications: [],

  setLoading: (key, value) =>
    set((state) => ({ loading: { ...state.loading, [key]: value } })),

  clearError: () => set({ error: null }),

  addNotification: (type, message) => {
    const id = Date.now().toString();
    set((state) => ({
      notifications: [...state.notifications, { id, type, message }],
    }));
    setTimeout(() => {
      get().removeNotification(id);
    }, 4000);
  },

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  fetchBreakpoints: async (filters) => {
    set({ loading: { ...get().loading, breakpoints: true } });
    try {
      const data = await api.breakpoints.list(filters);
      set({ breakpoints: data });
    } catch (err) {
      set({ error: err as FriendlyError });
    } finally {
      set({ loading: { ...get().loading, breakpoints: false } });
    }
  },

  fetchBreakpoint: async (id) => {
    set({ loading: { ...get().loading, breakpoint: true } });
    try {
      const data = await api.breakpoints.get(id);
      set({ currentBreakpoint: data });
    } catch (err) {
      set({ error: err as FriendlyError });
    } finally {
      set({ loading: { ...get().loading, breakpoint: false } });
    }
  },

  updateBreakpoint: async (id, updates) => {
    try {
      await api.breakpoints.update(id, updates);
      await get().fetchBreakpoint(id);
      await get().fetchBreakpoints();
      get().addNotification('success', '断点信息已更新');
    } catch (err) {
      const e = err as FriendlyError;
      set({ error: e });
      get().addNotification('error', e.message);
      throw err;
    }
  },

  markDetour: async (id) => {
    try {
      await api.breakpoints.markDetour(id);
      await get().fetchBreakpoint(id);
      await get().fetchBreakpoints();
      get().addNotification('success', '已标记为施工临时改道，已流转到待复核状态');
    } catch (err) {
      const e = err as FriendlyError;
      set({ error: e });
      get().addNotification('error', e.message);
      throw err;
    }
  },

  confirmBreakpoint: async (id) => {
    try {
      await api.breakpoints.confirm(id);
      await get().fetchBreakpoint(id);
      await get().fetchBreakpoints();
      get().addNotification('success', '居民代表已确认，点位清单已更新');
    } catch (err) {
      const e = err as FriendlyError;
      set({ error: e });
      get().addNotification('error', e.message);
      throw err;
    }
  },

  previewImport: async (content, format = 'csv') => {
    set({ loading: { ...get().loading, importPreview: true } });
    try {
      return await api.import.preview(content, format);
    } catch (err) {
      set({ error: err as FriendlyError });
      throw err;
    } finally {
      set({ loading: { ...get().loading, importPreview: false } });
    }
  },

  executeImport: async (content, format = 'csv', fileName) => {
    set({ loading: { ...get().loading, importExecute: true } });
    try {
      const batch = await api.import.execute(content, format, fileName);
      await get().fetchBreakpoints();
      await get().fetchImportBatches();
      get().addNotification(
        'success',
        `导入完成：新增 ${batch.importedCount} 条，跳过重复 ${batch.duplicateCount} 条`
      );
      return batch;
    } catch (err) {
      const e = err as FriendlyError;
      set({ error: e });
      get().addNotification('error', e.message);
      throw err;
    } finally {
      set({ loading: { ...get().loading, importExecute: false } });
    }
  },

  fetchImportBatches: async () => {
    try {
      const data = await api.import.batches();
      set({ importBatches: data });
    } catch (err) {
      set({ error: err as FriendlyError });
    }
  },

  fetchHistory: async () => {
    try {
      const data = await api.history.list();
      set({ historyRecords: data });
    } catch (err) {
      set({ error: err as FriendlyError });
    }
  },

  rollbackHistory: async (historyId) => {
    try {
      await api.history.rollback(historyId);
      await get().fetchHistory();
      await get().fetchBreakpoints();
      get().addNotification('success', '已回滚到指定历史版本');
    } catch (err) {
      const e = err as FriendlyError;
      set({ error: e });
      get().addNotification('error', e.message);
      throw err;
    }
  },

  fetchRules: async () => {
    try {
      const data = await api.rules.list();
      set({ rules: data });
    } catch (err) {
      set({ error: err as FriendlyError });
    }
  },

  toggleRule: async (id, isActive) => {
    try {
      await api.rules.toggle(id, isActive);
      await get().fetchRules();
      get().addNotification('success', `规则已${isActive ? '启用' : '停用'}`);
    } catch (err) {
      const e = err as FriendlyError;
      set({ error: e });
      get().addNotification('error', e.message);
      throw err;
    }
  },
}));

export default useAppStore;
