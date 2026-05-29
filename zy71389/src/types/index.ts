export enum FileType {
  EXPERIMENT_CONFIG = 'experiment_config',
  USER_BUCKET = 'user_bucket',
  EXPOSURE_LOG = 'exposure_log',
  OPERATION_CHANGE = 'operation_change',
  CONVERSION_DATA = 'conversion_data',
  CONTAMINATION_REPORT = 'contamination_report',
  UNKNOWN = 'unknown'
}

export enum ContaminationType {
  CROSS_GROUP = 'cross_group',
  DUPLICATE_EXPOSURE = 'duplicate',
  CONFIG_CHANGE = 'config_change',
  NONE = 'none'
}

export enum ProcessStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  SUCCESS = 'success',
  ERROR = 'error',
  FAILED = 'failed',
  PARTIAL = 'partial',
  SKIPPED = 'skipped'
}

export interface ExperimentConfig {
  experimentId: string;
  experimentName: string;
  version: string;
  configData: Record<string, any>;
  startTime: number;
  endTime?: number;
  createdAt: number;
}

export interface UserBucket {
  userId: string;
  experimentId: string;
  groupId: string;
  groupName: string;
  bucketTime: number;
  bucketVersion: string;
}

export interface ExposureLog {
  exposureId: string;
  userId: string;
  experimentId: string;
  groupId: string;
  exposureTime: number;
  configVersion: string;
  deviceId?: string;
  pageUrl?: string;
  isContaminated: boolean;
  contaminationType: ContaminationType;
  contaminationReason?: string;
}

export interface OperationChange {
  changeId: string;
  experimentId: string;
  changeType: 'config' | 'traffic' | 'group';
  changeTime: number;
  operator: string;
  changeDescription: string;
  oldValue?: string;
  newValue?: string;
}

export interface ConversionData {
  conversionId: string;
  userId: string;
  exposureId: string;
  conversionEvent: string;
  conversionValue: number;
  conversionTime: number;
}

export interface Metrics {
  conversionRate: number;
  averageValue: number;
  totalConversions: number;
  totalValue: number;
  uniqueUsers: number;
}

export interface PhaseResult {
  phaseId: string;
  phaseName: string;
  startTime: number;
  endTime: number;
  configVersion: string;
  exposureCount: number;
  contaminationCount: number;
  metrics: Metrics;
}

export interface CheckResult {
  totalExposures: number;
  contaminatedCount: number;
  crossGroupCount: number;
  duplicateExposureCount: number;
  configChangeCount: number;
  contaminationRate: number;
  crossGroupRate: number;
  duplicateRate: number;
  configChangeRate: number;
  affectedUsers: string[];
  contaminatedExposures: string[];
  phaseResults: PhaseResult[];
  recalculatedMetrics: Metrics;
  originalMetrics: Metrics;
  consistencyChecksum: string;
  processedAt: number;
}

export interface FileRecord {
  id: string;
  name: string;
  path: string;
  size: number;
  type: FileType;
  status: ProcessStatus;
  rowCount: number;
  errorMessage?: string;
  createdAt: number;
  processedAt?: number;
}

export interface EvidenceChain {
  exposureId: string;
  userId: string;
  bucketRecords: UserBucket[];
  exposureRecords: ExposureLog[];
  configChanges: OperationChange[];
  conversionRecords: ConversionData[];
  relatedConversions: ConversionData[];
  contaminationVerdict: ContaminationType;
  verdictReason: string;
  evidenceItems: EvidenceItem[];
  consistencyHash: string;
  isConsistent: boolean;
}

export interface EvidenceItem {
  type: 'bucket' | 'exposure' | 'config_change' | 'conversion' | 'contamination';
  timestamp: number;
  label: string;
  title: string;
  description: string;
  evidence: any;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

export interface CheckConfig {
  configChangeWindowMinutes: number;
  markCrossGroup: boolean;
  markDuplicate: boolean;
  markConfigChange: boolean;
  duplicateExposureThresholdMinutes: number;
  enableCrossGroupCheck: boolean;
  enableDuplicateCheck: boolean;
  enableConfigChangeCheck: boolean;
  duplicateWindowMinutes: number;
  crossGroupGraceMinutes: number;
  minimumRecords: number;
}

export const DEFAULT_CHECK_CONFIG: CheckConfig = {
  configChangeWindowMinutes: 30,
  markCrossGroup: true,
  markDuplicate: true,
  markConfigChange: true,
  duplicateExposureThresholdMinutes: 0,
  enableCrossGroupCheck: true,
  enableDuplicateCheck: true,
  enableConfigChangeCheck: true,
  duplicateWindowMinutes: 5,
  crossGroupGraceMinutes: 10,
  minimumRecords: 10
};

export const CONTAMINATION_TYPE_LABELS: Record<ContaminationType, string> = {
  [ContaminationType.CROSS_GROUP]: '用户串组',
  [ContaminationType.DUPLICATE_EXPOSURE]: '重复曝光',
  [ContaminationType.CONFIG_CHANGE]: '配置变更污染',
  [ContaminationType.NONE]: '正常'
};

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  [FileType.EXPERIMENT_CONFIG]: '实验配置',
  [FileType.USER_BUCKET]: '用户分桶',
  [FileType.EXPOSURE_LOG]: '曝光日志',
  [FileType.OPERATION_CHANGE]: '运营变更',
  [FileType.CONVERSION_DATA]: '转化数据',
  [FileType.CONTAMINATION_REPORT]: '污染报告',
  [FileType.UNKNOWN]: '未知类型'
};

export const PROCESS_STATUS_LABELS: Record<ProcessStatus, string> = {
  [ProcessStatus.PENDING]: '待处理',
  [ProcessStatus.PROCESSING]: '处理中',
  [ProcessStatus.COMPLETED]: '已完成',
  [ProcessStatus.SUCCESS]: '成功',
  [ProcessStatus.ERROR]: '错误',
  [ProcessStatus.FAILED]: '失败',
  [ProcessStatus.PARTIAL]: '部分成功',
  [ProcessStatus.SKIPPED]: '已跳过'
};

export type ExportFormat = 'csv' | 'excel' | 'xlsx' | 'json' | 'pdf';
export type ExportContent = 'summary' | 'contamination_detail' | 'phase_metrics' | 'group_metrics' | 'consistency_report' | 'evidence_chain' | 'all' | 'contaminated' | 'normal';

export interface ConsistencyReport {
  isConsistent: boolean;
  summary: string;
  details: ConsistencyDetail[];
  checksum: string;
}

export interface ConsistencyDetail {
  name: string;
  match: boolean;
  expected: number;
  actual: number;
  diff: number;
}
