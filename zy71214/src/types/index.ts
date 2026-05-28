export type BusinessStatus =
  | 'pending'
  | 'processing'
  | 'issue_found'
  | 'supplementing'
  | 'pending_review'
  | 'duplicate_check'
  | 'confirmed'
  | 'withdrawn'
  | 'rejected'
  | 'closed';

export type AuditAction =
  | 'create'
  | 'submit'
  | 'detect_issue'
  | 'request_supplement'
  | 'upload_supplement'
  | 'recheck'
  | 'review_pass'
  | 'review_reject'
  | 'confirm'
  | 'withdraw'
  | 'resubmit'
  | 'export';

export type IssueType =
  | 'purpose_mismatch'
  | 'supplement_covers'
  | 'duplicate_remittance'
  | 'amount_mismatch'
  | 'date_invalid'
  | 'document_missing'
  | 'manual_marked';

export type IssueSeverity = 'low' | 'medium' | 'high';
export type IssueStatus = 'open' | 'resolved' | 'ignored';
export type RiskLevel = 'normal' | 'warning' | 'danger';
export type SupplementType = 'contract' | 'invoice' | 'purpose' | 'other';
export type ConclusionResult = 'pass' | 'reject' | 'supplement';

export interface RemittanceApplication {
  id: string;
  businessNo: string;
  version: number;
  amount: number;
  currency: string;
  payeeName: string;
  payeeBank: string;
  payeeAccount?: string;
  purposeCode: string;
  purposeDescription: string;
  submitter: string;
  submitTime: string;
}

export interface Contract {
  id: string;
  businessNo: string;
  version: number;
  contractNo: string;
  contractDate: string;
  amount: number;
  currency: string;
  goodsDescription: string;
  signatoryA: string;
  signatoryB: string;
  isSupplement: boolean;
  uploader: string;
  uploadTime: string;
}

export interface Invoice {
  id: string;
  businessNo: string;
  version: number;
  invoiceNo: string;
  invoiceDate: string;
  amount: number;
  currency: string;
  goodsDescription: string;
  sellerName: string;
  buyerName: string;
  isSupplement: boolean;
  uploader: string;
  uploadTime: string;
}

export interface SupplementRecord {
  id: string;
  businessNo: string;
  version: number;
  supplementType: SupplementType;
  originalDocumentId: string;
  newDocumentId: string;
  reason: string;
  operator: string;
  operateTime: string;
  coversOriginal: boolean;
}

export interface AuditTrail {
  id: string;
  businessNo: string;
  action: AuditAction;
  operator: string;
  operateTime: string;
  remark: string;
  fromStatus: BusinessStatus;
  toStatus: BusinessStatus;
}

export interface Issue {
  id: string;
  businessNo: string;
  type: IssueType;
  severity: IssueSeverity;
  description: string;
  detectedBy: 'system' | 'manual';
  detectedAt: string;
  status: IssueStatus;
  resolution: string | null;
  resolvedAt: string | null;
  resolver: string | null;
  relatedDocumentId?: string;
}

export interface AuditConclusion {
  id: string;
  businessNo: string;
  result: ConclusionResult;
  remark: string;
  auditor: string;
  auditTime: string;
  reviewer: string | null;
  reviewTime: string | null;
  isFinal: boolean;
}

export interface BusinessObject {
  id: string;
  businessNo: string;
  customerName: string;
  customerId: string;
  amount: number;
  currency: string;
  purposeCode: string;
  purposeName: string;
  status: BusinessStatus;
  riskLevel: RiskLevel;
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
  applications: RemittanceApplication[];
  contracts: Contract[];
  invoices: Invoice[];
  supplementRecords: SupplementRecord[];
  auditTrails: AuditTrail[];
  issues: Issue[];
  conclusion: AuditConclusion | null;
  duplicateWith?: string[];
}

export interface PurposeCodeRule {
  code: string;
  name: string;
  keywords: string[];
  category: string;
}

export interface User {
  id: string;
  name: string;
  role: 'teller' | 'supervisor' | 'auditor';
  department: string;
}
