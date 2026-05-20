export interface BudgetCategory {
  id: string;
  code: string;
  name: string;
  department?: string;
  annual_budget: number;
  used_budget: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TripRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  department?: string;
  trip_type?: string;
  departure_city?: string;
  arrival_city?: string;
  start_date?: string;
  end_date?: string;
  purpose?: string;
  estimated_amount?: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ReimbursementForm {
  id: string;
  form_no: string;
  employee_id: string;
  employee_name: string;
  department?: string;
  trip_id?: string;
  budget_category_id?: string;
  total_amount: number;
  status: string;
  submitted_at?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceImage {
  id: string;
  invoice_no?: string;
  invoice_code?: string;
  invoice_date?: string;
  amount?: number;
  tax_amount?: number;
  total_amount?: number;
  seller_name?: string;
  seller_tax_no?: string;
  buyer_name?: string;
  buyer_tax_no?: string;
  category?: string;
  image_url?: string;
  ocr_result?: string;
  status: string;
  employee_id?: string;
  employee_name?: string;
  department?: string;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

export interface DuplicateInvoice {
  id: string;
  original_invoice_id: string;
  duplicate_invoice_id: string;
  duplicate_type?: string;
  confidence?: number;
  status: string;
  detected_at: string;
  resolved_at?: string;
}

export interface MatchResult {
  id: string;
  invoice_id: string;
  reimbursement_id?: string;
  trip_id?: string;
  budget_category_id?: string;
  match_type?: string;
  match_score?: number;
  status: string;
  matched_by?: string;
  matched_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface StatusTimeline {
  id: string;
  entity_type: string;
  entity_id: string;
  status: string;
  previous_status?: string;
  operator?: string;
  notes?: string;
  created_at: string;
}

export type InvoiceStatus = 'pending' | 'matched' | 'duplicate' | 'exception' | 'confirmed';
export type MatchStatus = 'pending' | 'auto_matched' | 'manual_matched' | 'rejected';
export type ReimbursementStatus = 'draft' | 'submitted' | 'reviewing' | 'approved' | 'rejected';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginationResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
