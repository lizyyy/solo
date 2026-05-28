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
  Anomaly,
} from '../types';
import {
  mockProducts,
  generateNetValues,
  mockRedemptions,
  mockVersionHistory,
  mockScripts,
} from '../data/mockData';
import type { FileCategory } from '../services/fileParser';
import { detectAnomalies } from '../services/fileParser';

interface RawImportRecord {
  id: string;
  fileName: string;
  category: FileCategory;
  importTime: string;
  rawData: Record<string, unknown>[];
  parsedData: Record<string, unknown>[];
}

interface ImportResult {
  success: boolean;
  updatedProducts: string[];
  newProducts: string[];
  anomalies: Anomaly[];
  warnings: string[];
}

interface AppState {
  products: Product[];
  netValues: Record<string, NetValue[]>;
  valuations: Record<string, Valuation[]>;
  redemptions: Record<string, Redemption>;
  versionHistory: Record<string, VersionRecord[]>;
  scripts: Record<string, CustomerScript>;
  drafts: Record<string, { scriptContent: string; note: string }>;
  rawImports: RawImportRecord[];
  filter: ListFilter;
  selectedProductIds: string[];
  setFilter: (filter: Partial<ListFilter>) => void;
  getProductById: (id: string) => Product | undefined;
  getNetValues: (productId: string) => NetValue[];
  updateProduct: (productId: string, updates: Partial<Product>) => void;
  saveScript: (productId: string, scriptType: ScriptType, content: string) => void;
  getScript: (productId: string, type: ScriptType) => CustomerScript;
  recordVersion: (productId: string, operationType: OperationType, beforeData: Record<string, unknown>, afterData: Record<string, unknown>, diffSummary: string) => void;
  setSelectedProducts: (ids: string[]) => void;
  saveDraft: (productId: string, data: { scriptContent?: string; note?: string }) => void;
  getDraft: (productId: string) => { scriptContent: string; note: string } | undefined;
  clearDraft: (productId: string) => void;
  importNetValues: (data: NetValue[], fileName: string, rawData: Record<string, unknown>[]) => ImportResult;
  importRedemptions: (data: Redemption[], fileName: string, rawData: Record<string, unknown>[]) => ImportResult;
  importWarningLines: (data: Array<{ productCode: string; warningLine: number; stopLossLine: number; effectiveDate: string }>, fileName: string, rawData: Record<string, unknown>[]) => ImportResult;
  importValuations: (data: Valuation[], fileName: string, rawData: Record<string, unknown>[]) => ImportResult;
  getValuations: (productId: string) => Valuation[];
  getProductValuationDate: (productId: string) => string | undefined;
  getProductHistory: (productId: string) => VersionRecord[];
  getProductLatestVersion: (productId: string) => string;
  getRawImportById: (id: string) => RawImportRecord | undefined;
  getProductScripts: (productId: string) => CustomerScript[];
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

function calculateProductStatus(netValue: number, warningLine: number, stopLossLine: number): Product['status'] {
  if (netValue <= stopLossLine) return 'stop_loss';
  if (netValue <= warningLine) return 'warning';
  return 'normal';
}

function getProductIdByCode(products: Product[], code: string): string | undefined {
  const product = products.find(
    (p) => p.code.toLowerCase() === code.toLowerCase() || p.id === code
  );
  return product?.id;
}

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
      rawImports: [],
      filter: initialFilter,
      selectedProductIds: [],

      setFilter: (newFilter) =>
        set((state) => ({
          filter: { ...state.filter, ...newFilter },
        })),

      getProductById: (id) => get().products.find((p) => p.id === id),

      getNetValues: (productId) => {
        const cached = get().netValues[productId];
        if (cached && cached.length > 0) return cached;
        const values = generateNetValues(productId);
        set((state) => ({
          netValues: { ...state.netValues, [productId]: values },
        }));
        return values;
      },

