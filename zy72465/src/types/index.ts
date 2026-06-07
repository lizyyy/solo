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
  remark?: string;
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
