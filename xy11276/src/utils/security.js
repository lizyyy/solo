const config = require('../../config/default');

const maskPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return phone;
  if (phone.length <= 7) return config.security.maskPattern;
  return phone.substring(0, 3) + config.security.maskPattern + phone.substring(phone.length - 4);
};

const maskIdCard = (idCard) => {
  if (!idCard || typeof idCard !== 'string') return idCard;
  if (idCard.length <= 10) return config.security.maskPattern;
  return idCard.substring(0, 6) + config.security.maskPattern + idCard.substring(idCard.length - 4);
};

const maskField = (value, fieldName) => {
  if (!config.security.maskFields) return value;
  
  if (fieldName.toLowerCase().includes('phone') || fieldName === 'operatorPhone') {
    return maskPhone(value);
  }
  if (fieldName.toLowerCase().includes('idcard') || fieldName === 'operatorIdCard') {
    return maskIdCard(value);
  }
  if (fieldName.toLowerCase().includes('contact') || fieldName === 'maintainerContact') {
    return maskPhone(value);
  }
  return value;
};

const maskSensitiveFields = (data) => {
  if (!data || typeof data !== 'object') return data;
  
  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveFields(item));
  }
  
  const result = { ...data };
  config.security.sensitiveFields.forEach(field => {
    if (result[field] !== undefined) {
      result[field] = maskField(result[field], field);
    }
  });
  
  return result;
};

const validateAccess = (userRole, requiredRole) => {
  const roleHierarchy = {
    'viewer': 1,
    'operator': 2,
    'supervisor': 3,
    'admin': 4
  };
  
  return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
};

module.exports = {
  maskSensitiveFields,
  maskField,
  validateAccess
};