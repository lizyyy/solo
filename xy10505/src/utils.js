const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

function generateId() {
  return uuidv4();
}

function formatDateTime(date) {
  return moment(date).format('YYYY-MM-DD HH:mm:ss');
}

function formatAmount(amount, currency = 'CNY') {
  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : currency;
  return `${symbol}${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function compareObjects(oldObj, newObj) {
  const changes = [];
  const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
  
  for (const key of allKeys) {
    const oldVal = oldObj ? oldObj[key] : undefined;
    const newVal = newObj ? newObj[key] : undefined;
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({
        field: key,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  }
  return changes;
}

function buildErrorResponse(message, code = 400, details = null) {
  return {
    success: false,
    code,
    message,
    details,
    timestamp: formatDateTime(new Date()),
  };
}

function buildSuccessResponse(data, message = '操作成功') {
  return {
    success: true,
    code: 200,
    message,
    data,
    timestamp: formatDateTime(new Date()),
  };
}

module.exports = {
  generateId,
  formatDateTime,
  formatAmount,
  deepClone,
  compareObjects,
  buildErrorResponse,
  buildSuccessResponse,
};
