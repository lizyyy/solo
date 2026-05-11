export interface CourierCompany {
  id: number;
  name: string;
  code: string;
  delivery_fee: number;
  return_fee: number;
  storage_fee_per_day: number;
  created_at: string;
}

export interface RetentionRule {
  id: number;
  courier_company_id: number | null;
  courier_company_name?: string;
  free_days: number;
  storage_fee_per_day: number;
  is_global: boolean;
  created_at: string;
}

export type PackageStatus = 'pending' | 'delivered' | 'returned';

export interface Package {
  id: number;
  tracking_number: string;
  courier_company_id: number;
  courier_company_name?: string;
  courier_company_code?: string;
  recipient_name: string;
  recipient_phone: string;
  status: PackageStatus;
  scan_time: string;
  delivery_time?: string;
  return_time?: string;
  retention_days: number;
  total_fee: number;
  delivery_fee: number;
  return_fee: number;
  storage_fee: number;
  notes?: string;
  created_at: string;
}

export type SettlementStatus = 'draft' | 'confirmed';

export interface Settlement {
  id: number;
  courier_company_id: number;
  courier_company_name?: string;
  start_date: string;
  end_date: string;
  total_packages: number;
  total_fee: number;
  delivery_fee_total: number;
  return_fee_total: number;
  storage_fee_total: number;
  pending_count: number;
  delivered_count: number;
  returned_count: number;
  status: SettlementStatus;
  created_at: string;
}

export interface PackageStats {
  total: number;
  pending: number;
  delivered: number;
  returned: number;
  total_fee: number;
  delivery_fee_total: number;
  return_fee_total: number;
  storage_fee_total: number;
}

export interface SettlementStats {
  total: number;
  draft: number;
  confirmed: number;
  total_fee: number;
}

export interface ImportResult {
  success: boolean;
  successCount: number;
  errorCount: number;
  totalCount: number;
  errors: Array<{ row: number; error: string }>;
}
