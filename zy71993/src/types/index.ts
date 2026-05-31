export type Severity = 'ignorable' | 'needs_backup' | 'dev_required';

export type IssueType =
  | 'missing_file'
  | 'corrupted_archive'
  | 'duplicate_backup'
  | 'stale_checksum'
  | 'path_with_spaces'
  | 'rollback_residual';

export type PackageStatus = 'ok' | 'missing' | 'corrupted' | 'duplicate' | 'stale_checksum' | 'error';

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  modified: string;
  checksum?: string;
}

export interface DirectorySnapshot {
  path: string;
  files: FileInfo[];
  timestamp: string;
}

export interface ChecksumEntry {
  path: string;
  algorithm: string;
  expected: string;
  actual?: string;
  match?: boolean;
}

export interface ChecksumManifest {
  entries: ChecksumEntry[];
}

export interface LogEntry {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO';
  message: string;
  source?: string;
  path?: string;
}

export interface FailureLog {
  entries: LogEntry[];
}

export interface RollbackEntry {
  timestamp: string;
  targetPath: string;
  reason: string;
  preChecksum?: string;
  postChecksum?: string;
  completed: boolean;
}

export interface RollbackRecord {
  entries: RollbackEntry[];
}

export interface IssueDetail {
  expectedPath?: string;
  actualPath?: string;
  expectedChecksum?: string;
  actualChecksum?: string;
  duplicateTimestamps?: string[];
  rollbackTimestamp?: string;
}

export interface VerificationIssue {
  id: string;
  type: IssueType;
  severity: Severity;
  path: string;
  description: string;
  detail: IssueDetail;
  relatedLogSnippet?: string;
  timestamp: string;
}

export interface BackupPackage {
  name: string;
  path: string;
  size: number;
  status: PackageStatus;
  checksumMatch?: boolean;
  timestamp: string;
  issues: string[];
}

export interface VerificationSummary {
  total: number;
  normal: number;
  missingFile: number;
  corrupted: number;
  duplicate: number;
  staleChecksum: number;
  other: number;
}

export interface VerificationResult {
  machineId: string;
  timestamp: string;
  summary: VerificationSummary;
  issues: VerificationIssue[];
  packages: BackupPackage[];
}

export interface HistoryRecord {
  machineId: string;
  verificationDate: string;
  issues: VerificationIssue[];
  resolvedIssueIds: string[];
}

export interface DataSourceMeta {
  type: 'snapshot' | 'checksum' | 'failure_log' | 'rollback';
  fileName: string;
  loaded: boolean;
  error?: string;
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  ignorable: '可忽略',
  needs_backup: '需补备份',
  dev_required: '必须研发介入',
};

export const ISSUE_TYPE_LABEL: Record<IssueType, string> = {
  missing_file: '缺文件',
  corrupted_archive: '压缩包损坏',
  duplicate_backup: '同日重复备份',
  stale_checksum: '回滚后校验值陈旧',
  path_with_spaces: '路径含空格',
  rollback_residual: '回滚残留',
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  ignorable: 'text-accent-amber',
  needs_backup: 'text-accent-red',
  dev_required: 'text-accent-purple',
};

export const SEVERITY_BG: Record<Severity, string> = {
  ignorable: 'bg-accent-amber/10 border-accent-amber/30',
  needs_backup: 'bg-accent-red/10 border-accent-red/30',
  dev_required: 'bg-accent-purple/10 border-accent-purple/30',
};

export const STATUS_COLORS: Record<PackageStatus, string> = {
  ok: 'text-accent-green',
  missing: 'text-accent-red',
  corrupted: 'text-accent-amber',
  duplicate: 'text-accent-purple',
  stale_checksum: 'text-accent-amber',
  error: 'text-accent-red',
};

export const STATUS_LABEL: Record<PackageStatus, string> = {
  ok: '正常',
  missing: '缺失',
  corrupted: '损坏',
  duplicate: '重复',
  stale_checksum: '校验值陈旧',
  error: '错误',
};
