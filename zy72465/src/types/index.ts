export type RecordStatus = 
  | 'imported' 
  | 'pending_review' 
  | 'sampling_reviewed' 
  | 'summary_updated' 
  | 'inspector_confirmed' 
  | 'completed';

export type StepNumber = 1 | 2 | 3;

export type Credibility = 'high' | 'medium' | 'low';

export type UserRole = 'aning' | 'inspector' | 'street';

export type HistoryAction = 
  | 'create' 
  | 'update_status' 
  | 'update_name' 
  | 'add_sampling' 
  | 'update_summary' 
  | 'rollback'
  | 'confirm_name';

export type ExportFormat = 'excel' | 'csv' | 'street_summary';

export interface RampRecord {
  exists: boolean;
  location: string;
  condition: string;
  source: 'import';
}

export interface SamplingPoint {
  exists: boolean;
  location: string;
  credibility: Credibility;
  reviewedBy: string;
  reviewedAt: Date;
}

export interface Summary {
  content: string;
  updatedBy: string;
  updatedAt: Date;
}

export interface ApprovalRecord {
  id: string;
  originalLineNumber: number;
  importBatchId?: string;
  communityOldName?: string;
  communityNewName?: string;
  communityFinalName?: string;
  hasNameConflict: boolean;
  rampRecord: RampRecord;
  samplingPoint?: SamplingPoint;
  status: RecordStatus;
  currentStep: StepNumber;
  summary?: Summary;
  assignee?: UserRole;
  createdAt: Date;
  updatedAt: Date;
  _snapshot?: Record<string, unknown>;
}

export interface HistoryEntry {
  id: string;
  recordId: string;
  action: HistoryAction;
  operator: string;
  operatorRole: UserRole;
  timestamp: Date;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  snapshotBefore?: ApprovalRecord;
  snapshotAfter?: ApprovalRecord;
  remark?: string;
}

export interface ExportLog {
  id: string;
  format: ExportFormat;
  filename: string;
  exportedBy: string;
  exportedByRole: UserRole;
  exportedAt: Date;
  recordCount: number;
  recordIds: string[];
  dataSnapshotHash: string;
  dataSnapshot: ApprovalRecord[];
  consistencyVerified: boolean;
  consistencyHash: string;
}

export type RuleCategory = 'name_conflict' | 'rollback' | 'consistency' | 'exception';

export interface BoundaryRule {
  id: string;
  title: string;
  category: RuleCategory;
  description: string;
  logic: string;
  example: string;
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  imported: '已导入',
  pending_review: '待巡检员复核',
  sampling_reviewed: '已补看采样点',
  summary_updated: '摘要已更新',
  inspector_confirmed: '巡检员已确认',
  completed: '已完成',
};

export const STEP_LABELS: Record<StepNumber, string> = {
  1: '导入无障碍坡道记录',
  2: '阿宁补看夜间采样点',
  3: '更新街道会看摘要',
};

export const CREDIBILITY_LABELS: Record<Credibility, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  aning: '城更项目经理（阿宁）',
  inspector: '市政巡检员',
  street: '街道审批人员',
};

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  excel: 'Excel 明细',
  csv: 'CSV 明细',
  street_summary: '街道会看摘要',
};

export interface ExportFieldMapping {
  code: string;
  label: string;
  pageKey: keyof ApprovalRecord | string;
  exportKey: string;
  apiKey: string;
  description: string;
}

