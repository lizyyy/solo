export enum PriceListStatus {
  DRAFT = 'draft',
  PENDING_EFFECTIVE = 'pending_effective',
  EFFECTIVE = 'effective',
  ROLLED_BACK = 'rolled_back'
}

export enum StorePriceStatus {
  PENDING = 'pending',
  CONFLICT = 'conflict',
  EFFECTIVE = 'effective'
}

export interface Store {
  id: string;
  code: string;
  name: string;
  region?: string;
  status: string;
  created_at: string;
}

export interface PriceList {
  id: string;
  version: string;
  name: string;
  description?: string;
  status: PriceListStatus;
  effective_time?: string;
  approver_id?: string;
  approver_name?: string;
  approved_at?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface PriceListStore {
  id: string;
  price_list_id: string;
  store_id: string;
  store_code: string;
  store_name: string;
  status: StorePriceStatus;
  conflict_reason?: string;
  created_at: string;
}

export interface PriceListItem {
  id: string;
  price_list_id: string;
  sku_code: string;
  sku_name: string;
  original_price: number;
  sale_price: number;
  created_at: string;
}

export interface PriceListHistory {
  id: string;
  price_list_id: string;
  action: string;
  action_by: string;
  action_by_name: string;
  remark?: string;
  old_status?: string;
  new_status?: string;
  created_at: string;
}

export interface CreatePriceListRequest {
  name: string;
  description?: string;
  effective_time?: string;
  store_ids: string[];
  items: Array<{
    sku_code: string;
    sku_name: string;
    original_price: number;
    sale_price: number;
  }>;
  created_by: string;
  created_by_name: string;
}

export interface UpdatePriceListRequest {
  name?: string;
  description?: string;
  effective_time?: string;
  store_ids?: string[];
  items?: Array<{
    sku_code: string;
    sku_name: string;
    original_price: number;
    sale_price: number;
  }>;
}

export interface ApproveRequest {
  approver_id: string;
  approver_name: string;
  remark?: string;
}

export interface ConflictInfo {
  store_code: string;
  store_name: string;
  conflict_reason: string;
  required_materials: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  next_steps?: string[];
  conflicts?: ConflictInfo[];
}
