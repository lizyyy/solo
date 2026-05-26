function validateRequired(fields, data) {
  const missing = [];
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    return new Error('缺少必填字段: ' + missing.join(', '));
  }
  return null;
}

function validateEnum(value, allowed, fieldName) {
  if (!allowed.includes(value)) {
    return new Error(`${fieldName}必须是以下值之一: ${allowed.join(', ')}`);
  }
  return null;
}

function validateDate(value, fieldName) {
  if (value && isNaN(Date.parse(value))) {
    return new Error(`${fieldName}不是有效的日期格式`);
  }
  return null;
}

function validatePositive(value, fieldName) {
  if (value !== undefined && value !== null && (isNaN(value) || Number(value) <= 0)) {
    return new Error(`${fieldName}必须是正数`);
  }
  return null;
}

module.exports = { validateRequired, validateEnum, validateDate, validatePositive };
