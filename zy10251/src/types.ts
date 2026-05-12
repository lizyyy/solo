export enum AppointmentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  EXPIRED = 'expired'
}

export enum AuthorizationStatus {
  INACTIVE = 'inactive',
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired'
}

export enum ChangeSource {
  USER_CREATE = 'user_create',
  SYSTEM_AUTO = 'system_auto',
  ADMIN_APPROVE = 'admin_approve',
  ADMIN_REJECT = 'admin_reject',
  GATE_CHECKIN = 'gate_checkin',
  GATE_CHECKOUT = 'gate_checkout',
  MEETING_CANCEL = 'meeting_cancel',
  ADMIN_REVOKE = 'admin_revoke',
  SYSTEM_EXPIRE = 'system_expire'
}

export interface Appointment {
  id: string;
  requestId: string;
  visitorName: string;
  visitorPhone: string;
  visitorCompany: string;
  hostName: string;
  hostDepartment: string;
  licensePlate: string;
  meetingSubject: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Authorization {
  id: string;
  appointmentId: string;
  licensePlate: string;
  validFrom: string;
  validTo: string;
  status: AuthorizationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeLog {
  id: string;
  entityType: 'appointment' | 'authorization';
  entityId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  source: ChangeSource;
  operatorId: string | null;
  operatorName: string | null;
  remark: string | null;
  createdAt: string;
}

export interface CreateAppointmentRequest {
  requestId: string;
  visitorName: string;
  visitorPhone: string;
  visitorCompany: string;
  hostName: string;
  hostDepartment: string;
  licensePlate: string;
  meetingSubject: string;
  startTime: string;
  endTime: string;
}

export interface ApproveAppointmentRequest {
  operatorId: string;
  operatorName: string;
  remark?: string;
}

export interface RejectAppointmentRequest {
  operatorId: string;
  operatorName: string;
  remark: string;
}

export interface CheckInRequest {
  gateId: string;
  gateName: string;
}

export interface CheckOutRequest {
  gateId: string;
  gateName: string;
}

export interface RevokeRequest {
  operatorId: string;
  operatorName: string;
  reason: string;
}
