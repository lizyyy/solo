import { create } from 'zustand';
import type {
  Batch,
  Material,
  ParsedTerms,
  CustomerPosition,
  UnderlyingPrice,
  CalculationResult,
  ValidationIssue,
  PayoutPlan,
  OperationLog,
  BatchVersion,
  MaterialType,
  BatchStatus,
} from '../types';
import { generateId } from '../utils/hash';
import { importMaterial } from '../engine/import';
import { parseProductTerms, parseCustomerPosition, parseUnderlyingPrices } from '../engine/parser';
import { batchCalculate } from '../engine/calculator';
import { validateBatch } from '../engine/validator';
import { generatePayoutPlans } from '../engine/payout';

interface BatchStore {
  batches: Batch[];
  currentBatch: Batch | null;
  materials: Material[];
  parsedTerms: ParsedTerms | null;
  positions: CustomerPosition[];
  prices: UnderlyingPrice[];
  calculations: CalculationResult[];
  validationIssues: ValidationIssue[];
  payoutPlans: PayoutPlan[];
  operationLogs: OperationLog[];
  batchVersions: BatchVersion[];
  isLoading: boolean;
  error: string | null;
  
  createBatch: (name: string) => Batch;
  setCurrentBatch: (batchId: string) => void;
  loadBatch: (batchId: string) => void;
  importMaterial: (file: File, batchId: string, forcedType?: MaterialType) => Promise<{
    material: Material;
    detectionResult: any;
  }>;
  parseAllMaterials: (batchId: string) => Promise<void>;
  calculateAll: (batchId: string) => Promise<void>;
  validateAll: (batchId: string) => void;
  generatePlans: (batchId: string) => void;
  resolveIssue: (issueId: string, note: string) => void;
  updateParsedTerms: (terms: ParsedTerms) => void;
  addOperationLog: (batchId: string, action: string, beforeValue?: any, afterValue?: any, operator?: string) => void;
  deleteMaterial: (materialId: string) => void;
  clearCurrentBatch: () => void;
  filterBatches: (filters: {
    status?: BatchStatus;
    dateFrom?: string;
    dateTo?: string;
    productCode?: string;
    customerName?: string;
  }) => Batch[];
}

const initialBatches: Batch[] = [];

