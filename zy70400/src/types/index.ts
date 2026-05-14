export enum ProcessingStatus {
  SUCCESS = 'success',
  ABNORMAL = 'abnormal',
  PENDING = 'pending',
  MANUALLY_CORRECTED = 'manually_corrected'
}

export enum AbnormalType {
  FIELD_TRUNCATED = 'field_truncated',
  DATA_MISSING = 'data_missing',
  FORMAT_ERROR = 'format_error',
  DUPLICATE = 'duplicate'
}

export interface RecordingRecord {
  id: string;
  batchId: string;
  recordingId: string;
  customerName: string;
  phoneNumber: string;
  serviceType: string;
  startTime: string;
  endTime: string;
  duration: number;
  agentName: string;
  summary: string;
  status: ProcessingStatus;
  abnormalType?: AbnormalType;
  abnormalReason?: string;
  isFieldTruncated?: boolean;
  truncatedFields?: string[];
  processingResult?: string;
  correctedBy?: string;
  correctionReason?: string;
  correctionTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BatchInfo {
  batchId: string;
  batchName: string;
  source: string;
  processingBasis: string;
  totalRecords: number;
  successCount: number;
  abnormalCount: number;
  pendingCount: number;
  correctedCount: number;
  createdAt: string;
  processedAt?: string;
}

export interface QueryOptions {
  batchId?: string;
  status?: ProcessingStatus;
  abnormalType?: AbnormalType;
  startDate?: string;
  endDate?: string;
  keyword?: string;
}

export interface ExportOptions {
  format: 'json' | 'csv';
  includeAbnormalOnly?: boolean;
  batchId?: string;
}
