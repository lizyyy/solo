import { create } from 'zustand';
import type {
  Author,
  Book,
  SalesRecord,
  ReturnRecord,
  Contract,
  RoyaltyLadder,
  DiscountActivity,
  Settlement,
  SettlementDetail,
  DashboardData,
  CalculateRoyaltyRequest,
  CalculateRoyaltyResponse,
} from '../../shared/types.js';
import { api } from '../lib/api.js';

interface AppState {
  loading: boolean;
  error: string | null;
  authors: Author[];
  books: Book[];
  sales: SalesRecord[];
  returns: ReturnRecord[];
  contracts: Contract[];
  ladders: RoyaltyLadder[];
  discounts: DiscountActivity[];
  settlements: Settlement[];
  dashboard: DashboardData | null;
  currentSettlement: SettlementDetail | null;
  calculationResult: CalculateRoyaltyResponse | null;
  selectedPeriod: string;
  selectedAuthorId: string | null;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedPeriod: (period: string) => void;
  setSelectedAuthorId: (authorId: string | null) => void;

  loadDashboard: () => Promise<void>;
  loadAuthors: () => Promise<void>;
  loadBooks: () => Promise<void>;
  loadSales: (period?: string) => Promise<void>;
  loadReturns: (period?: string) => Promise<void>;
  loadContracts: () => Promise<void>;
  loadLadders: () => Promise<void>;
  loadDiscounts: () => Promise<void>;
  loadSettlements: () => Promise<void>;
  loadSettlement: (id: string) => Promise<void>;

  calculateRoyalties: (request: CalculateRoyaltyRequest) => Promise<void>;
  confirmException: (id: string, operator: string, note?: string) => Promise<void>;
  lockSettlement: (id: string, operator: string) => Promise<void>;
  exportSettlement: (request: {
    settlementId: string;
    format: 'EXCEL' | 'CSV';
    includeTrail: boolean;
    includeRawData: boolean;
  }) => Promise<void>;

  clearCurrentSettlement: () => void;
  clearCalculationResult: () => void;
}

const getCurrentPeriod = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const useStore = create<AppState>((set, get) => ({
  loading: false,
  error: null,
  authors: [],
  books: [],
  sales: [],
  returns: [],
  contracts: [],
  ladders: [],
  discounts: [],
  settlements: [],
  dashboard: null,
  currentSettlement: null,
  calculationResult: null,
  selectedPeriod: getCurrentPeriod(),
  selectedAuthorId: null,

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setSelectedPeriod: (period) => set({ selectedPeriod: period }),
  setSelectedAuthorId: (authorId) => set({ selectedAuthorId: authorId }),

  loadDashboard: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.getDashboard();
      set({ dashboard: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载仪表盘数据失败' });
    } finally {
      set({ loading: false });
    }
  },

  loadAuthors: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.getAuthors();
      set({ authors: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载作者列表失败' });
    } finally {
      set({ loading: false });
    }
  },

  loadBooks: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.getBooks();
      set({ books: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载图书列表失败' });
    } finally {
      set({ loading: false });
    }
  },

  loadSales: async (period) => {
    set({ loading: true, error: null });
    try {
      const data = await api.getSales(period);
      set({ sales: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载销售记录失败' });
    } finally {
      set({ loading: false });
    }
  },

  loadReturns: async (period) => {
    set({ loading: true, error: null });
    try {
      const data = await api.getReturns(period);
      set({ returns: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载退货记录失败' });
    } finally {
      set({ loading: false });
    }
  },

  loadContracts: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.getContracts();
      set({ contracts: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载合同列表失败' });
    } finally {
      set({ loading: false });
    }
  },

  loadLadders: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.getLadders();
      set({ ladders: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载阶梯配置失败' });
    } finally {
      set({ loading: false });
    }
  },

  loadDiscounts: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.getDiscounts();
      set({ discounts: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载折扣活动失败' });
    } finally {
      set({ loading: false });
    }
  },

  loadSettlements: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.getSettlements();
      set({ settlements: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载结算列表失败' });
    } finally {
      set({ loading: false });
    }
  },

  loadSettlement: async (id) => {
    set({ loading: true, error: null });
    try {
      const data = await api.getSettlement(id);
      set({ currentSettlement: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '加载结算详情失败' });
    } finally {
      set({ loading: false });
    }
  },

  calculateRoyalties: async (request) => {
    set({ loading: true, error: null });
    try {
      const data = await api.calculateRoyalties(request);
      set({ calculationResult: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '计算版税失败' });
    } finally {
      set({ loading: false });
    }
  },

  confirmException: async (id, operator, note) => {
    set({ loading: true, error: null });
    try {
      await api.confirmException(id, operator, note);
      const { currentSettlement } = get();
      if (currentSettlement) {
        const updatedExceptions = currentSettlement.exceptions.map((e) =>
          e.id === id
            ? { ...e, isConfirmed: true, confirmedBy: operator, confirmationNote: note }
            : e
        );
        set({
          currentSettlement: {
            ...currentSettlement,
            exceptions: updatedExceptions,
          },
        });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '确认异常失败' });
    } finally {
      set({ loading: false });
    }
  },

  lockSettlement: async (id, operator) => {
    set({ loading: true, error: null });
    try {
      await api.lockSettlement(id, operator);
      const { settlements } = get();
      const updatedSettlements = settlements.map((s) =>
        s.id === id ? { ...s, status: 'LOCKED' as const } : s
      );
      set({ settlements: updatedSettlements });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '锁定结算失败' });
    } finally {
      set({ loading: false });
    }
  },

  exportSettlement: async (request) => {
    set({ loading: true, error: null });
    try {
      const result = await api.exportSettlement(request);
      window.open(result.downloadUrl, '_blank');
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '导出结算失败' });
    } finally {
      set({ loading: false });
    }
  },

  clearCurrentSettlement: () => set({ currentSettlement: null }),
  clearCalculationResult: () => set({ calculationResult: null }),
}));
