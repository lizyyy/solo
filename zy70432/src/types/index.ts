export interface SearchKeywordReport {
  id?: string;
  keyword: string;
  searchVolume: number;
  clickRate: number;
  conversionRate: number;
  avgPosition: number;
  competition: 'low' | 'medium' | 'high';
  category: string;
  region: string;
  downloadUrl: string;
  reportDate: string;
  department: string;
  submittedBy: string;
}

export type FailureType = 
  | 'download_url_invalid'
  | 'keyword_empty'
  | 'search_volume_negative'
  | 'click_rate_out_of_range'
  | 'conversion_rate_out_of_range'
  | 'avg_position_invalid'
  | 'competition_invalid'
  | 'date_format_invalid'
  | 'duplicate_submission'
  | 'conflict_detected';

export interface FieldError {
  field: string;
  value: any;
  message: string;
  failureType: FailureType;
}

export interface ValidationResult {
  isValid: boolean;
  errors: FieldError[];
  recordHash: string;
}

export interface RecordingSession {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  status: 'recording' | 'completed' | 'archived';
  recordCount: number;
}

export interface PlaybackResult {
  sessionId: string;
  totalRecords: number;
  successCount: number;
  failureCount: number;
  results: PlaybackRecord[];
  groupedFailures: Record<FailureType, PlaybackRecord[]>;
}

export interface PlaybackRecord {
  originalRecord: SearchKeywordReport;
  status: 'success' | 'failure' | 'conflict' | 'reused';
  errors?: FieldError[];
  existingRecordId?: string;
  message?: string;
}

export interface AuditEntry {
  id: string;
  recordHash: string;
  recordId: string;
  action: 'submit' | 'reuse' | 'conflict' | 'export' | 'confirm' | 'reject';
  timestamp: string;
  operator: string;
  details: string;
  needsConfirmation: boolean;
  confirmed: boolean;
  confirmedBy?: string;
  confirmedAt?: string;
}

export interface ExportOptions {
  format: 'json' | 'csv';
  includeFailuresOnly?: boolean;
  filterByFailureType?: FailureType;
  groupByFailure?: boolean;
}

export interface FailedRecord {
  id: string;
  record: SearchKeywordReport;
  errors: FieldError[];
  submittedAt: string;
  submittedBy: string;
  recordHash: string;
}
