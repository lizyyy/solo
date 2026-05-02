export type OrderStatus = '待检测' | '待报价' | '维修中' | '待取机' | '已完成' | '已取消';

export interface Technician {
  id: number;
  name: string;
  phone?: string;
  created_at: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  created_at: string;
}

export interface Device {
  id: number;
  customer_id: number;
  brand: string;
  model: string;
  imei?: string;
  created_at: string;
}

export interface StatusHistory {
  id: number;
  order_id: number;
  old_status?: OrderStatus;
  new_status: OrderStatus;
  changed_by?: string;
  changed_at: string;
  note?: string;
  changed_by_name?: string;
}

export interface Note {
  id: number;
  order_id: number;
  content: string;
  created_by?: string;
  created_at: string;
  created_by_name?: string;
}

export interface Order {
  id: number;
  customer_id: number;
  device_id: number;
  technician_id?: number;
  fault_description: string;
  quote?: number;
  estimated_completion_time?: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_phone: string;
  device_brand: string;
  device_model: string;
  device_imei?: string;
  technician_name?: string;
  status_history?: StatusHistory[];
  notes?: Note[];
}

export interface CreateOrderRequest {
  customer_name: string;
  customer_phone: string;
  device_brand: string;
  device_model: string;
  device_imei?: string;
  technician_id?: number;
  fault_description: string;
  quote?: number;
  estimated_completion_time?: string;
  status?: OrderStatus;
}

export interface UpdateOrderRequest {
  customer_name?: string;
  customer_phone?: string;
  device_brand?: string;
  device_model?: string;
  device_imei?: string;
  technician_id?: number | null;
  fault_description?: string;
  quote?: number | null;
  estimated_completion_time?: string | null;
  status?: OrderStatus;
  note?: string;
}

export interface ApiError {
  error: string;
}
