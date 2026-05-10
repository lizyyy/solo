const { v4: uuidv4 } = require('uuid');

function generateId() {
  return uuidv4();
}

function round2(num) {
  return Math.round(num * 100) / 100;
}

function formatCurrency(num) {
  return '¥' + round2(num).toFixed(2);
}

function getCurrentMonth() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1
  };
}

function getMonthRange(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const pad = (n) => n.toString().padStart(2, '0');
  
  return {
    startDate: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`,
    endDate: `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`
  };
}

function formatBusinessDate(dateStr) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function getMealTypeLabel(type) {
  const labels = {
    breakfast: '早餐',
    lunch: '午餐',
    dinner: '晚餐',
    supper: '夜宵'
  };
  return labels[type] || type;
}

function getSettlementStatusLabel(status) {
  const labels = {
    pending: '待开始',
    processing: '计算中',
    calculated: '待审核',
    reviewing: '审核中',
    rejected: '已驳回',
    approved: '已通过',
    settled: '已结算',
    cancelled: '已取消'
  };
  return labels[status] || status;
}

function getWorkflowStepLabel(code) {
  const labels = {
    data_collect: '数据采集',
    difference_calc: '差异计算',
    subsidy_calc: '补贴核算',
    operator_review: '运营审核',
    finance_review: '财务审核',
    adjustment: '差异调整',
    settlement: '最终结算'
  };
  return labels[code] || code;
}

function getDifferenceReasonLabel(code) {
  const reasons = {
    NO_SHOW: '员工未取餐',
    EXTRA_VERIFICATION: '超计划取餐',
    WRONG_DATE: '日期核对有误',
    WRONG_MEAL_TYPE: '餐别核对有误',
    SUBSIDY_MISMATCH: '补贴金额不符',
    PRICE_CHANGE: '单价变动',
    EMPLOYEE_STATUS: '员工状态异常',
    SYSTEM_ERROR: '系统记录异常',
    OTHER: '其他原因'
  };
  return reasons[code] || code;
}

function getAdjustmentTypeLabel(type) {
  const labels = {
    refund: '退款',
    deduction: '补扣',
    waive: '免单',
    manual: '手动调整'
  };
  return labels[type] || type;
}

module.exports = {
  generateId,
  round2,
  formatCurrency,
  getCurrentMonth,
  getMonthRange,
  formatBusinessDate,
  getMealTypeLabel,
  getSettlementStatusLabel,
  getWorkflowStepLabel,
  getDifferenceReasonLabel,
  getAdjustmentTypeLabel
};
