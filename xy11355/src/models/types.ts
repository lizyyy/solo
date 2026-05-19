export type VisitorType = 'personal' | 'business' | 'temporary';

export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export type RecordType = 'entry' | 'exit';

export type BlacklistReason = 'security' | 'violation' | 'other';

export interface Visitor {
  id: string;
  name: string;
  phone: string;
  idCard?: string;
  company?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  visitorId: string;
  visitorName: string;
  visitorPhone: string;
  visitorCompany?: string;
  plateNumber?: string;
  visitDate: string;
  startTime: string;
  endTime: string;
  reason: string;
  hostName: string;
  hostPhone: string;
  status: VerificationStatus;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemporaryPlate {
  id: string;
  plateNumber: string;
  visitorName: string;
  visitorPhone: string;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlacklistEntry {
  id: string;
  name: string;
  phone?: string;
  idCard?: string;
  plateNumber?: string;
  reason: BlacklistReason;
  reasonDetail?: string;
  addedBy: string;
  addedAt: string;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationRecord {
  id: string;
  type: RecordType;
  timestamp: string;
  visitorName: string;
  visitorPhone: string;
  plateNumber?: string;
  appointmentId?: string;
  result: 'allowed' | 'denied';
  reason: string;
  operator: string;
  gate: string;
  details?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  operator: string;
  timestamp: string;
  resourceType: string;
  resourceId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  details?: string;
  createdAt: string;
  updatedAt: string;
}

export type MaskLevel = 'none' | 'partial' | 'full';

export interface MaskConfig {
  phone: MaskLevel;
  idCard: MaskLevel;
  plateNumber: MaskLevel;
}
