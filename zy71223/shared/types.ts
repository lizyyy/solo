export type VoucherStatus = 'pending' | 'parsing' | 'reviewing' | 'revised' | 'completed' | 'exception';

export type SubjectCategory = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type Direction = 'debit' | 'credit';

export interface AccountSubject {
  id: string;
  code: string;
  name: string;
  category: SubjectCategory;
  direction: Direction;
  isSystem: boolean;
}

export interface ReceiptImage {
  id: string;
  voucherId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  clarity: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ParseResult {
  id: string;
  voucherId: string;
  amount: number | null;
  date: string | null;
  description: string | null;
  merchant: string | null;
  confidence: number;
  rawText: string | null;
  parsedAt: string;
}

export interface SubjectMapping {
  id: string;
  voucherId: string;
  subjectId: string;
  subjectName?: string;
  subjectCode?: string;
  direction: Direction;
  amount: number;
  isSuggested: boolean;
  suggestionReason: string | null;
  adjustedBy: string | null;
  adjustedAt: string | null;
  adjustmentReason: string | null;
}

export interface CustomerNote {
  id: string;
  voucherId: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface Revision {
  id: string;
  voucherId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string;
  reason: string;
  revisedBy: string;
  revisedAt: string;
}

export interface BalanceRecord {
  id: string;
  subjectId: string;
  subjectCode?: string;
  subjectName?: string;
  period: string;
  openingBalance: number;
  currentDebit: number;
  currentCredit: number;
  closingBalance: number;
  direction: Direction;
  isOverdrawn: boolean;
  warningReason: string | null;
}

export interface ReportItem {
  id: string;
  reportId: string;
  voucherId: string;
  voucherNo: string;
  date: string;
  description: string | null;
  amount: number;
  subjectName: string;
  hasException: boolean;
  exceptionReason: string | null;
  customerName: string;
  status: VoucherStatus;
}

export interface CollationReport {
  id: string;
  period: string;
  voucherCount: number;
  totalVouchers: number;
  completedVouchers: number;
  reviewingVouchers: number;
  exceptionVouchers: number;
  totalAmount: number;
  exceptionCount: number;
  revisionCount: number;
  generatedBy: string;
  createdAt: string;
  items: ReportItem[];
}

export interface CashVoucher {
  id: string;
  voucherNo: string;
  customerName: string;
  status: VoucherStatus;
  amount: number;
  date: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  images: ReceiptImage[];
  parseResult: ParseResult | null;
  mappings: SubjectMapping[];
  notes: CustomerNote[];
  revisions: Revision[];
}

export interface SubjectSuggestion {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  confidence: number;
  reason: string;
}

export interface BalanceWarning {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  type: 'overdrawn' | 'unusual' | 'mismatch';
  message: string;
  suggestion: string;
}

export interface VoucherSummary {
  total: number;
  pending: number;
  reviewing: number;
  exception: number;
  completed: number;
  revised: number;
}
