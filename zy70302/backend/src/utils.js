const { v4: uuidv4 } = require('uuid');

const ERROR_CATEGORIES = {
  NETWORK_ERROR: 'network',
  TIMEOUT: 'timeout',
  BUSINESS_ERROR: 'business',
  DATA_ERROR: 'data',
  SYSTEM_ERROR: 'system',
  UNKNOWN: 'unknown'
};

const classifyError = (error) => {
  const message = error?.message || error || '';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return ERROR_CATEGORIES.TIMEOUT;
  }
  if (lowerMessage.includes('network') || lowerMessage.includes('connection') || 
      lowerMessage.includes('etimedout') || lowerMessage.includes('econnrefused')) {
    return ERROR_CATEGORIES.NETWORK_ERROR;
  }
  if (lowerMessage.includes('business') || lowerMessage.includes('validation') || 
      lowerMessage.includes('invalid') || lowerMessage.includes('not found')) {
    return ERROR_CATEGORIES.BUSINESS_ERROR;
  }
  if (lowerMessage.includes('data') || lowerMessage.includes('format') || 
      lowerMessage.includes('json') || lowerMessage.includes('parse')) {
    return ERROR_CATEGORIES.DATA_ERROR;
  }
  if (lowerMessage.includes('system') || lowerMessage.includes('internal')) {
    return ERROR_CATEGORIES.SYSTEM_ERROR;
  }
  return ERROR_CATEGORIES.UNKNOWN;
};

const computeDiff = (before, after) => {
  const diffs = [];
  
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  
  for (const key of allKeys) {
    const beforeVal = JSON.stringify(before[key]);
    const afterVal = JSON.stringify(after[key]);
    
    if (beforeVal !== afterVal) {
      diffs.push({
        field: key,
        before: before[key],
        after: after[key]
      });
    }
  }
  
  return diffs;
};

const now = () => new Date().toISOString();

const generateId = () => uuidv4();

const parseJSON = (str) => {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
};

const stringifyJSON = (obj, space = 2) => {
  try {
    return JSON.stringify(obj, null, space);
  } catch {
    return String(obj);
  }
};

const SAFE_FIELDS = {
  invoice: ['invoiceNo', 'remark', 'callbackUrl'],
  sms: ['content', 'templateParams', 'callbackUrl'],
  inventory: ['reason', 'operatorId', 'callbackUrl']
};

const getSafeFields = (taskType) => {
  return SAFE_FIELDS[taskType] || [];
};

module.exports = {
  ERROR_CATEGORIES,
  classifyError,
  computeDiff,
  now,
  generateId,
  parseJSON,
  stringifyJSON,
  getSafeFields,
  SAFE_FIELDS
};
