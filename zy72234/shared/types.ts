export type AdjustmentStatus =
  | 'imported'
  | 'pending_custody'
  | 'pending_review'
  | 'reviewed_normal'
  | 'needs_verification';

export type ProcessStep = 'import' | 'custody' | 'review' | 'complete';

export type UserRole = 'assistant' | 'risk' | 'executive' | 'all';

export interface TailAdjustment {
  id: string;
  tradeDate: string;
  adjustmentNo: string;
  amount: number;
  remark: string;
  hasZeroAmountButReversed: boolean;
  status: AdjustmentStatus;
  custodyConfirmId?: string;
  importTime: string;
  importOperator: string;
  reviewTime?: string;
  reviewOperator?: string;
  reviewComment?: string;
}

export interface CustodyConfirmation {
  id: string;
  adjustmentId: string;
  voucherNo: string;
  custodyDate: string;
  amount: number;
  custodian: string;
  handler: string;
  signatureUrl?: string;
  hasScannedCopy: boolean;
  supplementaryFields: Record<string, string>;
  createTime: string;
  updateTime: string;
}

export interface ExecutiveSummaryItem {
  adjustmentId: string;
  adjustmentNo: string;
  tradeDate: string;
  amount: number;
  remark: string;
  status: AdjustmentStatus;
  whyKept: string;
  missingMaterials: string[];
  nextStep: string;
  contactPerson: string;
  contactRole: 'assistant' | 'risk' | 'both';
  updatedAt: string;
  custody?: CustodyConfirmation;
}

export interface ProcessNode {
  id: string;
  adjustmentId: string;
  step: ProcessStep;
  operator: string;
  operatorRole: UserRole;
  action: string;
  comment?: string;
  timestamp: string;
}

export interface OverviewStats {
  total: number;
  pendingCustody: number;
  pendingReview: number;
  completed: number;
  flagged: number;
}

export interface ChartDataPoint {
  date: string;
  amount: number;
  count: number;
  hasFlagged: boolean;
  adjustmentIds: string[];
}

export interface PieChartData {
  name: string;
  value: number;
  color: string;
  status: AdjustmentStatus | 'normal';
}

export interface ImportResult {
  total: number;
  flagged: number;
  items: TailAdjustment[];
}

export interface ReviewRequest {
  result: 'normal' | 'verify';
  comment: string;
  operator: string;
}

export interface CustodyDiffField {
  field: string;
  label: string;
  original: string | number | boolean | null;
  corrected: string | number | boolean | null;
  reason: string;
}

export interface CustodyDiffSnapshot {
  adjustmentId: string;
  adjustmentNo: string;
  beforeStatus: AdjustmentStatus;
  afterStatus: AdjustmentStatus;
  fields: CustodyDiffField[];
  snapshotTime: string;
  operator: string;
}

export interface CustodyCreateResult {
  custody: CustodyConfirmation;
  adjustment: TailAdjustment;
  diffSnapshot: CustodyDiffSnapshot;
}

export const STATUS_LABELS: Record<AdjustmentStatus, string> = {
  imported: '已导入',
  pending_custody: '待补托管页',
  pending_review: '待风控复核',
  reviewed_normal: '已复核正常',
  needs_verification: '需进一步核实',
};

export const STATUS_COLORS: Record<AdjustmentStatus, string> = {
  imported: 'gray',
  pending_custody: 'orange',
  pending_review: 'red',
  reviewed_normal: 'green',
  needs_verification: 'orange',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  assistant: '投研助理',
  risk: '风控同事',
  executive: '负责人',
  all: '全员',
};

export function isZeroReversed(amount: number, remark: string): boolean {
  return amount === 0 && remark.includes('已冲正');
}

export function generateSummary(
  adjustment: TailAdjustment,
  custody?: CustodyConfirmation
): Omit<ExecutiveSummaryItem, 'adjustmentId' | 'adjustmentNo' | 'tradeDate' | 'amount' | 'remark' | 'status' | 'updatedAt' | 'custody'> {
  if (adjustment.status === 'reviewed_normal') {
    return {
      whyKept: '风控已复核确认，该笔冲正记录正常，可归档。',
      missingMaterials: [],
      nextStep: '已完成，可归档备查。',
      contactPerson: adjustment.reviewOperator || '风控同事',
      contactRole: 'risk',
    };
  }

  if (adjustment.status === 'needs_verification') {
    return {
      whyKept: '风控标记需进一步核实，可能存在账务疑问，暂不归档。',
      missingMaterials: ['进一步核实材料', '相关交易背景说明'],
      nextStep: `请找${adjustment.reviewOperator || '风控同事'}了解核实要求，补充材料后再次提交复核。`,
      contactPerson: adjustment.reviewOperator || '风控同事',
      contactRole: 'risk',
    };
  }

  if (adjustment.status === 'pending_review' && custody) {
    return {
      whyKept: '这条金额是0但备注写了已冲正，我先留着等风控看，现在托管确认页已经补上了。',
      missingMaterials: ['风控复核意见'],
      nextStep: '下一步找风控同事复核，托管凭证已经齐全了。',
      contactPerson: '风控同事',
      contactRole: 'risk',
    };
  }

  if (adjustment.status === 'pending_custody' || (adjustment.status === 'pending_review' && !custody)) {
    return {
      whyKept: '这条金额是0但备注写了已冲正，系统不敢自动归正常，按规则留给风控复核。',
      missingMaterials: ['托管确认页凭证', '经办人签字'],
      nextStep: '先找投研助理小周补托管确认凭证，补完再找风控同事复核。',
      contactPerson: '小周',
      contactRole: 'assistant',
    };
  }

  return {
    whyKept: '正常清算记录，无需特殊处理。',
    missingMaterials: [],
    nextStep: '已完成。',
    contactPerson: '小周',
    contactRole: 'assistant',
  };
}
