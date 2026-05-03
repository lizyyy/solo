export interface ReceiptTemplate {
  name: string;
  width: '58mm' | '80mm';
  header: TemplateSection[];
  items: ItemsSection;
  footer: TemplateSection[];
  commands: CommandConfig;
}

export interface TemplateSection {
  type: 'text' | 'separator' | 'barcode' | 'qrcode' | 'space';
  content?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  size?: 'normal' | 'double';
  lines?: number;
  value?: string;
  height?: number;
}

export interface ItemsSection {
  columns: ItemColumn[];
  separator?: boolean;
}

export interface ItemColumn {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'right';
}

export interface CommandConfig {
  cut: boolean;
  openDrawer: boolean;
  beep?: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  time: string;
  cashier: string;
  items: TransactionItem[];
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  payment: PaymentInfo;
  customer?: {
    name?: string;
    phone?: string;
    memberId?: string;
  };
  store: {
    name: string;
    address: string;
    phone: string;
  };
}

export interface TransactionItem {
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
  category?: string;
}

export interface PaymentInfo {
  method: string;
  amount: number;
  change?: number;
  cardInfo?: string;
}

export interface PrinterProfile {
  model: string;
  width: '58mm' | '80mm';
  charsPerLine: number;
  supportsQRCode: boolean;
  supportsBarcode: boolean;
  supportsCut: boolean;
  supportsOpenDrawer: boolean;
  maxBarcodeHeight: number;
  qrCodeSize: number;
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  field?: string;
  message: string;
  transactionId?: string;
  templateName?: string;
  printerModel?: string;
  lineNumber?: number;
}

export interface RenderedReceipt {
  transactionId: string;
  templateName: string;
  width: '58mm' | '80mm';
  lines: RenderedLine[];
  commands: CommandInfo[];
}

export interface RenderedLine {
  content: string;
  type: 'text' | 'separator' | 'barcode' | 'qrcode' | 'space';
  width: number;
  align: 'left' | 'center' | 'right';
}

export interface CommandInfo {
  type: 'cut' | 'openDrawer' | 'beep';
  supported: boolean;
  printerModel: string;
}