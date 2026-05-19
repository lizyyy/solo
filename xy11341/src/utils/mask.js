const SENSITIVE_FIELDS = [
  { field: 'engineer_phone', pattern: /(\d{3})\d{4}(\d{4})/, replace: '$1****$2' },
  { field: 'engineer_name', pattern: /(.{1}).*/, replace: '$1*' },
];

function maskValue(value, fieldName) {
  if (!value) return value;
  const rule = SENSITIVE_FIELDS.find(r => r.field === fieldName);
  if (rule) {
    return String(value).replace(rule.pattern, rule.replace);
  }
  return value;
}

function maskObject(obj, fields = null) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object') {
      result[key] = maskObject(value, fields);
    } else {
      const shouldMask = fields ? fields.includes(key) : SENSITIVE_FIELDS.some(r => r.field === key);
      result[key] = shouldMask ? maskValue(value, key) : value;
    }
  }
  return result;
}

function maskLogEntry(entry) {
  if (typeof entry === 'string') {
    let masked = entry;
    SENSITIVE_FIELDS.forEach(rule => {
      const regex = new RegExp(`"${rule.field}":"([^"]+)"`, 'g');
      masked = masked.replace(regex, (match, value) => {
        return `"${rule.field}":"${maskValue(value, rule.field)}"`;
      });
    });
    return masked;
  }
  return maskObject(entry);
}

module.exports = {
  maskValue,
  maskObject,
  maskLogEntry,
  SENSITIVE_FIELDS,
};
