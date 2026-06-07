export type RecordSource = 'ramp' | 'sampling' | 'merged';

export type RecordStatus = 'normal' | 'pending_review' | 'conflict' | 'archived';

export interface RampRecord {
  id: string;
  originalRowNumber: number;
  sourceFile: string;
  location: string;
  hasRamp: boolean;
  rampCondition: string;
  residentOpinionOriginal?: string;
  residentOpinionSummary: string;
  importTime: string;
  importedBy: string;
}

export interface SamplingRecord {
  id: string;
  originalRowNumber: number;
  sourceFile: string;
  location: string;
  samplingPoint: string;
  nightService: boolean;
  residentOpinionOriginal?: string;
  residentOpinionSummary: string;
  importTime: string;
  importedBy: string;
}

export interface ModificationLog {
  id: string;
  timestamp: string;
  operator: string;
  action: string;
  beforeChanges?: Record<string, any>;
  afterChanges?: Record<string, any>;
}

export interface FinalRecord {
  id: string;
  source: RecordSource;
  location: string;
  status: RecordStatus;
  rampData?: RampRecord;
  samplingData?: SamplingRecord;
  residentOpinionOriginal?: string;
  residentOpinionSummary: string;
  hasOpinionOriginal: boolean;
  lastModified: string;
  modifiedBy: string;
  modificationHistory: ModificationLog[];
}

export interface ConflictRecord {
  id: string;
  location: string;
  rampRecord: RampRecord;
  samplingRecord: SamplingRecord;
  conflictFields: string[];
  status: 'pending' | 'resolved';
  resolution?: 'keep_ramp' | 'keep_sampling' | 'merge';
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface SelfCheckResult {
  duplicateImports: FinalRecord[];
  missingOpinionOriginal: FinalRecord[];
  recalculationNeeded: FinalRecord[];
  exportConsistency: {
    isConsistent: boolean;
    mismatches: Array<{
      recordId: string;
      field: string;
      pageValue: any;
      exportValue: any;
    }>;
  };
}

export interface ImportResult {
  success: number;
  duplicates: number;
  anomalies: number;
  records: FinalRecord[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
