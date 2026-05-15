export interface AuditItem {
  id: string;
  content: string;
  contentType: 'text' | 'image' | 'url';
  metadata?: Record<string, any>;
}

export interface ModelResult {
  modelName: string;
  score: number;
  label: string;
  confidence: number;
  details?: Record<string, any>;
}

export interface RuleResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  matchContent?: string;
  severity: 'low' | 'medium' | 'high';
}

export interface AuditResult {
  itemId: string;
  item: AuditItem;
  modelResults: ModelResult[];
  ruleResults: RuleResult[];
  overallDecision: 'pass' | 'reject' | 'review';
  overallConfidence: number;
  timestamp: number;
}

export interface ManualCorrection {
  id: string;
  resultId: string;
  handler: string;
  originalDecision: 'pass' | 'reject' | 'review';
  newDecision: 'pass' | 'reject' | 'review';
  remark: string;
  timestamp: number;
}

export interface AuditRecord {
  result: AuditResult;
  corrections: ManualCorrection[];
  status: 'pending' | 'confirmed' | 'corrected';
  finalDecision?: 'pass' | 'reject' | 'review';
  handler?: string;
  auditTimestamp?: number;
}

export interface PreviewResult {
  totalItems: number;
  estimatedReject: number;
  estimatedReview: number;
  estimatedPass: number;
  items: {
    item: AuditItem;
    prediction: 'pass' | 'reject' | 'review';
  }[];
}

export type OutputFormat = 'json' | 'markdown';
