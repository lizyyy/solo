export enum RecordStatus {
  PENDING = 'pending',
  REVIEWING = 'reviewing',
  PLANNER_DONE = 'planner_done',
  INSPECTOR_DONE = 'inspector_done',
  NORMAL = 'normal',
  PROBLEM = 'problem',
}

export enum WorkflowStep {
  IMPORT = 'import',
  BUS_CHECK = 'bus_check',
  SUMMARY = 'summary',
}

export enum OperatorRole {
  PLANNER = 'planner',
  INSPECTOR = 'inspector',
}

export interface CanopyRecord {
  id: string;
  originalRowNumber: number;
  communityName: string;
  stationName: string;
  photoUrl?: string;
  photoDescription?: string;
  busSwipeTime?: string;
  status: RecordStatus;
  isSuspectedDuplicateName: boolean;
  suspectedMatchedRecordIds?: string[];
  plannerRemark?: string;
  inspectorRemark?: string;
  createdAt: string;
  updatedAt: string;
  importBatchId: string;
  importFileName?: string;
}

export interface HistoryRecord {
  id: string;
  recordId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  operator: OperatorRole;
  operatorName: string;
  timestamp: string;
  changeReason?: string;
}

export interface ImportPreviewItem {
  originalRowNumber: number;
  communityName: string;
  stationName: string;
  photoDescription?: string;
  isDuplicate: boolean;
  existingRecordId?: string;
}

export interface ImportResult {
  totalCount: number;
  newCount: number;
  duplicateCount: number;
  skippedCount: number;
  batchId: string;
  records: CanopyRecord[];
}

export interface BoundaryRule {
  id: string;
  name: string;
  description: string;
  action: 'mark_review' | 'skip' | 'flag';
  rollbackable: boolean;
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  [RecordStatus.PENDING]: '待排查',
  [RecordStatus.REVIEWING]: '待复核',
  [RecordStatus.PLANNER_DONE]: '规划员已处理',
  [RecordStatus.INSPECTOR_DONE]: '巡检员已复核',
  [RecordStatus.NORMAL]: '已确认正常',
  [RecordStatus.PROBLEM]: '有问题',
};

export const STEP_LABELS: Record<WorkflowStep, string> = {
  [WorkflowStep.IMPORT]: '第一步：导入路口照片',
  [WorkflowStep.BUS_CHECK]: '第二步：补看公交刷卡时段',
  [WorkflowStep.SUMMARY]: '第三步：更新街道会摘要',
};

export const STATUS_COLORS: Record<RecordStatus, string> = {
  [RecordStatus.PENDING]: 'bg-slate-100 text-slate-700 border-slate-300',
  [RecordStatus.REVIEWING]: 'bg-amber-50 text-amber-700 border-amber-400',
  [RecordStatus.PLANNER_DONE]: 'bg-blue-50 text-blue-700 border-blue-300',
  [RecordStatus.INSPECTOR_DONE]: 'bg-indigo-50 text-indigo-700 border-indigo-300',
  [RecordStatus.NORMAL]: 'bg-green-50 text-green-700 border-green-300',
  [RecordStatus.PROBLEM]: 'bg-red-50 text-red-700 border-red-300',
};
