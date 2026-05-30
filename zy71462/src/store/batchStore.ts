import { create } from 'zustand';
import {
  Batch,
  Material,
  Holding,
  TargetWeight,
  PriceQuote,
  Task,
  TradeSuggestion,
  EvidenceRecord,
  ValidationError,
  RebalanceConfig,
  DEFAULT_CONFIG,
  MaterialType,
  BatchStatus,
} from '@/types';
import { generateSampleBatch, generateSampleMaterials, generateSampleHoldings, generateSampleTargetWeights, generateSamplePriceQuotes, generateSampleConfig } from '@/mock/sampleData';

interface BatchState {
  currentBatch: Batch | null;
  materials: Material[];
  holdings: Holding[];
  targetWeights: TargetWeight[];
  priceQuotes: PriceQuote[];
  currentTask: Task | null;
  trades: TradeSuggestion[];
  evidenceRecords: EvidenceRecord[];
  validationErrors: ValidationError[];
  config: RebalanceConfig;
  isCalculating: boolean;
  calculationProgress: number;
  calculationMessage: string;
  
  setCurrentBatch: (batch: Batch | null) => void;
  addMaterial: (material: Material) => void;
  removeMaterial: (materialId: string) => void;
  setHoldings: (holdings: Holding[]) => void;
  setTargetWeights: (targetWeights: TargetWeight[]) => void;
  setPriceQuotes: (priceQuotes: PriceQuote[]) => void;
  setCurrentTask: (task: Task | null) => void;
  setTrades: (trades: TradeSuggestion[]) => void;
  setEvidenceRecords: (records: EvidenceRecord[]) => void;
  setValidationErrors: (errors: ValidationError[]) => void;
  setConfig: (config: Partial<RebalanceConfig> | RebalanceConfig) => void;
  setCalculating: (isCalculating: boolean) => void;
  setCalculationProgress: (progress: number, message: string) => void;
  updateBatchStatus: (status: BatchStatus) => void;
  loadDemoData: () => void;
  clearAll: () => void;
  getMaterialByType: (type: MaterialType) => Material | undefined;
}

export const useBatchStore = create<BatchState>((set, get) => ({
  currentBatch: null,
  materials: [],
  holdings: [],
  targetWeights: [],
  priceQuotes: [],
  currentTask: null,
  trades: [],
  evidenceRecords: [],
  validationErrors: [],
  config: DEFAULT_CONFIG,
  isCalculating: false,
  calculationProgress: 0,
  calculationMessage: '',

  setCurrentBatch: (batch) => set({ currentBatch: batch }),
  
  addMaterial: (material) => set((state) => ({
    materials: [...state.materials.filter(m => !(m.type === material.type && m.version === material.version)), material],
  })),
  
  removeMaterial: (materialId) => set((state) => ({
    materials: state.materials.filter(m => m.id !== materialId),
  })),
  
  setHoldings: (holdings) => set({ holdings }),
  setTargetWeights: (targetWeights) => set({ targetWeights }),
  setPriceQuotes: (priceQuotes) => set({ priceQuotes }),
  
  setCurrentTask: (task) => set({ currentTask: task }),
  setTrades: (trades) => set({ trades }),
  setEvidenceRecords: (evidenceRecords) => set({ evidenceRecords }),
  setValidationErrors: (validationErrors) => set({ validationErrors }),
  
  setConfig: (config) => set((state) => ({
    config: {
      ...state.config,
      ...config,
      taxRules: { ...state.config.taxRules, ...config.taxRules },
      lossOffsetRules: { ...state.config.lossOffsetRules, ...config.lossOffsetRules },
      holdingPeriodRules: { ...state.config.holdingPeriodRules, ...config.holdingPeriodRules },
      constraints: { ...state.config.constraints, ...config.constraints },
    },
  })),
  
  setCalculating: (isCalculating) => set({ isCalculating }),
  
  setCalculationProgress: (progress, message) => set({
    calculationProgress: progress,
    calculationMessage: message,
  }),
  
  updateBatchStatus: (status) => set((state) => ({
    currentBatch: state.currentBatch ? { ...state.currentBatch, status, updatedAt: new Date() } : null,
  })),
  
  loadDemoData: () => {
    const batch = generateSampleBatch();
    const materials = generateSampleMaterials(batch.id);
    const holdings = generateSampleHoldings(materials[0].id);
    const targetWeights = generateSampleTargetWeights(materials[1].id);
    const priceQuotes = generateSamplePriceQuotes(materials[2].id);
    const config = generateSampleConfig();
    
    set({
      currentBatch: batch,
      materials,
      holdings,
      targetWeights,
      priceQuotes,
      config,
      validationErrors: [],
    });
  },
  
  clearAll: () => set({
    currentBatch: null,
    materials: [],
    holdings: [],
    targetWeights: [],
    priceQuotes: [],
    currentTask: null,
    trades: [],
    evidenceRecords: [],
    validationErrors: [],
    config: DEFAULT_CONFIG,
    isCalculating: false,
    calculationProgress: 0,
    calculationMessage: '',
  }),
  
  getMaterialByType: (type) => {
    const state = get();
    const typeMaterials = state.materials.filter(m => m.type === type);
    if (typeMaterials.length === 0) return undefined;
    return typeMaterials.reduce((latest, m) => m.version > latest.version ? m : latest);
  },
}));
