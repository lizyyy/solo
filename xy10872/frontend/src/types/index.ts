export enum ResetStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  BLOCKED = 'blocked',
  CANCELLED = 'cancelled'
}

export enum LogLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  DEBUG = 'debug'
}

export interface ResetRequest {
  id: number;
  lab_space_id: number;
  snapshot_id: number;
  requested_by: string;
  requested_by_name: string;
  reason: string | null;
  status: ResetStatus;
  status_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecoveryLog {
  id: number;
  reset_request_id: number;
  level: LogLevel;
  message: string;
  details: string | null;
  created_at: string;
}

export interface RetainedFile {
  id: number;
  reset_request_id: number;
  file_path: string;
  reason: string | null;
  is_submission: boolean;
  retained_path: string | null;
  created_at: string;
}

export interface LabSpace {
  id: number;
  name: string;
  student_id: string;
  student_name: string;
  course_id: string;
  path: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExportReport {
  request_id: number;
  lab_space: {
    id: number;
    name: string;
    student_id: string;
    student_name: string;
  };
  snapshot: {
    id: number;
    name: string;
  };
  request_info: {
    requested_by: string;
    requested_by_name: string;
    reason: string | null;
    created_at: string;
  };
  status: {
    current: string;
    explanation: string;
    reason: string | null;
    approved_by: string | null;
    approved_at: string | null;
    started_at: string | null;
    completed_at: string | null;
  };
  timeline: Array<{
    time: string;
    level: string;
    message: string;
    details: string | null;
  }>;
  retained_files: Array<{
    file_path: string;
    reason: string | null;
    is_submission: boolean;
  }>;
  status_history: Array<{
    time: string;
    event: string;
    details: string | null;
  }>;
}