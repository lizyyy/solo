export interface Tour {
  id: string;
  name: string;
  bandName?: string;
  initialBudget: number;
  startDate: string;
  endDate: string;
  notes?: string;
  rawData: {
    tour: Record<string, unknown>;
    stops: Record<string, unknown>[];
    merch: Record<string, unknown>[];
  };
  processingLog: ProcessingLogEntry[];
}

export interface Stop {
  id: string;
  tourId: string;
  city: string;
  venue: string;
  date: string;
  distanceFromPrev: number;
  venueRent: number;
  venueSplit: number;
  ticketPrice: number;
  predictedAttendance: number;
  actualAttendance?: number;
  transportType: string;
  transportCost: number;
  notes?: string;
  status: 'pending' | 'current' | 'completed' | 'skipped';
  order: number;
}

export interface MerchItem {
  id: string;
  tourId: string;
  name: string;
  sku?: string;
  costPrice: number;
  sellingPrice: number;
  initialStock: number;
  currentStock: number;
  notes?: string;
}

export interface MerchSale {
  id: string;
  stopId: string;
  merchItemId: string;
  quantity: number;
  unitPrice: number;
  promotionType?: 'none' | 'discount' | 'bundle';
}

export interface Expense {
  id: string;
  stopId: string;
  category: 'venue' | 'transport' | 'merch' | 'marketing' | 'other';
  description: string;
  amount: number;
  notes?: string;
}

export interface Revenue {
  id: string;
  stopId: string;
  category: 'ticket' | 'merch' | 'sponsorship' | 'other';
  description: string;
  amount: number;
  notes?: string;
}

export type RiskType = 'box_office' | 'inventory' | 'route' | 'cashflow';
export type RiskLevel = 'low' | 'medium' | 'high';
export type RiskSeverity = 'warning' | 'critical';

export interface RiskEvent {
  id: string;
  tourId: string;
  stopId: string;
  type: RiskType;
  severity: RiskSeverity;
  level: RiskLevel;
  description: string;
  impact: number;
  chosenOptionId?: string;
  outcome?: string;
  triggeredAt: string;
  resolvedAt?: string;
}

export type DecisionType = 'route' | 'pricing' | 'inventory' | 'marketing' | 'risk_mitigation';
export type RiskOptionLevel = 'conservative' | 'balanced' | 'aggressive';

export interface DisposalOption {
  id: string;
  name: string;
  description: string;
  riskLevel: RiskOptionLevel;
  immediateImpact: {
    cashFlow: number;
    riskIndex: number;
  };
  projectedOutcome: {
    bestCase: number;
    expectedCase: number;
    worstCase: number;
  };
}

export interface DecisionLog {
  id: string;
  tourId: string;
  stopId: string;
  decisionType: DecisionType;
  description: string;
  chosenOption: DisposalOption;
  alternatives: DisposalOption[];
  outcome: {
    actualImpact: number;
    riskChange: number;
    notes?: string;
  };
  createdAt: string;
}

export interface ProcessingLogEntry {
  id: string;
  priority: number;
  type: 'missing_value' | 'format_error' | 'logic_error' | 'outlier' | 'info';
  severity: 'error' | 'warning' | 'info';
  field: string;
  rowIndex?: number;
  originalValue: string;
  cleanedValue?: string;
  message: string;
  requiresUserAction: boolean;
  resolved: boolean;
  userOverride?: string;
}

export interface ValidationError {
  id: string;
  type: 'required' | 'format' | 'logic' | 'range';
  field: string;
  rowIndex?: number;
  message: string;
  severity: 'error' | 'warning';
}

export type GamePhase = 'setup' | 'import' | 'playing' | 'settlement' | 'review' | 'export';

export interface StopResult {
  stopId: string;
  ticketRevenue: number;
  merchRevenue: number;
  totalRevenue: number;
  venueExpense: number;
  transportExpense: number;
  merchCost: number;
  otherExpenses: number;
  totalExpense: number;
  netProfit: number;
  actualAttendance: number;
  merchSales: MerchSale[];
  risks: RiskEvent[];
}
