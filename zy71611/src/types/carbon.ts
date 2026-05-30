export interface TradeRecord {
  date: string;
  price: number;
}

export interface OverviewData {
  gap: number;
  emission: number;
  allowance: number;
  matchedAmount: number;
  unmatchedGap: number;
  fundNeeded: number;
  tradeRecords: TradeRecord[];
  budgetStatus: {
    used: number;
    total: number;
  };
}

export interface EmissionRow {
  facility: string;
  emission: number;
  unit: string;
  sourceFile: string;
  importTime: string;
  unitStatus: 'normal' | 'warning';
}

export interface QuotaAccount {
  accountNo: string;
  quota: number;
  sourceFile: string;
  importTime: string;
}

export interface QuotaDetailData {
  emissions: EmissionRow[];
  accounts: QuotaAccount[];
  totalEmission: number;
  totalAllowance: number;
  gap: number;
}

export interface HedgingContract {
  contractNo: string;
  lockedPrice: number;
  quantity: number;
  validPeriod: string;
  source: string;
  duplicateStatus: 'normal' | 'duplicate';
}

export interface HedgingDetailData {
  contracts: HedgingContract[];
  sankeyData: {
    nodes: { name: string }[];
    links: { source: string; target: string; value: number }[];
  };
  matchRate: number;
  lockedAmount: number;
  pendingAmount: number;
  marketPrice: number;
  priceComparison: {
    contractNo: string;
    lockedPrice: number;
    marketPrice: number;
  }[];
}

export interface BudgetCategory {
  name: string;
  budget: number;
  actual: number;
}

export interface FundSource {
  name: string;
  amount: number;
  targetType: string;
  targetId: string;
}

export interface BudgetDetailData {
  categories: BudgetCategory[];
  usagePercent: number;
  fundSources: FundSource[];
  alertRules: { threshold: number; level: string }[];
}

export interface AnomalyItem {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  explanation: string;
  suggestion: string;
  resolved: boolean;
}

export interface ConflictItem {
  id: string;
  type: string;
  description: string;
  resolved: boolean;
}

export interface TraceNode {
  id: string;
  label: string;
  value: number | string;
  sourceFile?: string;
  timestamp?: string;
  type: 'source' | 'calculation' | 'aggregation';
  children?: TraceNode[];
}

export interface ReportSection {
  title: string;
  content: string;
  traceable?: boolean;
}

export interface ReportData {
  sections: ReportSection[];
  generatedAt: string;
}
