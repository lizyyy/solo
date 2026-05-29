export type RecordStatus = 'processed' | 'pending' | 'rejected';
export type Currency = 'CNY' | 'USD' | 'EUR' | 'GBP' | 'JPY';
export type TransportStatus = 'pending' | 'in_transit' | 'arrived' | 'delivered';
export type NodeType = 'origin' | 'transit' | 'destination';
export type AlertSeverity = 'error' | 'warning' | 'info';
export type AlertType = 'valuation' | 'contract' | 'transport' | 'insurance';

export interface Artwork {
  id: string;
  name: string;
  artworkNo: string;
  artist: string;
  year: string;
  material: string;
  size: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  status: RecordStatus;
}

export interface Valuation {
  id: string;
  artworkId: string;
  amount: number;
  currency: Currency;
  valuationDate: string;
  institution: string;
  valuer: string;
  remarks?: string;
  convertedAmount?: number;
  convertedCurrency: Currency;
  createdAt: string;
}

export interface LoanContract {
  id: string;
  artworkId: string;
  version: string;
  lender: string;
  lenderContact: string;
  startDate: string;
  endDate: string;
  specialTerms?: string;
  fileUrl?: string;
  signedDate?: string;
  isLatest: boolean;
  createdAt: string;
}

export interface TransportNode {
  id: string;
  artworkId: string;
  nodeType: NodeType;
  location: string;
  status: TransportStatus;
  timestamp?: string;
  handler?: string;
  remarks?: string;
}

export interface InsuranceClause {
  id: string;
  artworkId: string;
  policyType: string;
  coverageAmount: number;
  currency: Currency;
  deductible: number;
  effectiveDate: string;
  expiryDate: string;
  specialClauses?: string;
  insurer: string;
  policyNo?: string;
  createdAt: string;
}

export interface ChangeLog {
  id: string;
  recordId: string;
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
  operator: string;
  timestamp: string;
  reason?: string;
}

export interface GapAlert {
  id: string;
  artworkId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  field?: string;
  resolved: boolean;
  createdAt: string;
}

export interface ArtworkDetail extends Artwork {
  valuations: Valuation[];
  contracts: LoanContract[];
  transportNodes: TransportNode[];
  insuranceClauses: InsuranceClause[];
  changeLogs: ChangeLog[];
  gapAlerts: GapAlert[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ReportSummary {
  total: number;
  processed: number;
  pending: number;
  rejected: number;
  totalValuation: number;
  totalCoverage: number;
  gapCount: number;
}

export interface ExchangeRates {
  CNY: number;
  USD: number;
  EUR: number;
  GBP: number;
  JPY: number;
  [key: string]: number;
}

export interface Database {
  artworks: Artwork[];
  valuations: Valuation[];
  loanContracts: LoanContract[];
  transportNodes: TransportNode[];
  insuranceClauses: InsuranceClause[];
  changeLogs: ChangeLog[];
  gapAlerts: GapAlert[];
  exchangeRates: ExchangeRates;
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  processed: '已处理',
  pending: '待确认',
  rejected: '需退回补材料',
};

export const STATUS_COLORS: Record<RecordStatus, string> = {
  processed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
};

export const TRANSPORT_STATUS_LABELS: Record<TransportStatus, string> = {
  pending: '待运输',
  in_transit: '运输中',
  arrived: '已到达',
  delivered: '已签收',
};

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  origin: '起运地',
  transit: '中转节点',
  destination: '目的地',
};

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  error: '错误',
  warning: '警告',
  info: '提示',
};

export const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  error: 'text-red-600 bg-red-50 border-red-200',
  warning: 'text-amber-600 bg-amber-50 border-amber-200',
  info: 'text-blue-600 bg-blue-50 border-blue-200',
};
