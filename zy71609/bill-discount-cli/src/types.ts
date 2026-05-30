export interface Bill {
  billNo: string;
  drawer: string;
  payee: string;
  acceptor: string;
  amount: number;
  issueDate: string;
  maturityDate: string;
  billType: '电子' | '纸质';
  status: BillStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type BillStatus = 'pending' | 'discounted' | 'matured' | 'paid' | 'overdue';

export interface Quote {
  id: string;
  bankName: string;
  billType: '电子' | '纸质';
  rate: number;
  effectiveDate: string;
  expiryDate: string;
  version: number;
  minAmount: number;
  maxAmount: number;
  createdAt: string;
}

export interface Application {
  appId: string;
  billNo: string;
  bankName: string;
  discountDate: string;
  appliedRate: number;
  status: AppStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type AppStatus = 'pending' | 'approved' | 'rejected' | 'recalculated';

export interface CalendarEntry {
  date: string;
  isWorkday: boolean;
  holidayName: string;
}

export interface Payment {
  paymentId: string;
  billNo: string;
  amount: number;
  paymentDate: string;
  payer: string;
  payee: string;
  status: PaymentStatus;
  createdAt: string;
}

export type PaymentStatus = 'pending' | 'completed' | 'failed';

export type AnomalyCategory = 'data' | 'rule' | 'material';
export type AnomalySeverity = 'error' | 'warning' | 'info';

export interface Anomaly {
  id: string;
  billNo: string;
  category: AnomalyCategory;
  severity: AnomalySeverity;
  code: string;
  message: string;
  detail: string;
  resolved: boolean;
  resolvedAt: string;
  resolution: string;
  createdAt: string;
}

export type ImportStrategy = 'skip' | 'update' | 'conflict';

export interface ConflictRecord {
  key: string;
  dataType: string;
  fieldName: string;
  existingValue: string;
  newValue: string;
  strategy: ImportStrategy;
  resolved: boolean;
}

export interface ImportResult {
  dataType: string;
  total: number;
  inserted: number;
  skipped: number;
  updated: number;
  conflicts: ConflictRecord[];
  timestamp: string;
}

export interface CalculationResult {
  billNo: string;
  appId: string;
  bankName: string;
  amount: number;
  discountDate: string;
  maturityDate: string;
  interestDays: number;
  appliedRate: number;
  matchedQuoteId: string;
  matchedRate: number;
  discountInterest: number;
  netAmount: number;
  rateDiff: number;
  interestDiff: number;
  anomalies: Anomaly[];
  calculatedAt: string;
}

export interface ReportEntry {
  billNo: string;
  appId: string;
  drawer: string;
  acceptor: string;
  amount: number;
  discountDate: string;
  maturityDate: string;
  interestDays: number;
  appliedRate: number;
  matchedRate: number;
  discountInterest: number;
  netAmount: number;
  rateDiff: number;
  interestDiff: number;
  anomalies: Anomaly[];
  status: string;
}

export type DataType = 'bills' | 'quotes' | 'applications' | 'calendar' | 'payments';

export interface Store {
  bills: Bill[];
  quotes: Quote[];
  applications: Application[];
  calendar: CalendarEntry[];
  payments: Payment[];
  anomalies: Anomaly[];
  calculations: CalculationResult[];
  importHistory: ImportResult[];
}
