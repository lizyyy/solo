const crypto = require('crypto');

function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
}

function generateBatchId() {
  return generateId('batch');
}

function formatDate(date) {
  const d = new Date(date || Date.now());
  return d.toISOString().split('T')[0];
}

function formatDateTime(date) {
  const d = new Date(date || Date.now());
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

function isEmpty(value) {
  return value === null || value === undefined || value === '';
}

function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

function isValidIdCard(idCard) {
  return /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/.test(idCard);
}

function isValidLicensePlate(plate) {
  return /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-HJ-NP-Z][A-HJ-NP-Z0-9]{4,5}[A-HJ-NP-Z0-9挂学警港澳]$/.test(plate);
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return String(obj);
  }
}

function parseJsonSafe(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

module.exports = {
  generateId,
  generateBatchId,
  formatDate,
  formatDateTime,
  isEmpty,
  isValidPhone,
  isValidIdCard,
  isValidLicensePlate,
  safeStringify,
  parseJsonSafe
};
