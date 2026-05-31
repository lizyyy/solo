export type SourceType = 'metronome' | 'song_list' | 'sheet_music';
export type ChangeType = 'supplement' | 'revision';
export type RecordStatus = 'normal' | 'duplicate' | 'transposition_mismatch';

export interface Student {
  id: string;
  name: string;
  grade: string;
  teacherInCharge: string;
  teacherContact?: string;
}

export interface DataSource {
  id: string;
  archiveId: string;
  sourceType: SourceType;
  sourceName: string;
  recordedAt: Date;
  isBackfilled: boolean;
  recordedBy: string;
  rawData: Record<string, any>;
}

export interface TranspositionInfo {
  id: string;
  archiveId: string;
  metronomeKey?: number;
  songListKey?: number;
  sheetMusicKey?: number;
  isSynced: boolean;
  mismatchNote?: string;
}

export interface VersionHistory {
  id: string;
  archiveId: string;
  versionNumber: number;
  changedAt: Date;
  changedBy: string;
  changeDescription: string;
  changeType: ChangeType;
  diffData: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  snapshotUrl?: string;
}

export interface DuplicateInfo {
  duplicateWithId: string;
  conflictFields: string[];
  suggestedHandler: string;
  suggestedAction: string;
  sourceComparison: {
    record1Sources: SourceType[];
    record2Sources: SourceType[];
    timeGapMinutes: number;
  };
}

export interface ArchiveRecord {
  id: string;
  studentId: string;
  student: Student;
  pieceName: string;
  changeType: ChangeType;
  status: RecordStatus;
  sources: DataSource[];
  transposition?: TranspositionInfo;
  versions: VersionHistory[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  duplicateInfo?: DuplicateInfo;
  notes?: string;
}

export interface FilterState {
  studentId?: string;
  dateRange?: [string, string];
  sourceTypes?: SourceType[];
  changeTypes?: ChangeType[];
  statuses?: RecordStatus[];
  searchQuery?: string;
  page: number;
  pageSize: number;
}

export interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface HumanError {
  title: string;
  message: string;
  suggestion: string;
  severity: 'info' | 'warning' | 'error';
  fieldName?: string;
}

export interface TranspositionValidationResult {
  isSynced: boolean;
  mismatchedSources: SourceType[];
  expectedKey: number;
  actualValues: Partial<Record<SourceType, number>>;
  humanMessage: string;
}

export interface DuplicateResult {
  record1: ArchiveRecord;
  record2: ArchiveRecord;
  conflictFields: string[];
  sourceComparison: {
    record1Sources: SourceType[];
    record2Sources: SourceType[];
    timeGapMinutes: number;
  };
  suggestedHandler: string;
  suggestedAction: string;
}

export interface ExportSummary {
  id: string;
  filterStateHash: string;
  rangeDescription: string;
  recordCount: number;
  exportedAt: Date;
  exportedBy: string;
}

export interface StatsOverview {
  todayNew: number;
  pendingDuplicates: number;
  transpositionMismatches: number;
  supplementsCount: number;
}

export const SOURCE_LABELS: Record<SourceType, string> = {
  metronome: '节拍器记录',
  song_list: '选曲表',
  sheet_music: '曲谱PDF',
};

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  supplement: '补材料',
  revision: '改结论',
};

export const STATUS_LABELS: Record<RecordStatus, string> = {
  normal: '正常',
  duplicate: '重复统计',
  transposition_mismatch: '转调未同步',
};

export const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
