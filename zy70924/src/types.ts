export type BatchStatus = 'pending' | 'processing' | 'reviewing' | 'completed' | 'returned';

export type AttendanceStatus = 'normal' | 'late' | 'absent' | 'makeup_pending' | 'makeup_approved' | 'makeup_rejected';

export type HomeworkStatus = 'pending' | 'submitted' | 'graded' | 'absent';

export type CertificateStatus = 'pending' | 'issued' | 'revoked';

export type ReviewAction = 'approve' | 'reject' | 'return' | 'makeup_approve' | 'makeup_reject' | 'revoke';

export interface Batch {
  id: string;
  course_name: string;
  course_code: string;
  batch_number: string;
  start_date: string;
  end_date: string;
  status: BatchStatus;
  total_students: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CourseRule {
  id: string;
  batch_id: string;
  min_attendance_rate: number;
  late_threshold_minutes: number;
  late_penalty_score: number;
  min_homework_score: number;
  require_all_homework: boolean;
  created_at: string;
}

export interface Student {
  id: string;
  batch_id: string;
  employee_id: string;
  name: string;
  department?: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  batch_id: string;
  session_date: string;
  check_in_time?: string;
  check_out_time?: string;
  status: AttendanceStatus;
  late_minutes: number;
  is_makeup: boolean;
  makeup_approved_by?: string;
  makeup_approved_at?: string;
  makeup_reason?: string;
  created_at: string;
}

export interface HomeworkRecord {
  id: string;
  student_id: string;
  batch_id: string;
  homework_name: string;
  score?: number;
  submitted_at?: string;
  status: HomeworkStatus;
  created_at: string;
}

export interface Certificate {
  id: string;
  certificate_number: string;
  student_id: string;
  batch_id: string;
  issue_date?: string;
  status: CertificateStatus;
  revoke_reason?: string;
  revoked_by?: string;
  revoked_at?: string;
  final_score?: number;
  attendance_rate?: number;
  homework_avg_score?: number;
  created_at: string;
}

export interface RecordReview {
  id: string;
  record_type: 'attendance' | 'homework' | 'certificate';
  record_id: string;
  batch_id: string;
  student_id: string;
  action: ReviewAction;
  reason: string;
  processed_by: string;
  processed_at: string;
  previous_status?: string;
  new_status?: string;
}

export interface AuditLog {
  id: string;
  batch_id?: string;
  student_id?: string;
  certificate_id?: string;
  action: string;
  details?: string;
  operator: string;
  operated_at: string;
}

export interface ExportDetail {
  学员工号: string;
  学员姓名: string;
  部门: string;
  课程名称: string;
  课程代码: string;
  批次号: string;
  出勤率: string;
  作业平均分: string;
  最终成绩: string;
  证书编号: string;
  证书状态: string;
  处理记录: string;
}
