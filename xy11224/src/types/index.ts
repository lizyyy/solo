export enum FaultType {
  CABINET_DOOR_FAILURE = 'CABINET_DOOR_FAILURE',
  SCAN_FAILURE = 'SCAN_FAILURE',
  FALSE_EMPTY_SLOT_ALARM = 'FALSE_EMPTY_SLOT_ALARM',
  OTHER = 'OTHER'
}

export enum TicketStatus {
  PENDING = 'PENDING',
  RECEIVED = 'RECEIVED',
  ANALYZED = 'ANALYZED',
  DISPATCHED = 'DISPATCHED',
  REVIEWED = 'REVIEWED',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED'
}

export enum RuleAction {
  ALLOW = 'ALLOW',
  BLOCK = 'BLOCK',
  MERGE = 'MERGE'
}

export interface Ticket {
  id: string;
  externalId: string;
  cabinetId: string;
  cabinetName: string;
  faultType: FaultType;
  description: string;
  status: TicketStatus;
  isOffline: boolean;
  reportedAt: Date;
  receivedAt?: Date;
  analyzedAt?: Date;
  dispatchedAt?: Date;
  reviewedAt?: Date;
  resolvedAt?: Date;
  assignedTo?: string;
  rootCause?: string;
  resolution?: string;
  mergedInto?: string;
  mergedTickets: string[];
  ruleResults: RuleResult[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleResult {
  ruleName: string;
  action: RuleAction;
  reason: string;
  timestamp: Date;
  details?: Record<string, any>;
}

export interface Cabinet {
  id: string;
  name: string;
  isOnline: boolean;
  lastHeartbeat: Date;
  location: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaintenanceRecord {
  id: string;
  ticketId: string;
  cabinetId: string;
  technician: string;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  statusBefore: string;
  statusAfter?: string;
  notes?: string;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  ticketId?: string;
  action: string;
  operator: string;
  details: Record<string, any>;
  timestamp: Date;
}

export interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  merged: number;
  errors: ImportError[];
}

export interface ImportError {
  externalId: string;
  reason: string;
  details?: Record<string, any>;
}

export interface ExportFilter {
  startDate?: Date;
  endDate?: Date;
  status?: TicketStatus[];
  faultType?: FaultType[];
  cabinetId?: string;
}

export interface MonthlyReport {
  period: string;
  totalTickets: number;
  byFaultType: Record<FaultType, number>;
  byStatus: Record<TicketStatus, number>;
  mergedTickets: number;
  offlineExcluded: number;
  averageResolutionTime?: number;
  dispatchedCount: number;
  reviewedCount: number;
}