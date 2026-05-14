export interface WorkOrder {
  id: string;
  orderNo: string;
  title: string;
  content: string;
  sourceSystem: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  attachments: Attachment[];
}

export interface Attachment {
  id: string;
  workOrderId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: Date;
  expireAt: Date | null;
  status: 'valid' | 'expired' | 'deleted';
}

export interface IndexSuggestion {
  id: string;
  tableName: string;
  columnName: string;
  indexType: 'BTREE' | 'HASH' | 'GIN' | 'GIST';
  suggestionType: 'create' | 'drop' | 'modify';
  reason: string;
  estimatedBenefit: number;
  confidence: 'high' | 'medium' | 'low';
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  workOrderId: string;
  sourceSystem: string;
  action: string;
  operator: string;
  reason: string;
  beforeData: Record<string, any> | null;
  afterData: Record<string, any> | null;
  createdAt: Date;
}

export interface AuditResult {
  summary: AuditSummary;
  normalRecords: WorkOrder[];
  exceptionRecords: ExceptionRecord[];
  indexSuggestions: IndexSuggestion[];
  execution: ExecutionInfo;
  nextSteps: NextStep[];
}

export interface ExceptionRecord {
  id: string;
  workOrderId: string;
  type: 'attachment_expired' | 'data_inconsistency' | 'index_missing';
  severity: 'critical' | 'major' | 'minor';
  message: string;
  details: Record<string, any>;
  discoveredAt: Date;
}

export interface AuditSummary {
  totalRecords: number;
  normalCount: number;
  exceptionCount: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
}

export interface ExecutionInfo {
  startTime: Date;
  endTime: Date;
  durationMs: number;
  executor: string;
}

export interface NextStep {
  id: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
  description: string;
  estimatedTime: string;
  responsible: string;
}

export interface CandidateItem {
  id: string;
  type: 'cleanup' | 'rollback';
  targetId: string;
  targetType: 'work_order' | 'attachment' | 'index';
  description: string;
  impact: string;
  riskLevel: 'high' | 'medium' | 'low';
  approved: boolean;
}

export interface ReportFormat {
  format: 'json' | 'markdown' | 'download';
  content: string;
}
