export enum DeductionStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  APPEALING = 'APPEALING',
  ADJUSTED = 'ADJUSTED',
  CLOSED = 'CLOSED',
}

export const STATUS_LABELS: Record<DeductionStatus, string> = {
  [DeductionStatus.DRAFT]: '待提交',
  [DeductionStatus.PENDING]: '待审核',
  [DeductionStatus.CONFIRMED]: '已确认',
  [DeductionStatus.APPEALING]: '申诉中',
  [DeductionStatus.ADJUSTED]: '已调整',
  [DeductionStatus.CLOSED]: '已结案',
};

export const STATUS_COLORS: Record<DeductionStatus, string> = {
  [DeductionStatus.DRAFT]: 'bg-gray-100 text-gray-700',
  [DeductionStatus.PENDING]: 'bg-yellow-100 text-yellow-700',
  [DeductionStatus.CONFIRMED]: 'bg-blue-100 text-blue-700',
  [DeductionStatus.APPEALING]: 'bg-orange-100 text-orange-700',
  [DeductionStatus.ADJUSTED]: 'bg-purple-100 text-purple-700',
  [DeductionStatus.CLOSED]: 'bg-green-100 text-green-700',
};

export enum DeductionAction {
  SUBMIT = 'SUBMIT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  APPEAL = 'APPEAL',
  APPEAL_APPROVE = 'APPEAL_APPROVE',
  APPEAL_REJECT = 'APPEAL_REJECT',
  CLOSE = 'CLOSE',
}

export const ACTION_LABELS: Record<DeductionAction, string> = {
  [DeductionAction.SUBMIT]: '提交',
  [DeductionAction.APPROVE]: '审核通过',
  [DeductionAction.REJECT]: '退回修改',
  [DeductionAction.APPEAL]: '提交申诉',
  [DeductionAction.APPEAL_APPROVE]: '申诉通过',
  [DeductionAction.APPEAL_REJECT]: '申诉驳回',
  [DeductionAction.CLOSE]: '结案',
};

export interface Store {
  id: string;
  name: string;
  address: string;
  region: string;
  managerName: string;
  managerPhone: string;
}

export interface DeductionItem {
  id: string;
  name: string;
  category: string;
  maxScore: number;
  description: string;
}

export interface DeductionPhoto {
  id: string;
  url: string;
  hash: string;
  fileName: string;
  uploadedAt: string;
  uploadSource: 'APP' | 'PC';
  reusedWarning?: {
    storeName: string;
    usedAt: string;
  };
}

export interface DeductionDetail {
  id: string;
  itemId: string;
  itemName: string;
  score: number;
  photos: DeductionPhoto[];
  remark: string;
}

export interface StatusHistory {
  id: string;
  recordId: string;
  fromStatus: DeductionStatus | null;
  toStatus: DeductionStatus;
  action: DeductionAction;
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  remark: string;
  createdAt: string;
  scoreSnapshot?: number;
}

export interface DeductionRecord {
  id: string;
  recordNo: string;
  storeId: string;
  storeName: string;
  inspectorId: string;
  inspectorName: string;
  inspectionDate: string;
  submissionSource: 'APP' | 'PC';
  status: DeductionStatus;
  details: DeductionDetail[];
  totalScore: number;
  appealContent?: string;
  appealAt?: string;
  adjustedScore?: number;
  adjustRemark?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export const calculateTotalScore = (details: DeductionDetail[]): number => {
  return details.reduce((sum, detail) => sum + detail.score, 0);
};

export const validateScoreConsistency = (
  details: DeductionDetail[],
  totalScore: number
): boolean => {
  return calculateTotalScore(details) === totalScore;
};

export const canPerformAction = (
  status: DeductionStatus,
  action: DeductionAction
): boolean => {
  const allowedTransitions: Record<DeductionStatus, DeductionAction[]> = {
    [DeductionStatus.DRAFT]: [DeductionAction.SUBMIT],
    [DeductionStatus.PENDING]: [DeductionAction.APPROVE, DeductionAction.REJECT],
    [DeductionStatus.CONFIRMED]: [DeductionAction.APPEAL, DeductionAction.CLOSE],
    [DeductionStatus.APPEALING]: [DeductionAction.APPEAL_APPROVE, DeductionAction.APPEAL_REJECT],
    [DeductionStatus.ADJUSTED]: [DeductionAction.CLOSE],
    [DeductionStatus.CLOSED]: [],
  };
  return allowedTransitions[status]?.includes(action) ?? false;
};

export const getNextStatus = (
  currentStatus: DeductionStatus,
  action: DeductionAction
): DeductionStatus | null => {
  const transitions: Record<DeductionStatus, Partial<Record<DeductionAction, DeductionStatus>>> = {
    [DeductionStatus.DRAFT]: {
      [DeductionAction.SUBMIT]: DeductionStatus.PENDING,
    },
    [DeductionStatus.PENDING]: {
      [DeductionAction.APPROVE]: DeductionStatus.CONFIRMED,
      [DeductionAction.REJECT]: DeductionStatus.DRAFT,
    },
    [DeductionStatus.CONFIRMED]: {
      [DeductionAction.APPEAL]: DeductionStatus.APPEALING,
      [DeductionAction.CLOSE]: DeductionStatus.CLOSED,
    },
    [DeductionStatus.APPEALING]: {
      [DeductionAction.APPEAL_APPROVE]: DeductionStatus.ADJUSTED,
      [DeductionAction.APPEAL_REJECT]: DeductionStatus.CONFIRMED,
    },
    [DeductionStatus.ADJUSTED]: {
      [DeductionAction.CLOSE]: DeductionStatus.CLOSED,
    },
    [DeductionStatus.CLOSED]: {},
  };
  return transitions[currentStatus]?.[action] ?? null;
};

export interface ReportSummary {
  totalRecords: number;
  totalScore: number;
  avgScore: number;
  statusCounts: Record<DeductionStatus, number>;
  topStores: { storeName: string; totalScore: number; recordCount: number }[];
  topItems: { itemName: string; totalScore: number; recordCount: number }[];
  monthlyTrend: { month: string; totalScore: number; recordCount: number }[];
}
