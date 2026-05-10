export interface Student {
  id: string;
  name: string;
  studentId: string;
  class: string;
  gender: string;
  phone: string;
  emergencyContact: string;
  groupId: string | null;
  status: 'active' | 'inactive';
}

export interface Teacher {
  id: string;
  name: string;
  teacherId: string;
  phone: string;
}

export interface Group {
  id: string;
  name: string;
  teacherId: string | null;
  meetingPointId: string | null;
}

export interface MeetingPoint {
  id: string;
  name: string;
  location: string;
  description: string;
  orderIndex: number;
}

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'late';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  meetingPointId: string;
  status: AttendanceStatus;
  timestamp: string;
  operatorId: string;
  rawInput: string;
  notes: string;
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  studentId: string;
  meetingPointId: string;
  reason: string;
  status: LeaveStatus;
  requestedBy: string;
  approvedBy: string | null;
  requestTime: string;
  approvalTime: string | null;
  rawInput: string;
}

export interface GroupChange {
  id: string;
  studentId: string;
  oldGroupId: string | null;
  newGroupId: string | null;
  reason: string;
  operatorId: string;
  timestamp: string;
  rawInput: string;
}

export interface ApiError {
  code: string;
  message: string;
  rawInput?: string;
  details?: Record<string, unknown>;
}

export interface DashboardData {
  meetingPoints: Array<MeetingPoint & {
    presentCount: number;
    absentCount: number;
    leaveCount: number;
    lateCount: number;
    totalStudents: number;
  }>;
  totalStudents: number;
  absentCount: number;
  pendingLeaves: number;
}

export interface AbsentAlert {
  student: Student;
  lastMeetingPoint: MeetingPoint | null;
  lastStatus: string;
  lastTime: string | null;
}

export interface ExportReport {
  activityName: string;
  activityDate: string;
  generatedAt: string;
  meetingPoints: Array<{
    id: string;
    name: string;
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    leaveCount: number;
    lateCount: number;
    students: Array<{
      studentId: string;
      name: string;
      status: AttendanceStatus;
      actionTaken: string;
      exceptionType: 'rule_intercept' | 'data_missing' | 'status_conflict' | null;
      rawInput: string;
    }>;
  }>;
}
