import { create } from "zustand";

export interface Batch {
  id: string;
  name: string;
  date: string;
  status: string;
  createdAt: string;
}

export interface Trade {
  id: string;
  batchId: string;
  direction: string;
  counterparty: string;
  amount: number;
  term: number;
  startDate: string;
  endDate: string;
  source: string;
  version: number;
}

export interface Collateral {
  id: string;
  batchId: string;
  tradeId: string;
  bondCode: string;
  bondName: string;
  faceValue: number;
  quantity: number;
  maturityDate: string;
  replacementBondCode?: string;
  replacementStatus: string;
  source: string;
  version: number;
}

export interface DiscountRate {
  id: string;
  batchId: string;
  bondCode: string;
  rate: number;
  effectiveDate: string;
  expiryDate: string;
  source: string;
  version: number;
}

export interface ProcessResult {
  id: string;
  batchId: string;
  collateralId: string;
  tradeId: string;
  bondCode: string;
  discountRate: number;
  discountAmount: number;
  conclusion: string;
  warnings: Array<{
    type: string;
    message: string;
    affectedTradeIds: string[];
    affectedCollateralIds: string[];
  }>;
}

export interface ReviewRecord {
  id: string;
  batchId: string;
  resultId: string;
  status: string;
  reviewer: string;
  reviewedAt?: string;
  remark?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface AppState {
  currentBatchId: string | null;
  batches: Batch[];
  trades: Trade[];
  collaterals: Collateral[];
  rates: DiscountRate[];
  results: ProcessResult[];
  reviews: ReviewRecord[];

  setCurrentBatchId: (id: string | null) => void;
  fetchBatches: () => Promise<void>;
  createBatch: (data: { name: string; date: string }) => Promise<void>;
  fetchTrades: (batchId: string) => Promise<void>;
  createTrade: (batchId: string, data: Omit<Trade, "id" | "batchId" | "version">) => Promise<void>;
  updateTrade: (batchId: string, tradeId: string, data: Partial<Trade>) => Promise<void>;
  deleteTrade: (batchId: string, tradeId: string) => Promise<void>;
  fetchCollaterals: (batchId: string) => Promise<void>;
  createCollateral: (batchId: string, data: Omit<Collateral, "id" | "batchId" | "version">) => Promise<void>;
  updateCollateral: (batchId: string, collateralId: string, data: Partial<Collateral>) => Promise<void>;
  deleteCollateral: (batchId: string, collateralId: string) => Promise<void>;
  fetchRates: (batchId: string) => Promise<void>;
  createRate: (batchId: string, data: Omit<DiscountRate, "id" | "batchId" | "version">) => Promise<void>;
  updateRate: (batchId: string, rateId: string, data: Partial<DiscountRate>) => Promise<void>;
  deleteRate: (batchId: string, rateId: string) => Promise<void>;
  processBatch: (batchId: string) => Promise<void>;
  fetchResults: (batchId: string) => Promise<void>;
  submitReview: (batchId: string, resultId: string, data: { status: string; reviewer: string; remark?: string }) => Promise<void>;
  fetchReviews: (batchId: string) => Promise<void>;
  exportBatch: (batchId: string) => void;
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  if (json.success && json.data !== undefined) return json.data as T;
  return json as T;
}

export const useStore = create<AppState>((set, get) => ({
  currentBatchId: null,
  batches: [],
  trades: [],
  collaterals: [],
  rates: [],
  results: [],
  reviews: [],

  setCurrentBatchId: (id) => set({ currentBatchId: id }),

  fetchBatches: async () => {
    const data = await api<Batch[]>("/api/batches");
    set({ batches: data });
  },

  createBatch: async (data) => {
    const batch = await api<Batch>("/api/batches", {
      method: "POST",
      body: JSON.stringify(data),
    });
    set((s) => ({ batches: [batch, ...s.batches] }));
  },

  fetchTrades: async (batchId) => {
    const data = await api<Trade[]>(`/api/batches/${batchId}/trades`);
    set({ trades: data });
  },

  createTrade: async (batchId, data) => {
    const trade = await api<Trade>(`/api/batches/${batchId}/trades`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    set((s) => ({ trades: [...s.trades, trade] }));
  },

  updateTrade: async (batchId, tradeId, data) => {
    const trade = await api<Trade>(`/api/batches/${batchId}/trades/${tradeId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    set((s) => ({
      trades: s.trades.map((t) => (t.id === tradeId ? trade : t)),
    }));
  },

  deleteTrade: async (batchId, tradeId) => {
    await api(`/api/batches/${batchId}/trades/${tradeId}`, { method: "DELETE" });
    set((s) => ({ trades: s.trades.filter((t) => t.id !== tradeId) }));
  },

  fetchCollaterals: async (batchId) => {
    const data = await api<Collateral[]>(`/api/batches/${batchId}/collaterals`);
    set({ collaterals: data });
  },

  createCollateral: async (batchId, data) => {
    const collateral = await api<Collateral>(`/api/batches/${batchId}/collaterals`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    set((s) => ({ collaterals: [...s.collaterals, collateral] }));
  },

  updateCollateral: async (batchId, collateralId, data) => {
    const collateral = await api<Collateral>(`/api/batches/${batchId}/collaterals/${collateralId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    set((s) => ({
      collaterals: s.collaterals.map((c) => (c.id === collateralId ? collateral : c)),
    }));
  },

  deleteCollateral: async (batchId, collateralId) => {
    await api(`/api/batches/${batchId}/collaterals/${collateralId}`, { method: "DELETE" });
    set((s) => ({ collaterals: s.collaterals.filter((c) => c.id !== collateralId) }));
  },

  fetchRates: async (batchId) => {
    const data = await api<DiscountRate[]>(`/api/batches/${batchId}/rates`);
    set({ rates: data });
  },

  createRate: async (batchId, data) => {
    const rate = await api<DiscountRate>(`/api/batches/${batchId}/rates`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    set((s) => ({ rates: [...s.rates, rate] }));
  },

  updateRate: async (batchId, rateId, data) => {
    const rate = await api<DiscountRate>(`/api/batches/${batchId}/rates/${rateId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    set((s) => ({
      rates: s.rates.map((r) => (r.id === rateId ? rate : r)),
    }));
  },

  deleteRate: async (batchId, rateId) => {
    await api(`/api/batches/${batchId}/rates/${rateId}`, { method: "DELETE" });
    set((s) => ({ rates: s.rates.filter((r) => r.id !== rateId) }));
  },

  processBatch: async (batchId) => {
    const data = await api<ProcessResult[]>(`/api/batches/${batchId}/process`, {
      method: "POST",
    });
    set({ results: data });
    const batches = await api<Batch[]>("/api/batches");
    set({ batches });
  },

  fetchResults: async (batchId) => {
    const data = await api<ProcessResult[]>(`/api/batches/${batchId}/results`);
    set({ results: data });
  },

  submitReview: async (batchId, resultId, data) => {
    const review = await api<ReviewRecord>(`/api/batches/${batchId}/review`, {
      method: "POST",
      body: JSON.stringify({ resultId, status: data.status || "已复核", reviewer: data.reviewer, remark: data.remark }),
    });
    set((s) => ({
      reviews: s.reviews.map((r) => (r.resultId === resultId ? review : r)),
    }));
  },

  fetchReviews: async (batchId) => {
    const data = await api<ReviewRecord[]>(`/api/batches/${batchId}/reviews`);
    set({ reviews: data });
  },

  exportBatch: (batchId) => {
    window.open(`/api/batches/${batchId}/export`);
  },
}));
