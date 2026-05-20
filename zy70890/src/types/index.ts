export enum ObjectLevel {
  LEVEL_A = 'A',
  LEVEL_B = 'B',
  LEVEL_C = 'C'
}

export enum AttendanceStatus {
  NORMAL = 'normal',
  LATE = 'late',
  ABSENT = 'absent',
  LEAVE = 'leave',
  EXCEPTION = 'exception'
}

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  NEED_SUPPLEMENT = 'need_supplement'
}

export enum DifferenceType {
  TIMEOUT_NO_SIGN = 'timeout_no_sign',
  LEAVE_OVERLAP = 'leave_overlap',
  TRACE_GAP = 'trace_gap',
  LOCATION_ANOMALY = 'location_anomaly',
  MANUAL_CORRECTION = 'manual_correction'
}

export enum LeaveType {
  PERSONAL = 'personal',
  SICK = 'sick',
  WORK = 'work',
  OTHER = 'other'
}

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Person {
  id: string;
  name: string;
  idCard: string;
  level: ObjectLevel;
  department: string;
  manager: string;
}

export interface AttendanceRecord extends BaseEntity {
  personId: string;
  personName: string;
  date: string;
  signInTime?: string;
  signOutTime?: string;
  expectedSignInTime: string;
  expectedSignOutTime: string;
  status: AttendanceStatus;
  source: string;
  location?: string;
  remark?: string;
}

export interface LeaveRecord extends BaseEntity {
  personId: string;
  personName: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  reason: string;
  status: LeaveStatus;
  approver?: string;
  approveTime?: string;
  source: string;
}

export interface LocationTrace extends BaseEntity {
  personId: string;
  personName: string;
  date: string;
  tracePoints: TracePoint[];
  totalDistance?: number;
  anomalyCount: number;
  isComplete: boolean;
  source: string;
}

export interface TracePoint {
  timestamp: string;
  latitude: number;
  longitude: number;
  location: string;
  accuracy?: number;
  isAnomaly: boolean;
  anomalyReason?: string;
}

export interface DifferenceDetail {
  type: DifferenceType;
  description: string;
  source: string;
  evidence?: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ReconciliationRecord extends BaseEntity {
  reconciliationId: string;
  personId: string;
  personName: string;
  personLevel: ObjectLevel;
  date: string;
  attendance?: AttendanceRecord;
  leave?: LeaveRecord;
  locationTrace?: LocationTrace;
  differences: DifferenceDetail[];
  finalStatus: AttendanceStatus;
  reviewStatus: ReviewStatus;
  reviewComment?: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewTime?: Date;
  isManualCorrected: boolean;
  correctionReason?: string;
  correctionOperatorId?: string;
  correctionOperatorName?: string;
  correctionTime?: Date;
}

export interface ReconciliationSummary {
  totalRecords: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  needSupplement: number;
  totalDifferences: number;
  timeoutNoSign: number;
  leaveOverlap: number;
  traceGap: number;
  locationAnomaly: number;
  manualCorrection: number;
  levelABnormal: number;
  levelBBnormal: number;
  levelCBnormal: number;
}

export interface ImportResult<T> {
  success: boolean;
  totalCount: number;
  successCount: number;
  failedCount: number;
  errors: string[];
  data: T[];
}

export interface ReviewRequest {
  reconciliationId: string;
  recordIds: string[];
  status: ReviewStatus;
  comment: string;
  operatorId: string;
  operatorName: string;
}

export interface ManualCorrectionRequest {
  reconciliationId: string;
  recordId: string;
  newStatus: AttendanceStatus;
  reason: string;
  operatorId: string;
  operatorName: string;
}
