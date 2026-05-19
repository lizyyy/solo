export type BillingType = 'hourly' | 'area' | 'fuel' | 'mixed';

export type RecordStatus = 'pending' | 'valid' | 'invalid' | 'billed' | 'reviewed';

export type ExceptionType = 
  | 'missing_field'
  | 'invalid_format'
  | 'cross_day'
  | 'below_minimum'
  | 'duplicate'
  | 'already_billed'
  | 'data_corruption'
  | 'unknown';

export interface WorkRecord {
  id: string;
  recordNo: string;
  operator: string;
  tractorNo: string;
  operatorName: string;
  startTime: Date;
  endTime: Date;
  workHours: number;
  workArea: number;
  fuelConsumption: number;
  billingType: BillingType;
  hourlyRate: number;
  areaRate: number;
  fuelRate: number;
  minimumCharge: number;
  status: RecordStatus;
  totalAmount: number;
  calculatedAmount: number;
  finalAmount: number;
  exceptions: ExceptionInfo[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  isBilled: boolean;
  billedAt?: Date;
  billedBy?: string;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
}

export interface ExceptionInfo {
  type: ExceptionType;
  message: string;
  severity: 'warning' | 'error';
  field?: string;
  timestamp: Date;
}

export interface BillingResult {
  success: boolean;
  recordId: string;
  recordNo: string;
  calculatedAmount: number;
  finalAmount: number;
  adjustments: BillingAdjustment[];
  exceptions: ExceptionInfo[];
  status: RecordStatus;
}

export interface BillingAdjustment {
  type: string;
  reason: string;
  amount: number;
  applied: boolean;
}

export interface AuditLog {
  id: string;
  action: string;
  recordId?: string;
  operator: string;
  timestamp: Date;
  details: Record<string, any>;
  ip?: string;
}

export interface ImportOptions {
  filePath: string;
  operator: string;
  skipDuplicates?: boolean;
  validateOnly?: boolean;
}

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  duplicates: number;
  records: WorkRecord[];
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  recordNo?: string;
  errors: string[];
  data: Record<string, any>;
}

export interface QueryFilter {
  operator?: string;
  startDate?: Date;
  endDate?: Date;
  status?: RecordStatus[];
  exceptionType?: ExceptionType[];
  tractorNo?: string;
  operatorName?: string;
  isBilled?: boolean;
}

export interface ReportData {
  summary: {
    totalRecords: number;
    totalAmount: number;
    validRecords: number;
    invalidRecords: number;
    billedRecords: number;
    pendingRecords: number;
    totalExceptions: number;
  };
  records: WorkRecord[];
  generatedAt: Date;
  generatedBy: string;
  filters: QueryFilter;
}

export interface BillingConfig {
  defaultHourlyRate: number;
  defaultAreaRate: number;
  defaultFuelRate: number;
  defaultMinimumCharge: number;
  crossDaySplit: boolean;
  enforceMinimumCharge: boolean;
}
