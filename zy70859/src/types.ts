export type MaterialStatus = 'pending' | 'normal' | 'needs_supplement' | 'blocked';

export interface Batch {
  id: string;
  batch_number: string;
  created_by: string;
  created_at: string;
  status: string;
  description?: string;
  total_materials: number;
}

export interface Material {
  id: string;
  batch_id: string;
  document_number: string;
  case_number?: string;
  document_type?: string;
  borrower?: string;
  borrow_date?: string;
  return_date?: string;
  original_data: string;
  status: MaterialStatus;
  status_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface ProcessingTrail {
  id: string;
  material_id: string;
  previous_status?: string;
  new_status: string;
  status_reason?: string;
  processed_by: string;
  processed_at: string;
  note?: string;
}

export interface AuditLog {
  id: string;
  material_id: string;
  field_name: string;
  old_value?: string;
  new_value: string;
  modified_by: string;
  modified_at: string;
  change_reason: string;
}

export interface ClassificationResult {
  status: MaterialStatus;
  reason: string;
  followUpAction: string;
}
