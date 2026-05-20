export interface ReceiptItem {
  id?: string;
  batchId?: string;
  receiptNo: string;
  memberPhone: string;
  transactionTime: string;
  transactionType: 'purchase' | 'return';
  amount: number;
  pointsEarned?: number;
  storeId: string;
  productId?: string;
  productName?: string;
  activityId?: string;
  operator?: string;
}

export interface Member {
  phone: string;
  name: string;
  level: 'normal' | 'silver' | 'gold' | 'diamond';
  totalPoints: number;
  availablePoints: number;
  joinDate: string;
  lastActiveTime?: string;
}

export interface ActivityRule {
  id: string;
  name: string;
  type: 'multiplier' | 'bonus' | 'special';
  startTime: string;
  endTime: string;
  conditions: {
    minAmount?: number;
    maxAmount?: number;
    productCategories?: string[];
    memberLevels?: Member['level'][];
    storeIds?: string[];
  };
  multiplier?: number;
  bonusPoints?: number;
  maxPointsPerTransaction?: number;
  priority: number;
  enabled: boolean;
}

export type ProcessingStatus = 'success' | 'pending' | 'failed';

export interface ProcessingResult {
  receiptNo: string;
  status: ProcessingStatus;
  originalData: ReceiptItem;
  calculatedPoints: number;
  appliedRules: string[];
  errorCode?: string;
  errorMessage?: string;
  suggestion?: string;
  warnings?: string[];
  traceId: string;
}

export interface BatchReport {
  batchId: string;
  totalCount: number;
  successCount: number;
  pendingCount: number;
  failedCount: number;
  totalPoints: number;
  createdAt: string;
  items: {
    success: ProcessingResult[];
    pending: ProcessingResult[];
    failed: ProcessingResult[];
  };
}

export interface DatabaseRecord {
  id: string;
  batchId: string;
  receiptNo: string;
  memberPhone: string;
  transactionTime: string;
  amount: number;
  calculatedPoints: number;
  status: ProcessingStatus;
  errorCode?: string;
  errorMessage?: string;
  suggestion?: string;
  rawData: string;
  appliedRules: string;
  traceId: string;
  createdAt: string;
}

export const ERROR_CODES = {
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
  INVALID_TRANSACTION_TYPE: 'INVALID_TRANSACTION_TYPE',
  NEGATIVE_AMOUNT: 'NEGATIVE_AMOUNT',
  RETURN_WITHOUT_PURCHASE: 'RETURN_WITHOUT_PURCHASE',
  MULTIPLIER_OVER_LIMIT: 'MULTIPLIER_OVER_LIMIT',
  DUPLICATE_RECEIPT: 'DUPLICATE_RECEIPT',
  ACTIVITY_NOT_APPLICABLE: 'ACTIVITY_NOT_APPLICABLE',
  INVALID_TIME_FORMAT: 'INVALID_TIME_FORMAT',
  AMOUNT_TOO_LARGE: 'AMOUNT_TOO_LARGE',
  POINTS_CALCULATION_ERROR: 'POINTS_CALCULATION_ERROR'
} as const;

export const SUGGESTIONS = {
  MEMBER_NOT_FOUND: '请检查会员手机号是否正确，或先为该顾客注册会员',
  RETURN_WITHOUT_PURCHASE: '未找到对应消费记录，请核实退货小票是否属于本系统',
  DUPLICATE_RECEIPT: '该小票已处理过，请勿重复提交',
  MULTIPLIER_OVER_LIMIT: '活动倍率超出限制，已按最高倍率计算，请确认活动规则',
  ACTIVITY_NOT_APPLICABLE: '该交易不符合活动参与条件，请核实活动规则'
};
