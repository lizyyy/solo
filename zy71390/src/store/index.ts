import { create } from 'zustand';
import type {
  RateLimitRule,
  RuleVersion,
  Customer,
  DrillReport,
  Anomaly,
  ModificationLog,
  DashboardStats,
  CreateRuleRequest,
  UpdateRuleRequest,
  DrillConfig,
  AddWhitelistRequest,
  Tier,
  EntityType,
} from '../../shared/types';
import { api } from '../lib/api';

interface StoreState {
  rules: RateLimitRule[];
  ruleVersions: RuleVersion[];
  customers: Customer[];
  whitelist: Customer[];
  reports: DrillReport[];
  anomalies: Anomaly[];
  modifications: ModificationLog[];
  dashboardStats: DashboardStats | null;
  loading: Record<string, boolean>;
  error: string | null;

  setLoading: (key: string, value: boolean) => void;
  setError: (error: string | null) => void;

  fetchRules: () => Promise<void>;
  fetchRule: (id: string) => Promise<RateLimitRule | null>;
  getRuleVersions: (ruleId: string) => Promise<RuleVersion[]>;
  rollbackRule: (ruleId: string, version: number, reason: string) => Promise<RateLimitRule | null>;
  createRule: (data: CreateRuleRequest) => Promise<RateLimitRule | null>;
  updateRule: (
    id: string,
    data: UpdateRuleRequest
  ) => Promise<RateLimitRule | null>;

  fetchCustomers: () => Promise<void>;
  updateCustomerTier: (
    id: string,
    tier: Tier,
    reason: string
  ) => Promise<Customer | null>;

  fetchWhitelist: () => Promise<void>;
  addWhitelist: (data: AddWhitelistRequest) => Promise<Customer | null>;
  removeWhitelist: (id: string, reason: string) => Promise<boolean>;

  runDrill: (config: DrillConfig) => Promise<DrillReport | null>;
  fetchReport: (id: string) => Promise<DrillReport | null>;
  fetchReports: () => Promise<void>;
  exportReport: (id: string, format: 'csv' | 'json') => Promise<string | null>;

  fetchAnomalies: (includeResolved?: boolean) => Promise<void>;
  resolveAnomaly: (
    id: string,
    resolution: string
  ) => Promise<Anomaly | null>;

  fetchModifications: (params?: {
    entityType?: EntityType;
    entityId?: string;
  }) => Promise<void>;

  fetchDashboardStats: () => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  rules: [],
  ruleVersions: [],
  customers: [],
  whitelist: [],
  reports: [],
  anomalies: [],
  modifications: [],
  dashboardStats: null,
  loading: {},
  error: null,

  setLoading: (key, value) =>
    set((state) => ({
      loading: { ...state.loading, [key]: value },
    })),

  setError: (error) => set({ error }),

  fetchRules: async () => {
    const { setLoading, setError } = get();
    try {
      setLoading('rules', true);
      setError(null);
      const rules = await api.getRules();
      set({ rules });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取规则列表失败';
      setError(message);
      console.error('fetchRules error:', error);
    } finally {
      setLoading('rules', false);
    }
  },

  fetchRule: async (id) => {
    const { setLoading, setError } = get();
    try {
      setLoading(`rule:${id}`, true);
      setError(null);
      const rule = await api.getRule(id);
      set((state) => ({
        rules: state.rules.map((r) => (r.id === id ? rule : r)),
      }));
      return rule;
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取规则详情失败';
      setError(message);
      console.error('fetchRule error:', error);
      return null;
    } finally {
      setLoading(`rule:${id}`, false);
    }
  },

  createRule: async (data) => {
    const { setLoading, setError } = get();
    try {
      setLoading('createRule', true);
      setError(null);
      const rule = await api.createRule(data);
      set((state) => ({
        rules: [rule, ...state.rules],
      }));
      return rule;
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建规则失败';
      setError(message);
      console.error('createRule error:', error);
      return null;
    } finally {
      setLoading('createRule', false);
    }
  },

  updateRule: async (id, data) => {
    const { setLoading, setError } = get();
    try {
      setLoading(`updateRule:${id}`, true);
      setError(null);
      const rule = await api.updateRule(id, data);
      set((state) => ({
        rules: state.rules.map((r) => (r.id === id ? rule : r)),
      }));
      return rule;
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新规则失败';
      setError(message);
      console.error('updateRule error:', error);
      return null;
    } finally {
      setLoading(`updateRule:${id}`, false);
    }
  },

  getRuleVersions: async (ruleId) => {
    const { setLoading, setError } = get();
    try {
      setLoading(`ruleVersions:${ruleId}`, true);
      setError(null);
      const versions = await api.getRuleVersions(ruleId);
      set({ ruleVersions: versions });
      return versions;
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取版本历史失败';
      setError(message);
      console.error('getRuleVersions error:', error);
      return [];
    } finally {
      setLoading(`ruleVersions:${ruleId}`, false);
    }
  },

  rollbackRule: async (ruleId, version, reason) => {
    const { setLoading, setError } = get();
    try {
      setLoading(`rollbackRule:${ruleId}`, true);
      setError(null);
      const rule = await api.rollbackRule(ruleId, version, reason);
      set((state) => ({
        rules: state.rules.map((r) => (r.id === ruleId ? rule : r)),
      }));
      return rule;
    } catch (error) {
      const message = error instanceof Error ? error.message : '回滚失败';
      setError(message);
      console.error('rollbackRule error:', error);
      return null;
    } finally {
      setLoading(`rollbackRule:${ruleId}`, false);
    }
  },

  fetchCustomers: async () => {
    const { setLoading, setError } = get();
    try {
      setLoading('customers', true);
      setError(null);
      const customers = await api.getCustomers();
      set({ customers });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取客户列表失败';
      setError(message);
      console.error('fetchCustomers error:', error);
    } finally {
      setLoading('customers', false);
    }
  },

