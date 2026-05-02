export enum UserRole {
  STORE_STAFF = 'store_staff',
  SUPERVISOR = 'supervisor',
  ADMIN = 'admin'
}

export enum TicketStatus {
  CREATED = 'created',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  RETEST_REQUESTED = 'retest_requested',
  RETEST_FAILED = 'retest_failed',
  REOPEN_REQUESTED = 'reopen_requested',
  CLOSED = 'closed',
  ARCHIVED = 'archived'
}

export enum SampleType {
  CHLORINE = 'chlorine',
  PH = 'ph',
  TURBIDITY = 'turbidity'
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  storeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Pool {
  id: string;
  storeId: string;
  name: string;
  type: string;
  volume: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Threshold {
  id: string;
  sampleType: SampleType;
  minValue: number;
  maxValue: number;
  unit: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceCalibration {
  id: string;
  storeId: string;
  deviceName: string;
  deviceType: string;
  serialNumber: string;
  calibrationDate: string;
  validUntil: string;
  calibratedBy: string;
  certificateUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SampleRecord {
  id: string;
  storeId: string;
  poolId: string;
  sampleType: SampleType;
  value: number;
  unit: string;
  sampleTime: string;
  recordedBy: string;
  deviceCalibrationId?: string;
  isExceeded: boolean;
  ticketId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReport {
  id: string;
  storeId: string;
  reportDate: string;
  visitorCount: number;
  waterChangeRecords: string[];
  temporaryClosures: TemporaryClosure[];
  submittedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemporaryClosure {
  startTime: string;
  endTime: string;
  reason: string;
}

export interface Ticket {
  id: string;
  storeId: string;
  poolId: string;
  sampleRecordId: string;
  sampleType: SampleType;
  exceededValue: number;
  thresholdMin: number;
  thresholdMax: number;
  status: TicketStatus;
  assignedTo?: string;
  rectificationDescription?: string;
  rectificationEvidenceUrls?: string[];
  rectificationTime?: string;
  retestSampleRecordId?: string;
  retestValue?: number;
  retestTime?: string;
  retestPassed?: boolean;
  reopenRequestReason?: string;
  reopenRequestTime?: string;
  reopenedBy?: string;
  closeReason?: string;
  closedTime?: string;
  closedBy?: string;
  archivedTime?: string;
  archivedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  username: string;
  userRole: UserRole;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  changes?: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface VersionRecord {
  id: string;
  entityType: string;
  entityId: string;
  version: number;
  state: Record<string, any>;
  createdAt: string;
  createdBy: string;
}
