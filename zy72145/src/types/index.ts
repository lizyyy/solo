export type ValidationStatus =
  | 'normal'
  | 'auth_expired'
  | 'tc_mismatch'
  | 'duplicate'
  | 'dirty_data';

export interface ValidationError {
  type: ValidationStatus;
  message: string;
  field: string;
}

export interface ModifyHistory {
  timestamp: number;
  oldRemark: string;
  newRemark: string;
  diff: string;
}

export interface TrackRecord {
  id: string;
  teacherName: string;
  trackName: string;
  authStart: string;
  authEnd: string;
  tcIn: string;
  tcOut: string;
  duration: number;
  remark: string;
  sourceFile: string;
  importedAt: number;
  lastModifiedAt: number;
  validationStatus: ValidationStatus;
  validationErrors: ValidationError[];
  modifyHistory: ModifyHistory[];
  rawData: Record<string, unknown>;
  duplicateGroupId?: string;
}

export interface FilterState {
  status: ValidationStatus | 'all';
  teacherName: string;
  trackName: string;
  dateFrom: string;
  dateTo: string;
}

export interface ImportStats {
  total: number;
  success: number;
  warnings: number;
  errors: number;
  dirtyRecords: TrackRecord[];
}

export interface AppState {
  records: TrackRecord[];
  filters: FilterState;
  selectedIds: string[];
  importStats: ImportStats | null;
  showImportModal: boolean;
}

export const STATUS_LABELS: Record<ValidationStatus | 'all', string> = {
  all: '全部',
  normal: '正常',
  auth_expired: '授权过期',
  tc_mismatch: '时码错位',
  duplicate: '重复曲目',
  dirty_data: '脏数据',
};

export const STATUS_COLORS: Record<ValidationStatus, string> = {
  normal: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  auth_expired: 'bg-amber-100 text-amber-700 border-amber-300',
  tc_mismatch: 'bg-rose-100 text-rose-700 border-rose-300',
  duplicate: 'bg-purple-100 text-purple-700 border-purple-300',
  dirty_data: 'bg-slate-100 text-slate-700 border-slate-300',
};
