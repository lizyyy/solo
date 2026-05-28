import { create } from 'zustand';
import type {
  AuctionItem,
  BidRecord,
  TransactionRecord,
  UnsoldRecord,
  CalculationParams,
  CalculationPoint,
  AnomalyItem,
  OptimizationReport,
  UploadedData,
  DataValidationResult,
} from '../types/auction';
import { defaultParams } from '../data/defaultParams';
import { sampleItems } from '../data/sampleItems';
import { sampleBids } from '../data/sampleBids';
import { sampleTransactions } from '../data/sampleTransactions';
import { sampleUnsolds } from '../data/sampleUnsolds';
import { calculateScenarios, applyRiskConstraints, findOptimalPoint } from '../utils/calculator';
import { detectAllAnomalies } from '../utils/anomalyDetector';

interface AuctionState {
  items: AuctionItem[];
  bids: BidRecord[];
  transactions: TransactionRecord[];
  unsolds: UnsoldRecord[];
  selectedItemId: string | null;
  params: CalculationParams;
  calculationResults: {
    conservative: CalculationPoint[];
    neutral: CalculationPoint[];
    optimistic: CalculationPoint[];
  } | null;
  optimalPoints: {
    conservative: CalculationPoint | null;
    neutral: CalculationPoint | null;
    optimistic: CalculationPoint | null;
  };
  anomalies: AnomalyItem[];
  report: OptimizationReport | null;
  isCalculating: boolean;
  validationResult: DataValidationResult | null;
  activeTab: 'import' | 'calculate' | 'anomalies' | 'report';

  setActiveTab: (tab: 'import' | 'calculate' | 'anomalies' | 'report') => void;
  setSelectedItemId: (id: string | null) => void;
  updateParams: (params: Partial<CalculationParams>) => void;
  loadSampleData: () => void;
  setUploadedData: (data: UploadedData) => void;
  runCalculation: () => void;
  detectAnomalies: () => void;
  generateReport: () => void;
  clearData: () => void;
  validateData: () => void;
}

