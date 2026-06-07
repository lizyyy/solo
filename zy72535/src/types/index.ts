export interface DesensitizationRule {
  id: string;
  ruleHash: string;
  content: string;
  remark: string;
  createdBy: string;
  createdAt: string;
}

export interface GrayBatch {
  id: string;
  batchName: string;
  batchNo: string;
  grayTime: string;
  remark: string;
  createdBy: string;
}

export type AutoResult = 'PASS' | 'FAIL' | 'PENDING';
export type ReviewStatus = 'DRAFT' | 'REVIEWING' | 'PENDING_REVIEW' | 'CONFIRMED';

export interface ReviewRecord {
  id: string;
  ruleId: string;
  batchId?: string;
  scriptContent: string;
  autoResult: AutoResult;
  status: ReviewStatus;
  hasManualJudgment: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeHistory {
  id: string;
  recordId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changeReason: string;
  changedAt: string;
}

export type ReviewState = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface JudgmentRecord {
  id: string;
  recordId: string;
  judgmentResult: 'PASS' | 'FAIL';
  judgmentReason: string;
  judgedBy: string;
  judgedAt: string;
  reviewStatus: ReviewState;
  reviewedBy?: string;
  reviewedAt?: string;
}

export type Assignee = '安全审核同事' | '模型评测同事小孟';

export interface EvaluationReport {
  id: string;
  recordId: string;
  conclusion: string;
  reason: string;
  missingMaterials: string[];
  nextStep: string;
  assignee: Assignee;
  generatedBy: string;
  createdAt: string;
}

export interface ImportResult {
  added: number;
  skipped: number;
  total: number;
}

export interface VisualizationNode {
  id: string;
  x: number;
  y: number;
  z: number;
  type: 'rule' | 'batch' | 'record';
  status?: AutoResult;
  label: string;
}
