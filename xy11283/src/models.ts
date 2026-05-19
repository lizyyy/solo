export interface Medicine {
  id?: number;
  code: string;
  name: string;
  generic_name?: string;
  manufacturer?: string;
  specification?: string;
  unit: string;
  dosage_form?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryBatch {
  id?: number;
  medicine_id: number;
  batch_number: string;
  quantity: number;
  unit: string;
  manufacture_date?: string;
  expiry_date?: string;
  location?: string;
  status?: string;
  created_at?: string;
}

export interface DosageRule {
  id?: number;
  medicine_id: number;
  species: string;
  min_weight?: number;
  max_weight?: number;
  min_dosage: number;
  max_dosage: number;
  dosage_unit: string;
  dosage_per_kg?: number;
  frequency?: string;
  route?: string;
  notes?: string;
  created_at?: string;
}

export interface Prescription {
  id?: number;
  prescription_no: string;
  patient_id: string;
  patient_name: string;
  species: string;
  breed?: string;
  weight: number;
  weight_unit?: string;
  age?: string;
  doctor_id: string;
  doctor_name: string;
  diagnosis?: string;
  status?: string;
  total_amount?: number;
  issued_at?: string;
  created_at?: string;
}

export interface PrescriptionItem {
  id?: number;
  prescription_id: number;
  medicine_id: number;
  batch_id?: number;
  dosage: number;
  dosage_unit: string;
  quantity: number;
  quantity_unit: string;
  frequency?: string;
  route?: string;
  days?: number;
  notes?: string;
  calculated_dosage?: number;
  dosage_warning?: string;
  status?: string;
}

export interface BadRecord {
  id?: number;
  source_type: string;
  source_file?: string;
  row_number?: number;
  original_data: string;
  error_type: string;
  error_message: string;
  suggestion?: string;
  status?: string;
  corrected_data?: string;
  created_at?: string;
  resolved_at?: string;
}

export interface AuditLog {
  id?: number;
  entity_type: string;
  entity_id?: number;
  action: string;
  old_value?: string;
  new_value?: string;
  operator_id?: string;
  operator_name?: string;
  ip_address?: string;
  created_at?: string;
}

export interface StockMovement {
  id?: number;
  batch_id: number;
  prescription_item_id?: number;
  movement_type: string;
  quantity: number;
  unit: string;
  reference_no?: string;
  notes?: string;
  operator_id?: string;
  created_at?: string;
}

export interface DosageCalculationResult {
  valid: boolean;
  calculatedDosage?: number;
  warning?: string;
  error?: string;
  rule?: DosageRule;
}

export interface ImportResult {
  success: number;
  failed: number;
  total: number;
  badRecords: BadRecord[];
}

export type PrescriptionStatus = 'pending' | 'validated' | 'dispensed' | 'cancelled';
export type MovementType = 'in' | 'out' | 'adjust' | 'return';
export type BadRecordStatus = 'pending' | 'resolved' | 'ignored';
