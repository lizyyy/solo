const CryptoJS = require('crypto-js');
const { DESENSITIZATION_RULES } = require('./constants');

const maskPhone = (phone) => {
  if (!phone) return phone;
  const str = String(phone);
  if (str.length <= 7) return str;
  return str.slice(0, 3) + '****' + str.slice(-4);
};

const maskEmail = (email) => {
  if (!email) return email;
  const str = String(email);
  const [name, domain] = str.split('@');
  if (!name || !domain) return str;
  if (name.length <= 2) return '***@' + domain;
  return name.slice(0, 2) + '***@' + domain;
};

const maskIdCard = (idCard) => {
  if (!idCard) return idCard;
  const str = String(idCard);
  if (str.length <= 10) return str;
  return str.slice(0, 6) + '********' + str.slice(-4);
};

const maskName = (name) => {
  if (!name) return name;
  const str = String(name);
  if (str.length <= 1) return str;
  if (str.length === 2) return str[0] + '*';
  return str[0] + '*'.repeat(str.length - 2) + str.slice(-1);
};

const maskAddress = (address) => {
  if (!address) return address;
  const str = String(address);
  if (str.length <= 10) return str;
  return str.slice(0, 10) + '***';
};

const hashIp = (ip) => {
  if (!ip) return ip;
  return 'HASHED_' + CryptoJS.MD5(String(ip)).toString().slice(0, 8);
};

const desensitizeField = (value, rule) => {
  switch (rule) {
    case DESENSITIZATION_RULES.MASK_PHONE:
      return maskPhone(value);
    case DESENSITIZATION_RULES.MASK_EMAIL:
      return maskEmail(value);
    case DESENSITIZATION_RULES.MASK_ID_CARD:
      return maskIdCard(value);
    case DESENSITIZATION_RULES.MASK_NAME:
      return maskName(value);
    case DESENSITIZATION_RULES.MASK_ADDRESS:
      return maskAddress(value);
    case DESENSITIZATION_RULES.HASH_IP:
      return hashIp(value);
    default:
      return value;
  }
};

const desensitizeObject = (obj, fieldRules) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      const rule = fieldRules[key];
      
      if (rule === DESENSITIZATION_RULES.REMOVE_SENSITIVE_FIELDS) {
        continue;
      }
      
      if (typeof value === 'object' && value !== null) {
        result[key] = desensitizeObject(value, fieldRules);
      } else if (rule) {
        result[key] = desensitizeField(value, rule);
      } else {
        result[key] = value;
      }
    }
  }
  
  return result;
};

const validateDesensitization = (original, desensitized, fieldRules) => {
  const issues = [];
  
  for (const field in fieldRules) {
    const originalValue = original[field];
    const desensitizedValue = desensitized[field];
    const rule = fieldRules[field];
    
    if (rule === DESENSITIZATION_RULES.REMOVE_SENSITIVE_FIELDS) {
      if (desensitizedValue !== undefined) {
        issues.push(`字段 ${field} 应该被移除，但仍然存在`);
      }
      continue;
    }
    
    if (originalValue && desensitizedValue && String(originalValue) === String(desensitizedValue)) {
      issues.push(`字段 ${field} 可能未正确脱敏，值未发生变化`);
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
};

const detectSensitiveFields = (obj) => {
  const rules = {};
  const sensitivePatterns = {
    phone: /^1[3-9]\d{9}$/,
    email: /^[\w.-]+@[\w.-]+\.\w+$/,
    idCard: /^\d{17}[\dXx]$/,
    ip: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
  };
  
  const detectRecursive = (obj, prefix = '') => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        const value = obj[key];
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (sensitivePatterns.phone.test(value)) {
          rules[fullKey] = DESENSITIZATION_RULES.MASK_PHONE;
        } else if (sensitivePatterns.email.test(value)) {
          rules[fullKey] = DESENSITIZATION_RULES.MASK_EMAIL;
        } else if (sensitivePatterns.idCard.test(value)) {
          rules[fullKey] = DESENSITIZATION_RULES.MASK_ID_CARD;
        } else if (sensitivePatterns.ip.test(value)) {
          rules[fullKey] = DESENSITIZATION_RULES.HASH_IP;
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        detectRecursive(obj[key], prefix ? `${prefix}.${key}` : key);
      }
    }
  };
  
  detectRecursive(obj);
  return rules;
};

module.exports = {
  maskPhone,
  maskEmail,
  maskIdCard,
  maskName,
  maskAddress,
  hashIp,
  desensitizeField,
  desensitizeObject,
  validateDesensitization,
  detectSensitiveFields
};
