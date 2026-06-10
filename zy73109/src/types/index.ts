export type SourceType = 'normal' | 'old_visa' | 'verbal' | 'anomaly';

export type ConfirmStatus = 'confirmed' | 'pending_evidence' | 'rejected' | 'processing';

export type AnomalyType = 'coord_offset' | 'out_of_range' | 'format_error' | 'missing_data';

export type AnomalyHandlingStatus = 'open' | 'in_progress' | 'resolved' | 'ignored';

export interface AnomalyDetail {
  id: string;
  type: AnomalyType;
  typeLabel: string;
  offsetValue?: number;
  expectedMin?: number;
  expectedMax?: number;
  actualValue?: number;
  axis?: string;
  description: string;
  detectionBasis: string;
  handlingSuggestion: string;
  handlingStatus: AnomalyHandlingStatus;
  handlingRemark?: string;
  handledBy?: string;
  handledAt?: string;
}

export interface RecordItem {
  id: string;
  batchId: string;
  code: string;
  title: string;
  content: string;
  source: SourceType;
  status: ConfirmStatus;
  createdAt: string;
  createdBy: string;
  confirmBy?: string;
  confirmAt?: string;
  remark?: string;
  anomaly?: AnomalyDetail;
  impactSummary: string;
  buildingInfo?: string;
  floorRange?: string;
}

export interface ImpactFactor {
  id: string;
  name: string;
  value: number;
  unit: string;
  weight: number;
  description: string;
  threshold: number;
  isExceeded: boolean;
}

export interface ConclusionStep {
  id: string;
  stepOrder: number;
  stepName: string;
  description: string;
  inputValue: string;
  outputValue: string;
  formula?: string;
  contributionPct: number;
}

export interface SimilarReference {
  code: string;
  title: string;
  conclusion: string;
  diff: string;
}

export interface ImpactChain {
  recordId: string;
  factors: ImpactFactor[];
  steps: ConclusionStep[];
  finalConclusion: string;
  explanation: string;
  similarReferences: SimilarReference[];
  comparisonTable: {
    label: string;
    current: string;
    standard: string;
    diff: string;
    exceed: boolean;
  }[];
}

export interface RunHistoryItem {
  id: string;
  batchId: string;
  runIndex: number;
  runAt: string;
  runBy: string;
  triggerReason: string;
  remarkBefore?: string;
  remarkAfter?: string;
  recordCount: number;
  anomalyCount: number;
  pendingCount: number;
  confirmedCount: number;
  summary: string;
  isSelected?: boolean;
}

export interface DiffField {
  fieldName: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
  changeType: 'add' | 'modify' | 'remove';
}

export interface RecordDiff {
  recordCode: string;
  recordTitle: string;
  fields: DiffField[];
}

export interface BatchDiff {
  runIdA: string;
  runIdB: string;
  runLabelA: string;
  runLabelB: string;
  fields: DiffField[];
  recordDiffs: RecordDiff[];
}

export interface BatchInfo {
  batchId: string;
  name: string;
  projectName: string;
  createdAt: string;
  createdBy: string;
  lastRunAt: string;
  lastRunBy: string;
  runCount: number;
}

export const SOURCE_META: Record<SourceType, { label: string; color: string; bgColor: string; borderColor: string; icon: string }> = {
  normal: { label: '正常记录', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', icon: '📋' },
  old_visa: { label: '旧版签证单', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', icon: '📜' },
  verbal: { label: '口头备注', color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', icon: '💬' },
  anomaly: { label: '异常数据', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200', icon: '⚠️' },
};

export const STATUS_META: Record<ConfirmStatus, { label: string; color: string; bgColor: string; borderColor: string; dotColor: string }> = {
  confirmed: { label: '已确认', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', dotColor: 'bg-emerald-500' },
  pending_evidence: { label: '待补证据', color: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200', dotColor: 'bg-yellow-500' },
  rejected: { label: '已驳回', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200', dotColor: 'bg-red-500' },
  processing: { label: '处理中', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', dotColor: 'bg-blue-500' },
};

export const ANOMALY_STATUS_META: Record<AnomalyHandlingStatus, { label: string; color: string; bgColor: string }> = {
  open: { label: '待处理', color: 'text-red-600', bgColor: 'bg-red-50' },
  in_progress: { label: '处理中', color: 'text-orange-600', bgColor: 'bg-orange-50' },
  resolved: { label: '已解决', color: 'text-green-600', bgColor: 'bg-green-50' },
  ignored: { label: '已标记忽略', color: 'text-gray-600', bgColor: 'bg-gray-50' },
};
