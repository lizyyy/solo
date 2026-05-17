export enum CheckListStatus {
  OCCUPIED = '已占号',
  PENDING_RELEASE = '待释放',
  RELEASED = '已释放',
  RESCHEDULED = '已改约'
}

export enum ReleaseReason {
  PATIENT_REFUND = '患者退费',
  PATIENT_CANCEL = '患者取消',
  DOCTOR_ADJUST = '医生调整',
  EXPIRED = '号源过期',
  SYSTEM_ERROR = '系统异常',
  OTHER = '其他'
}

export interface Patient {
  id: string;
  name: string;
  idCard: string;
  phone: string;
  createdAt: string;
}

export interface ExamItem {
  id: string;
  name: string;
  code: string;
  department: string;
  price: number;
}

export interface TimeSlot {
  id: string;
  examItemId: string;
  date: string;
  startTime: string;
  endTime: string;
  total: number;
  available: number;
  occupied: number;
}

export interface CheckList {
  id: string;
  checklistNo: string;
  patientId: string;
  patientName: string;
  patientIdCard: string;
  patientPhone: string;
  examItemId: string;
  examItemName: string;
  examItemCode: string;
  department: string;
  timeSlotId: string;
  timeSlotDate: string;
  timeSlotTime: string;
  status: CheckListStatus;
  releaseReason?: ReleaseReason;
  releaseRemark?: string;
  operator?: string;
  businessObject?: string;
  createdAt: string;
  updatedAt: string;
  releasedAt?: string;
}

export interface CheckListHistory {
  id: string;
  checklistId: string;
  fromStatus?: CheckListStatus;
  toStatus: CheckListStatus;
  operator?: string;
  remark?: string;
  createdAt: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  total: number;
  details: Array<{
    row: number;
    success: boolean;
    error?: string;
    checklistId?: string;
  }>;
}

export interface QueryParams {
  startDate?: string;
  endDate?: string;
  status?: CheckListStatus;
  operator?: string;
  businessObject?: string;
  patientName?: string;
  examItemName?: string;
  page?: number;
  pageSize?: number;
}
