export type ServiceOrderStatus = 'pending' | 'completed' | 'cancelled';
export type ReconciliationStatus = 'matched' | 'discrepancy' | 'reviewing' | 'approved' | 'rejected' | 'supplement';
export type DiscrepancyType = 
  | 'nurse_mismatch'
  | 'skill_mismatch'
  | 'time_mismatch'
  | 'service_mismatch'
  | 'cancelled_without_notice'
  | 'cross_region'
  | 'duplicate_order'
  | 'missing_record'
  | 'other';

export interface ElderProfile {
  id: string;
  name: string;
  idCard: string;
  phone: string;
  address: string;
  district: string;
  serviceItems: string[];
  careLevel: string;
  createdAt: Date;
}

export interface NurseSchedule {
  nurseId: string;
  nurseName: string;
  skills: string[];
  district: string;
  date: string;
  timeSlots: TimeSlot[];
}

export interface TimeSlot {
  start: string;
  end: string;
  elderId?: string;
  elderName?: string;
  serviceType?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  cancelReason?: string;
  substituteNurseId?: string;
  substituteNurseName?: string;
}

export interface ServiceOrder {
  id: string;
  orderNo: string;
  elderId: string;
  elderName: string;
  nurseId: string;
  nurseName: string;
  serviceDate: string;
  serviceTime: string;
  serviceItems: string[];
  actualDuration: number;
  status: ServiceOrderStatus;
  cancelReason?: string;
  createdAt: Date;
  signedBy?: string;
  signatureImage?: string;
}

export interface Discrepancy {
  id: string;
  type: DiscrepancyType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  explanation: string;
  field?: string;
  expectedValue?: string;
  actualValue?: string;
  source: 'schedule' | 'order' | 'profile';
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  operator: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  remark?: string;
}

export interface ReconciliationRecord {
  id: string;
  batchId: string;
  serviceOrderId: string;
  serviceOrder: ServiceOrder;
  matchedSchedule?: NurseSchedule;
  matchedTimeSlot?: TimeSlot;
  elderProfile: ElderProfile;
  status: ReconciliationStatus;
  discrepancies: Discrepancy[];
  auditLogs: AuditLog[];
  reviewer?: string;
  reviewRemark?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReconciliationBatch {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  totalRecords: number;
  matchedCount: number;
  discrepancyCount: number;
  reviewingCount: number;
  approvedCount: number;
  rejectedCount: number;
  supplementCount: number;
  status: 'processing' | 'completed' | 'archived';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
  totalCount: number;
  validCount: number;
}

export interface ReportSummary {
  batchId: string;
  batchName: string;
  periodStart: string;
  periodEnd: string;
  totalOrders: number;
  totalAmount: number;
  matchedRate: number;
  statusBreakdown: Record<ReconciliationStatus, number>;
  discrepancyBreakdown: Record<DiscrepancyType, number>;
  generatedAt: Date;
}

export interface ReportDetail {
  recordId: string;
  orderNo: string;
  elderName: string;
  nurseName: string;
  serviceDate: string;
  serviceItems: string[];
  status: ReconciliationStatus;
  discrepancies: Discrepancy[];
  reviewRemark?: string;
  traceability: TraceabilityLink[];
}

export interface TraceabilityLink {
  level: string;
  source: string;
  data: string;
  timestamp: Date;
}
