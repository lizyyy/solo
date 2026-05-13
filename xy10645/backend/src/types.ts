export interface Student {
  id: string;
  name: string;
  idCard: string;
  phone: string;
  email?: string;
  course: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'leave';
  remark?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExamScore {
  id: string;
  studentId: string;
  examType: 'final' | 'midterm' | 'quiz';
  score: number;
  fullScore: number;
  passScore: number;
  isPassed: boolean;
  examDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RetakeRecord {
  id: string;
  studentId: string;
  originalExamId: string;
  retakeCount: number;
  retakeDate: string;
  score: number;
  isPassed: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Certificate {
  id: string;
  certificateNo: string;
  studentId: string;
  status: 'pending' | 'issued' | 'revoked' | 'rechecked';
  issueDate?: string;
  revokeDate?: string;
  revokeReason?: string;
  revokedBy?: string;
  recheckDate?: string;
  recheckedBy?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistory {
  id: string;
  entityType: 'student' | 'attendance' | 'examScore' | 'retake' | 'certificate';
  entityId: string;
  fieldName: string;
  oldValue: any;
  newValue: any;
  changedBy: string;
  changedAt: string;
  remark?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  requestId: string;
  timestamp: string;
}

export interface IdempotentRequest {
  requestId: string;
  endpoint: string;
  payload: any;
  response: ApiResponse;
  createdAt: string;
}

export interface ExportFilter {
  responsiblePerson?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}
