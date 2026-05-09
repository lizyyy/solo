export type TransactionType = 'BUY' | 'SELL';
export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REVERSED' | 'CANCELLED';
export type ReversalStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRY_PENDING';
export type IdempotentStatus = 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface Customer {
  id: string;
  name: string;
  idCardNo: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuotaLedger {
  id: string;
  customerId: string;
  year: number;
  totalQuota: number;
  usedQuota: number;
  availableQuota: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeRateSnapshot {
  id: string;
  currency: string;
  buyRate: number;
  sellRate: number;
  snapshotTime: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  idempotentKey: string;
  customerId: string;
  type: TransactionType;
  currency: string;
  foreignCurrencyAmount: number;
  rmbAmount: number;
  rateSnapshotId: string;
  quotaLedgerId: string;
  status: TransactionStatus;
  remark: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReversalRecord {
  id: string;
  originalTransactionId: string;
  transactionId: string;
  reason: string;
  status: ReversalStatus;
  retryCount: number;
  lastRetryAt: string;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface IdempotentRecord {
  id: string;
  idempotentKey: string;
  status: IdempotentStatus;
  response: string;
  createdAt: string;
  updatedAt: string;
}

export interface FailedOperation {
  id: string;
  operationType: string;
  payload: string;
  errorMessage: string;
  retryCount: number;
  nextRetryAt: string;
  status: 'PENDING' | 'FAILED' | 'SUCCESS';
  createdAt: string;
  updatedAt: string;
}

export interface RegulatoryReport {
  id: string;
  reportDate: string;
  customerId: string;
  totalBuyAmount: number;
  totalSellAmount: number;
  transactionCount: number;
  reportData: string;
  createdAt: string;
}