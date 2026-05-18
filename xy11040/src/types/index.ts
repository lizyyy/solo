export enum ProcessingOrderStatus {
  PENDING = 'pending',
  IN_PRODUCTION = 'in_production',
  QUALITY_CHECK = 'quality_check',
  COMPLETED = 'completed',
  REWORK_REQUESTED = 'rework_requested',
  CANCELLED = 'cancelled'
}

export enum ReworkStatus {
  SUBMITTED = 'submitted',
  REVIEWING = 'reviewing',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  IN_REWORK = 'in_rework',
  REWORK_COMPLETED = 'rework_completed',
  FINAL_INSPECTION = 'final_inspection',
  CLOSED = 'closed'
}

export enum ReworkReason {
  AXIS_WRONG = 'axis_wrong',
  POWER_INCORRECT = 'power_incorrect',
  COATING_ISSUE = 'coating_issue',
  EDGE_QUALITY = 'edge_quality',
  SURFACE_DEFECT = 'surface_defect',
  CENTERING_ERROR = 'centering_error',
  SIZE_MISMATCH = 'size_mismatch',
  OTHER = 'other'
}

export interface LensPrescription {
  sphere: number;
  cylinder: number;
  axis: number;
  add?: number;
  prism?: number;
  prismBase?: string;
}

export interface LensSpecification {
  material: string;
  index: number;
  coating: string[];
  design: string;
  diameter?: number;
  thickness?: number;
}

export interface SubmissionMeta {
  source: string;
  submittedAt: Date;
  submittedBy: string;
  userRole: string;
}

export interface ProcessingOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  frameModel: string;
  frameColor: string;
  odPrescription: LensPrescription;
  osPrescription: LensPrescription;
  lensSpec: LensSpecification;
  status: ProcessingOrderStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  assignedTechnician?: string;
  expectedDelivery?: Date;
  notes?: string;
  reworkCount: number;
  auditTrail: AuditEntry[];
}

export interface ReworkItem {
  eye: 'OD' | 'OS' | 'BOTH';
  reason: ReworkReason;
  description: string;
  originalAxis?: number;
  correctedAxis?: number;
  originalPower?: number;
  correctedPower?: number;
}

export interface ReworkReport {
  id: string;
  processingOrderId: string;
  processingOrderNumber: string;
  reporter: string;
  reporterRole: string;
  reportedAt: Date;
  reworkItems: ReworkItem[];
  rootCause?: string;
  correctiveAction?: string;
  status: ReworkStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewComments?: string;
  assignedTo?: string;
  startedAt?: Date;
  completedAt?: Date;
  inspectionResult?: 'pass' | 'fail';
  inspectedBy?: string;
  inspectedAt?: Date;
  updatedPrescription?: {
    od?: LensPrescription;
    os?: LensPrescription;
  };
  submissionMeta: SubmissionMeta;
  auditTrail: AuditEntry[];
}

export interface AuditEntry {
  action: string;
  timestamp: Date;
  performedBy: string;
  fromStatus?: string;
  toStatus?: string;
  changes?: Record<string, any>;
  notes?: string;
}

export interface AxisConsistencyIssue {
  processingOrderId: string;
  reworkReportId: string;
  eye: 'OD' | 'OS';
  processingOrderAxis: number;
  reworkReportAxis: number;
  issueType: 'axis_not_synced' | 'axis_mismatch';
  detectedAt: Date;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
