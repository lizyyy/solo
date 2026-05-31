import { create } from "zustand";
import {
  api,
  type SettlementRecord,
  type SettlementFilter,
  type ImportResult,
  type ImportSession,
  type OperationLog,
  type DashboardStats,
} from "@/utils/api";
import { mapErrorMessage } from "@/utils/errorMessages";

const DEFAULT_FILTER: SettlementFilter = {
  page: 1,
  page_size: 20,
};

interface SettlementStore {
  filter: SettlementFilter;
  setFilter: (filter: Partial<SettlementFilter>) => void;
  resetFilter: () => void;
  getSerializedFilter: () => SettlementFilter;

  records: SettlementRecord[];
  total: number;
  loading: boolean;
  fetchRecords: () => Promise<void>;

  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  importResult: ImportResult | null;
  importLoading: boolean;
  setImportResult: (result: ImportResult | null) => void;

  importSessions: ImportSession[];
  fetchImportSessions: () => Promise<void>;

  stats: DashboardStats | null;
  fetchStats: () => Promise<void>;

  operationLogs: OperationLog[];
  operationLogsTotal: number;
  fetchHistory: (filters?: {
    record_id?: string;
    operation_type?: string;
  }) => Promise<void>;

  error: string | null;
  clearError: () => void;

  toastMessage: string | null;
  toastType: "success" | "error";
  showToast: (message: string, type?: "success" | "error") => void;
  clearToast: () => void;
}

export const useSettlementStore = create<SettlementStore>((set, get) => ({
  filter: { ...DEFAULT_FILTER },
  setFilter: (partial) => {
    const newFilter = {
      ...get().filter,
      ...partial,
      page: partial.page ?? 1,
    };
    set({ filter: newFilter });
    get().fetchRecords();
  },
  resetFilter: () => {
    set({ filter: { ...DEFAULT_FILTER } });
    get().fetchRecords();
  },
  getSerializedFilter: () => {
    const { filter } = get();
    const params: SettlementFilter = { ...filter };
    return params;
  },

  records: [],
  total: 0,
  loading: false,
  fetchRecords: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.settlements.list(get().filter);
      set({ records: res.records, total: res.total, loading: false });
    } catch (err) {
      set({ error: mapErrorMessage(err), loading: false });
    }
  },

  selectedIds: new Set<string>(),
  toggleSelect: (id) => {
    const next = new Set(get().selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    set({ selectedIds: next });
  },
  selectAll: () => {
    const ids = new Set(get().records.map((r) => r.id));
    set({ selectedIds: ids });
  },
  clearSelection: () => {
    set({ selectedIds: new Set<string>() });
  },

  importResult: null,
  importLoading: false,
  setImportResult: (result) => set({ importResult: result }),

  importSessions: [],
  fetchImportSessions: async () => {
    try {
      const sessions = await api.imports.listSessions();
      set({ importSessions: sessions });
    } catch (err) {
      set({ error: mapErrorMessage(err) });
    }
  },

  stats: null,
  fetchStats: async () => {
    try {
      const stats = await api.stats.getDashboard();
      set({ stats });
    } catch (err) {
      set({ error: mapErrorMessage(err) });
    }
  },

  operationLogs: [],
  operationLogsTotal: 0,
  fetchHistory: async (filters) => {
    try {
      const params: Record<string, string> = {};
      if (filters?.record_id) params.record_id = filters.record_id;
      if (filters?.operation_type) params.operation_type = filters.operation_type;
      const logs = await api.history.list(params);
      set({ operationLogs: logs, operationLogsTotal: logs.length });
    } catch (err) {
      set({ error: mapErrorMessage(err) });
    }
  },

  error: null,
  clearError: () => set({ error: null }),

  toastMessage: null,
  toastType: "success",
  showToast: (message, type = "success") => {
    set({ toastMessage: message, toastType: type });
    setTimeout(() => {
      set({ toastMessage: null });
    }, 3000);
  },
  clearToast: () => set({ toastMessage: null }),
}));
