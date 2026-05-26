export interface AttendanceRecord {
  employeeId: string;
  employeeName: string;
  courseBatch: string;
  courseName: string;
  checkInTime: string;
  scheduledStartTime: string;
  checkInStatus: 'normal' | 'late' | 'absent' | 'makeup';
  makeupApproved?: boolean;
  makeupReason?: string;
  rawData?: Record<string, any>;
}

export interface AssignmentRecord {
  employeeId: string;
  employeeName: string;
  courseBatch: string;
  courseName: string;
  assignmentId: string;
  assignmentName: string;
  submittedAt: string;
  deadline: string;
  score: number;
  passScore: number;
  status: 'passed' | 'failed' | 'pending' | 'submitted_late';
  rawData?: Record<string, any>;
}

export interface CourseRule {
  courseBatch: string;
  courseName: string;
  lateThresholdMinutes: number;
  latePenaltyPoints: number;
  maxLateAllowed: number;
  allowMakeup: boolean;
  makeupDeadlineDays: number;
  requiredAttendanceRate: number;
  certificateRevokeConditions: {
    tooManyLates: boolean;
    lowAttendance: boolean;
    assignmentFailed: boolean;
    cheatingDetected: boolean;
  };
  appealWindowDays: number;
}

export interface ProcessedRecord<T> {
  id: string;
  type: 'attendance' | 'assignment';
  original: T;
  status: 'normal' | 'pending' | 'failed';
  category: string;
  reason: string;
  suggestion: string;
  pointsDeducted?: number;
  requiresManualReview: boolean;
  reviewAction?: 'approve' | 'reject' | 'request_more_info';
}

export interface ValidationResult {
  batchId: string;
  courseBatch: string;
  processedAt: string;
  summary: {
    total: number;
    normal: number;
    pending: number;
    failed: number;
  };
  normalItems: ProcessedRecord<any>[];
  pendingItems: ProcessedRecord<any>[];
  failedItems: ProcessedRecord<any>[];
}

export interface BatchSubmission {
  batchId: string;
  submittedAt: string;
  courseBatch: string;
  attendanceCount: number;
  assignmentCount: number;
  status: 'processed' | 'duplicate';
}
