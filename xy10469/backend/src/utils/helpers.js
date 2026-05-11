const moment = require('moment');

const generateOrderNo = (prefix = '') => {
  const dateStr = moment().format('YYYYMMDD');
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${dateStr}${randomStr}`;
};

const isDateOverlap = (start1, end1, start2, end2) => {
  const s1 = moment(start1);
  const e1 = moment(end1);
  const s2 = moment(start2);
  const e2 = moment(end2);
  
  return s1.isBefore(e2) && e1.isAfter(s2);
};

const getDateRangeDays = (startDate, endDate) => {
  const start = moment(startDate);
  const end = moment(endDate);
  return end.diff(start, 'days') + 1;
};

const formatCurrency = (amount, currency = 'CNY') => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
};

const boothTypeMap = {
  food: '食品摊位',
  cultural: '文创摊位',
  promotion: '促销摊位'
};

const applicationStatusMap = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消'
};

const depositTypeMap = {
  deposit: '押金缴纳',
  refund: '押金退还',
  deduction: '押金扣款',
  rent: '租金收取',
  electricity: '电费收取'
};

const acceptanceStatusMap = {
  pending: '待验收',
  in_progress: '验收中',
  passed: '已通过',
  failed: '未通过'
};

const itemStatusMap = {
  pass: '通过',
  fail: '未通过',
  na: '不适用'
};

const acceptanceCategoryMap = {
  equipment: '设备设施',
  cleanliness: '清洁卫生',
  electricity: '用电安全',
  structure: '结构安全',
  other: '其他'
};

module.exports = {
  generateOrderNo,
  isDateOverlap,
  getDateRangeDays,
  formatCurrency,
  boothTypeMap,
  applicationStatusMap,
  depositTypeMap,
  acceptanceStatusMap,
  itemStatusMap,
  acceptanceCategoryMap
};