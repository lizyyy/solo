const SENSITIVE_FIELDS = ['phone', 'parent_phone', 'id_card', 'email', 'password'];

function maskPhone(phone) {
  if (!phone) return phone;
  const str = String(phone);
  if (str.length >= 11) {
    return str.substring(0, 3) + '****' + str.substring(7);
  }
  return str.substring(0, Math.floor(str.length / 2)) + '****';
}

function maskIdCard(idCard) {
  if (!idCard) return idCard;
  const str = String(idCard);
  if (str.length >= 18) {
    return str.substring(0, 6) + '********' + str.substring(14);
  }
  return str.substring(0, Math.floor(str.length / 3)) + '****' + str.substring(Math.floor(str.length * 2 / 3));
}

function maskName(name) {
  if (!name) return name;
  const str = String(name);
  if (str.length <= 1) return str;
  if (str.length === 2) return str[0] + '*';
  return str[0] + '*'.repeat(str.length - 2) + str[str.length - 1];
}

function maskEmail(email) {
  if (!email) return email;
  const [user, domain] = String(email).split('@');
  if (!user || !domain) return email;
  const maskedUser = user.substring(0, Math.max(1, Math.floor(user.length / 2))) + '***';
  return `${maskedUser}@${domain}`;
}

function maskField(fieldName, value) {
  if (value === null || value === undefined) return value;
  
  const lowerField = fieldName.toLowerCase();
  
  if (lowerField.includes('phone') || lowerField.includes('mobile')) {
    return maskPhone(value);
  }
  if (lowerField.includes('id_card') || lowerField.includes('idcard') || lowerField.includes('identity')) {
    return maskIdCard(value);
  }
  if (lowerField.includes('name') && !lowerField.includes('bus') && !lowerField.includes('route')) {
    return maskName(value);
  }
  if (lowerField.includes('email')) {
    return maskEmail(value);
  }
  
  return value;
}

function maskObject(obj, options = {}) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const { excludeFields = [] } = options;
  const result = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    if (excludeFields.includes(key)) {
      result[key] = obj[key];
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      result[key] = maskObject(obj[key], options);
    } else {
      result[key] = maskField(key, obj[key]);
    }
  }
  
  return result;
}

function maskForLog(data) {
  return maskObject(data);
}

function maskForExport(data) {
  return maskObject(data);
}

function maskForResponse(data, options = {}) {
  return maskObject(data, options);
}

module.exports = {
  maskPhone,
  maskIdCard,
  maskName,
  maskEmail,
  maskField,
  maskObject,
  maskForLog,
  maskForExport,
  maskForResponse
};