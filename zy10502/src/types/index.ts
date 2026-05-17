export enum WindowStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  BLOCKING = 'BLOCKING',
  RECOVERING = 'RECOVERING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ERROR = 'ERROR'
}

export enum RecoveryConditionType {
  TIME_BASED = 'TIME_BASED',
  DBA_CONFIRM = 'DBA_CONFIRM',
  WRITE_QUEUE_EMPTY = 'WRITE_QUEUE_EMPTY',
  MANUAL = 'MANUAL'
}

export interface AffectedService {
  id: string;
  serviceName: string;
  serviceOwner: string;
  writeOperations: string[];
  estimatedImpact: 'HIGH' | 'MEDIUM' | 'LOW';
  notified: boolean;
  notificationTime?: Date;
}

export interface BlockedWrite {
  id: string;
  windowId: string;
  serviceName: string;
  operation: string;
  sqlStatement?: string;
  timestamp: Date;
  blockedBy: string;
  retryCount: number;
  resolved: boolean;
  resolvedTime?: Date;
  resolution?: 'DROPPED' | 'RETRIED' | 'MANUAL_HANDLED';
}

export interface RecoveryCondition {
  type: RecoveryConditionType;
  value: string;
  satisfied: boolean;
  satisfiedTime?: Date;
  verifiedBy?: string;
}

export interface ReadonlyWindow {
  id: string;
  databaseName: string;
  databaseHost: string;
  windowName: string;
  description?: string;
  status: WindowStatus;
  scheduledStartTime: Date;
  scheduledEndTime: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  affectedServices: AffectedService[];
  recoveryConditions: RecoveryCondition[];
  dbaContact: string;
  reason: string;
  tags?: string[];
}

export interface WindowReport {
  id: string;
  windowId: string;
  generatedAt: Date;
  totalBlockedWrites: number;
  affectedServicesCount: number;
  peakBlockedPerMinute: number;
  durationMinutes: number;
  recoveryTimeMinutes?: number;
  statusSummary: string;
  anomalies?: string[];
  exportedBy?: string;
}

export interface ExceptionRecord {
  id: string;
  windowId?: string;
  operation: string;
  originalInput: any;
  errorMessage: string;
  errorStack?: string;
  handled: boolean;
  handledBy?: string;
  handlingNote?: string;
  timestamp: Date;
}

export interface ManualCorrection {
  id: string;
  windowId: string;
  correctedBy: string;
  correctionType: 'STATUS_CHANGE' | 'SERVICE_ADD' | 'SERVICE_REMOVE' | 'CONDITION_UPDATE' | 'OTHER';
  oldValue: any;
  newValue: any;
  reason: string;
  timestamp: Date;
}

export interface CreateWindowRequest {
  databaseName: string;
  databaseHost: string;
  windowName: string;
  description?: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  createdBy: string;
  affectedServices: Omit<AffectedService, 'id' | 'notified' | 'notificationTime'>[];
  recoveryConditions: Omit<RecoveryCondition, 'satisfied' | 'satisfiedTime' | 'verifiedBy'>[];
  dbaContact: string;
  reason: string;
  tags?: string[];
}

export interface UpdateWindowStatusRequest {
  status: WindowStatus;
  updatedBy: string;
  note?: string;
}

export interface BlockWriteRequest {
  serviceName: string;
  operation: string;
  sqlStatement?: string;
  blockedBy: string;
}
