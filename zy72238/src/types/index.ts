export interface Transaction {
  id: string;
  businessNo: string;
  type: 'principal' | 'fee';
  amount: number;
  counterTailNo: string;
  source: 'counter' | 'email';
  status: 'normal' | 'pending_review' | 'reviewed' | 'rejected';
  createdAt: string;
}

export interface SupplementEmail {
  id: string;
  businessNo: string;
  content: string;
  emailAmount: number;
  emailCounterTailNo: string;
  relatedTransactionId: string;
  conflictStatus: 'none' | 'conflict' | 'resolved';
  operatorDecision: 'confirmed' | 'rejected' | 'pending';
  createdAt: string;
}

export interface DifferenceItem {
  id: string;
  businessNo: string;
  category: 'split_row' | 'data_mismatch' | 'duplicate' | 'other';
  description: string;
  status: 'open' | 'pending_review' | 'resolved' | 'rejected';
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: 'import' | 'supplement' | 'conflict_resolve' | 'review' | 'export';
  operator: string;
  detail: string;
  timestamp: string;
}

export interface SelfCheckResult {
  id: string;
  type: 'duplicate_import' | 'split_row' | 'recalc_mismatch' | 'export_inconsistency';
  severity: 'error' | 'warning' | 'info';
  message: string;
  relatedBusinessNos: string[];
}
