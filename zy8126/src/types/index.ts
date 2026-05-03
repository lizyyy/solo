export interface PrinterProfile {
  name: string;
  paperWidth: 58 | 80;
  charsPerLine: number;
  supportedEncodings: string[];
  hasBarcode: boolean;
  maxLinesPerPage?: number;
  features: {
    cutter?: boolean;
    cashDrawer?: boolean;
    twoColor?: boolean;
  };
}

export interface PrinterProfiles {
  [profileName: string]: PrinterProfile;
}

export interface TemplateElement {
  type: 'text' | 'line' | 'barcode' | 'qrcode' | 'space' | 'table' | 'section';
  content?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  doubleWidth?: boolean;
  doubleHeight?: boolean;
  fontSize?: 'normal' | 'large' | 'small';
  lines?: number;
  barcodeType?: string;
  barcodeData?: string;
  qrcodeData?: string;
  columns?: Array<{
    key: string;
    width: number;
    align?: 'left' | 'center' | 'right';
  }>;
  rows?: string[][];
  conditional?: string;
}

export interface Template {
  name: string;
  version: string;
  description?: string;
  printerProfile: string;
  elements: TemplateElement[];
  variables?: string[];
  defaultData?: Record<string, unknown>;
}

export interface TransactionItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxRate?: number;
  taxAmount?: number;
}

export interface Transaction {
  id: string;
  timestamp: string;
  type: 'sale' | 'refund' | 'void';
  items: TransactionItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  paymentMethod: string;
  paymentAmount: number;
  changeAmount: number;
  cashier?: string;
  registerId?: string;
  customerInfo?: {
    name?: string;
    phone?: string;
    memberId?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface RenderedLine {
  text: string;
  originalWidth: number;
  visualWidth: number;
  align: 'left' | 'center' | 'right';
  style: {
    bold?: boolean;
    doubleWidth?: boolean;
    doubleHeight?: boolean;
  };
  elementIndex: number;
}

export interface RenderedReceipt {
  templateName: string;
  transactionId: string;
  paperWidth: 58 | 80;
  charsPerLine: number;
  lines: RenderedLine[];
  totalLines: number;
  totalVisualWidth: number;
}

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  type: string;
  severity: IssueSeverity;
  message: string;
  templateName?: string;
  transactionId?: string;
  elementIndex?: number;
  lineNumber?: number;
  field?: string;
  expected?: string;
  actual?: string;
  context?: Record<string, unknown>;
}

export interface ValidationResult {
  templateName: string;
  transactionId: string;
  issues: ValidationIssue[];
  statistics: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
  };
}

export interface ExportResult {
  previewFile: string;
  issuesFile: string;
  reportFile: string;
  timestamp: string;
  summary: {
    totalReceipts: number;
    totalIssues: number;
    errors: number;
    warnings: number;
  };
}
