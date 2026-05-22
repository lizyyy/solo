const { v4: uuidv4 } = require('uuid');
const { SENSITIVE_FIELDS } = require('./constants');

function generateId() {
  return uuidv4();
}

function getCurrentTime() {
  return new Date().toISOString();
}

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai'
  });
}

function maskPhone(phone) {
  if (!phone) return '';
  const str = String(phone);
  if (str.length <= 7) return str.replace(/./g, '*');
  return str.slice(0, 3) + '****' + str.slice(-4);
}

function maskName(name) {
  if (!name) return '';
  const str = String(name);
  if (str.length <= 1) return '*';
  return str[0] + '*'.repeat(str.length - 1);
}

function maskValue(field, value) {
  if (value === null || value === undefined) return value;
  
  if (field === 'resident_phone') {
    return maskPhone(value);
  }
  if (field === 'resident_name') {
    return maskName(value);
  }
  if (field.includes('_id') && typeof value === 'string') {
    return value.slice(0, 8) + '...';
  }
  return value;
}

function desensitizeObject(obj, fields = SENSITIVE_FIELDS) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      result[key] = desensitizeObject(value, fields);
    } else if (fields.includes(key)) {
      result[key] = maskValue(key, value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

function batchMask(dataArray, fields = SENSITIVE_FIELDS) {
  return dataArray.map(item => desensitizeObject(item, fields));
}

function calculateBatchStats(orders) {
  const total = orders.length;
  const success = orders.filter(o => o.status === 'completed').length;
  const pending = orders.filter(o => 
    ['draft', 'submitted', 'second_confirmation', 'assigned', 'in_progress', 'pending_review'].includes(o.status)
  ).length;
  const failed = orders.filter(o => 
    ['rejected', 'cancelled'].includes(o.status)
  ).length;
  
  return { total, success, pending, failed };
}

function isRetryableError(error) {
  const retryableMessages = [
    'timeout',
    'connection',
    'network',
    'temporarily',
    'try again',
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED'
  ];
  
  const message = (error.message || '').toLowerCase();
  return retryableMessages.some(msg => message.includes(msg.toLowerCase()));
}

function parseBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }
  return false;
}

function safeParseJSON(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

function truncateString(str, maxLength = 100) {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

function generateBatchNo(prefix = 'WX') {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${dateStr}${random}`;
}

function getTimeAfterMinutes(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function buildOrderQuery(filters) {
  const conditions = [];
  const params = [];
  
  if (filters.batch_id) {
    conditions.push('batch_id = ?');
    params.push(filters.batch_id);
  }
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.room_number) {
    conditions.push('room_number LIKE ?');
    params.push(`%${filters.room_number}%`);
  }
  if (filters.repair_type) {
    conditions.push('repair_type = ?');
    params.push(filters.repair_type);
  }
  if (filters.assignee_id) {
    conditions.push('assignee_id = ?');
    params.push(filters.assignee_id);
  }
  if (filters.start_date) {
    conditions.push('created_at >= ?');
    params.push(filters.start_date);
  }
  if (filters.end_date) {
    conditions.push('created_at <= ?');
    params.push(filters.end_date);
  }
  
  return { conditions, params };
}

function maskSensitiveData(value, fieldName = '') {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  
  if (fieldName.includes('phone') || /^1[3-9]\d{9}$/.test(value)) {
    return maskPhone(value);
  }
  if (fieldName.includes('name') || value.length <= 4) {
    return maskName(value);
  }
  if (value.length > 10) {
    return value.slice(0, 3) + '***' + value.slice(-3);
  }
  return value;
}

module.exports = {
  maskSensitiveData,
  generateId,
  getCurrentTime,
  formatDate,
  maskPhone,
  maskName,
  maskValue,
  desensitizeObject,
  batchMask,
  calculateBatchStats,
  isRetryableError,
  parseBool,
  safeParseJSON,
  truncateString,
  generateBatchNo,
  getTimeAfterMinutes,
  buildOrderQuery
};