export const useBatchStore = create<BatchStore>((set, get) => ({
  batches: initialBatches,
  currentBatch: null,
  materials: [],
  parsedTerms: null,
  positions: [],
  prices: [],
  calculations: [],
  validationIssues: [],
  payoutPlans: [],
  operationLogs: [],
  batchVersions: [],
  isLoading: false,
  error: null,
  
  createBatch: (name: string) => {
    const newBatch: Batch = {
      id: generateId('batch'),
      name,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      currentVersion: 1,
      issueCount: 0,
      errorCount: 0,
      warningCount: 0,
    };
    
    set(state => ({
      batches: [newBatch, ...state.batches],
      currentBatch: newBatch,
    }));
    
    return newBatch;
  },
  
  setCurrentBatch: (batchId: string) => {
    const batch = get().batches.find(b => b.id === batchId);
    if (batch) {
      set({ currentBatch: batch });
      get().loadBatch(batchId);
    }
  },
  
  loadBatch: (batchId: string) => {
    const state = get();
    const batch = state.batches.find(b => b.id === batchId);
    const materials = state.materials.filter(m => m.batchId === batchId);
    const logs = state.operationLogs.filter(l => l.batchId === batchId);
    const versions = state.batchVersions.filter(v => v.batchId === batchId);
    const positions = state.positions.filter(p => p.batchId === batchId);
    const prices = state.prices.filter(p => p.batchId === batchId);
    const calculations = state.calculations.filter(c => c.batchId === batchId);
    const issues = state.validationIssues.filter(i => i.batchId === batchId);
    const plans = state.payoutPlans.filter(p => p.batchId === batchId);
    const parsedTerms = state.parsedTerms && state.parsedTerms.batchId === batchId 
      ? state.parsedTerms 
      : null;
    
    set({
      currentBatch: batch,
      materials,
      operationLogs: logs,
      batchVersions: versions,
      positions,
      prices,
      calculations,
      validationIssues: issues,
      payoutPlans: plans,
      parsedTerms,
    });
  },
  
  importMaterial: async (file: File, batchId: string, forcedType?: MaterialType) => {
    const state = get();
    const existingMaterials = state.materials.filter(m => m.batchId === batchId);
    
    const result = await importMaterial(file, batchId, existingMaterials, 'manual', forcedType);
    
    set(s => ({
      materials: [...s.materials, result.material],
    }));
    
    get().addOperationLog(
      batchId,
      `导入材料: ${file.name}`,
      null,
      result.material,
      '当前用户'
    );
    
    if (result.detectionResult.status === 'updated') {
      get().addOperationLog(
        batchId,
        `材料更新: ${file.name}`,
        state.materials.find(m => m.id === result.detectionResult.existingMaterialId),
        result.material,
        '系统检测'
      );
      
      set(s => ({
        batchVersions: [...s.batchVersions, {
          id: generateId('ver'),
          batchId,
          version: s.batchVersions.filter(v => v.batchId === batchId).length + 1,
          changeSummary: `${file.name}: ${result.detectionResult.changes.join('; ')}`,
          changedMaterials: [result.material.id],
          createdAt: new Date(),
        }],
      }));
    }
    
    return result;
  },
  
  parseAllMaterials: async (batchId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const state = get();
      const batch = state.batches.find(b => b.id === batchId);
      if (!batch) throw new Error('批次不存在');
      
      set(s => ({
        batches: s.batches.map(b => 
          b.id === batchId ? { ...b, status: 'parsing' as BatchStatus, updatedAt: new Date() } : b
        ),
      }));
      
      const termMaterial = state.materials.find(m => m.batchId === batchId && m.type === 'product_terms');
      const posMaterial = state.materials.find(m => m.batchId === batchId && m.type === 'customer_position');
      const priceMaterial = state.materials.find(m => m.batchId === batchId && m.type === 'underlying_price');
      
      let parsedTerms: ParsedTerms | null = null;
      let positions: CustomerPosition[] = [];
      let prices: UnderlyingPrice[] = [];
      
      if (termMaterial) {
        const result = parseProductTerms(termMaterial);
        if (result.success && result.data) {
          parsedTerms = result.data;
        } else {
          throw new Error(result.errors.join('; '));
        }
      }
      
      if (posMaterial) {
        const result = parseCustomerPosition(posMaterial);
        if (result.success && result.data) {
          positions = result.data;
        } else {
          throw new Error(result.errors.join('; '));
        }
      }
      
      if (priceMaterial) {
        const result = parseUnderlyingPrices(priceMaterial);
        if (result.success && result.data) {
          prices = result.data;
        } else {
          throw new Error(result.errors.join('; '));
        }
      }
      
      set({
        parsedTerms,
        positions,
        prices,
        isLoading: false,
      });
      
      get().addOperationLog(
        batchId,
        '条款解析完成',
        null,
        { parsedTerms, positions, prices },
        '系统'
      );
      
      set(s => ({
        batches: s.batches.map(b => 
          b.id === batchId ? { ...b, status: 'calculating' as BatchStatus, updatedAt: new Date() } : b
        ),
      }));
      
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  calculateAll: async (batchId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const state = get();
      
      if (!state.parsedTerms || state.positions.length === 0 || state.prices.length === 0) {
        throw new Error('请先完成材料导入和条款解析');
      }
      
      const priceMaterial = state.materials.find(m => m.batchId === batchId && m.type === 'underlying_price');
      
      const calculations = batchCalculate(
        state.parsedTerms,
        state.positions,
        state.prices,
        priceMaterial
      );
      
      set({
        calculations,
        isLoading: false,
      });
      
      get().addOperationLog(
        batchId,
        '档位试算完成',
        null,
        { count: calculations.length, totalPayout: calculations.reduce((s, c) => s + c.payoutAmount, 0) },
        '系统'
      );
      
      set(s => ({
        batches: s.batches.map(b => 
          b.id === batchId ? { ...b, status: 'validating' as BatchStatus, updatedAt: new Date() } : b
        ),
      }));
      
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  validateAll: (batchId: string) => {
    const state = get();
    
    const issues = validateBatch({
      batchId,
      terms: state.parsedTerms,
      positions: state.positions,
      prices: state.prices,
      calculations: state.calculations,
      materials: state.materials.filter(m => m.batchId === batchId),
    });
    
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    
    const status: BatchStatus = errorCount > 0 ? 'has_issues' : 'ready';
    
    set({
      validationIssues: issues,
      batches: state.batches.map(b => 
        b.id === batchId ? {
          ...b,
          status,
          issueCount: issues.length,
          errorCount,
          warningCount,
          updatedAt: new Date(),
        } : b
      ),
    });
    
    get().addOperationLog(
      batchId,
      '复核校验完成',
      null,
      { errorCount, warningCount, totalIssues: issues.length },
      '系统'
    );
  },
  
  generatePlans: (batchId: string) => {
    const state = get();
    
    if (!state.parsedTerms || state.calculations.length === 0) {
      throw new Error('请先完成条款解析和档位试算');
    }
    
    const plans = generatePayoutPlans(
      batchId,
      state.calculations,
      state.parsedTerms,
      state.positions
    );
    
    set({
      payoutPlans: plans,
      batches: state.batches.map(b => 
        b.id === batchId ? { ...b, status: 'ready' as BatchStatus, updatedAt: new Date() } : b
      ),
    });
    
    get().addOperationLog(
      batchId,
      '兑付方案生成完成',
      null,
      { planCount: plans.length },
      '系统'
    );
  },
  
  resolveIssue: (issueId: string, note: string) => {
    set(state => ({
      validationIssues: state.validationIssues.map(issue =>
        issue.id === issueId
          ? { ...issue, resolved: true, resolvedAt: new Date(), resolutionNote: note }
          : issue
      ),
    }));
    
    const issue = get().validationIssues.find(i => i.id === issueId);
    if (issue) {
      get().addOperationLog(
        issue.batchId,
        `解决问题: ${issue.description}`,
        null,
        { resolutionNote: note },
        '当前用户'
      );
      
      const remainingErrors = get().validationIssues.filter(i => !i.resolved && i.severity === 'error').length;
      if (remainingErrors === 0) {
        set(state => ({
          batches: state.batches.map(b =>
            b.id === issue.batchId ? { ...b, status: 'ready' as BatchStatus, updatedAt: new Date() } : b
          ),
        }));
      }
    }
  },
  
  updateParsedTerms: (terms: ParsedTerms) => {
    const oldTerms = get().parsedTerms;
    
    set({
      parsedTerms: { ...terms, manuallyModified: true },
    });
    
    get().addOperationLog(
      terms.batchId,
      '人工修正条款解析',
      oldTerms,
      terms,
      '当前用户'
    );
  },
  
  addOperationLog: (batchId: string, action: string, beforeValue?: any, afterValue?: any, operator: string = '当前用户') => {
    const log: OperationLog = {
      id: generateId('log'),
      batchId,
      action,
      operator,
      beforeValue,
      afterValue,
      timestamp: new Date(),
    };
    
    set(state => ({
      operationLogs: [...state.operationLogs, log],
    }));
  },
  
  deleteMaterial: (materialId: string) => {
    const material = get().materials.find(m => m.id === materialId);
    if (material) {
      set(state => ({
        materials: state.materials.filter(m => m.id !== materialId),
      }));
      
      get().addOperationLog(
        material.batchId,
        `删除材料: ${material.filename}`,
        material,
        null,
        '当前用户'
      );
    }
  },
  
  clearCurrentBatch: () => {
    set({
      currentBatch: null,
      materials: [],
      parsedTerms: null,
      positions: [],
      prices: [],
      calculations: [],
      validationIssues: [],
      payoutPlans: [],
    });
  },
  
  filterBatches: (filters) => {
    let results = [...get().batches];
    
    if (filters.status) {
      results = results.filter(b => b.status === filters.status);
    }
    
    if (filters.dateFrom) {
      results = results.filter(b => b.createdAt >= new Date(filters.dateFrom));
    }
    
    if (filters.dateTo) {
      results = results.filter(b => b.createdAt <= new Date(filters.dateTo + 'T23:59:59'));
    }
    
    return results;
  },
}));
