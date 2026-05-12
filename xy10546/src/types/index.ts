export interface CompanyHeader {
  id: string;
  name: string;
  taxId: string;
  groupId: string;
  companyType: 'parent' | 'subsidiary' | 'branch';
  allowedDepartments: string[];
  status: 'active' | 'inactive';
}

export interface Employee {
  id: string;
  name: string;
  employeeId: string;
  departmentId: string;
  departmentName: string;
  email: string;
}

export interface Department {
  id: string;
  name: string;
  manager: string;
  allowedCompanyHeaders: string[];
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceCode: string;
  headerName: string;
  taxId: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  invoiceDate: string;
  sellerName: string;
  sellerTaxId: string;
  invoiceType: 'food' | 'travel' | 'purchase' | 'other';
  items: InvoiceItem[];
  submitterId: string;
  submitterName: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_review' | 'corrected';
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface ReimbursementForm {
  id: string;
  formNumber: string;
  applicantId: string;
  applicantName: string;
  departmentId: string;
  departmentName: string;
  expectedHeaderName: string;
  expectedTaxId: string;
  totalAmount: number;
  invoiceIds: string[];
  description: string;
  status: 'draft' | 'submitted' | 'reviewing' | 'approved' | 'rejected' | 'needs_correction';
  createdAt: string;
  updatedAt: string;
}

export interface AuditRecord {
  id: string;
  targetType: 'invoice' | 'reimbursement' | 'correction';
  targetId: string;
  action: string;
  operatorId: string;
  operatorName: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  diff?: DiffItem[];
  reason?: string;
  timestamp: string;
}

export interface DiffItem {
  field: string;
  before: any;
  after: any;
}

export type CheckResult = 
  | 'auto_pass' 
  | 'needs_reissue' 
  | 'manual_review' 
  | 'correction_suggested';

export interface CheckIssue {
  id: string;
  type: 'duplicate_invoice' 
    | 'header_mismatch' 
    | 'similar_header' 
    | 'cross_company_header'
    | 'amount_mismatch' 
    | 'amount_split'
    | 'tax_id_mismatch'
    | 'other';
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  suggestion?: string;
  affectedFields?: string[];
  relatedEntities?: {
    type: 'invoice' | 'reimbursement' | 'company';
    id: string;
    name: string;
  }[];
}

export interface InvoiceCheckReport {
  invoiceId: string;
  invoiceNumber: string;
  reimbursementId?: string;
  reimbursementNumber?: string;
  result: CheckResult;
  issues: CheckIssue[];
  passCount: number;
  warnCount: number;
  errorCount: number;
  checkedAt: string;
}

export interface Correction {
  id: string;
  invoiceId: string;
  operatorId: string;
  operatorName: string;
  changes: DiffItem[];
  reason: string;
  status: 'pending_approval' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
}
