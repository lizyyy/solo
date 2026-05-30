export type LimitStatus = 'pending' | 'processing' | 'approved' | 'rejected' | 'to_confirm';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type RiskType = 'whitelist_expired' | 'limit_exceeded' | 'duplicate_transaction' | 'calculation_missing' | 'other';

export type TransactionStatus = 'success' | 'failed' | 'pending';

export type WhitelistStatus = 'active' | 'expired' | 'pending';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface WalletLimit {
  id: string;
  walletAccount: string;
  walletName: string;
  dailyLimit: number;
  singleLimit: number;
  usedDailyLimit: number;
  status: LimitStatus;
  riskLevel: RiskLevel;
  createdAt: string;
  updatedAt: string;
}

export interface LimitHistory {
  id: string;
  walletLimitId: string;
  beforeDailyLimit: number;
  afterDailyLimit: number;
  beforeSingleLimit: number;
  afterSingleLimit: number;
  beforeStatus: LimitStatus;
  afterStatus: LimitStatus;
  operator: string;
  remark: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  walletLimitId: string;
  transactionNo: string;
  amount: number;
  status: TransactionStatus;
  transactionTime: string;
  isDuplicate: boolean;
  isAbnormal: boolean;
  description: string;
}

export interface WhitelistVersion {
  id: string;
  walletLimitId: string;
  version: number;
  tempDailyLimit: number;
  tempSingleLimit: number;
  effectiveTime: string;
  expireTime: string;
  status: WhitelistStatus;
  creator: string;
  createdAt: string;
}

export interface RiskMark {
  id: string;
  walletLimitId: string;
  type: RiskType;
  level: RiskLevel;
  description: string;
  isResolved: boolean;
  createdAt: string;
}

export interface ExportRecord {
  id: string;
  walletLimitId: string;
  fileName: string;
  format: ExportFormat;
  operator: string;
  contentHash: string;
  createdAt: string;
}

export interface StatusTransition {
  from: LimitStatus;
  to: LimitStatus;
  timestamp: string;
  operator: string;
  remark: string;
}
