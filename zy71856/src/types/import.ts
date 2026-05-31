export type ImportStatus = 'processing' | 'done' | 'error';
export type RecordType = 'normal' | 'late' | 'duplicate' | 'corrected';

export interface ImportItem {
  id: string;
  packageId: string;
  type: RecordType;
  originalData: any;
  processedEventId?: string;
  error?: string;
  warnings?: string[];
}

export interface ImportPackage {
  id: string;
  name: string;
  uploadTime: number;
  status: ImportStatus;
  totalItems: number;
  items: ImportItem[];
  stats: {
    normal: number;
    late: number;
    duplicate: number;
    corrected: number;
    errors: number;
  };
  progress: number;
  errorMessage?: string;
}

export interface ImportConfig {
  duplicateTimeWindow: number;
  lateThreshold: number;
  priority: RecordType[];
}

export interface RawRecord {
  id: string;
  timestamp: number;
  type: string;
  title: string;
  description?: string;
  operator?: string;
  recordType?: RecordType;
  isCorrection?: boolean;
  correctionOf?: string;
  attachmentDelay?: number;
  metadata?: Record<string, any>;
}

export interface DeduplicateResult {
  kept: RawRecord;
  duplicates: RawRecord[];
  reason: string;
}

export interface ProcessResult {
  package: ImportPackage;
  eventIds: string[];
  abnormalIds: string[];
  warnings: string[];
  session?: any;
  events?: any[];
}

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  normal: '正常记录',
  late: '晚到附件',
  duplicate: '重复项',
  corrected: '人工更正'
};

export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  processing: '处理中',
  done: '已完成',
  error: '处理失败'
};

export const DEFAULT_IMPORT_CONFIG: ImportConfig = {
  duplicateTimeWindow: 2000,
  lateThreshold: 5000,
  priority: ['corrected', 'normal', 'late', 'duplicate']
};
