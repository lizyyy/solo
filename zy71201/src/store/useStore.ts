import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Product,
  NetValue,
  Valuation,
  Redemption,
  VersionRecord,
  CustomerScript,
  ListFilter,
  ScriptType,
  OperationType,
} from '../types';
import {
  mockProducts,
  generateNetValues,
  mockValuations,
  mockRedemptions,
  mockVersionHistory,
  mockScripts,
} from '../data/mockData';

interface AppState {
  products: Product[];
  netValues: Record<string, NetValue[]>;
  valuations: Record<string, Valuation[]>;
  redemptions: Record<string, Redemption>;
  versionHistory: Record<string, VersionRecord[]>;
  scripts: Record<string, CustomerScript>;
  drafts: Record<string, { scriptContent: string; note: string }>;
  filter: ListFilter;
  selectedProductIds: string[];
  setFilter: (filter: Partial<ListFilter>) => void;
  getProductById: (id: string) => Product | undefined;
  getNetValues: (productId: string) => NetValue[];
  updateProductScript: (productId: string, updates: Partial<Product>) => void;
  saveScript: (productId: string, scriptType: ScriptType, content: string) => void;
  getScript: (productId: string, type: ScriptType) => CustomerScript;
  recordVersion: (productId: string, operationType: OperationType, beforeData: Record<string, unknown>, afterData: Record<string, unknown>, diffSummary: string) => void;
  setSelectedProducts: (ids: string[]) => void;
  saveDraft: (productId: string, data: { scriptContent?: string; note?: string }) => void;
  getDraft: (productId: string) => { scriptContent: string; note: string } | undefined;
  clearDraft: (productId: string) => void;
}

const initialFilter: ListFilter = {
  search: '',
  status: 'all',
  anomalyType: 'all',
  dateRange: {
    start: '',
    end: '',
  },
  page: 1,
  pageSize: 10,
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      products: mockProducts,
      netValues: {},
      valuations: {},
      redemptions: mockRedemptions,
      versionHistory: { p003: mockVersionHistory },
      scripts: {},
      drafts: {},
      filter: initialFilter,
      selectedProductIds: [],

      setFilter: (newFilter) =>
        set((state) => ({
          filter: { ...state.filter, ...newFilter },
        })),

      getProductById: (id) => get().products.find((p) => p.id === id),

      getNetValues: (productId) => {
        const cached = get().netValues[productId];
        if (cached) return cached;
        const values = generateNetValues(productId);
        set((state) => ({
          netValues: { ...state.netValues, [productId]: values },
        }));
        return values;
      },

      updateProductScript: (productId, updates) =>
        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId ? { ...p, ...updates } : p,
          ),
        })),

      saveScript: (productId, scriptType, content) => {
        const key = `${productId}-${scriptType}`;
        const script: CustomerScript = {
          productId,
          type: scriptType,
          title: scriptType === 'normal' ? '净值正常波动说明' : scriptType === 'warning' ? '接近预警线说明' : '特殊情况说明',
          content,
          lastModified: new Date().toISOString(),
          modifiedBy: '客服-小王',
        };
        set((state) => ({
          scripts: { ...state.scripts, [key]: script },
        }));
      },

      getScript: (productId, type) => {
        const key = `${productId}-${type}`;
        const saved = get().scripts[key];
        if (saved) return saved;
        const templates = mockScripts[type] || mockScripts.normal;
        const template = templates[0];
        return { ...template, productId };
      },

      recordVersion: (productId, operationType, beforeData, afterData, diffSummary) => {
        const history = get().versionHistory[productId] || [];
        const newVersion: VersionRecord = {
          id: `vh-${Date.now()}`,
          productId,
          versionNumber: `v1.${history.length + 1}`,
          operationType,
          operator: '客服-小王',
          beforeData,
          afterData,
          diffSummary,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          versionHistory: {
            ...state.versionHistory,
            [productId]: [newVersion, ...history],
          },
        }));
      },

      setSelectedProducts: (ids) => set({ selectedProductIds: ids }),

      saveDraft: (productId, data) =>
        set((state) => ({
          drafts: {
            ...state.drafts,
            [productId]: {
              ...state.drafts[productId],
              ...data,
            },
          },
        })),

      getDraft: (productId) => get().drafts[productId],

      clearDraft: (productId) =>
        set((state) => {
          const newDrafts = { ...state.drafts };
          delete newDrafts[productId];
          return { drafts: newDrafts };
        }),
    }),
    {
      name: 'private-fund-warning',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        products: state.products,
        scripts: state.scripts,
        drafts: state.drafts,
        filter: state.filter,
        selectedProductIds: state.selectedProductIds,
        versionHistory: state.versionHistory,
      }),
    }
  )
);
