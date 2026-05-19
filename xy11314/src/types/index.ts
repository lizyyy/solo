export type RecordStatus = 'pending' | 'valid' | 'invalid' | 'matched' | 'adjudicated' | 'reviewed';

export type AdjudicationResult = 'driver_fault' | 'traffic_fault' | 'parent_fault' | 'system_error' | 'undetermined';

export type ReviewStatus = 'confirmed' | 'overturned' | 'pending_review';

export interface SensitiveConfig {
  maskPhone: boolean;
  maskName: boolean;
  maskLocation: boolean;
  allowedRoles: string[];
}

export interface StopSchedule {
  id?: number;
  routeId: string;
  stopId: string;
  stopName: string;
  scheduledTime: string;
  latitude: number;
  longitude: number;
  importBatchId: string;
  createdAt?: string;
}

export interface GPSRecord {
  id?: number;
  deviceId: string;
  driverId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  speed: number;
  accuracy: number;
  importBatchId: string;
  createdAt?: string;
}

export interface DriverCheckin {
  id?: number;
  driverId: string;
  routeId: string;
  stopId: string;
  checkinTime: string;
  checkinType: 'arrival' | 'departure';
  importBatchId: string;
  createdAt?: string;
}

export interface ParentComplaint {
  id?: number;
  complaintId: string;
  parentName: string;
  parentPhone: string;
  studentName: string;
  routeId: string;
  stopId: string;
  scheduledDate: string;
  scheduledTime: string;
  actualArrivalTime?: string;
  complaintType: 'late' | 'no_show' | 'early' | 'other';
  description: string;
  status: RecordStatus;
  importBatchId: string;
  createdAt?: string;
}

export interface BadRecord {
  id?: number;
  importBatchId: string;
  sourceType: 'schedule_csv' | 'gps_json' | 'complaint' | 'checkin';
  rawData: string;
  rowNumber?: number;
  failureReason: string;
  suggestedFix: string;
  createdAt?: string;
}

export interface MatchRecord {
  id?: number;
  complaintId: number;
  gpsRecords: number[];
  checkinRecords: number[];
  stopScheduleId: number;
  matchConfidence: number;
  timeDiscrepancyMinutes: number;
  distanceDiscrepancyMeters: number;
  status: RecordStatus;
  createdAt?: string;
}

export interface Adjudication {
  id?: number;
  matchId: number;
  complaintId: number;
  result: AdjudicationResult;
  confidence: number;
  reasons: string[];
  evidence: {
    gpsEvidence?: string;
    checkinEvidence?: string;
    scheduleEvidence?: string;
  };
  adjudicator: 'system' | string;
  adjudicatedAt: string;
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt?: string;
}

export interface AuditLog {
  id?: number;
  entityType: string;
  entityId: number;
  action: string;
  oldValue?: string;
  newValue?: string;
  operator: string;
  timestamp: string;
  details?: string;
}

export interface ImportResult {
  batchId: string;
  successCount: number;
  failureCount: number;
  badRecords: BadRecord[];
}

export interface ExportOptions {
  format: 'csv' | 'json';
  includeSensitive: boolean;
  dateRange?: { start: string; end: string };
  statusFilter?: RecordStatus[];
}
