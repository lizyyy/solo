import dayjs from 'dayjs';

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2
  }).format(amount || 0);
};

export const formatDate = (date, format = 'YYYY-MM-DD') => {
  if (!date) return '-';
  return dayjs(date).format(format);
};

export const formatDateTime = (date) => {
  if (!date) return '-';
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
};

export const boothTypeMap = {
  food: '食品摊位',
  cultural: '文创摊位',
  promotion: '促销摊位'
};

export const boothTypeOptions = [
  { value: 'food', label: '食品摊位' },
  { value: 'cultural', label: '文创摊位' },
  { value: 'promotion', label: '促销摊位' }
];

export const applicationStatusMap = {
  pending: { label: '待审核', type: 'warning' },
  approved: { label: '已通过', type: 'success' },
  rejected: { label: '已拒绝', type: 'danger' },
  in_progress: { label: '进行中', type: 'primary' },
  completed: { label: '已完成', type: 'info' },
  cancelled: { label: '已取消', type: 'info' }
};

export const depositTypeMap = {
  deposit: { label: '押金缴纳', type: 'success' },
  refund: { label: '押金退还', type: 'warning' },
  deduction: { label: '押金扣款', type: 'danger' },
  rent: { label: '租金收取', type: 'primary' },
  electricity: { label: '电费收取', type: 'info' }
};

export const acceptanceStatusMap = {
  pending: { label: '待验收', type: 'warning' },
  in_progress: { label: '验收中', type: 'primary' },
  passed: { label: '已通过', type: 'success' },
  failed: { label: '未通过', type: 'danger' }
};

export const itemStatusMap = {
  pass: { label: '通过', type: 'success' },
  fail: { label: '未通过', type: 'danger' },
  na: { label: '不适用', type: 'info' }
};

export const acceptanceCategoryMap = {
  equipment: '设备设施',
  cleanliness: '清洁卫生',
  electricity: '用电安全',
  structure: '结构安全',
  other: '其他'
};

export const riskLevelMap = {
  high: { label: '高风险', type: 'danger' },
  medium: { label: '中风险', type: 'warning' },
  low: { label: '低风险', type: 'warning' },
  none: { label: '正常', type: 'success' }
};

export const paymentMethodMap = {
  cash: '现金',
  bank_transfer: '银行转账',
  wechat: '微信支付',
  alipay: '支付宝',
  card: '银行卡'
};