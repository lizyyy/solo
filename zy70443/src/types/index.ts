export interface Certificate {
  id?: number;
  certificateNo: string;
  applicant: string;
  issueDate: string;
  status: 'pending' | 'issued' | 'revoked';
  createdAt: string;
  updatedAt: string;
}

export interface AuditResult {
  id?: number;
  batchId: string;
  recordId: number;
  recordType: 'certificate' | 'bus_booking';
  originalLineNo: number;
  status: 'success' | 'failed' | 'warning';
  errorCode?: string;
  errorMessage?: string;
  beforeData: string;
  afterData?: string;
  remarks?: string;
  executedAt: string;
}

export interface AuditBatch {
  id?: number;
  batchId: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  warningCount: number;
  startTime: string;
  endTime: string;
  executionTimeMs: number;
  status: 'completed' | 'partial' | 'failed';
  reportSummary?: string;
  nextSteps?: string;
  createdAt: string;
}

export interface BusBooking {
  id?: number;
  batchId?: string;
  originalLineNo: number;
  employeeName: string;
  employeeId: string;
  route: string;
  bookingDate: string;
  manualRemark?: string;
  createdAt: string;
}

export interface ExportData {
  batchId: string;
  records: AuditResult[];
  generatedAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  code: number;
  message: string;
  data?: T;
  errors?: Array<{
    field?: string;
    code: string;
    message: string;
  }>;
}
