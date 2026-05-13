export interface Supplier {
  id: string;
  code: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SampleBatch {
  id: string;
  batch_no: string;
  supplier_id: string;
  product_name: string;
  sample_type?: string;
  quantity?: number;
  receive_date?: string;
  status?: 'pending' | 'reviewing' | 'finalized';
  version?: string;
  supplier_name?: string;
  supplier_code?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReviewScore {
  id: string;
  batch_id: string;
  reviewer: string;
  review_date: string;
  appearance_score?: number;
  quality_score?: number;
  function_score?: number;
  packaging_score?: number;
  total_score?: number;
  comments?: string;
  result?: 'pending' | 'pass' | 'fail';
  version?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RectificationOpinion {
  id: string;
  batch_id: string;
  item: string;
  description?: string;
  requirement?: string;
  deadline?: string;
  responsible_person?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  created_at?: string;
  updated_at?: string;
}

export interface ReshipLogistics {
  id: string;
  batch_id: string;
  tracking_no?: string;
  courier_company?: string;
  ship_date?: string;
  receive_date?: string;
  status?: 'transit' | 'received';
  remarks?: string;
  created_at?: string;
}

export interface VersionFinalization {
  id: string;
  batch_id: string;
  final_version: string;
  finalizer: string;
  finalize_date: string;
  remarks?: string;
  created_at?: string;
}

export interface ChangeLog {
  id: string;
  table_name: string;
  record_id: string;
  field_name: string;
  old_value: string;
  new_value: string;
  changed_by: string;
  changed_at: string;
}

export interface Statistics {
  totalBatches: number;
  pending: number;
  reviewing: number;
  finalized: number;
  avgScore: number;
}
