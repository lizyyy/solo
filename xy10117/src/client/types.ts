export interface Transaction {
  id: string;
  transaction_id: string;
  amount: number;
  merchant: string;
  category: string;
  country: string;
  device_id: string;
  user_id: string;
  transaction_time: string;
  is_first_transaction: number;
  is_weekend: number;
  is_night: number;
  velocity_24h: number;
  amount_deviation: number;
  risk_score: number;
  is_anomaly: number;
  reviewed: number;
  review_decision?: string;
  review_comment?: string;
  reviewer?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface Explanation {
  id: string;
  transaction_id: string;
  feature: string;
  feature_value: string;
  contribution: number;
  threshold: string;
  reason: string;
  created_at: string;
}

export interface VersionHistory {
  id: string;
  transaction_id: string;
  action: 'import' | 'review' | 'rollback';
  old_value: string;
  new_value: string;
  operator: string;
  created_at: string;
}

export interface Statistics {
  total: number;
  anomalies: number;
  reviewed: number;
  confirmed: number;
  rejected: number;
  unreviewed: number;
  avg_score: number;
}

export interface ReviewRequest {
  transaction_id: string;
  decision: 'confirmed' | 'rejected';
  comment: string;
  reviewer: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TransactionFilters {
  is_anomaly?: boolean;
  reviewed?: boolean;
  review_decision?: 'confirmed' | 'rejected';
  min_score?: number;
  max_score?: number;
  search?: string;
}

export const FEATURE_NAMES: Record<string, string> = {
  amount: '交易金额',
  velocity_24h: '24小时交易频次',
  amount_deviation: '金额偏离度',
  is_first_transaction: '首次交易',
  is_night: '夜间交易',
  is_weekend: '周末交易',
};
