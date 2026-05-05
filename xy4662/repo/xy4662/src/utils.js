const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const generateId = () => uuidv4();

const calculateHash = (data) => {
  if (typeof data !== 'string') {
    data = JSON.stringify(data);
  }
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
};

const normalizeForHash = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const sorted = {};
  Object.keys(obj).sort().forEach(key => {
    const value = obj[key];
    if (value !== null && value !== undefined && value !== '') {
      sorted[key] = normalizeForHash(value);
    }
  });
  return sorted;
};

const calculateContentHash = (record, recordType) => {
  const normalized = normalizeForHash(record);
  const hashInput = `${recordType}:${JSON.stringify(normalized)}`;
  return calculateHash(hashInput);
};

const validateSampleData = (data) => {
  const errors = [];
  
  if (!data.sample_code && !data.bottle_code) {
    errors.push('缺少样品编号或样品瓶码');
  }
  
  if (data.temperature !== undefined && data.temperature !== null && data.temperature !== '') {
    const temp = parseFloat(data.temperature);
    if (isNaN(temp) || temp < -50 || temp > 100) {
      errors.push('温度值无效');
    }
  }
  
  if (data.ph !== undefined && data.ph !== null && data.ph !== '') {
    const ph = parseFloat(data.ph);
    if (isNaN(ph) || ph < 0 || ph > 14) {
      errors.push('pH值无效');
    }
  }
  
  if (data.sampling_time) {
    const date = new Date(data.sampling_time);
    if (isNaN(date.getTime())) {
      errors.push('采样时间格式无效');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

const validateReadingData = (data) => {
  const errors = [];
  
  if (!data.reading_type) {
    errors.push('缺少读数类型');
  }
  
  if (data.reading_value === undefined || data.reading_value === null || data.reading_value === '') {
    errors.push('缺少读数值');
  } else {
    const value = parseFloat(data.reading_value);
    if (isNaN(value)) {
      errors.push('读数值无效');
    }
  }
  
  if (data.reading_time) {
    const date = new Date(data.reading_time);
    if (isNaN(date.getTime())) {
      errors.push('读数时间格式无效');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

const validateRecheckData = (data) => {
  const errors = [];
  
  if (!data.recheck_reason) {
    errors.push('缺少复检原因');
  }
  
  if (data.recheck_time) {
    const date = new Date(data.recheck_time);
    if (isNaN(date.getTime())) {
      errors.push('复检时间格式无效');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

const calculateRiskScore = (errorReason, originalContent) => {
  let score = 0;
  let level = 'unknown';
  
  const lowRiskPatterns = ['格式', '空格', '大小写', '多余字符', '日期格式', '时间格式'];
  const mediumRiskPatterns = ['数值', 'pH', '温度', '浓度', '无效'];
  const highRiskPatterns = ['缺失', '空白', '空', 'null', 'undefined', '不存在'];
  
  const reasonLower = (errorReason || '').toLowerCase();
  const contentLower = (originalContent || '').toLowerCase();
  
  lowRiskPatterns.forEach(pattern => {
    if (reasonLower.includes(pattern.toLowerCase()) || contentLower.includes(pattern.toLowerCase())) {
      score += 1;
    }
  });
  
  mediumRiskPatterns.forEach(pattern => {
    if (reasonLower.includes(pattern.toLowerCase()) || contentLower.includes(pattern.toLowerCase())) {
      score += 3;
    }
  });
  
  highRiskPatterns.forEach(pattern => {
    if (reasonLower.includes(pattern.toLowerCase()) || contentLower.includes(pattern.toLowerCase())) {
      score += 5;
    }
  });
  
  if (score <= 2) {
    level = 'low';
  } else if (score <= 5) {
    level = 'medium';
  } else {
    level = 'high';
  }
  
  return { score, level };
};

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().replace('T', ' ').substring(0, 19);
};

module.exports = {
  generateId,
  calculateHash,
  calculateContentHash,
  normalizeForHash,
  validateSampleData,
  validateReadingData,
  validateRecheckData,
  calculateRiskScore,
  formatDate
};
