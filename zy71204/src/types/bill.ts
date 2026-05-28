export type BillStatus = 
  | 'pending'
  | 'pledged'
  | 'extended'
  | 'matured'
  | 'released'
  | 'to_confirm'
  | 'closed';

export type ExceptionType = 
  | 'overdue_not_released'
  | 'extended_still_matured'
  | 'duplicate_pledged'
  | 'data_inconsistency';

export type ExceptionSeverity = 'high' | 'medium' | 'low';

export interface Bill {
  id: string;
  billNo: string;
  pledgeStatus: string;
  maturityDate: string;
  originalMaturityDate?: string;
  margin: number;
  releaseApplication?: string;
  occupancyReport?: string;
  status: BillStatus;
  statusHistory: StatusHistoryItem[];
  exceptions: ExceptionItem[];
  createdAt: string;
  updatedAt: string;
  sourceFile: string;
  isDirty: boolean;
  dirtyReason?: string;
  calculatedOccupancy?: number;
  remarks?: string;
}

export interface StatusHistoryItem {
  id: string;
  status: BillStatus;
  timestamp: string;
  operator: string;
  reason: string;
  details?: string;
}

export interface ExceptionItem {
  id: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  message: string;
  detectedAt: string;
  confirmed: boolean;
  confirmedBy?: string;
  confirmedAt?: string;
  explanation?: string;
}

export interface AuditLog {
  id: string;
  billId?: string;
  billNo?: string;
  action: string;
  operator: string;
  timestamp: string;
  details: string;
  ip?: string;
}

export interface ImportResult {
  success: boolean;
  total: number;
  validCount: number;
  dirtyCount: number;
  validBills: Bill[];
  dirtyBills: Bill[];
  errors: string[];
  warnings: string[];
}

export type ImportFileType = 'excel' | 'csv';

export interface FileUploadItem {
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'success' | 'error';
  progress: number;
  result?: ImportResult;
  error?: string;
}
