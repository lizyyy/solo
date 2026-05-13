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

export interface TireCost {
  id: string;
  tire_id: string;
  event_id: string;
  cost_type: string;
  amount: number;
  description: string | null;
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
