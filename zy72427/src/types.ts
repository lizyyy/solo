export type CardStatus = 
  | 'DRAFT'
  | 'ATTENDANCE_IMPORTED'
  | 'TICKET_SUPPLEMENTED'
  | 'CONFLICT_DETECTED'
  | 'CONFLICT_RESOLVED'
  | 'REVENUE_CALCULATED'
  | 'COMPLETED'
  | 'WITHDRAWN';

export type ConflictResolution = 'CONFIRM_ATTENDANCE' | 'CONFIRM_TICKET' | 'PENDING_REVIEW';

export type AttendanceStatus = 'NORMAL' | 'TEMP_SUBSTITUTE' | 'ABSENT' | 'MAKEUP';

export interface ClassAttendanceRecord {
  id: string;
  cardId: string;
  classDate: string;
  className: string;
  studentName: string;
  status: AttendanceStatus;
  sourceNote?: string;
  isGroupMessageOnly?: boolean;
  importedAt: string;
  importBatchId: string;
}

export interface TicketExportRecord {
  id: string;
  cardId: string;
  classDate: string;
  className: string;
  studentName: string;
  ticketCount: number;
  ticketType: string;
  exportedAt: string;
  exportBatchId: string;
  supplementNote?: string;
}

export interface ConflictRecord {
  id: string;
  cardId: string;
  attendanceId: string;
  ticketId?: string;
  conflictType: string;
  description: string;
  attendanceData: any;
  ticketData?: any;
  resolution?: ConflictResolution;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface RevenueShareDetail {
  id: string;
  cardId: string;
  version: number;
  classDate: string;
  className: string;
  studentName: string;
  baseAmount: number;
  adjustmentAmount: number;
  finalAmount: number;
  calculationParams: {
    formulaVersion: string;
    modelVersion?: string;
    assumptions: string[];
    tradeoffs: string[];
  };
  calculatedAt: string;
  calculatedBy: string;
  isWithdrawn: boolean;
}

export interface SelfCheckResult {
  checkType: 'DUPLICATE_IMPORT' | 'TEMP_SUBSTITUTE_WARNING' | 'MAKUP_RECALCULATION' | 'EXPORT_CONSISTENCY';
  passed: boolean;
  message: string;
  details?: any;
  severity: 'INFO' | 'WARNING' | 'ERROR';
}

export interface ImportResultDetail {
  record: ClassAttendanceRecord;
  importStatus: 'NEW' | 'DUPLICATE_CURRENT_BATCH' | 'DUPLICATE_HISTORICAL';
  duplicateOf?: string;
}

export interface PlaylistColdStartCard {
  id: string;
  playlistName: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: CardStatus;
  currentVersion: number;
  attendanceBatchId?: string;
  ticketBatchId?: string;
  revenueVersion?: number;
  selfCheckResults: SelfCheckResult[];
  notes?: string;
}

export interface CardVersionSnapshot {
  id: string;
  cardId: string;
  version: number;
  status: CardStatus;
  attendanceBatchId?: string;
  ticketBatchId?: string;
  revenueVersion?: number;
  snapshotData: any;
  createdAt: string;
  createdBy: string;
}
