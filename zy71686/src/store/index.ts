import { create } from 'zustand';
import type {
  ImportPreviewResponse,
  ImportBatch,
  DataImportWarning,
  RiskAnalysisResult,
  GraphResponse,
  DashboardStats,
  VersionSnapshot,
  OperationLog,
  BatchTask,
  RiskLevel,
  ReportResponse,
  Customer,
} from '../../shared/types';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  description?: string;
}

interface AppState {
  loading: boolean;
  setLoading: (loading: boolean) => void;

  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  currentPage: string;
  setCurrentPage: (page: string) => void;

  activeVersion: VersionSnapshot | null;
  setActiveVersion: (version: VersionSnapshot | null) => void;

  dashboardStats: DashboardStats | null;
  setDashboardStats: (stats: DashboardStats | null) => void;

  riskResults: RiskAnalysisResult[];
  riskResultsLoading: boolean;
  setRiskResults: (results: RiskAnalysisResult[]) => void;
  setRiskResultsLoading: (loading: boolean) => void;

  riskFilter: {
    riskLevel?: RiskLevel;
    searchText?: string;
  };
  setRiskFilter: (filter: Partial<AppState['riskFilter']>) => void;

  graphData: GraphResponse | null;
  graphLoading: boolean;
  setGraphData: (data: GraphResponse | null) => void;
  setGraphLoading: (loading: boolean) => void;

  graphFilter: {
    centerCustomerId?: string;
    maxDepth: number;
    minAmount?: number;
    riskLevels?: RiskLevel[];
  };
  setGraphFilter: (filter: Partial<AppState['graphFilter']>) => void;

  importPreview: ImportPreviewResponse | null;
  importPreviewLoading: boolean;
  setImportPreview: (data: ImportPreviewResponse | null) => void;
  setImportPreviewLoading: (loading: boolean) => void;

  importBatches: ImportBatch[];
  setImportBatches: (batches: ImportBatch[]) => void;

  importWarnings: DataImportWarning[];
  setImportWarnings: (warnings: DataImportWarning[]) => void;

  versions: VersionSnapshot[];
  setVersions: (versions: VersionSnapshot[]) => void;

  operationLogs: OperationLog[];
  setOperationLogs: (logs: OperationLog[]) => void;

  selectedCustomerIds: string[];
  setSelectedCustomerIds: (ids: string[]) => void;
  toggleCustomerSelection: (id: string) => void;
  clearCustomerSelection: () => void;

  batchTasks: Map<string, BatchTask>;
  updateBatchTask: (task: BatchTask) => void;
  removeBatchTask: (taskId: string) => void;

  reportResponse: ReportResponse | null;
  setReportResponse: (response: ReportResponse | null) => void;

  selectedCustomer: Customer | null;
  setSelectedCustomer: (customer: Customer | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  loading: false,
  setLoading: (loading) => set({ loading }),

  notifications: [],
  addNotification: (notification) => {
    const id = Date.now().toString();
    set((state) => ({
      notifications: [...state.notifications, { ...notification, id }],
    }));
    setTimeout(() => {
      get().removeNotification(id);
    }, 5000);
  },
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  clearNotifications: () => set({ notifications: [] }),

  currentPage: 'dashboard',
  setCurrentPage: (page) => set({ currentPage: page }),

  activeVersion: null,
  setActiveVersion: (version) => set({ activeVersion: version }),

  dashboardStats: null,
  setDashboardStats: (stats) => set({ dashboardStats: stats }),

  riskResults: [],
  riskResultsLoading: false,
  setRiskResults: (results) => set({ riskResults: results }),
  setRiskResultsLoading: (loading) => set({ riskResultsLoading: loading }),

  riskFilter: {},
  setRiskFilter: (filter) =>
    set((state) => ({
      riskFilter: { ...state.riskFilter, ...filter },
    })),

  graphData: null,
  graphLoading: false,
  setGraphData: (data) => set({ graphData: data }),
  setGraphLoading: (loading) => set({ graphLoading: loading }),

  graphFilter: {
    maxDepth: 3,
  },
  setGraphFilter: (filter) =>
    set((state) => ({
      graphFilter: { ...state.graphFilter, ...filter },
    })),

  importPreview: null,
  importPreviewLoading: false,
  setImportPreview: (data) => set({ importPreview: data }),
  setImportPreviewLoading: (loading) => set({ importPreviewLoading: loading }),

  importBatches: [],
  setImportBatches: (batches) => set({ importBatches: batches }),

  importWarnings: [],
  setImportWarnings: (warnings) => set({ importWarnings: warnings }),

  versions: [],
  setVersions: (versions) => set({ versions }),

  operationLogs: [],
  setOperationLogs: (logs) => set({ operationLogs: logs }),

  selectedCustomerIds: [],
  setSelectedCustomerIds: (ids) => set({ selectedCustomerIds: ids }),
  toggleCustomerSelection: (id) =>
    set((state) => ({
      selectedCustomerIds: state.selectedCustomerIds.includes(id)
        ? state.selectedCustomerIds.filter((i) => i !== id)
        : [...state.selectedCustomerIds, id],
    })),
  clearCustomerSelection: () => set({ selectedCustomerIds: [] }),

  batchTasks: new Map(),
  updateBatchTask: (task) =>
    set((state) => {
      const newTasks = new Map(state.batchTasks);
      newTasks.set(task.id, task);
      return { batchTasks: newTasks };
    }),
  removeBatchTask: (taskId) =>
    set((state) => {
      const newTasks = new Map(state.batchTasks);
      newTasks.delete(taskId);
      return { batchTasks: newTasks };
    }),

  reportResponse: null,
  setReportResponse: (response) => set({ reportResponse: response }),

  selectedCustomer: null,
  setSelectedCustomer: (customer) => set({ selectedCustomer: customer }),
}));

export function getRiskLevelBadgeClass(level: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    low: 'badge-risk-low',
    medium: 'badge-risk-medium',
    high: 'badge-risk-high',
    critical: 'badge-risk-critical',
  };
  return map[level] || 'badge-risk-low';
}

export function getRiskLevelText(level: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    low: '低',
    medium: '中',
    high: '高',
    critical: '极高',
  };
  return map[level] || level;
}

export function formatAmount(amount: number): string {
  return (amount / 10000).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateOnly(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
