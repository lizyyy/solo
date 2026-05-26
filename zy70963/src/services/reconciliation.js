const THRESHOLD_NORMAL = 5;
const THRESHOLD_BLOCK = 100;

function calculateCashShortLong(record) {
  const {
    opening_cash = 0,
    pos_sales = 0,
    cash_deposit = 0,
    imprest_borrow = 0,
    imprest_return = 0,
    closing_cash = 0
  } = record;

  const theoretical_cash = opening_cash + pos_sales - cash_deposit - imprest_borrow + imprest_return;
  const cash_short_long = closing_cash - theoretical_cash;

  return {
    theoretical_cash: Math.round(theoretical_cash * 100) / 100,
    cash_short_long: Math.round(cash_short_long * 100) / 100,
    is_balanced: Math.abs(cash_short_long) <= THRESHOLD_NORMAL ? 1 : 0
  };
}

function categorizeRecord(record) {
  const {
    pos_sales,
    cash_deposit,
    imprest_borrow,
    opening_cash,
    closing_cash,
    is_holiday,
    holiday_delay_note,
    cash_short_long
  } = record;

  const missingFields = [];
  if (pos_sales === undefined || pos_sales === null) missingFields.push('POS销售数据');
  if (cash_deposit === undefined || cash_deposit === null) missingFields.push('现金缴存数据');
  if (opening_cash === undefined || opening_cash === null) missingFields.push('期初现金');
  if (closing_cash === undefined || closing_cash === null) missingFields.push('期末现金');

  if (pos_sales < 0 || cash_deposit < 0 || opening_cash < 0 || closing_cash < 0) {
    return {
      category: '已拦截',
      category_reason: '数据异常：存在负数金额',
      next_action: '驳回门店重新提交，核实数据真实性'
    };
  }

  if (Math.abs(cash_short_long) > THRESHOLD_BLOCK) {
    return {
      category: '已拦截',
      category_reason: `现金长短款金额过大：${cash_short_long > 0 ? '长款' : '短款'} ${Math.abs(cash_short_long).toFixed(2)}元`,
      next_action: '立即通知区域经理，要求门店提交书面说明并开展专项核查'
    };
  }

  if (missingFields.length > 0) {
    return {
      category: '待补充',
      category_reason: `缺少关键字段：${missingFields.join('、')}`,
      next_action: '通知门店财务在3个工作日内补充完整数据'
    };
  }

  if (is_holiday && !holiday_delay_note) {
    return {
      category: '待补充',
      category_reason: '节假日未提供延迟入账说明',
      next_action: '补充节假日银行延迟入账说明及预计到账时间'
    };
  }

  if (Math.abs(cash_short_long) <= THRESHOLD_NORMAL) {
    return {
      category: '正常',
      category_reason: `账实相符，现金长短款 ${cash_short_long.toFixed(2)} 元，在正常误差范围内（±${THRESHOLD_NORMAL}元）`,
      next_action: '正常归档，数据纳入门店考核'
    };
  }

  return {
    category: '待补充',
    category_reason: `现金长短款超出正常范围：${cash_short_long > 0 ? '长款' : '短款'} ${Math.abs(cash_short_long).toFixed(2)}元`,
    next_action: '门店需提交长短款说明，区域财务审核后处理'
  };
}

function processRecord(record) {
  const { theoretical_cash, cash_short_long, is_balanced } = calculateCashShortLong(record);
  const enrichedRecord = { ...record, theoretical_cash, cash_short_long, is_balanced };
  const categoryInfo = categorizeRecord(enrichedRecord);
  return { ...enrichedRecord, ...categoryInfo };
}

module.exports = {
  calculateCashShortLong,
  categorizeRecord,
  processRecord,
  THRESHOLD_NORMAL,
  THRESHOLD_BLOCK
};
