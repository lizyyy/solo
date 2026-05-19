export type RequestStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
export type CreditStatus = 'pending' | 'approved' | 'rejected';
export type PackageStatus = 'active' | 'expired' | 'depleted';

export interface Member {
  id: string;
  name: string;
  email: string;
  created_at: number;
  updated_at: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  member_id: string;
  created_at: number;
  updated_at: number;
}

export interface QuotaPackage {
  id: string;
  name: string;
  total_quota: number;
  remaining_quota: number;
  member_id: string;
  project_id?: string;
  valid_from: number;
  valid_to: number;
  status: PackageStatus;
  created_at: number;
  updated_at: number;
}

export interface GenerationRequest {
  id: string;
  idempotency_key: string;
  member_id: string;
  project_id: string;
  quota_package_id: string;
  quota_consumed: number;
  prompt?: string;
  status: RequestStatus;
  error_message?: string;
  created_at: number;
  updated_at: number;
  completed_at?: number;
}

export interface FailureCredit {
  id: string;
  request_id: string;
  member_id: string;
  quota_package_id: string;
  quota_returned: number;
  reason?: string;
  reviewed_by?: string;
  review_note?: string;
  status: CreditStatus;
  created_at: number;
  reviewed_at?: number;
}

export interface MonthlySummary {
  id: string;
  member_id: string;
  project_id?: string;
  year: number;
  month: number;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  quota_consumed: number;
  quota_returned: number;
  net_quota_used: number;
  created_at: number;
  updated_at: number;
}

export interface CreateGenerationRequest {
  member_id: string;
  project_id: string;
  quota_amount: number;
  prompt?: string;
  idempotency_key: string;
}

export interface ReviewCreditRequest {
  status: 'approved' | 'rejected';
  reviewed_by: string;
  review_note?: string;
}
