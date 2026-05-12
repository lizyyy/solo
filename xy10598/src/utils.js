const crypto = require('crypto');

function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  return `${prefix}${timestamp}${random}`.toUpperCase();
}

function generateBatchId(type) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `BATCH-${type.toUpperCase()}-${date}-${Date.now()}`;
}

function generatePeriod(date) {
  const d = new Date(date);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parsePeriod(period) {
  const year = parseInt(period.slice(0, 4));
  const month = parseInt(period.slice(4, 6));
  return { year, month };
}

function getPrevPeriod(period) {
  const { year, month } = parsePeriod(period);
  if (month === 1) {
    return `${year - 1}12`;
  }
  return `${year}${String(month - 1).padStart(2, '0')}`;
}

function dateToISO(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function formatMoney(amount) {
  return Number(amount).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function hashData(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('md5').update(str).digest('hex');
}

function safeAmount(val, defaultValue = 0) {
  const num = Number(val);
  return isNaN(num) ? defaultValue : num;
}

module.exports = {
  generateId,
  generateBatchId,
  generatePeriod,
  parsePeriod,
  getPrevPeriod,
  dateToISO,
  formatMoney,
  hashData,
  safeAmount
};