export const useAuctionStore = create<AuctionState>((set, get) => ({
  items: [],
  bids: [],
  transactions: [],
  unsolds: [],
  selectedItemId: null,
  params: { ...defaultParams },
  calculationResults: null,
  optimalPoints: { conservative: null, neutral: null, optimistic: null },
  anomalies: [],
  report: null,
  isCalculating: false,
  validationResult: null,
  activeTab: 'import',

  setActiveTab: (tab) => set({ activeTab: tab }),

  setSelectedItemId: (id) => set({ selectedItemId: id }),

  updateParams: (newParams) => set((state) => ({
    params: { ...state.params, ...newParams },
  })),

  loadSampleData: () => {
    set({
      items: [...sampleItems],
      bids: [...sampleBids],
      transactions: [...sampleTransactions],
      unsolds: [...sampleUnsolds],
      selectedItemId: sampleItems[0]?.id || null,
    });
    get().validateData();
    get().detectAnomalies();
  },

  setUploadedData: (data) => {
    set({
      items: data.items,
      bids: data.bids,
      transactions: data.transactions,
      unsolds: data.unsolds,
      selectedItemId: data.items[0]?.id || null,
    });
    get().validateData();
    get().detectAnomalies();
  },

  runCalculation: () => {
    const { items, bids, transactions, params, selectedItemId } = get();
    if (!selectedItemId) return;

    const selectedItem = items.find(i => i.id === selectedItemId);
    if (!selectedItem) return;

    set({ isCalculating: true });

    setTimeout(() => {
      const results = calculateScenarios(selectedItem, bids, transactions, params);

      const constrained = {
        conservative: applyRiskConstraints(results.conservative, params),
        neutral: applyRiskConstraints(results.neutral, params),
        optimistic: applyRiskConstraints(results.optimistic, params),
      };

      const optimalPoints = {
        conservative: findOptimalPoint(constrained.conservative),
        neutral: findOptimalPoint(constrained.neutral),
        optimistic: findOptimalPoint(constrained.optimistic),
      };

      set({
        calculationResults: constrained,
        optimalPoints,
        isCalculating: false,
      });
    }, 500);
  },

  detectAnomalies: () => {
    const { bids, transactions, unsolds, params } = get();
    const anomalies = detectAllAnomalies(bids, transactions, unsolds, params.commissionTiers);
    set({ anomalies });
  },

  generateReport: () => {
    const { items, selectedItemId, optimalPoints, anomalies, params } = get();
    if (!selectedItemId) return;

    const selectedItem = items.find(i => i.id === selectedItemId);
    if (!selectedItem || !optimalPoints.neutral) return;

    const neutral = optimalPoints.neutral;
    const conservative = optimalPoints.conservative;
    const optimistic = optimalPoints.optimistic;

    if (!conservative || !optimistic) return;

    const lowerBound = Math.min(
      conservative.reservePrice,
      neutral.reservePrice,
      optimistic.reservePrice
    );
    const upperBound = Math.max(
      conservative.reservePrice,
      neutral.reservePrice,
      optimistic.reservePrice
    );

    const report: OptimizationReport = {
      generatedAt: new Date().toISOString(),
      itemSummary: selectedItem,
      optimalReservePrice: neutral.reservePrice,
      reservePriceRange: [lowerBound * 0.95, upperBound * 1.05],
      scenarios: {
        conservative,
        neutral,
        optimistic,
      },
      anomalies,
      parameterSnapshot: { ...params },
      ruleNotes: `
## 核心算法规则说明

### 1. 收益期望计算公式
期望收益 = Σ(成交价格 × 成交概率) - Σ(流拍成本 × 流拍概率)
- 成交概率基于历史数据的正态分布拟合
- 买家活跃度加权调整出价概率
- 佣金按阶梯分段计算

### 2. 风险约束条件
- 流拍概率 ≤ ${(params.maxUnsoldProbability * 100).toFixed(0)}%
- 期望佣金 ≥ ${params.minCommissionGuarantee.toLocaleString()}元
- 保留价/估值 ∈ [${(params.minReserveRatio * 100).toFixed(0)}%, ${(params.maxReserveRatio * 100).toFixed(0)}%]

### 3. 情景参数调整
- 保守情景：买家活跃度×0.8，流拍概率×1.2
- 中性情景：使用原始参数
- 乐观情景：买家活跃度×1.2，流拍概率×0.8

### 4. 异常检测规则
- 样本量<10：严重警告，置信度<70%
- 样本量<30：警告，置信度<85%
- 流拍成本缺项：检查仓储、营销、机会成本
- 佣金阶梯异常：断点、倒转、偏离行业标准±3%
`,
    };

    set({ report });
  },

  clearData: () => {
    set({
      items: [],
      bids: [],
      transactions: [],
      unsolds: [],
      selectedItemId: null,
      calculationResults: null,
      optimalPoints: { conservative: null, neutral: null, optimistic: null },
      anomalies: [],
      report: null,
      validationResult: null,
    });
  },

  validateData: () => {
    const { items, bids, transactions, unsolds } = get();
    const errors: string[] = [];
    const warnings: string[] = [];

    if (items.length === 0) errors.push('缺少拍品信息数据');
    if (bids.length === 0) warnings.push('暂无买家出价记录，将仅使用历史成交数据');
    if (transactions.length === 0) warnings.push('暂无历史成交记录，计算结果参考价值有限');

    const itemIds = new Set(items.map(i => i.id));
    const orphanBids = bids.filter(b => !itemIds.has(b.itemId));
    if (orphanBids.length > 0) {
      warnings.push(`${orphanBids.length}条出价记录的拍品ID不存在，已自动忽略`);
    }

    set({
      validationResult: {
        valid: errors.length === 0,
        errors,
        warnings,
        recordCounts: {
          items: items.length,
          bids: bids.length,
          transactions: transactions.length,
          unsolds: unsolds.length,
        },
      },
    });
  },
}));