      updateProduct: (productId, updates) => {
        const product = get().getProductById(productId);
        if (!product) return;

        set((state) => ({
          products: state.products.map((p) =>
            p.id === productId ? { ...p, ...updates, lastUpdated: new Date().toISOString() } : p
          ),
        }));

        get().recordVersion(
          productId,
          'update',
          product as unknown as Record<string, unknown>,
          { ...product, ...updates } as unknown as Record<string, unknown>,
          '更新产品信息'
        );
      },

      saveScript: (productId, scriptType, content) => {
        const key = `${productId}-${scriptType}`;
        const oldScript = get().scripts[key];
        
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

        get().recordVersion(
          productId,
          'update',
          { scriptContent: oldScript?.content || '' },
          { scriptContent: content },
          `更新${scriptType === 'normal' ? '普通' : scriptType === 'warning' ? '警示' : '特殊'}话术`
        );
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
          id: `vh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

      importNetValues: (data, fileName, rawData) => {
        const state = get();
        const updatedProducts: string[] = [];
        const newProducts: string[] = [];
        const allAnomalies: Anomaly[] = [];
        const warnings: string[] = [];

        const newNetValues = { ...state.netValues };
        const newProductsList = [...state.products];

        data.forEach((nv) => {
          const productId = getProductIdByCode(state.products, nv.productId);
          
          if (!productId) {
            warnings.push(`未找到产品 ${nv.productId}，已跳过`);
            return;
          }

          if (!newNetValues[productId]) {
            newNetValues[productId] = [];
          }

          const existingIndex = newNetValues[productId].findIndex(
            (v) => v.valueDate === nv.valueDate
          );
          
          if (existingIndex >= 0) {
            newNetValues[productId][existingIndex] = nv;
          } else {
            newNetValues[productId].push(nv);
          }

          newNetValues[productId].sort((a, b) => 
            new Date(a.valueDate).getTime() - new Date(b.valueDate).getTime()
          );

          const productIndex = newProductsList.findIndex((p) => p.id === productId);
          if (productIndex >= 0) {
            const product = newProductsList[productIndex];
            const oldNetValue = product.latestNetValue;
            const oldStatus = product.status;
            
            const newStatus = calculateProductStatus(
              nv.netValue,
              product.warningLine,
              product.stopLossLine
            );

            newProductsList[productIndex] = {
              ...product,
              latestNetValue: nv.netValue,
              latestDrawdownRate: nv.drawdownRate,
              status: newStatus,
              lastUpdated: new Date().toISOString(),
            };

            const productAnomalies = detectAnomalies(
              [nv],
              undefined,
              undefined,
              state.redemptions[productId]?.status
            );

            if (productAnomalies.length > 0) {
              newProductsList[productIndex].anomalies = productAnomalies;
              allAnomalies.push(...productAnomalies);
            }

            updatedProducts.push(productId);

            if (oldNetValue !== nv.netValue || oldStatus !== newStatus) {
              get().recordVersion(
                productId,
                'import',
                { netValue: oldNetValue, status: oldStatus },
                { netValue: nv.netValue, status: newStatus },
                `导入净值数据: ${nv.valueDate}, 净值 ${nv.netValue}`
              );
            }
          }
        });

        const rawImport: RawImportRecord = {
          id: `import-${Date.now()}`,
          fileName,
          category: 'netvalue',
          importTime: new Date().toISOString(),
          rawData,
          parsedData: data as unknown as Record<string, unknown>[],
        };

        set({
          netValues: newNetValues,
          products: newProductsList,
          rawImports: [rawImport, ...state.rawImports],
        });

        return {
          success: true,
          updatedProducts,
          newProducts,
          anomalies: allAnomalies,
          warnings,
        };
      },

      importRedemptions: (data, fileName, rawData) => {
        const state = get();
        const updatedProducts: string[] = [];
        const allAnomalies: Anomaly[] = [];
        const warnings: string[] = [];

        const newRedemptions = { ...state.redemptions };
        const newProductsList = [...state.products];

        data.forEach((r) => {
          const productId = getProductIdByCode(state.products, r.productId);
          
          if (!productId) {
            warnings.push(`未找到产品 ${r.productId}，已跳过`);
            return;
          }

          const oldRedemption = newRedemptions[productId];
          newRedemptions[productId] = r;
          updatedProducts.push(productId);

          const productIndex = newProductsList.findIndex((p) => p.id === productId);
          if (productIndex >= 0 && r.status === 'suspended') {
            const product = newProductsList[productIndex];
            const newAnomalies = detectAnomalies(
              [],
              undefined,
              undefined,
              r.status
            );
            
            if (newAnomalies.length > 0) {
              newProductsList[productIndex] = {
                ...product,
                anomalies: [...product.anomalies, ...newAnomalies],
              };
              allAnomalies.push(...newAnomalies);
            }
          }

          if (oldRedemption?.status !== r.status) {
            get().recordVersion(
              productId,
              'import',
              { redemptionStatus: oldRedemption?.status },
              { redemptionStatus: r.status },
              `更新申赎状态: ${r.status === 'suspended' ? '暂停赎回' : r.status === 'restricted' ? '限制赎回' : '正常申赎'}`
            );
          }
        });

        const rawImport: RawImportRecord = {
          id: `import-${Date.now()}`,
          fileName,
          category: 'redemption',
          importTime: new Date().toISOString(),
          rawData,
          parsedData: data as unknown as Record<string, unknown>[],
        };

        set({
          redemptions: newRedemptions,
          products: newProductsList,
          rawImports: [rawImport, ...state.rawImports],
        });

        return {
          success: true,
          updatedProducts,
          newProducts: [],
          anomalies: allAnomalies,
          warnings,
        };
      },

      importWarningLines: (data, fileName, rawData) => {
        const state = get();
        const updatedProducts: string[] = [];
        const allAnomalies: Anomaly[] = [];
        const warnings: string[] = [];

        const newProductsList = [...state.products];

        data.forEach((w) => {
          const productId = getProductIdByCode(state.products, w.productCode);
          
          if (!productId) {
            warnings.push(`未找到产品 ${w.productCode}，已跳过`);
            return;
          }

          const productIndex = newProductsList.findIndex((p) => p.id === productId);
          if (productIndex >= 0) {
            const product = newProductsList[productIndex];
            const oldWarningLine = product.warningLine;
            const oldStopLossLine = product.stopLossLine;
            
            const newStatus = calculateProductStatus(
              product.latestNetValue,
              w.warningLine,
              w.stopLossLine
            );

            newProductsList[productIndex] = {
              ...product,
              warningLine: w.warningLine,
              stopLossLine: w.stopLossLine,
              status: newStatus,
              lastUpdated: new Date().toISOString(),
            };

            if (oldWarningLine !== w.warningLine) {
              const lineAnomalies = detectAnomalies(
                [],
                oldWarningLine,
                w.warningLine
              );
              
              if (lineAnomalies.length > 0) {
                newProductsList[productIndex].anomalies = [
                  ...product.anomalies.filter((a) => a.type !== 'warning_line_changed'),
                  ...lineAnomalies,
                ];
                allAnomalies.push(...lineAnomalies);
              }

              updatedProducts.push(productId);

              get().recordVersion(
                productId,
                'import',
                { warningLine: oldWarningLine, stopLossLine: oldStopLossLine },
                { warningLine: w.warningLine, stopLossLine: w.stopLossLine },
                `更新预警线: ${oldWarningLine} -> ${w.warningLine}, 止损线: ${oldStopLossLine} -> ${w.stopLossLine}`
              );
            }
          }
        });

        const rawImport: RawImportRecord = {
          id: `import-${Date.now()}`,
          fileName,
          category: 'warning',
          importTime: new Date().toISOString(),
          rawData,
          parsedData: data as unknown as Record<string, unknown>[],
        };

        set({
          products: newProductsList,
          rawImports: [rawImport, ...state.rawImports],
        });

        return {
          success: true,
          updatedProducts,
          newProducts: [],
          anomalies: allAnomalies,
          warnings,
        };
      },

      importValuations: (data, fileName, rawData) => {
        const state = get();
        const updatedProducts: string[] = [];
        const allAnomalies: Anomaly[] = [];
        const warnings: string[] = [];

        const newValuations = { ...state.valuations };
        const newProductsList = [...state.products];

        const valuationByProduct: Record<string, Valuation[]> = {};
        data.forEach((v) => {
          if (!valuationByProduct[v.productId]) {
            valuationByProduct[v.productId] = [];
          }
          valuationByProduct[v.productId].push(v);
        });

        Object.entries(valuationByProduct).forEach(([productCode, valuations]) => {
          const productId = getProductIdByCode(state.products, productCode);
          
          if (!productId) {
            warnings.push(`未找到产品 ${productCode}，已跳过`);
            return;
          }

          newValuations[productId] = valuations;
          updatedProducts.push(productId);

          const productIndex = newProductsList.findIndex((p) => p.id === productId);
          if (productIndex >= 0) {
            const product = newProductsList[productIndex];
            const valuationDate = valuations[0]?.valuationDate;
            const currentNetValues = get().getNetValues(productId);
            const latestNetValue = currentNetValues[currentNetValues.length - 1];
            const netValueDate = latestNetValue?.valueDate;

            if (valuationDate && netValueDate && valuationDate !== netValueDate) {
              const dateAnomalies = detectAnomalies(
                [],
                undefined,
                undefined,
                undefined,
                valuationDate,
                netValueDate
              );

              if (dateAnomalies.length > 0) {
                const existingAnomalies = product.anomalies.filter(
                  (a) => a.type !== 'date_mismatch'
                );
                newProductsList[productIndex] = {
                  ...product,
                  anomalies: [...existingAnomalies, ...dateAnomalies],
                  lastUpdated: new Date().toISOString(),
                };
                allAnomalies.push(...dateAnomalies);
              }
            }
          }

          get().recordVersion(
            productId,
            'import',
            { valuationCount: (state.valuations[productId] || []).length },
            { valuationCount: valuations.length, valuationDate: valuations[0]?.valuationDate },
            `导入估值数据: ${valuations.length} 条持仓, 估值日期 ${valuations[0]?.valuationDate || '未知'}`
          );
        });

        const rawImport: RawImportRecord = {
          id: `import-${Date.now()}`,
          fileName,
          category: 'valuation',
          importTime: new Date().toISOString(),
          rawData,
          parsedData: data as unknown as Record<string, unknown>[],
        };

        set({
          valuations: newValuations,
          products: newProductsList,
          rawImports: [rawImport, ...state.rawImports],
        });

        return {
          success: true,
          updatedProducts,
          newProducts: [],
          anomalies: allAnomalies,
          warnings,
        };
      },

      getValuations: (productId) => {
        return get().valuations[productId] || [];
      },

      getProductValuationDate: (productId) => {
        const valuations = get().valuations[productId];
        return valuations?.[0]?.valuationDate;
      },

      getProductHistory: (productId) => {
        return get().versionHistory[productId] || [];
      },

      getProductLatestVersion: (productId) => {
        const history = get().versionHistory[productId];
        return history?.[0]?.versionNumber || 'v1.0';
      },

      getRawImportById: (id) => {
        return get().rawImports.find((r) => r.id === id);
      },

      getProductScripts: (productId) => {
        const scripts: CustomerScript[] = [];
        (['normal', 'warning', 'special'] as ScriptType[]).forEach((type) => {
          scripts.push(get().getScript(productId, type));
        });
        return scripts;
      },
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
        rawImports: state.rawImports,
        redemptions: state.redemptions,
        netValues: state.netValues,
        valuations: state.valuations,
      }),
    }
  )
);
