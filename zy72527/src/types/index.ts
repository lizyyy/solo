export type ManifestStatus = 'pending' | 'processing' | 'conflict' | 'overridden' | 'verified' | 'completed';
export type FieldSource = 'ocr' | 'knowledge_base' | 'ticket' | 'manual';
export type ConflictStatus = 'pending' | 'confirmed_knowledge' | 'confirmed_ticket' | 'deferred';
export type OperationType = 'manual_override' | 'batch_override' | 'system_override';
export type SelfCheckType = 'duplicate_import' | 'override_detection' | 'recalculation' | 'export_consistency';

export interface ManifestField {
  key: string;
  label: string;
  value: string;
  confidence: number;
  source: FieldSource;
  paramVersion?: string;
  tradeOffReason?: string;
  updatedAt: string;
  operator?: string;
}

export interface KnowledgeReference {
  id: string;
  manifestId: string;
  url: string;
  title: string;
  extractedFields: Record<string, string>;
  confidence: number;
  modelVersion: string;
  importedAt: string;
  importedBy: string;
}

export interface FeedbackTicket {
  id: string;
  manifestId: string;
  ticketNo: string;
  title: string;
  content: string;
  feedbackFields: Record<string, string>;
  source: string;
  createdAt: string;
}

export interface ConflictRecord {
  id: string;
  manifestId: string;
  fieldKey: string;
  fieldLabel: string;
  knowledgeValue: string;
  ticketValue: string;
  knowledgeSource: string;
  ticketSource: string;
  status: ConflictStatus;
  decidedBy?: string;
  decidedAt?: string;
  decisionReason?: string;
}

export interface OverrideHistory {
  id: string;
  manifestId: string;
  fieldKey: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
  oldSource: FieldSource;
  newSource: FieldSource;
  operationType: OperationType;
  operator: string;
  isProtected: boolean;
  wasOverridden: boolean;
  overriddenByBatch?: string;
  createdAt: string;
}

export interface ManifestRecord {
  id: string;
  manifestNo: string;
  ocrFields: ManifestField[];
  supplementFields: ManifestField[];
  status: ManifestStatus;
  hasConflict: boolean;
  hasOverride: boolean;
  stepProgress: 0 | 1 | 2 | 3;
  createdAt: string;
  updatedAt: string;
}

export interface SelfCheckResult {
  type: SelfCheckType;
  label: string;
  passed: boolean;
  totalCount: number;
  failedCount: number;
  failedItems: { manifestId: string; manifestNo: string; reason: string }[];
  checkedAt: string;
}
