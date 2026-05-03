// 积分配置
const POINTS_CONFIG = {
  // 1积分等于多少元
  EXCHANGE_RATE: 0.1, // 1积分 = 0.1元
  // 每次账单最多可使用的积分比例（占应付金额的比例）
  MAX_DEDUCTION_RATE: 0.2, // 最多抵扣20%
  // 单次最大抵扣积分
  MAX_DEDUCTION_POINTS_PER_BILL: 100, // 最多100积分（10元）
  // 积分有效期（天）
  EXPIRY_DAYS: 180, // 6个月
};

// 状态映射
const STATUS_MAP = {
  BILL: {
    PENDING: 'pending',
    PARTIAL: 'partial',
    SETTLED: 'settled',
    OVERDUE: 'overdue',
    DISPUTED: 'disputed',
  },
  SPLIT_RULE: {
    PENDING: 'pending',
    PARTIAL: 'partial',
    PAID: 'paid',
    OVERDUE: 'overdue',
    DISPUTED: 'disputed',
  },
  PAYMENT: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    REJECTED: 'rejected',
    DISPUTED: 'disputed',
  },
  CHORE: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    MISSED: 'missed',
    SKIPPED: 'skipped',
    DISPUTED: 'disputed',
  },
  DISPUTE: {
    OPEN: 'open',
    UNDER_REVIEW: 'under_review',
    RESOLVED: 'resolved',
    CLOSED: 'closed',
    REJECTED: 'rejected',
  },
};

// 分摊类型
const SPLIT_TYPES = {
  EQUAL: 'equal',        // 均摊
  RATIO: 'ratio',        // 按比例
  SPECIFIC: 'specific',  // 指定人员
  ADVANCE: 'advance',    // 垫付报销
};

// 通知类型
const NOTIFICATION_TYPES = {
  BILL_CREATED: 'bill_created',
  BILL_DUE_SOON: 'bill_due_soon',
  BILL_OVERDUE: 'bill_overdue',
  BILL_PAYMENT_RECEIVED: 'bill_payment_received',
  BILL_PAYMENT_CONFIRMED: 'bill_payment_confirmed',
  BILL_DISPUTE_OPENED: 'bill_dispute_opened',
  BILL_DISPUTE_RESOLVED: 'bill_dispute_resolved',
  CHORE_ASSIGNED: 'chore_assigned',
  CHORE_DUE_SOON: 'chore_due_soon',
  CHORE_OVERDUE: 'chore_overdue',
  CHORE_COMPLETED: 'chore_completed',
  CHORE_DISPUTE_OPENED: 'chore_dispute_opened',
  POINT_EARNED: 'point_earned',
  POINT_DEDUCTED: 'point_deducted',
  POINT_USED: 'point_used',
  DISPUTE_ASSIGNED: 'dispute_assigned',
  DISPUTE_UPDATED: 'dispute_updated',
  SYSTEM_ALERT: 'system_alert',
  OTHER: 'other',
};

// 错误码
const ERROR_CODES = {
  // 通用错误
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  
  // 账单相关
  BILL_NOT_FOUND: 'BILL_NOT_FOUND',
  BILL_ALREADY_SETTLED: 'BILL_ALREADY_SETTLED',
  BILL_HAS_DISPUTE: 'BILL_HAS_DISPUTE',
  
  // 付款相关
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  PAYMENT_ALREADY_CONFIRMED: 'PAYMENT_ALREADY_CONFIRMED',
  PAYMENT_AMOUNT_EXCEEDS: 'PAYMENT_AMOUNT_EXCEEDS',
  
  // 分摊相关
  INVALID_SPLIT_RULE: 'INVALID_SPLIT_RULE',
  SPLIT_RATIO_NOT_100: 'SPLIT_RATIO_NOT_100',
  
  // 积分相关
  INSUFFICIENT_POINTS: 'INSUFFICIENT_POINTS',
  POINTS_DEDUCTION_EXCEEDS_LIMIT: 'POINTS_DEDUCTION_EXCEEDS_LIMIT',
  
  // 争议相关
  DISPUTE_NOT_FOUND: 'DISPUTE_NOT_FOUND',
  DISPUTE_ALREADY_RESOLVED: 'DISPUTE_ALREADY_RESOLVED',
  
  // 家务相关
  CHORE_NOT_FOUND: 'CHORE_NOT_FOUND',
  CHORE_ALREADY_COMPLETED: 'CHORE_ALREADY_COMPLETED',
  
  // 室友相关
  FLATMATE_NOT_FOUND: 'FLATMATE_NOT_FOUND',
  FLATMATE_NOT_ACTIVE: 'FLATMATE_NOT_ACTIVE',
};

module.exports = {
  POINTS_CONFIG,
  STATUS_MAP,
  SPLIT_TYPES,
  NOTIFICATION_TYPES,
  ERROR_CODES,
};
