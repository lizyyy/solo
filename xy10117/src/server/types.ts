export interface TransactionData {
  transaction_id: string;
  amount: number;
  merchant: string;
  category: string;
  country: string;
  device_id: string;
  user_id: string;
  transaction_time: string;
  is_first_transaction?: number;
  is_weekend?: number;
  is_night?: number;
  velocity_24h?: number;
  amount_deviation?: number;
  risk_score?: number;
}

export interface ReviewRequest {
  transaction_id: string;
  decision: 'confirmed' | 'rejected';
  comment: string;
  reviewer: string;
}

export interface ExportRequest {
  start_date?: string;
  end_date?: string;
  status?: 'all' | 'reviewed' | 'unreviewed' | 'confirmed' | 'rejected';
  format: 'csv' | 'json';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
