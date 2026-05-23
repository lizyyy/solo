export interface Equipment {
  id: string;
  name: string;
  category: string;
  model?: string;
  serial_number?: string;
  status: 'available' | 'rented' | 'maintenance' | 'damaged';
  deposit_amount: number;
  daily_rate: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Accessory {
  id: string;
  equipment_id: string;
  name: string;
  quantity: number;
  status: 'good' | 'damaged' | 'missing';
}

export interface RentalOrder {
  id: string;
  order_no: string;
  equipment_id: string;
  borrower_name: string;
  borrower_phone?: string;
  borrower_id?: string;
  expected_start_date: string;
  expected_end_date: string;
  actual_start_date?: string;
  actual_end_date?: string;
  deposit_paid: number;
  status: 'pending' | 'confirmed' | 'active' | 'returned' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface RentalAccessory {
  id: string;
  rental_order_id: string;
  accessory_id: string;
  expected_quantity: number;
  returned_quantity: number;
  status: 'pending' | 'returned' | 'missing' | 'damaged';
}

export interface ReturnInspection {
  id: string;
  rental_order_id: string;
  inspector_name: string;
  inspection_date: string;
  has_scratches: boolean;
  scratches_description?: string;
  has_damage: boolean;
  damage_description?: string;
  accessories_complete: boolean;
  accessories_notes?: string;
  overall_condition: 'excellent' | 'good' | 'fair' | 'poor';
  conclusion: string;
  status: 'pending' | 'reviewed' | 'approved';
  created_at: string;
}

export interface DepositDeduction {
  id: string;
  rental_order_id: string;
  inspection_id?: string;
  amount: number;
  reason: string;
  requested_by: string;
  requested_at: string;
  approved_by?: string;
  approved_at?: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
}

export interface ExceptionLog {
  id: string;
  operation_type: string;
  original_input: string;
  error_message?: string;
  processing_conclusion?: string;
  handled_by?: string;
  handled_at?: string;
  created_at: string;
  status: 'pending' | 'handled' | 'dismissed';
}

export interface ManualCorrection {
  id: string;
  rental_order_id?: string;
  correction_type: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  reason: string;
  corrected_by: string;
  corrected_at: string;
}

export interface RentalReport {
  order_no: string;
  equipment_name: string;
  borrower_name: string;
  rental_period: string;
  actual_days: number;
  rental_fee: number;
  overdue_days: number;
  overdue_fee: number;
  deposit_paid: number;
  deductions: number;
  deposit_refund: number;
  inspection_result: string;
  status: string;
}

export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
};
