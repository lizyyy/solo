export interface Customer {
  id?: number;
  name: string;
  phone?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id?: number;
  name: string;
  code: string;
  description?: string;
  created_at?: string;
}

export interface PriceVersion {
  id?: number;
  category_id: number;
  price: number;
  effective_date: string;
  version?: number;
  created_by?: string;
  created_at?: string;
}

export interface DeductionRatio {
  id?: number;
  category_id: number;
  ratio: number;
  effective_date?: string;
  description?: string;
}

export interface WeighingRecord {
  id?: number;
  record_no: string;
  customer_id: number;
  category_id: number;
  gross_weight: number;
  tare_weight: number;
  net_weight?: number;
  status?: 'pending' | 'verified' | 'priced' | 'settled';
  price_version_id?: number;
  deduction_ratio?: number;
  operator?: string;
  weigh_time?: string;
  confirmed_time?: string;
  settled_time?: string;
  created_at?: string;
  updated_at?: string;
}

export interface WeightVerification {
  id?: number;
  weighing_record_id: number;
  gross_weight: number;
  tare_weight: number;
  verifier: string;
  verification_time?: string;
  remark?: string;
}

export interface SettlementReport {
  id?: number;
  report_no: string;
  customer_id: number;
  start_date: string;
  end_date: string;
  total_amount: number;
  status?: 'draft' | 'confirmed';
  generated_by?: string;
  generated_at?: string;
  confirmed_at?: string;
}

export interface SettlementItem {
  id?: number;
  report_id: number;
  weighing_record_id: number;
  net_weight: number;
  unit_price: number;
  amount: number;
}

export interface ExceptionRecord {
  id?: number;
  record_no?: string;
  type: string;
  original_input: string;
  error_message?: string;
  handled?: boolean;
  handled_by?: string;
  handled_at?: string;
  conclusion?: string;
  created_at?: string;
}

export interface ManualCorrection {
  id?: number;
  weighing_record_id: number;
  field_name: string;
  old_value?: string;
  new_value?: string;
  reason: string;
  operator: string;
  created_at?: string;
}
