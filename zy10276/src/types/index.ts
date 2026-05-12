export type ViolationStatus = 
  | 'imported' 
  | 'matched' 
  | 'pending_confirmation' 
  | 'confirmed' 
  | 'appealing' 
  | 'appeal_approved' 
  | 'appeal_rejected' 
  | 'penalized'
  | 'rolled_back';

export type ViolationType = 
  | 'speeding' 
  | 'red_light' 
  | 'wrong_parking' 
  | 'lane_violation' 
  | 'overload' 
  | 'other';

export interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  phone: string;
  totalPoints: number;
  remainingPoints: number;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  vehicleType: string;
  brand: string;
}

export interface Shift {
  id: string;
  vehicleId: string;
  driverId: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

export interface ViolationRecord {
  id: string;
  violationNumber: string;
  plateNumber: string;
  vehicleId?: string;
  violationTime: string;
  violationType: ViolationType;
  location: string;
  description: string;
  points: number;
  fineAmount: number;
  status: ViolationStatus;
  matchedShiftId?: string;
  matchedDriverId?: string;
  importBatchId: string;
  importedAt: string;
  importedBy: string;
}

export interface ProcessingHistory {
  id: string;
  violationId: string;
  action: string;
  operator: string;
  operatorId: string;
  timestamp: string;
  remarks?: string;
  oldStatus?: ViolationStatus;
  newStatus?: ViolationStatus;
  changes?: Record<string, { old: any; new: any }>;
}

export interface Appeal {
  id: string;
  violationId: string;
  driverId: string;
  reason: string;
  materials: AppealMaterial[];
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface AppealMaterial {
  id: string;
  name: string;
  type: string;
  uploadTime: string;
  fileKey: string;
}

export interface Penalty {
  id: string;
  violationId: string;
  driverId: string;
  pointsDeducted: number;
  fineAmount: number;
  appliedAt: string;
  isRolledBack: boolean;
  rolledBackAt?: string;
  rollbackReason?: string;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  importedAt: string;
  importedBy: string;
  totalRecords: number;
  successfulRecords: number;
  duplicateRecords: number;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface ViolationFilterParams {
  plateNumber?: string;
  driverName?: string;
  status?: ViolationStatus;
  violationType?: ViolationType;
  startDate?: string;
  endDate?: string;
}
