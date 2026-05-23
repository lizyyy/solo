const crypto = require('crypto');

const maskSensitiveData = (data, sensitiveFields, maskType = 'partial') => {
  if (!data || !sensitiveFields || sensitiveFields.length === 0) {
    return data;
  }

  const maskedData = JSON.parse(JSON.stringify(data));
  
  sensitiveFields.forEach(field => {
    const paths = field.field_path.split('.');
    let current = maskedData;
    
    for (let i = 0; i < paths.length - 1; i++) {
      if (current[paths[i]] === undefined) break;
      current = current[paths[i]];
    }
    
    const lastKey = paths[paths.length - 1];
    if (current[lastKey] !== undefined) {
      current[lastKey] = applyMask(current[lastKey], maskType);
    }
  });
  
  return maskedData;
};

const applyMask = (value, maskType) => {
  if (value === null || value === undefined) return value;
  const strValue = String(value);
  
  switch (maskType) {
    case 'full':
      return '***';
    case 'hash':
      return crypto.createHash('sha256').update(strValue).digest('hex').substring(0, 8);
    case 'partial':
    default:
      if (strValue.length <= 4) return '*'.repeat(strValue.length);
      return strValue.substring(0, 2) + '*'.repeat(strValue.length - 4) + strValue.substring(strValue.length - 2);
  }
};

const generateRequestHash = (method, url, headers, body) => {
  const normalizedHeaders = headers ? JSON.stringify(Object.keys(headers).sort().reduce((obj, key) => {
    obj[key] = headers[key];
    return obj;
  }, {})) : '';
  
  const normalizedBody = body ? JSON.stringify(body) : '';
  const data = `${method}:${url}:${normalizedHeaders}:${normalizedBody}`;
  
  return crypto.createHash('md5').update(data).digest('hex');
};

const detectSensitiveFields = (headers, body) => {
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,
    /auth/i,
    /credential/i,
    /private/i,
    /pin/i
  ];
  
  const detected = [];
  
  const checkObject = (obj, prefix = '') => {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      
      if (sensitivePatterns.some(pattern => pattern.test(key))) {
        detected.push({ field_path: fullPath, mask_type: 'partial' });
      }
      
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        checkObject(obj[key], fullPath);
      }
    });
  };
  
  checkObject(headers, 'headers');
  checkObject(body, 'body');
  
  return detected;
};

module.exports = {
  maskSensitiveData,
  generateRequestHash,
  detectSensitiveFields
};
