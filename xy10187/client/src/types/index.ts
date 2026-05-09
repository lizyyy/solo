export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  pagination?: Pagination;
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface Employee {
  id: string;
  name: string;
  department: string;
  monthly_allowance: number;
  used_amount: number;
  remaining_amount: number;
  usage_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Merchant {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  address: string;
  created_at: string;
}

export type ReceiptStatus = 'pending' | 'approved' | 'rejected' | 'duplicate' | 'settled' | 'appealed';

export interface Receipt {
  id: string;
  employee_id: string;
  merchant_id: string;
  receipt_no: string;
  amount: number;
  consumption_date: string;
  upload_date: string;
  status: ReceiptStatus;
  is_duplicate: number;
  duplicate_group_id?: string;
  notes?: string;
  image_path?: string;
  created_at: string;
  updated_at: string;
  employee_name?: string;
  employee_department?: string;
  merchant_name?: string;
}

export interface ReceiptDetail extends Receipt {
  monthly_allowance?: number;
  used_amount?: number;
  merchant_phone?: string;
  merchant_address?: string;
  logs: StatusLog[];
  appeal?: Appeal;
  duplicates: Receipt[];
}

export interface StatusLog {
  id: string;
  receipt_id: string;
  old_status?: string;
  new_status: string;
  operator: string;
  reason?: string;
  created_at: string;
}

export type SettlementStatus = 'pending' | 'processing' | 'completed' | 'cancelled';

export interface Settlement {
  id: string;
  merchant_id: string;
  settlement_month: string;
  total_amount: number;
  status: SettlementStatus;
  created_at: string;
  updated_at: string;
  merchant_name?: string;
  contact_person?: string;
  phone?: string;
}

export interface SettlementItem {
  id: string;
  settlement_id: string;
  receipt_id: string;
  amount: number;
  receipt_no: string;
  consumption_date: string;
  receipt_amount: number;
  employee_name: string;
  department: string;
}

export interface SettlementDetail extends Settlement {
  address?: string;
  items: SettlementItem[];
}

export type AppealType = 'reject' | 'duplicate';
export type AppealStatus = 'pending' | 'resolved' | 'rejected';

export interface Appeal {
  id: string;
  receipt_id: string;
  appellant: string;
  appeal_type: AppealType;
  reason: string;
  status: AppealStatus;
  handler?: string;
  handle_result?: string;
  created_at: string;
  updated_at: string;
  receipt_no?: string;
  amount?: number;
  receipt_status?: string;
  employee_name?: string;
  department?: string;
  merchant_name?: string;
}

export interface StatsOverview {
  receipt_stats: {
    total_receipts: number;
    pending_count: number;
    approved_count: number;
    approved_amount: number;
    rejected_count: number;
    duplicate_count: number;
    settled_count: number;
    settled_amount: number;
    appealed_count: number;
  };
  appeal_stats: {
    total_appeals: number;
    pending_appeals: number;
    resolved_appeals: number;
    rejected_appeals: number;
  };
  employee_stats: {
    total_employees: number;
    total_allowance: number;
    total_used: number;
    total_remaining: number;
  };
  merchant_stats: {
    total_merchants: number;
  };
  settlement_stats: {
    total_settlements: number;
    pending_settlements: number;
    processing_settlements: number;
    completed_settlements: number;
    completed_amount: number;
  };
  recent_activity: Array<{
    type: 'receipt' | 'appeal' | 'settlement';
    id: string;
    receipt_no?: string;
    amount?: number;
    status: string;
    created_at: string;
    related_name: string;
  }>;
  department_stats: Array<{
    department: string;
    employee_count: number;
    total_allowance: number;
    total_used: number;
    total_remaining: number;
    avg_usage_rate: number;
  }>;
}

export interface DuplicateGroup {
  id: string;
  receipt_no: string;
  count: number;
  created_at: string;
  merchant_name: string;
  merchant_id: string;
  receipts: Receipt[];
}
