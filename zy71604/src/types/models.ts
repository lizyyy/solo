import { Decimal } from 'decimal.js';

export type DividendType = 'cash' | 'reinvestment';
export type ProcessingStatus = 'pending' | 'processed' | 'confirmed' | 'rejected';
export type ReconciliationStatus = 'matched' | 'mismatch' | 'pending';
export type DataSourceType = 'announcement' | 'share_file' | 'nav_file' | 'client_choice' | 'settlement_record';

export interface SourceReference {
  sourceType: DataSourceType;
  sourceId: string;
  sourceFileName?: string;
  sourceRow?: number;
  sourceColumn?: string;
  originalValue?: string;
}

export interface Fund {
  id: string;
  fundCode: string;
  fundName: string;
  fundType: string;
  createdAt: string;
  updatedAt: string;
}

export interface DividendAnnouncement {
  id: string;
  fundId: string;
  announcementId: string;
  announcementDate: string;
  registrationDate: string;
  exDividendDate: string;
  paymentDate: string;
  dividendPerUnit: Decimal;
  dividendRatio: Decimal;
  reinvestmentNav: Decimal;
  roundingMethod: 'round_half_up' | 'truncate' | 'bankers';
  roundingPrecision: number;
  status: 'draft' | 'published' | 'effective';
  source: SourceReference;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ClientAccount {
  id: string;
  accountNo: string;
  clientName: string;
  idType: string;
  idNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface DividendChoice {
  id: string;
  accountId: string;
  fundId: string;
  dividendType: DividendType;
  effectiveDate: string;
  expiryDate?: string;
  source: SourceReference;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ShareRecord {
  id: string;
  accountId: string;
  fundId: string;
  referenceDate: string;
  totalShares: Decimal;
  frozenShares?: Decimal;
  availableShares: Decimal;
  source: SourceReference;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface NavRecord {
  id: string;
  fundId: string;
  navDate: string;
  nav: Decimal;
  accumulatedNav: Decimal;
  source: SourceReference;
  createdAt: string;
}

export interface SettlementRecord {
  id: string;
  accountId: string;
  fundId: string;
  announcementId: string;
  settlementDate: string;
  reinvestedShares: Decimal;
  cashDividend?: Decimal;
  source: SourceReference;
  createdAt: string;
}

export interface ReconciliationIssue {
  id: string;
  type: 'date_mismatch' | 'share_rounding' | 'cash_to_reinvest' | 'nav_mismatch' | 'choice_mismatch' | 'other';
  severity: 'warning' | 'error' | 'critical';
  message: string;
  expectedValue?: string;
  actualValue?: string;
  sourceReferences: SourceReference[];
  resolved: boolean;
  resolution?: string;
  createdAt: string;
}

export interface CalculationResult {
  id: string;
  accountId: string;
  fundId: string;
  announcementId: string;
  registrationDate: string;
  sharesOnRecordDate: Decimal;
  dividendType: DividendType;
  dividendPerUnit: Decimal;
  totalDividendAmount: Decimal;
  reinvestmentNav: Decimal;
  theoreticalReinvestedShares: Decimal;
  actualReinvestedShares?: Decimal;
  roundingDifference: Decimal;
  status: ReconciliationStatus;
  issues: ReconciliationIssue[];
  sourceReferences: SourceReference[];
  calculatedAt: string;
  version: number;
}

export interface ProcessingTask {
  id: string;
  fundId: string;
  announcementId: string;
  status: ProcessingStatus;
  totalAccounts: number;
  processedAccounts: number;
  matchedCount: number;
  mismatchCount: number;
  pendingCount: number;
  rejectedCount: number;
  issues: ReconciliationIssue[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  operator?: string;
  remarks?: string;
}

export interface ReportData {
  taskId: string;
  generatedAt: string;
  summary: {
    fundName: string;
    fundCode: string;
    announcementId: string;
    registrationDate: string;
    exDividendDate: string;
    paymentDate: string;
    dividendPerUnit: Decimal;
    reinvestmentNav: Decimal;
    totalAccounts: number;
    processedCount: number;
    confirmedCount: number;
    pendingCount: number;
    rejectedCount: number;
    totalReinvestedShares: Decimal;
    totalDividendAmount: Decimal;
  };
  processedItems: CalculationResult[];
  pendingItems: CalculationResult[];
  rejectedItems: CalculationResult[];
  issues: ReconciliationIssue[];
}

export interface VersionInfo<T> {
  id: string;
  entityId: string;
  entityType: string;
  version: number;
  data: T;
  changedBy?: string;
  changeReason?: string;
  createdAt: string;
}
