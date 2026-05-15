export interface FieldIssue {
  fieldPath: string;
  originalValue: string;
  truncatedValue?: string;
  maxLength: number;
  actualLength: number;
  issueType: 'truncated' | 'overflow' | 'empty' | 'invalid';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface CorrectionNote {
  id: string;
  timestamp: string;
  operator: string;
  fieldPath: string;
  originalDecision: string;
  correctedDecision: string;
  reason: string;
  evidence?: string;
}

export interface RequestRecord {
  id: string;
  requestHash: string;
  timestamp: string;
  source: string;
  requestType: string;
  originalInput: Record<string, any>;
  fieldIssues: FieldIssue[];
  corrections: CorrectionNote[];
  status: 'pending' | 'reviewed' | 'corrected' | 'exported';
  metadata: Record<string, any>;
}

export interface ExportReport {
  reportId: string;
  generatedAt: string;
  generator: string;
  records: RequestRecord[];
  summary: {
    totalRecords: number;
    withIssues: number;
    corrected: number;
    pendingReview: number;
  };
}

export interface GuardrailConfig {
  maxFieldLength: number;
  maxRequestSize: number;
  enableTruncation: boolean;
  autoDetectEncoding: boolean;
  strictMode: boolean;
}
