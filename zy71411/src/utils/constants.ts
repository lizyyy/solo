export const CURRENCY_PAIRS = ['USD/CNY', 'EUR/CNY', 'GBP/CNY', 'JPY/CNY', 'AUD/CNY'];

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CNY'];

export const COUNTERPARTIES = [
  '中国银行',
  '工商银行',
  '建设银行',
  '农业银行',
  '招商银行',
  '汇丰银行',
  '花旗银行',
  '渣打银行',
];

export const STATUS_COLORS = {
  active: '#059669',
  rolled: '#0284C7',
  matured: '#6B7280',
  cancelled: '#DC2626',
  pending: '#D97706',
  approved: '#059669',
  rejected: '#DC2626',
  unmatched: '#D97706',
  matched: '#059669',
  duplicate: '#DC2626',
  pass: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  info: '#0284C7',
  success: '#059669',
};

export const STATUS_LABELS = {
  active: '有效',
  rolled: '已展期',
  matured: '已到期',
  cancelled: '已取消',
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  unmatched: '未匹配',
  matched: '已匹配',
  duplicate: '重复匹配',
  pass: '通过',
  warning: '警告',
  error: '错误',
  info: '提示',
  premium: '升水',
  discount: '贴水',
};

export const VALIDATION_TYPE_LABELS = {
  link: '合约链路',
  points: '点数计算',
  match: '收付匹配',
};

export const OPERATION_TYPE_LABELS = {
  create: '创建',
  update: '更新',
  delete: '删除',
  manual_correct: '人工修正',
  supplement: '补录材料',
};

export const IMPACT_WEIGHTS = {
  linkCompleteness: 30,
  linkCoverage: 25,
  pointsDirection: 20,
  pointsAccuracy: 15,
  matchUniqueness: 7,
  matchAmount: 3,
};

export const SPOT_RATE_TOLERANCE = 0.02;
export const POINTS_DEVIATION_TOLERANCE = 5;
export const AMOUNT_MATCH_TOLERANCE = 0.005;
export const PAYMENT_DATE_TOLERANCE_DAYS = 3;

export const INTEREST_RATES: Record<string, number> = {
  USD: 0.0525,
  EUR: 0.045,
  GBP: 0.05,
  JPY: 0.001,
  AUD: 0.0425,
  CNY: 0.025,
};
