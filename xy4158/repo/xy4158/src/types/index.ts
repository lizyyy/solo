export interface ProjectConfig {
  name: string;
  created: string;
  description?: string;
  rules: ValidationRules;
  devices: DeviceConfig[];
}

export interface DeviceConfig {
  id: string;
  name: string;
  type: DeviceType;
  expectedInterval: number;
  timeOffset?: number;
  calibrationPoints?: CalibrationPoint[];
}

export type DeviceType = 'logger' | 'camera' | 'sensor';

export interface CalibrationPoint {
  deviceTime: string;
  actualTime: string;
}

export interface ValidationRules {
  allowedExtensions: string[];
  maxMissingIntervals: number;
  maxTimeDriftMinutes: number;
  minFileSize: number;
  maxDuplicateThreshold: number;
  requireDeviceIdInFilename: boolean;
}

export interface ScannedFile {
  id: string;
  path: string;
  name: string;
  extension: string;
  size: number;
  lastModified: string;
  deviceId?: string;
  detectedTime?: string;
  fileType: FileType;
  hash: string;
  isValid: boolean;
  validationErrors: string[];
}

export type FileType = 'csv' | 'image' | 'log' | 'unknown';

export interface TimelineEntry {
  deviceId: string;
  fileId: string;
  fileName: string;
  startTime: string;
  endTime: string;
  recordCount: number;
  normalizedTime: string;
  timeDriftMinutes: number;
}

export interface ValidationIssue {
  id: string;
  type: IssueType;
  severity: Severity;
  deviceId: string;
  fileId?: string;
  fileName?: string;
  description: string;
  details: Record<string, any>;
  suggestedAction: string;
}

export type IssueType = 
  | 'missing_records'
  | 'time_drift'
  | 'duplicate_file'
  | 'corrupted_file'
  | 'invalid_filename'
  | 'cross_device_conflict'
  | 'file_too_small'
  | 'unexpected_extension';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface QuarantineEntry {
  issueId: string;
  fileId: string;
  action: 'quarantine' | 'ignore' | 'fix';
  quarantinePath?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface ProjectState {
  config: ProjectConfig;
  scannedFiles: ScannedFile[];
  timelineEntries: TimelineEntry[];
  issues: ValidationIssue[];
  quarantines: QuarantineEntry[];
  lastScanned?: string;
  lastValidated?: string;
}

export interface ExportReport {
  summary: ReportSummary;
  issues: ValidationIssue[];
  devices: DeviceReport[];
  statistics: Statistics;
}

export interface ReportSummary {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  issuesBySeverity: Record<Severity, number>;
  scanDate: string;
}

export interface DeviceReport {
  deviceId: string;
  deviceName: string;
  files: number;
  records: number;
  startTime: string;
  endTime: string;
  timeDrift: number;
  issues: number;
  missingIntervals: number[];
}

export interface Statistics {
  totalRecords: number;
  dataRangeHours: number;
  expectedRecords: number;
  actualRecords: number;
  completenessPercentage: number;
}

export interface CleanIndex {
  deviceId: string;
  cleanFiles: CleanFileEntry[];
  timeOffsets: Record<string, number>;
  mergedTimeline: string[];
}

export interface CleanFileEntry {
  fileId: string;
  originalPath: string;
  cleanPath: string;
  timeAdjustmentMinutes: number;
  validFrom: string;
  validTo: string;
}
