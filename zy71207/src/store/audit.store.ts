import { create } from 'zustand';
import { api } from '../api/client';
import type {
  AuditRecord,
  AuditLinkNode,
  AuditStats,
  RateVersion,
  ProductContract,
  RollbackRecord,
  AuditStatus,
} from '../../shared/types';

interface AuditState {
  audits: AuditRecord[];
  currentAudit: AuditRecord | null;
  auditChain: AuditLinkNode[];
  stats: AuditStats | null;
  rates: RateVersion[];
  contracts: ProductContract[];
  rollbackPlan: {
    rollback: RollbackRecord;
    planDetails: {
      rollbackAmount: number;
      compensationAmount: number;
      compensationRate: number;
      totalAmount: number;
      calculation: string[];
    };
  } | null;
  loading: boolean;
  error: string | null;
  filters: {
    status?: AuditStatus;
    customerId?: string;
    productId?: string;
    startDate?: string;
    endDate?: string;
  };
}

interface AuditActions {
  fetchStats: () => Promise<void>;
  fetchAudits: () => Promise<void>;
  fetchAudit: (id: string) => Promise<void>;
  fetchAuditChain: (id: string) => Promise<void>;
  fetchRates: () => Promise<void>;
  fetchContracts: () => Promise<void>;
  recalculateAudit: (id: string) => Promise<void>;
  generateRollback: (id: string) => Promise<void>;
  executeRollback: (id: string) => Promise<void>;
  resolveAudit: (id: string) => Promise<void>;
  setFilters: (filters: Partial<AuditState['filters']>) => void;
  clearRollbackPlan: () => void;
  clearError: () => void;
}

export const useAuditStore = create<AuditState & AuditActions>((set, get) => ({
  audits: [],
  currentAudit: null,
  auditChain: [],
  stats: null,
  rates: [],
  contracts: [],
  rollbackPlan: null,
  loading: false,
  error: null,
  filters: {},

  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await api.getStats();
      set({ stats });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchAudits: async () => {
    set({ loading: true, error: null });
    try {
      const filters = get().filters;
      const audits = await api.getAudits(filters);
      set({ audits });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchAudit: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const audit = await api.getAudit(id);
      set({ currentAudit: audit });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchAuditChain: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const chain = await api.getAuditChain(id);
      set({ auditChain: chain });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchRates: async () => {
    set({ loading: true, error: null });
    try {
      const rates = await api.getRateVersions();
      set({ rates });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchContracts: async () => {
    set({ loading: true, error: null });
    try {
      const contracts = await api.getContracts();
      set({ contracts });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  recalculateAudit: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const audit = await api.recalculateAudit(id);
      set((state) => ({
        currentAudit: audit,
        audits: state.audits.map((a) => (a.id === id ? audit : a)),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  generateRollback: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const plan = await api.generateRollback(id);
      set({ rollbackPlan: plan });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  executeRollback: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await api.executeRollback(id);
      await get().fetchAudit(get().currentAudit?.id || id);
      await get().fetchAudits();
      set({ rollbackPlan: null });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  resolveAudit: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const audit = await api.resolveAudit(id);
      set((state) => ({
        currentAudit: audit,
        audits: state.audits.map((a) => (a.id === id ? audit : a)),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }));
  },

  clearRollbackPlan: () => {
    set({ rollbackPlan: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
