export interface Store {
  id: string;
  name: string;
}

export interface Product {
  sku: string;
  name: string;
  category?: string;
  unit?: string;
  base_price: number;
}

export interface StorePrice {
  id?: string;
  store_id: string;
  sku: string;
  price: number;
  effective_from?: string;
  effective_to?: string;
}

export interface Promotion {
  id: string;
  sku: string;
  promotion_name: string;
  promotion_type: string;
  discount_value: number;
  effective_from: string;
  effective_to: string;
  priority: number;
}

export interface TagPrintRecord {
  id: string;
  store_id: string;
  sku: string;
  print_version: string;
  printed_price: number;
  printed_at: string;
  printed_by?: string;
  hash: string;
}

export interface TagScan {
  id: string;
  store_id: string;
  sku: string;
  scan_version: string;
  scanned_price: number;
  scanned_at: string;
  scanned_by?: string;
  tag_id?: string;
  hash: string;
}

export type CheckStatus = 
  | 'PASS'
  | 'MUST_REPRINT'
  | 'CAN_CONTINUE'
  | 'NEEDS_MANUAL_CHECK'
  | 'MANUALLY_APPROVED'
  | 'MANUALLY_REJECTED';

export interface CheckResult {
  id: string;
  scan_id: string;
  store_id: string;
  sku: string;
  status: CheckStatus;
  system_price: number;
  store_price?: number | null;
  printed_price: number;
  scanned_price: number;
  effective_promotion_id?: string;
  check_time: string;
}

export type IssueType = 'PRICE' | 'PROMOTION' | 'VERSION' | 'TIME' | 'DUPLICATE';
export type IssueSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface CheckIssue {
  id?: string;
  check_result_id: string;
  issue_type: IssueType;
  issue_code: string;
  issue_message: string;
  severity: IssueSeverity;
}

export interface ManualCorrection {
  id?: string;
  check_result_id: string;
  corrected_by: string;
  old_status: CheckStatus;
  new_status: CheckStatus;
  comment?: string;
  diff_json: string;
  created_at?: string;
}

export interface StatusHistory {
  id?: string;
  check_result_id: string;
  from_status?: CheckStatus;
  to_status: CheckStatus;
  reason?: string;
  operator?: string;
  created_at?: string;
}

export interface ImportData {
  stores?: Store[];
  products?: Product[];
  store_prices?: StorePrice[];
  promotions?: Promotion[];
  tag_print_records?: TagPrintRecord[];
  tag_scans?: TagScan[];
}