export const EXPORT_FIELD_MAPPINGS: ExportFieldMapping[] = [
  { code: 'ORIGINAL_LINE', label: '原始行号', pageKey: 'originalLineNumber', exportKey: 'originalLineNumber', apiKey: 'originalLineNumber', description: '导入文件中的原始行号，永久保留' },
  { code: 'COMMUNITY_OLD', label: '小区旧名称', pageKey: 'communityOldName', exportKey: 'communityOldName', apiKey: 'communityOldName', description: '导入时的旧称' },
  { code: 'COMMUNITY_NEW', label: '小区新名称', pageKey: 'communityNewName', exportKey: 'communityNewName', apiKey: 'communityNewName', description: '导入时的新称' },
  { code: 'COMMUNITY_FINAL', label: '最终确认名称', pageKey: 'communityFinalName', exportKey: 'communityFinalName', apiKey: 'communityFinalName', description: '巡检员确认的最终名称' },
  { code: 'NAME_CONFLICT', label: '是否名称冲突', pageKey: 'hasNameConflict', exportKey: 'hasNameConflict', apiKey: 'hasNameConflict', description: '同一小区新旧名称冲突标记' },
  { code: 'RAMP_EXISTS', label: '有无障碍坡道', pageKey: 'rampRecord', exportKey: 'rampExists', apiKey: 'rampRecord.exists', description: '无障碍坡道是否存在' },
  { code: 'RAMP_LOCATION', label: '坡道位置', pageKey: 'rampRecord', exportKey: 'rampLocation', apiKey: 'rampRecord.location', description: '坡道所在位置' },
  { code: 'RAMP_CONDITION', label: '坡道状况', pageKey: 'rampRecord', exportKey: 'rampCondition', apiKey: 'rampRecord.condition', description: '坡道完好/破损情况' },
  { code: 'SAMPLING_EXISTS', label: '有夜间采样点', pageKey: 'samplingPoint', exportKey: 'samplingExists', apiKey: 'samplingPoint.exists', description: '采样点是否存在' },
  { code: 'SAMPLING_LOCATION', label: '采样点位置', pageKey: 'samplingPoint', exportKey: 'samplingLocation', apiKey: 'samplingPoint.location', description: '采样点所在位置' },
  { code: 'SAMPLING_CREDIBILITY', label: '采样点可信度', pageKey: 'samplingPoint', exportKey: 'samplingCredibility', apiKey: 'samplingPoint.credibility', description: '高/中/低' },
  { code: 'STATUS', label: '当前处理状态', pageKey: 'status', exportKey: 'status', apiKey: 'status', description: '完整状态链路中的当前状态' },
  { code: 'CURRENT_STEP', label: '当前步骤', pageKey: 'currentStep', exportKey: 'currentStep', apiKey: 'currentStep', description: '三步流程中的第几步' },
  { code: 'SUMMARY', label: '街道会看摘要', pageKey: 'summary', exportKey: 'summary', apiKey: 'summary.content', description: '给街道看的摘要内容' },
  { code: 'CREATED_AT', label: '导入时间', pageKey: 'createdAt', exportKey: 'createdAt', apiKey: 'createdAt', description: '第一次导入时间' },
  { code: 'UPDATED_AT', label: '最后更新时间', pageKey: 'updatedAt', exportKey: 'updatedAt', apiKey: 'updatedAt', description: '最近一次修改时间' },
  { code: 'IMPORT_BATCH_ID', label: '导入批次号', pageKey: 'importBatchId', exportKey: 'importBatchId', apiKey: 'importBatchId', description: '同一次导入的批次标识' },
];

export function getFieldByCode(code: string): ExportFieldMapping | undefined {
  return EXPORT_FIELD_MAPPINGS.find(f => f.code === code);
}

export function getValueByPath(obj: unknown, path: string): unknown {
  if (!obj || !path) return undefined;
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

export function formatValueByCode(record: ApprovalRecord, code: string): string {
  const mapping = getFieldByCode(code);
  if (!mapping) return '';

  switch (code) {
    case 'RAMP_EXISTS':
      return record.rampRecord.exists ? '有' : '无';
    case 'RAMP_LOCATION':
      return record.rampRecord.location || '';
    case 'RAMP_CONDITION':
      return record.rampRecord.condition || '';
    case 'SAMPLING_EXISTS':
      return record.samplingPoint?.exists ? '有' : (record.samplingPoint ? '无' : '');
    case 'SAMPLING_LOCATION':
      return record.samplingPoint?.location || '';
    case 'SAMPLING_CREDIBILITY':
      return record.samplingPoint ? CREDIBILITY_LABELS[record.samplingPoint.credibility] : '';
    case 'NAME_CONFLICT':
      return record.hasNameConflict ? '是' : '否';
    case 'STATUS':
      return STATUS_LABELS[record.status];
    case 'CURRENT_STEP':
      return `第${record.currentStep}步 - ${STEP_LABELS[record.currentStep]}`;
    case 'SUMMARY':
      return record.summary?.content || '';
    case 'CREATED_AT':
    case 'UPDATED_AT':
      return new Date(getValueByPath(record, mapping.pageKey) as Date).toLocaleString('zh-CN');
    default: {
      const val = getValueByPath(record, mapping.pageKey);
      if (val === undefined || val === null) return '';
      return String(val);
    }
  }
}

export function getDisplayCommunityName(record: ApprovalRecord): string {
  if (record.communityFinalName) return record.communityFinalName;
  if (record.communityNewName) return record.communityNewName;
  return record.communityOldName || '未知';
}