  updateCustomerTier: async (id, tier, reason) => {
    const { setLoading, setError } = get();
    try {
      setLoading(`updateCustomerTier:${id}`, true);
      setError(null);
      const customer = await api.updateCustomerTier(id, tier, reason);
      set((state) => ({
        customers: state.customers.map((c) =>
          c.id === id ? customer : c
        ),
      }));
      return customer;
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新客户层级失败';
      setError(message);
      console.error('updateCustomerTier error:', error);
      return null;
    } finally {
      setLoading(`updateCustomerTier:${id}`, false);
    }
  },

  fetchWhitelist: async () => {
    const { setLoading, setError } = get();
    try {
      setLoading('whitelist', true);
      setError(null);
      const whitelist = await api.getWhitelist();
      set({ whitelist });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取白名单失败';
      setError(message);
      console.error('fetchWhitelist error:', error);
    } finally {
      setLoading('whitelist', false);
    }
  },

  addWhitelist: async (data) => {
    const { setLoading, setError } = get();
    try {
      setLoading('addWhitelist', true);
      setError(null);
      const customer = await api.addWhitelist(data);
      set((state) => ({
        whitelist: [...state.whitelist, customer],
        customers: state.customers.map((c) =>
          c.id === customer.id ? customer : c
        ),
      }));
      return customer;
    } catch (error) {
      const message = error instanceof Error ? error.message : '添加白名单失败';
      setError(message);
      console.error('addWhitelist error:', error);
      return null;
    } finally {
      setLoading('addWhitelist', false);
    }
  },

  removeWhitelist: async (id, reason) => {
    const { setLoading, setError } = get();
    try {
      setLoading(`removeWhitelist:${id}`, true);
      setError(null);
      await api.removeWhitelist(id, reason);
      set((state) => ({
        whitelist: state.whitelist.filter((c) => c.id !== id),
        customers: state.customers.map((c) =>
          c.id === id ? { ...c, isWhitelisted: false } : c
        ),
      }));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '移除白名单失败';
      setError(message);
      console.error('removeWhitelist error:', error);
      return false;
    } finally {
      setLoading(`removeWhitelist:${id}`, false);
    }
  },

  runDrill: async (config) => {
    const { setLoading, setError } = get();
    try {
      setLoading('runDrill', true);
      setError(null);
      const report = await api.runDrill(config);
      set((state) => ({
        reports: [report, ...state.reports],
      }));
      return report;
    } catch (error) {
      const message = error instanceof Error ? error.message : '发起演练失败';
      setError(message);
      console.error('runDrill error:', error);
      return null;
    } finally {
      setLoading('runDrill', false);
    }
  },

  fetchReport: async (id) => {
    const { setLoading, setError } = get();
    try {
      setLoading(`report:${id}`, true);
      setError(null);
      const report = await api.getReport(id);
      set((state) => ({
        reports: state.reports.map((r) => (r.id === id ? report : r)),
      }));
      return report;
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取报告详情失败';
      setError(message);
      console.error('fetchReport error:', error);
      return null;
    } finally {
      setLoading(`report:${id}`, false);
    }
  },

  fetchReports: async () => {
    const { setLoading, setError } = get();
    try {
      setLoading('reports', true);
      setError(null);
      const reports = await api.getReports();
      set({ reports });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取报告列表失败';
      setError(message);
      console.error('fetchReports error:', error);
    } finally {
      setLoading('reports', false);
    }
  },

  exportReport: async (id, format) => {
    const { setLoading, setError } = get();
    try {
      setLoading(`exportReport:${id}`, true);
      setError(null);
      const content = await api.exportReport(id, format);
      
      const blob = new Blob([content], { 
        type: format === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${id}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return content;
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出报告失败';
      setError(message);
      console.error('exportReport error:', error);
      return null;
    } finally {
      setLoading(`exportReport:${id}`, false);
    }
  },

  fetchAnomalies: async (includeResolved = false) => {
    const { setLoading, setError } = get();
    try {
      setLoading('anomalies', true);
      setError(null);
      const anomalies = await api.getAnomalies(includeResolved);
      set({ anomalies });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取异常列表失败';
      setError(message);
      console.error('fetchAnomalies error:', error);
    } finally {
      setLoading('anomalies', false);
    }
  },

  resolveAnomaly: async (id, resolution) => {
    const { setLoading, setError } = get();
    try {
      setLoading(`resolveAnomaly:${id}`, true);
      setError(null);
      const anomaly = await api.resolveAnomaly(id, resolution);
      set((state) => ({
        anomalies: state.anomalies.map((a) =>
          a.id === id ? anomaly : a
        ),
      }));
      return anomaly;
    } catch (error) {
      const message = error instanceof Error ? error.message : '解决异常失败';
      setError(message);
      console.error('resolveAnomaly error:', error);
      return null;
    } finally {
      setLoading(`resolveAnomaly:${id}`, false);
    }
  },

  fetchModifications: async (params) => {
    const { setLoading, setError } = get();
    try {
      setLoading('modifications', true);
      setError(null);
      const modifications = await api.getModifications(params);
      set({ modifications });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取修改历史失败';
      setError(message);
      console.error('fetchModifications error:', error);
    } finally {
      setLoading('modifications', false);
    }
  },

  fetchDashboardStats: async () => {
    const { setLoading, setError } = get();
    try {
      setLoading('dashboardStats', true);
      setError(null);
      const dashboardStats = await api.getDashboardStats();
      set({ dashboardStats });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取统计数据失败';
      setError(message);
      console.error('fetchDashboardStats error:', error);
    } finally {
      setLoading('dashboardStats', false);
    }
  },
}));
