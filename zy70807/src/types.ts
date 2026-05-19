export interface PackageItem {
  itemNo: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  taxRate: number;
}

export interface DeclarationSubmission {
  declarationNo: string;
  submitter: string;
  submitTime: string;
  packages: PackageItem[];
  totalAmount: number;
  customsCode?: string;
  logisticsNo?: string;
}

export interface ValidationError {
  field: string;
  rowIndex?: number;
  message: string;
}

export interface DeclarationRecord {
  id: number;
  declarationNo: string;
  submitter: string;
  submitTime: string;
  totalAmount: number;
  totalTax: number;
  status: 'pending' | 'processed' | 'rejected';
  contentHash: string;
  customsCode?: string;
  logisticsNo?: string;
  rejectionReason?: string;
  processor?: string;
  processedAt?: string;
  createdAt: string;
}

export interface PackageRecord {
  id: number;
  declarationId: number;
  itemNo: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  taxRate: number;
  taxAmount: number;
}

export interface SubmissionResult {
  success: boolean;
  isDuplicate?: boolean;
  declarationId?: number;
  declarationNo?: string;
  errors?: ValidationError[];
  existingRecord?: DeclarationRecord & { packages: PackageRecord[] };
}

export interface QueryParams {
  declarationNo?: string;
  submitter?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface Statistics {
  totalCount: number;
  pendingCount: number;
  processedCount: number;
  rejectedCount: number;
  totalAmount: number;
  totalTax: number;
}
