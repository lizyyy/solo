export type EvidencePackStatus = 
  | 'pending' 
  | 'parsing' 
  | 'parsed' 
  | 'judging' 
  | 'judged' 
  | 'reviewing' 
  | 'completed' 
  | 'archived';

export type JudgmentConclusion = 
  | 'normal' 
  | 'need_supplement' 
  | 'need_review' 
  | 'pending' 
  | 'abnormal';

export type EvidenceType = 
  | 'transaction' 
  | 'screenshot' 
  | 'email' 
  | 'correction';

export type ReviewAction = 
  | 'confirm' 
  | 'reject' 
  | 'supplement' 
  | 'correction';

export type Severity = 'info' | 'warning' | 'error';

export interface EvidenceItem {
  id: string;
  packId: string;
  type: EvidenceType;
  timestamp: Date;
  title: string;
  description: string;
  isDuplicate?: boolean;
  isLate?: boolean;
  isCorrection?: boolean;
  source: string;
}

export interface TransactionRecord extends EvidenceItem {
  type: 'transaction';
  transactionNo: string;
  amount: number;
  currency: string;
  counterparty: string;
  accountNo?: string;
  remark?: string;
}

export interface ApprovalScreenshot extends EvidenceItem {
  type: 'screenshot';
  filename: string;
  imageUrl: string;
  approver?: string;
  approvalStatus?: string;
}

export interface SupplementEmail extends EvidenceItem {
  type: 'email';
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  content: string;
  attachments: string[];
}

export interface CorrectionRecord extends EvidenceItem {
  type: 'correction';
  correctedItemId: string;
  correctionType: 'amount' | 'date' | 'status' | 'other';
  beforeValue: string;
  afterValue: string;
  operator: string;
}

export interface JudgmentReason {
  ruleCode: string;
  ruleName: string;
  description: string;
  severity: Severity;
  evidenceIds: string[];
}

export interface JudgmentResult {
  id: string;
  packId: string;
  conclusion: JudgmentConclusion;
  reasons: JudgmentReason[];
  nextStep: string;
  nextStepDetails: string[];
  judgedAt: Date;
  confidence: number;
}

export interface ReviewRecord {
  id: string;
  packId: string;
  reviewer: string;
  reviewedAt: Date;
  action: ReviewAction;
  comment: string;
  evidenceItems?: string[];
}

export interface EvidencePack {
  id: string;
  name: string;
  importedAt: Date;
  status: EvidencePackStatus;
  reviewer?: string;
  description?: string;
  tags?: string[];
}

export interface EvidencePackDetail extends EvidencePack {
  transactions: TransactionRecord[];
  screenshots: ApprovalScreenshot[];
  emails: SupplementEmail[];
  corrections: CorrectionRecord[];
  judgmentResult?: JudgmentResult;
  reviewRecords: ReviewRecord[];
}

export type AllEvidence = TransactionRecord | ApprovalScreenshot | SupplementEmail | CorrectionRecord;

export interface StatData {
  total: number;
  pending: number;
  reviewing: number;
  completed: number;
  abnormal: number;
}
