export type RecordStatus = 'pending' | 'investigating' | 'resolved' | 'disputed';

export type ChangeType = 'material_only' | 'conclusion_changed';

export type SourceType = 'refund_list' | 'settlement_attachment' | 'bank_statement' | 'manual_adjustment';

export type IssueCategory = 
  | 'fee_carryover'
  | 'refund_early_arrival'
  | 'attachment_late_submit'
  | 'statement_manual_edit'
  | 'amount_mismatch'
  | 'missing_document'
  | 'other';

export interface User {
  id: string;
  name: string;
  role: 'store_accountant' | 'hq_accountant' | 'finance_manager';
}

export interface Attachment {
  id: string;
  name: string;
  type: SourceType;
  uploadedBy: string;
  uploadedAt: string;
  version: number;
  fileHash?: string;
  note?: string;
}

export interface VersionSnapshot {
  amount: number;
  status: RecordStatus;
  conclusion: string;
  issueCategory: IssueCategory;
  attachments: Attachment[];
}

export interface ChangeDetail {
  field: string;
  oldValue: string;
  newValue: string;
  changeType: ChangeType;
}

export interface VersionHistory {
  id: string;
  version: number;
  timestamp: string;
  modifiedBy: string;
  changeReason: string;
  changes: ChangeDetail[];
  snapshot: VersionSnapshot;
}

export interface ShortageRecord {
  id: string;
  storeId: string;
  storeName: string;
  accountingPeriod: string;
  amount: number;
  status: RecordStatus;
  issueCategory: IssueCategory;
  source: SourceType;
  sourceRef: string;
  conclusion: string;
  pendingReason: string;
  attachments: Attachment[];
  versionHistory: VersionHistory[];
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  hasUnresolvedChanges: boolean;
  latestAlert?: string;
}

export interface FilterOptions {
  status?: RecordStatus[];
  storeId?: string;
  period?: string;
  hasUnresolvedChanges?: boolean;
  changeType?: ChangeType;
}
