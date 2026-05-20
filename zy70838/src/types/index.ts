export type RecordStatus = 'normal' | 'abnormal' | 'pending' | 'confirmed';

export type DiscrepancyType = 
  | 'overdue_return' 
  | 'fuel_card_balance' 
  | 'violation_ownership'
  | 'key_missing'
  | 'mileage_abnormal';

export type ReviewAction = 'confirm' | 'adjust' | 'dismiss';

export interface KeyBorrowRecord {
  id: string;
  recordId: string;
  vehicleId: string;
  vehiclePlate: string;
  borrower: string;
  borrowerDepartment: string;
  borrowTime: Date;
  expectedReturnTime: Date;
  actualReturnTime?: Date;
  borrowMileage: number;
  returnMileage?: number;
  fuelCardId?: string;
  fuelBalanceBefore: number;
  fuelBalanceAfter?: number;
  status: RecordStatus;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VehicleInfo {
  id: string;
  vehicleId: string;
  plateNumber: string;
  brand: string;
  model: string;
  color: string;
  vin: string;
  currentMileage: number;
  fuelCardId: string;
  fuelCardBalance: number;
  keyCount: number;
  status: 'available' | 'borrowed' | 'maintenance';
  assignedSalesperson?: string;
  purchaseDate: Date;
  remarks?: string;
}

export interface ViolationRecord {
  id: string;
  violationId: string;
  vehiclePlate: string;
  vehicleId?: string;
  violationTime: Date;
  violationType: string;
  violationLocation: string;
  points: number;
  fineAmount: number;
  status: 'unprocessed' | 'processed' | 'disputed';
  driverName?: string;
  driverId?: string;
  processedTime?: Date;
  remarks?: string;
  source: 'traffic_bureau' | 'manual';
}

export interface Discrepancy {
  id: string;
  type: DiscrepancyType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  sourceRecordId: string;
  sourceRecordType: 'borrow' | 'vehicle' | 'violation';
  relatedRecordIds: string[];
  status: 'open' | 'reviewed' | 'resolved';
  detectedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  resolution?: string;
  evidence: {
    field: string;
    expected: any;
    actual: any;
    difference: any;
  }[];
}

export interface ReviewRecord {
  id: string;
  reconciliationId: string;
  discrepancyId: string;
  action: ReviewAction;
  reviewer: string;
  reviewTime: Date;
  comments: string;
  adjustments?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

export interface ReconciliationResult {
  id: string;
  reconciliationId: string;
  period: {
    start: Date;
    end: Date;
  };
  status: 'draft' | 'reviewing' | 'finalized';
  summary: {
    totalBorrowRecords: number;
    overdueReturns: number;
    totalVehicles: number;
    fuelCardAbnormalities: number;
    totalViolations: number;
    unassignedViolations: number;
    totalDiscrepancies: number;
    resolvedDiscrepancies: number;
    totalFineAmount: number;
  };
  discrepancies: string[];
  reviews: string[];
  generatedAt: Date;
  generatedBy: string;
  finalizedAt?: Date;
  finalizedBy?: string;
}

export interface TraceLink {
  id: string;
  recordId: string;
  recordType: 'borrow' | 'vehicle' | 'violation' | 'discrepancy' | 'review' | 'report';
  timestamp: Date;
  action: string;
  operator?: string;
  details: any;
  nextLinks?: string[];
  prevLinks?: string[];
}

export interface ImportResult<T> {
  success: boolean;
  total: number;
  imported: number;
  failed: number;
  errors: { row: number; message: string }[];
  data: T[];
}
