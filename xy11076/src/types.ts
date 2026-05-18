export interface Customer {
  customer_id: string;
  name: string;
  phone: string;
  id_card: string;
  credit_score: number;
  total_rentals: number;
  overdue_times: number;
  created_at: string;
}

export interface Equipment {
  equipment_id: string;
  type: 'camera_body' | 'lens' | 'accessory';
  brand: string;
  model: string;
  serial_number: string;
  purchase_price: number;
  daily_rental_price: number;
  deposit: number;
  status: 'available' | 'rented' | 'maintenance' | 'damaged';
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  last_maintenance_date?: string;
  created_at: string;
}

export interface RentalOrder {
  order_id: string;
  customer_id: string;
  rental_start_date: string;
  expected_return_date: string;
  actual_return_date?: string;
  total_amount: number;
  deposit_paid: number;
  status: 'active' | 'completed' | 'overdue' | 'cancelled';
  pickup_location: string;
  return_location: string;
  staff_name: string;
  notes?: string;
  created_at: string;
}

export interface RentalItem {
  item_id: string;
  order_id: string;
  equipment_id: string;
  daily_price: number;
  quantity: number;
  actual_return_date?: string;
  return_condition?: string;
  return_staff?: string;
  created_at: string;
}

export interface OverdueBill {
  bill_id: string;
  order_id: string;
  customer_id: string;
  overdue_days: number;
  overdue_amount: number;
  equipment_ids: string;
  status: 'pending' | 'paid' | 'waived' | 'disputed';
  review_status: 'pending' | 'needs_review' | 'approved' | 'rejected';
  review_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: string;
  suggestion?: string;
}

export interface ReturnEquipmentRequest {
  order_id: string;
  equipment_id: string;
  return_condition: string;
  return_staff: string;
  actual_return_date?: string;
}
