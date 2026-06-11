export type Judgment = 'approved' | 'rejected' | 'pending';
export type PlanStatus = 'normal' | 'abnormal';
export type OperationType = 'create' | 'remark_update' | 'judgment_change' | 'material_add' | 'status_change';

export interface Plan {
  id: string;
  planNo: string;
  projectName: string;
  originalOpinion: string;
  originalSource: string;
  currentRemark: string;
  judgment: Judgment;
  status: PlanStatus;
  materialBatch: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface HistoryVersion {
  id: string;
  planId: string;
  version: string;
  operationType: OperationType;
  oldValue: string | null;
  newValue: string | null;
  changeReason: string;
  operator: string;
  timestamp: string;
}

export interface MaterialBatch {
  id: string;
  planId: string;
  batchNo: string;
  materialName: string;
  quantity: number;
  isSupplement: boolean;
  supplementReason: string | null;
  recordedAt: string;
}

export interface PlanDetail extends Plan {
  history: HistoryVersion[];
  materials: MaterialBatch[];
}

export interface UpdateRemarkRequest {
  remark: string;
  changeReason: string;
  operator: string;
}

export interface UpdateJudgmentRequest {
  newJudgment: Judgment;
  changeReason: string;
  operator: string;
}

export interface AddMaterialRequest {
  batchNo: string;
  materialName: string;
  quantity: number;
  supplementReason: string;
  operator: string;
}

export interface UpdateStatusRequest {
  status: PlanStatus;
  operator: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PlanListParams {
  status?: PlanStatus;
  keyword?: string;
}

export const JUDGMENT_LABELS: Record<Judgment, string> = {
  approved: '通过',
  rejected: '驳回',
  pending: '待审核',
};

export const STATUS_LABELS: Record<PlanStatus, string> = {
  normal: '正常',
  abnormal: '异常',
};

export const OPERATION_LABELS: Record<OperationType, string> = {
  create: '创建记录',
  remark_update: '修改备注',
  judgment_change: '调整判断',
  material_add: '补录材料',
  status_change: '标记状态',
};
