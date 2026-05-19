const maskPhone = (phone) => {
  if (!phone) return phone;
  const str = String(phone);
  if (str.length <= 4) return str;
  return str.slice(0, 3) + '****' + str.slice(-4);
};

const maskIdCard = (idCard) => {
  if (!idCard) return idCard;
  const str = String(idCard);
  if (str.length <= 8) return str;
  return str.slice(0, 6) + '********' + str.slice(-4);
};

const maskName = (name) => {
  if (!name) return name;
  const str = String(name);
  if (str.length <= 1) return str;
  return str[0] + '*'.repeat(str.length - 1);
};

const maskAddress = (address) => {
  if (!address) return address;
  const str = String(address);
  if (str.length <= 10) return str;
  return str.slice(0, 6) + '****' + str.slice(-4);
};

const sensitiveFields = {
  phone: maskPhone,
  customer_phone: maskPhone,
  id_card: maskIdCard,
  engineer_name: maskName,
  customer_name: maskName,
  customer_address: maskAddress,
  approved_by: maskName,
  warehouse_keeper: maskName,
  operator: maskName
};

const maskData = (data) => {
  if (!data) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => maskData(item));
  }
  
  if (typeof data === 'object' && data !== null) {
    const masked = {};
    for (const [key, value] of Object.entries(data)) {
      if (sensitiveFields[key]) {
        masked[key] = sensitiveFields[key](value);
      } else if (typeof value === 'object') {
        masked[key] = maskData(value);
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }
  
  return data;
};

const maskLog = (message, meta = {}) => {
  let maskedMessage = message;
  for (const [field, maskFn] of Object.entries(sensitiveFields)) {
    const regex = new RegExp(`(${field}["'\\s]*[:=]\\s*["']?)([^"',\\s}]+)`, 'gi');
    maskedMessage = maskedMessage.replace(regex, (match, prefix, value) => prefix + maskFn(value));
  }
  const maskedMeta = maskData(meta);
  return { message: maskedMessage, meta: maskedMeta };
};

const dataMaskingMiddleware = (req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    const maskedData = maskData(data);
    return originalJson.call(this, maskedData);
  };
  next();
};

module.exports = {
  dataMaskingMiddleware,
  maskData,
  maskLog,
  maskPhone,
  maskIdCard,
  maskName,
  maskAddress
};
