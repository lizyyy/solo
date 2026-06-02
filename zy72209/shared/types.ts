export interface CustodianData {
  source: 'custodian';
  exDividendDate: string;
  shareRatio: number;
  totalShares: number;
  confirmDate: string;
  fileHash: string;
}

export interface ScreenshotData {
  source: 'screenshot';
  exDividendDate: string;
  shareRatio: number;
  totalShares: number;
  ocrConfidence: number;
  uploadTime: string;
}

export interface ConflictEvidence {
  field: string;
  fieldLabel: string;
  custodianValue: any;
  screenshotValue: any;
  custodianSource: string;
  screenshotSource: string;
}

export type RecordStatus = 'pending' | 'imported' | 'abnormal' | 'conflict' | 'resolved' | 'reviewed';

export interface CreditRecord {
  id: string;
  institutionCode: string;
  institutionNamePrev: string;
  institutionNameCurrent: string;
  nameConsistent: boolean;
  creditLine: number;
  occupiedAmount: number;
  availableAmount: number;
  custodianData: CustodianData;
  screenshotData?: ScreenshotData;
  hasConflict: boolean;
  conflictFields?: string[];
  conflictEvidence?: ConflictEvidence[];
  status: RecordStatus;
  supplementFields?: Record<string, any>;
  importTime: string;
  updateTime: string;
  operator: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  conflictResolution?: {
    resolution: 'confirm_custodian' | 'reject_use_screenshot';
    operator: string;
    time: string;
    remark: string;
  };
}

export interface SelfCheckDetail {
  recordId?: string;
  institutionCode?: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface SelfCheckResult {
  checkType: 'duplicate_import' | 'name_inconsistency' | 'recalculation' | 'export_consistency';
  checkName: string;
  status: 'pass' | 'warning' | 'error';
  total: number;
  abnormal: number;
  details: SelfCheckDetail[];
  runTime: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
  dataHash: string;
}

export interface ImportResult {
  imported: number;
  duplicates: number;
  nameInconsistencies: number;
  records: CreditRecord[];
}

export interface OperationLog {
  id: string;
  recordId: string;
  operationType: 'import' | 'screenshot_upload' | 'conflict_resolve' | 'supplement' | 'review' | 'recalculate';
  operator: string;
  operationTime: string;
  beforeData?: any;
  afterData?: any;
  remark?: string;
}

export interface ImportHistory {
  id: string;
  fileHash: string;
  fileName: string;
  importTime: string;
  operator: string;
  recordCount: number;
}

export type SelfCheckType = 'duplicate_import' | 'name_inconsistency' | 'recalculation' | 'export_consistency';
