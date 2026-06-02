export type RecordStatus = 'pending' | 'processed' | 'verify' | 'onsite';

export type SourceType = 'inspection' | 'complaint' | 'meeting' | 'old_caliber';

export interface SourceInfo {
  id: string;
  type: SourceType;
  name: string;
  date: string;
  rawContent: string;
  importTime: string;
}

export interface CoordOffsetIssue {
  expectedLat: number;
  expectedLng: number;
  actualLat: number;
  actualLng: number;
  distanceMeters: number;
}

export interface ConflictInfo {
  type: 'same_name' | 'duplicate' | 'coord_offset' | 'cross_time' | 'capacity' | 'time_conflict';
  humanMessage: string;
  relatedRecordIds: string[];
  details?: CoordOffsetIssue;
}

export interface BikeRecord {
  id: string;
  stationName: string;
  exitNo: string;
  lat: number;
  lng: number;
  timeSlot: string;
  bikeCount: number;
  capacity: number;
  reason: string;
  status: RecordStatus;
  notes: string;
  sources: SourceInfo[];
  conflicts: ConflictInfo[];
  mergedFrom: string[];
  reviewTime?: string;
  createTime: string;
  updateTime: string;
  isOldCaliber: boolean;
}

export interface ImportResult {
  total: number;
  success: number;
  withIssues: number;
  issues: ConflictInfo[];
  records: BikeRecord[];
}

export interface ImportRawItem {
  stationName: string;
  exitNo: string;
  lat: number;
  lng: number;
  timeSlot: string;
  bikeCount: number;
  capacity: number;
  reason: string;
  source: {
    type: SourceType;
    name: string;
    date: string;
    rawContent: string;
  };
}

export interface UpdateRecordRequest {
  status?: RecordStatus;
  notes?: string;
  reason?: string;
}

export interface MergeRequest {
  recordIds: string[];
  keepStationName: string;
  keepExitNo: string;
  keepLat: number;
  keepLng: number;
  keepTimeSlot: string;
  keepReason: string;
}

export interface MergeResult {
  mergedRecord: BikeRecord;
  mergedCount: number;
}

export type ExportFormat = 'csv' | 'json';

export interface ExportRecord extends BikeRecord {
  statusText: string;
  sourceSummary: string;
  conflictSummary: string;
}

export interface ExportData {
  processed: ExportRecord[];
  verify: ExportRecord[];
  onsite: ExportRecord[];
  exportTime: string;
  operator: string;
}
