export const BUSINESS_RULES = {
  SPLIT_DETECTION: {
    ENABLED: true,
    SAME_BUSINESS_NUMBER: true,
    TRANSACTION_TYPES: ['PRINCIPAL', 'FEE'],
    ALLOW_PENDING_REVIEW: true,
  },
  DEDUPLICATION: {
    KEY_FIELD: 'tailNumber',
    SKIP_DUPLICATES: true,
    ALLOW_UPDATE_REMARK: true,
  },
  WORKFLOW: {
    STEPS: [
      { key: 'STEP1_IMPORTED', name: '第一步：柜台流水导入', role: '支付平台产品阿南' },
      { key: 'STEP2_EMAIL_SUPPLEMENTED', name: '第二步：补充邮件核对', role: '支付平台产品阿南' },
      { key: 'STEP3_DIFF_UPDATED', name: '第三步：差异清单更新', role: '结算主管' },
    ],
    REQUIRES_REVIEW_BEFORE_NORMAL: true,
  },
  MARGIN_CALCULATION: {
    BASE_RATIO: 0.15,
    SCENARIOS: [
      { name: '轻度压力', stressRatio: 0.20, description: '市场波动±10%' },
      { name: '中度压力', stressRatio: 0.30, description: '市场波动±20%' },
      { name: '重度压力', stressRatio: 0.45, description: '市场波动±30%' },
    ],
  },
  HISTORY: {
    RETAIN_VERSIONS: true,
    TRACK_FIELDS: ['remark', 'amount', 'scenario', 'baseMargin', 'stressMargin'],
  },
  VALIDATION: {
    REQUIRED_FIELDS: ['tailNumber', 'businessNumber', 'transactionDate', 'amount'],
    AMOUNT_MIN: 0,
  },
  ERROR_MESSAGES: {
    MISSING_TAIL_NUMBER: '请填写柜台流水尾号',
    MISSING_BUSINESS_NUMBER: '请填写业务号',
    MISSING_TRANSACTION_DATE: '请填写交易日期',
    MISSING_AMOUNT: '请填写金额',
    INVALID_AMOUNT: '金额必须大于0',
    DUPLICATE_TAIL_NUMBER: '该柜台流水尾号已存在，跳过导入',
    SPLIT_PENDING_REVIEW: '同一业务号拆分为本金和手续费，待结算主管复核',
  },
} as const;

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_REVIEW: { label: '待复核', color: 'orange' },
  NORMAL: { label: '正常', color: 'green' },
  SPLIT_PENDING: { label: '拆分待复核', color: 'gold' },
  DISPUTED: { label: '有争议', color: 'red' },
  ROLLBACKED: { label: '已回滚', color: 'default' },
};

export const WORKFLOW_STEP_LABELS: Record<string, { label: string; description: string }> = {
  STEP1_IMPORTED: { 
    label: '第一步完成', 
    description: '柜台流水已导入，请核对客户经理补充邮件' 
  },
  STEP2_EMAIL_SUPPLEMENTED: { 
    label: '第二步完成', 
    description: '补充邮件已核对，请更新差异清单' 
  },
  STEP3_DIFF_UPDATED: { 
    label: '第三步完成', 
    description: '差异清单已更新，流程完成' 
  },
};
