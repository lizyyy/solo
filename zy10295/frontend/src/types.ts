export type TireStatus = 
  | 'in_stock'
  | 'installed'
  | 'removed'
  | 'inspecting'
  | 'inspection_passed'
  | 'inspection_failed'
  | 'retreading'
  | 'retread_completed'
  | 'scrapped';

export type EventType =
  | 'install'
  | 'remove'
  | 'inspect'
  | 'send_retread'
  | 'complete_retread'
  | 'scrap';

export interface Vehicle {
  id: string;
  plate_number: string;
  model: string;
  tire_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Tire {
  id: string;
  serial_number: string;
  brand: string;
  model: string;
  size: string;
  initial_install_date: string | null;
  current_status: TireStatus;
  current_vehicle_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TireEvent {
  id: string;
  tire_id: string;
  event_type: EventType;
  vehicle_id: string | null;
  reason: string | null;
  inspection_result: string | null;
  inspection_notes: string | null;
  cost: number | null;
  cost_notes: string | null;
  performed_by: string | null;
  performed_at: string;
  notes: string | null;
  created_at: string;
}

export interface TireLifecycleDetail {
  tire: Tire;
  events: TireEvent[];
  totalCost: number;
  costBreakdown: { type: string; amount: number }[];
}

export interface VehicleAvailability {
  vehicle: Vehicle;
  installedTires: Tire[];
  missingTireCount: number;
  isAvailable: boolean;
  issues: string[];
}

export const STATUS_LABELS: Record<TireStatus, string> = {
  in_stock: '在库',
  installed: '已装车',
  removed: '已拆下',
  inspecting: '检测中',
  inspection_passed: '检测通过',
  inspection_failed: '检测未通过',
  retreading: '翻新中',
  retread_completed: '翻新完成',
  scrapped: '已报废',
};

export const STATUS_COLORS: Record<TireStatus, string> = {
  in_stock: '#10b981',
  installed: '#3b82f6',
  removed: '#f59e0b',
  inspecting: '#8b5cf6',
  inspection_passed: '#10b981',
  inspection_failed: '#ef4444',
  retreading: '#f59e0b',
  retread_completed: '#10b981',
  scrapped: '#6b7280',
};

export const EVENT_LABELS: Record<EventType, string> = {
  install: '装车',
  remove: '拆下',
  inspect: '检测',
  send_retread: '送翻新',
  complete_retread: '完成翻新',
  scrap: '报废',
};
