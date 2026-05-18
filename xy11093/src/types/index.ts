export enum SigninStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  NORMAL = 'normal',
  ABNORMAL = 'abnormal',
  MANUAL_PROCESSING = 'manual_processing',
  PROCESSED = 'processed',
  WITHDRAWN = 'withdrawn'
}

export enum AbnormalType {
  ONLINE_WRONG_OFFLINE = 'online_wrong_offline',
  CONSISTENCY_ERROR = 'consistency_error',
  SEAT_CONFLICT = 'seat_conflict',
  OTHER = 'other'
}

export interface Employee {
  id: string;
  employeeNo: string;
  name: string;
  department: string;
  isRemote: boolean;
  location: string;
}

export interface TrainingCourse {
  id: string;
  courseCode: string;
  courseName: string;
  trainingDate: string;
  trainingLocation: string;
  totalSeats: number;
}

export interface SigninRecord {
  id: string;
  recordNo: string;
  employeeId: string;
  courseId: string;
  signinType: 'online' | 'offline';
  seatNumber?: number;
  signinTime: string;
  status: SigninStatus;
  abnormalType?: AbnormalType;
  businessExplanation: string;
  submitterId: string;
  submitterName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SigninHistory {
  id: string;
  recordId: string;
  action: string;
  previousStatus?: SigninStatus;
  newStatus: SigninStatus;
  operatorId: string;
  operatorName: string;
  remark?: string;
  createdAt: string;
}

export interface SigninSupplementCreateDto {
  employeeId: string;
  courseId: string;
  signinType: 'online' | 'offline';
  seatNumber?: number;
  signinTime: string;
  submitterId: string;
  submitterName: string;
}

export interface ManualProcessDto {
  recordId: string;
  operatorId: string;
  operatorName: string;
  remark: string;
  resolution: 'approve' | 'reject';
}

export interface ExportRecord extends SigninRecord {
  employeeName: string;
  employeeNo: string;
  department: string;
  courseName: string;
  courseCode: string;
  trainingDate: string;
}
