const maskPhone = (phone) => {
  if (!phone) return phone;
  const str = String(phone);
  if (str.length <= 4) return '****';
  return str.slice(0, 3) + '****' + str.slice(-4);
};

const maskName = (name) => {
  if (!name) return name;
  const str = String(name);
  if (str.length <= 1) return '*';
  return str[0] + '*'.repeat(str.length - 1);
};

const maskSensitiveFields = (data, options = {}) => {
  if (!data) return data;

  const {
    phoneFields = ['phone', 'customerPhone', 'contactPhone'],
    nameFields = ['customerName', 'contactName']
  } = options;

  const maskObject = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map(item => maskObject(item));
    }

    if (typeof obj === 'object' && obj !== null && obj.toJSON) {
      obj = obj.toJSON();
    }

    if (typeof obj === 'object' && obj !== null) {
      const result = {};
      for (const key in obj) {
        if (phoneFields.includes(key)) {
          result[key] = maskPhone(obj[key]);
        } else if (nameFields.includes(key)) {
          result[key] = maskName(obj[key]);
        } else {
          result[key] = maskObject(obj[key]);
        }
      }
      return result;
    }

    return obj;
  };

  return maskObject(data);
};

module.exports = {
  maskPhone,
  maskName,
  maskSensitiveFields
};
