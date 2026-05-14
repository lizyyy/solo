export interface HandoverItem {
  id: string;
  packageName: string;
  version: string;
  author: string;
  submitTime: string;
  timezoneOffset: number;
  description: string;
  dependencies: Array<{
    name: string;
    version: string;
  }>;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface HandoverForm {
  id: string;
  batchId: string;
  title: string;
  submitter: string;
  submitTime: string;
  items: HandoverItem[];
  status: 'pending' | 'processing' | 'completed';
  ruleVersion: string;
}

export interface RuleCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'regex';
  value: any;
}

export interface Rule {
  id: string;
  version: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  action: 'allow' | 'deny' | 'review';
  createdAt: string;
  createdBy: string;
  isActive: boolean;
}

export interface ValidationResult {
  itemId: string;
  packageName: string;
  version: string;
  passed: boolean;
  ruleId: string;
  ruleVersion: string;
  message: string;
  details: any;
}

export interface BatchValidationResult {
  batchId: string;
  ruleVersion: string;
  startTime: string;
  endTime: string;
  executionTimeMs: number;
  totalItems: number;
  passedCount: number;
  failedCount: number;
  results: ValidationResult[];
}

export interface Report {
  id: string;
  batchId: string;
  ruleVersion: string;
  generatedAt: string;
  beforeSnapshot: BatchValidationResult | null;
  afterSnapshot: BatchValidationResult;
  executionTimeMs: number;
  nextSteps: string[];
  anomalies: string[];
}

export interface AnomalySample {
  id: string;
  batchId: string;
  itemId: string;
  type: 'timezone' | 'version' | 'dependency' | 'other';
  originalData: HandoverItem;
  detectedAt: string;
  detectedByRule: string;
  status: 'open' | 'investigating' | 'resolved';
  resolution?: string;
}

export interface HistoryRecord {
  id: string;
  resourceType: 'handover' | 'rule' | 'report' | 'anomaly';
  resourceId: string;
  resourceScope: string;
  action: 'create' | 'update' | 'delete';
  before: any;
  after: any;
  reason: string;
  operator: string;
  operatedAt: string;
}
