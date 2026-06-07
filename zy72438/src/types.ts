export interface TrackAlias {
  id: string;
  trackName: string;
  aliasNames: string[];
  artist: string;
  duration: number;
  fee: number;
  importTime: number;
  source: 'alias-table' | 'checkin-photo' | 'manual';
}

export interface CheckinRecord {
  id: string;
  photoId: string;
  trackName: string;
  studentName: string;
  teacherName: string;
  checkinTime: number;
  classDate: string;
  isSubstitute: boolean;
  substituteNote?: string;
  source: 'wechat-group' | 'official-system';
  verified: boolean;
  verifier?: string;
}

export interface SplitDetail {
  id: string;
  trackId: string;
  trackName: string;
  studentName: string;
  teacherName: string;
  classDate: string;
  baseFee: number;
  teacherShare: number;
  platformShare: number;
  substituteAdjustment: number;
  totalFee: number;
  calcTime: number;
  version: number;
  remark?: string;
}

export interface ConflictItem {
  id: string;
  type: 'track-mismatch' | 'substitute-unverified' | 'fee-mismatch' | 'duplicate-import';
  severity: 'warning' | 'error' | 'info';
  message: string;
  evidence: {
    aliasTable?: any;
    checkinPhoto?: any;
    detail?: string;
  };
  resolved: boolean;
  resolution?: 'confirm' | 'reject' | 'manual';
  resolver?: string;
  resolveTime?: number;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  duplicates: number;
  conflicts: ConflictItem[];
  warnings: string[];
}

export interface SelfCheckResult {
  name: string;
  passed: boolean;
  message: string;
  detail?: any;
}

export interface WorkflowState {
  step: 1 | 2 | 3;
  stepName: string;
  aliasImported: boolean;
  checkinReviewed: boolean;
  splitCalculated: boolean;
  pendingConflicts: number;
  pendingSubstitutes: number;
}

export interface HistoryRecord {
  id: string;
  action: string;
  operator: string;
  time: number;
  detail: string;
  before?: any;
  after?: any;
}
