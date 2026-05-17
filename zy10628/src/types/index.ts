export enum ShiftSwapStatus {
  PENDING_CONFIRM = 'pending_confirm',
  SWAPPED = 'swapped',
  CONFLICT_PENDING = 'conflict_pending',
  COMPLETED = 'completed'
}

export enum SwapReason {
  PERSONAL_AFFAIR = 'personal_affair',
  SICK_LEAVE = 'sick_leave',
  EMERGENCY = 'emergency',
  OTHER = 'other'
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  licenseNumber: string;
  licenseType: string;
  status: 'active' | 'inactive' | 'on_leave';
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  vehicleType: string;
  capacity: number;
  status: 'available' | 'in_use' | 'maintenance';
  createdAt: string;
  updatedAt: string;
}

export interface Shift {
  id: string;
  driverId: string;
  vehicleId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  route: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface ShiftSwap {
  id: string;
  originalShiftId: string;
  originalDriverId: string;
  newDriverId: string;
  swapReason: SwapReason;
  reasonDetail?: string;
  status: ShiftSwapStatus;
  conflictReason?: string;
  confirmedById?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftSwapHistory {
  id: string;
  swapId: string;
  previousStatus: ShiftSwapStatus;
  newStatus: ShiftSwapStatus;
  changedBy: string;
  changeReason?: string;
  changedAt: string;
}

export interface ValidationResult {
  rowNumber?: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    nextAction?: string;
  };
}
