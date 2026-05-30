export type MaterialType = 'holding' | 'target' | 'price';

export type BatchStatus = 'draft' | 'validating' | 'ready' | 'calculating' | 'completed' | 'error' | 'pending_data';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export type OptimizationTarget = 'minimize_tax' | 'maximize_after_tax' | 'minimize_tracking_error';

export type Severity = 'error' | 'warning' | 'info';

export type ErrorCategory = 'tax' | 'weight' | 'loss_offset' | 'data_integrity';

export interface Batch {
  id: string;
  name: string;
  clientId: string;
  status: BatchStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  currentVersion: number;
}

export interface Material {
  id: string;
  batchId: string;
  type: MaterialType;
  source: string;
  fileName: string;
  fileHash: string;
  uploadedBy: string;
  uploadedAt: Date;
  rawContent: string;
  version: number;
  isDuplicate?: boolean;
  diffFromPrevious?: DiffResult;
}

export interface DiffResult {
  isDuplicate: boolean;
  changes: ChangeItem[];
}

export interface ChangeItem {
  type: 'added' | 'modified' | 'deleted';
  materialType: MaterialType;
  fieldChanges?: FieldChange[];
  rowChanges?: RowChange[];
}

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface RowChange {
  rowIndex: number;
  type: 'added' | 'modified' | 'deleted';
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
}

export interface Holding {
  id: string;
  materialId: string;
  symbol: string;
  name: string;
  quantity: number;
  costBasis: number;
  marketPrice: number;
  purchaseDate: Date;
  holdingDays: number;
  marketValue: number;
  costValue: number;
  unrealizedGain: number;
  unrealizedGainPct: number;
  currentWeight: number;
}

export interface TargetWeight {
  id: string;
  materialId: string;
  symbol: string;
  targetWeight: number;
}

export interface PriceQuote {
  id: string;
  materialId: string;
  symbol: string;
  bidPrice: number;
  askPrice: number;
  quoteTime: Date;
}

export interface RebalanceConfig {
  taxRules: TaxRules;
  lossOffsetRules: LossOffsetRules;
  holdingPeriodRules: HoldingPeriodRules;
  optimizationTarget: OptimizationTarget;
  constraints: {
    minTradeValue: number;
    maxTurnoverPct: number;
    allowShortTermSell: boolean;
    washSaleProtection: boolean;
  };
}

export interface TaxRules {
  stampDutyRate: number;
  commissionRate: number;
  commissionMin: number;
  shortTermCapitalGainsRate: number;
  longTermCapitalGainsRate: number;
  dividendTaxRates: {
    lessThan30Days: number;
    between30And365Days: number;
    moreThan365Days: number;
  };
}

export interface LossOffsetRules {
  enabled: boolean;
  carryForwardYears: number;
  washSaleProtectionDays: number;
  offsetOrder: 'short_first' | 'long_first';
  priorYearLosses: number;
}

export interface HoldingPeriodRules {
  minHoldingDays: number;
  shortTermThresholdDays: number;
  longTermThresholdDays: number;
}

export interface Task {
  id: string;
  batchId: string;
  version: number;
  config: RebalanceConfig;
  status: TaskStatus;
  totalTax: number;
  totalCommission: number;
  totalStampDuty: number;
  totalCapitalGainsTax: number;
  totalLossOffset: number;
  afterTaxReturn: number;
  trackingError: number;
  totalTurnover: number;
  createdAt: Date;
  completedAt?: Date;
  progress?: number;
}

export interface TradeSuggestion {
  id: string;
  taskId: string;
  symbol: string;
  name: string;
  action: 'buy' | 'sell' | 'hold';
  quantity: number;
  price: number;
  estimatedValue: number;
  estimatedCommission: number;
  estimatedStampDuty: number;
  estimatedCapitalGainsTax: number;
  estimatedTotalTax: number;
  lossOffsetApplied: number;
  netProceeds: number;
  holdingDays: number;
  currentWeight: number;
  targetWeight: number;
  suggestedWeight: number;
  weightDiff: number;
  reason: string;
  constraints: string[];
  evidenceId: string;
  marginalTaxRate: number;
}

export interface ValidationError {
  id: string;
  severity: Severity;
  category: ErrorCategory;
  materialId: string;
  materialType: MaterialType;
  rowIndex?: number;
  fieldName?: string;
  message: string;
  currentValue?: any;
  expectedValue?: any;
  fixSuggestion: string;
  requiredData?: {
    description: string;
    format: string;
    example: string;
  };
}

export interface EvidenceRecord {
  id: string;
  taskId: string;
  targetType: 'trade' | 'tax' | 'holding';
  targetId: string;
  calculationSteps: CalculationStep[];
  sourceMaterialIds: string[];
}

export interface CalculationStep {
  order: number;
  operation: string;
  formula: string;
  inputs: Record<string, {
    value: number;
    source: string;
    materialId?: string;
    rowIndex?: number;
  }>;
  result: number;
  timestamp: Date;
}

export interface TaxBreakdown {
  commission: number;
  stampDuty: number;
  capitalGainsTax: number;
  lossOffset: number;
  totalTax: number;
}

export interface PortfolioSummary {
  totalMarketValue: number;
  totalCostValue: number;
  totalUnrealizedGain: number;
  totalUnrealizedGainPct: number;
  positionCount: number;
  targetWeightSum: number;
  weightGap: number;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  config: RebalanceConfig;
  createdAt: Date;
  updatedAt: Date;
}

export type MaterialUploadState = {
  [key in MaterialType]: {
    file: File | null;
    material: Material | null;
    parsing: boolean;
    error: string | null;
  };
};

export const DEFAULT_TAX_RULES: TaxRules = {
  stampDutyRate: 0.001,
  commissionRate: 0.0003,
  commissionMin: 5,
  shortTermCapitalGainsRate: 0.20,
  longTermCapitalGainsRate: 0.20,
  dividendTaxRates: {
    lessThan30Days: 0.20,
    between30And365Days: 0.10,
    moreThan365Days: 0,
  },
};

export const DEFAULT_LOSS_OFFSET_RULES: LossOffsetRules = {
  enabled: true,
  carryForwardYears: 5,
  washSaleProtectionDays: 30,
  offsetOrder: 'short_first',
  priorYearLosses: 0,
};

export const DEFAULT_HOLDING_PERIOD_RULES: HoldingPeriodRules = {
  minHoldingDays: 30,
  shortTermThresholdDays: 365,
  longTermThresholdDays: 365,
};

export const DEFAULT_CONFIG: RebalanceConfig = {
  taxRules: DEFAULT_TAX_RULES,
  lossOffsetRules: DEFAULT_LOSS_OFFSET_RULES,
  holdingPeriodRules: DEFAULT_HOLDING_PERIOD_RULES,
  optimizationTarget: 'minimize_tax',
  constraints: {
    minTradeValue: 1000,
    maxTurnoverPct: 0.30,
    allowShortTermSell: false,
    washSaleProtection: true,
  },
};

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  holding: '持仓表',
  target: '目标权重',
  price: '买卖报价',
};

export const MATERIAL_TYPE_COLORS: Record<MaterialType, string> = {
  holding: 'bg-blue-500',
  target: 'bg-emerald-500',
  price: 'bg-amber-500',
};

export function calculateHoldingDays(purchaseDate: Date, asOfDate: Date = new Date()): number {
  if (!purchaseDate || isNaN(purchaseDate.getTime())) return 0;
  const diffTime = asOfDate.getTime() - purchaseDate.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}
