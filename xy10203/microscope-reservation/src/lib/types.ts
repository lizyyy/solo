export type ReservationStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';

export interface Microscope {
  id: string;
  name: string;
  model?: string;
  location?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  is_active: number;
}

export interface Accessory {
  id: string;
  microscope_id: string;
  name: string;
  type: 'magnification' | 'sample_stage' | 'other';
  description?: string;
  created_at: string;
  updated_at: string;
  is_active: number;
}

export interface ResearchGroup {
  id: string;
  name: string;
  leader?: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  group_id?: string;
  role: 'user' | 'admin' | 'approver';
  created_at: string;
}

export interface Reservation {
  id: string;
  microscope_id: string;
  user_id: string;
  group_id: string;
  start_time: string;
  end_time: string;
  purpose: string;
  status: ReservationStatus;
  created_at: string;
  updated_at: string;
  submitted_at?: string;
  approved_at?: string;
  rejected_at?: string;
  cancelled_at?: string;
  approved_by?: string;
  rejection_reason?: string;
}

export interface ReservationWithDetails extends Reservation {
  microscope_name: string;
  user_name: string;
  group_name: string;
  accessories: Accessory[];
}

export interface ReservationAccessory {
  id: string;
  reservation_id: string;
  accessory_id: string;
  created_at: string;
}

export interface OperationLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values?: string;
  new_values?: string;
  user_id?: string;
  timestamp: string;
  note?: string;
}

export interface ConflictDetail {
  type: 'microscope' | 'accessory';
  resourceId: string;
  resourceName: string;
  conflictingReservationId: string;
  conflictingReservationTitle: string;
  overlappingTime: { start: string; end: string };
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts: ConflictDetail[];
}
