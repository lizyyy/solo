export interface LaboratorySample {
  id: string;
  sampleNo: string;
  sampleName: string;
  sampleType: string;
  collectionTime: string;
  submitter: string;
  laboratory: string;
  testItems: string[];
  status: 'pending' | 'testing' | 'completed' | 'failed';
  gatewayError?: string;
  submitTime: string;
  batchId: string;
}

export interface AuditRule {
  version: string;
  effectiveDate: string;
  description: string;
  checks: {
    id: string;
    name: string;
    description: string;
    check: (sample: LaboratorySample, context: AuditContext) => CheckResult;
  }[];
}

export interface CheckResult {
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface AuditContext {
  batchId: string;
  ruleVersion: string;
  auditTime: string;
  allSamples: LaboratorySample[];
}

export interface AuditRecord {
  sampleId: string;
  sampleNo: string;
  checks: {
    ruleId: string;
    ruleName: string;
    result: CheckResult;
  }[];
  overallStatus: 'success' | 'warning' | 'failed';
  beforeData: LaboratorySample;
  afterData?: LaboratorySample;
}

export interface AuditBatch {
  batchId: string;
  ruleVersion: string;
  startTime: string;
  endTime: string;
  executionTimeMs: number;
  totalCount: number;
  successCount: number;
  warningCount: number;
  failedCount: number;
  records: AuditRecord[];
  failedItems: FailedItem[];
  nextSteps: string[];
}

export interface FailedItem {
  sampleId: string;
  sampleNo: string;
  errors: {
    ruleId: string;
    ruleName: string;
    message: string;
  }[];
  rawData: LaboratorySample;
  suggestion: string;
}

export interface SummaryItem {
  sampleNo: string;
  exception: string;
  correction: string;
  conclusion: string;
}

export interface AuditReport {
  batchId: string;
  ruleVersion: string;
  ruleDescription: string;
  executionTime: string;
  executionTimeMs: number;
  statistics: {
    total: number;
    success: number;
    warning: number;
    failed: number;
  };
  beforeAfterComparison: {
    sampleNo: string;
    before: Partial<LaboratorySample>;
    after: Partial<LaboratorySample>;
  }[];
  summaries: SummaryItem[];
  nextSteps: string[];
  failedItemsPath?: string;
}

export type OutputFormat = 'json' | 'markdown' | 'download';
