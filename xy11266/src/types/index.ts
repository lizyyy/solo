export interface CallRecord {
  id?: number;
  callId: string;
  agentName: string;
  agentId: string;
  callDate: string;
  callDuration: number;
  transcript: string;
  summary?: string;
  status: RecordStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type RecordStatus = 'normal' | 'abnormal' | 'pending';

export type AnomalyType = 'apology_missing' | 'refund_promise_missing' | 'sensitive_word' | 'other';

export interface AnomalyRecord {
  id?: number;
  recordId: number;
  anomalyType: AnomalyType;
  description: string;
  severity: 'low' | 'medium' | 'high';
  position?: string;
  createdAt?: string;
}

export interface ErrorRecord {
  id?: number;
  sourceFile: string;
  originalPosition: string;
  rawContent: string;
  errorType: string;
  errorMessage: string;
  suggestion: string;
  status: 'unresolved' | 'resolved' | 'ignored';
  createdAt?: string;
  resolvedAt?: string;
}

export interface SensitiveWord {
  id?: number;
  word: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
  createdAt?: string;
}

export interface ImportHistory {
  id?: number;
  fileName: string;
  fileType: 'transcript' | 'metadata' | 'sensitive_words';
  totalRecords: number;
  successCount: number;
  errorCount: number;
  createdAt?: string;
}

export interface QueryFilters {
  agentName?: string;
  startDate?: string;
  endDate?: string;
  status?: RecordStatus;
  anomalyType?: AnomalyType;
}

export interface ExportConfig {
  format: 'xlsx' | 'csv';
  outputPath: string;
}
