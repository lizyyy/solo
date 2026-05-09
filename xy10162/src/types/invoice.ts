export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceCode: string;
  invoiceDate: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  sellerName: string;
  buyerName: string;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  isRedInvoice: boolean;
  originalInvoiceNumber?: string;
  originalInvoiceCode?: string;
  remark?: string;
  rawData?: Record<string, any>;
  importBatchId?: string;
  importTime?: Date;
  validationErrors?: ValidationError[];
}

export type InvoiceType = 
  | '增值税专用发票'
  | '增值税普通发票'
  | '电子普通发票'
  | '电子专用发票'
  | '机动车销售统一发票'
  | '二手车销售统一发票'
  | '其他';

export type InvoiceStatus = 
  | '正常'
  | '作废'
  | '红冲'
  | '异常'
  | '待核验';

export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  field?: string;
  relatedInvoiceId?: string;
}

export type ValidationErrorType = 
  | 'DUPLICATE_INVOICE'
  | 'RED_INVOICE_WITHOUT_ORIGINAL'
  | 'RED_INVOICE_AMOUNT_MISMATCH'
  | 'AMOUNT_TOTAL_MISMATCH'
  | 'INVALID_INVOICE_NUMBER'
  | 'INVALID_INVOICE_CODE'
  | 'INVALID_DATE'
  | 'INVALID_AMOUNT'
  | 'MISSING_REQUIRED_FIELD';

export interface ValidationOptions {
  checkDuplicates: boolean;
  checkRedInvoices: boolean;
  checkAmountConsistency: boolean;
  strictMode: boolean;
}

export interface ValidationResult {
  totalInvoices: number;
  validInvoices: number;
  invalidInvoices: number;
  duplicateGroups: DuplicateGroup[];
  redInvoiceRelations: RedInvoiceRelation[];
  errors: ValidationError[];
  processingTime: number;
  batchId: string;
}

export interface DuplicateGroup {
  key: string;
  invoices: Invoice[];
  recommendedInvoice?: Invoice;
}

export interface RedInvoiceRelation {
  redInvoice: Invoice;
  originalInvoice?: Invoice;
  isValid: boolean;
  reason?: string;
}

export interface ImportResult {
  success: boolean;
  totalRecords: number;
  importedRecords: number;
  failedRecords: number;
  failedRecordsDetails: FailedRecord[];
  invoices: Invoice[];
  batchId: string;
}

export interface FailedRecord {
  lineNumber: number;
  rawData: Record<string, any>;
  error: string;
}

export interface HistoryRecord {
  id: string;
  batchId: string;
  importTime: Date;
  fileName: string;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  validationResult?: ValidationResult;
  invoices: Invoice[];
}

export interface ExportOptions {
  format: 'csv' | 'json';
  includeRawData: boolean;
  includeErrors: boolean;
  includeDuplicates: boolean;
  includeRedInvoices: boolean;
}
