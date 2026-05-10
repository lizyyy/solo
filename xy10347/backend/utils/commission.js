const moment = require('moment');

// 计算佣金
function calculateCommission(price, rate) {
  return parseFloat((price * rate).toFixed(2));
}

// 获取订单的账期（付款时间的年月）
function getSettlementPeriod(paymentTime) {
  if (!paymentTime) return null;
  return moment(paymentTime).format('YYYY-MM');
}

// 验证订单是否可以计佣
function canCalculateCommission(order) {
  if (!order || !order.id) return false;
  if (order.status === 'cancelled') return false;
  if (order.is_settled === 1) return false;
  if (!order.payment_time) return false;
  return true;
}

// 计算退款需要冲减的佣金
function calculateRefundDeduction(refundAmount, originalPrice, originalCommission) {
  const refundRatio = refundAmount / originalPrice;
  return parseFloat((originalCommission * refundRatio).toFixed(2));
}

// 格式化金额
function formatAmount(amount) {
  return parseFloat(amount.toFixed(2));
}

module.exports = {
  calculateCommission,
  getSettlementPeriod,
  canCalculateCommission,
  calculateRefundDeduction,
  formatAmount
};
