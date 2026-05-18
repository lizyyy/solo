export enum CertificateStatus {
  ISSUED = 'issued',
  REVOKING = 'revoking',
  REVOKED = 'revoked',
  RESTORE_REQUESTED = 'restore_requested'
}

export enum RevocationFlow {
  NORMAL = 'normal',
  REJECT = 'reject',
  MANUAL_REVIEW = 'manual_review'
}

export enum ImportStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  CONFLICT = 'conflict'
}

export interface Course {
  id: string;
  name: string;
  code: string;
}

export interface Student {
  id: string;
  name: string;
  employeeId: string;
  department: string;
}

export interface Certificate {
  id: string;
  certificateNo: string;
  courseId: string;
  courseName: string;
  studentId: string;
  studentName: string;
  employeeId: string;
  issueDate: string;
  status: CertificateStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RevocationRecord {
  id: string;
  certificateId: string;
  certificateNo: string;
  courseId: string;
  courseName: string;
  studentId: string;
  studentName: string;
  employeeId: string;
  reason: string;
  flow: RevocationFlow;
  status: CertificateStatus;
  operatorId: string;
  operatorName: string;
  rejectReason?: string;
  reviewComment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportRecord {
  id: string;
  batchNo: string;
  rowNumber: number;
  certificateNo: string;
  reason: string;
  status: ImportStatus;
  errorMessage?: string;
  createdAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginationResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
