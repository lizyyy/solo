const { allQuery } = require('../database/db');

let sensitivePatterns = null;

async function loadSensitivePatterns() {
  const configs = await allQuery('SELECT field_name, mask_pattern FROM sensitive_fields_config WHERE is_enabled = 1');
  sensitivePatterns = {};
  configs.forEach(config => {
    sensitivePatterns[config.field_name] = config.mask_pattern;
  });
}

function maskText(text) {
  let masked = text;
  
  masked = masked.replace(/1[3-9]\d{9}/g, match => {
    return match.substring(0, 3) + '****' + match.substring(7);
  });

  masked = masked.replace(/\d{17}[\dXx]/g, match => {
    return match.substring(0, 6) + '********' + match.substring(14);
  });

  masked = masked.replace(/[\w.-]+@[\w.-]+\.\w+/g, match => {
    const parts = match.split('@');
    const name = parts[0];
    return name.substring(0, Math.min(3, name.length)) + '***@' + parts[1];
  });

  return masked;
}

function maskObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => maskObject(item));
  }

  const result = {};
  for (const key in obj) {
    if (key.toLowerCase().includes('name') || key === 'speaker' || key === 'operator' || key === 'inspector') {
      const value = obj[key];
      if (typeof value === 'string' && value.length > 1) {
        result[key] = value.substring(0, 1) + '*';
      } else {
        result[key] = value;
      }
    } else if (key === 'phone' || key === 'mobile' || key.toLowerCase().includes('phone')) {
      const value = obj[key];
      if (typeof value === 'string') {
        result[key] = value.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
      } else {
        result[key] = value;
      }
    } else if (key === 'email') {
      const value = obj[key];
      if (typeof value === 'string') {
        result[key] = value.replace(/(\w{1,3})\w+@(\w+)\.(\w+)/, '$1***@$2.$3');
      } else {
        result[key] = value;
      }
    } else if (key === 'idcard' || key.toLowerCase().includes('id')) {
      const value = obj[key];
      if (typeof value === 'string') {
        result[key] = value.replace(/(\d{6})\d{8}(\d{4})/, '$1********$2');
      } else {
        result[key] = value;
      }
    } else if (key === 'transcript_text' || key === 'text' || key === 'raw_data' || key === 'content') {
      result[key] = maskText(obj[key]);
    } else {
      result[key] = maskObject(obj[key]);
    }
  }
  return result;
}

async function reloadPatterns() {
  await loadSensitivePatterns();
}

module.exports = { maskText, maskObject, reloadPatterns, loadSensitivePatterns };
