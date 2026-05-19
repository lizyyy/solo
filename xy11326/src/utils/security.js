const CryptoJS = require('crypto-js');
const config = require('../config');

const maskSensitiveFields = (data, fields = ['phone', 'idCard', 'bankAccount']) => {
  if (!data) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveFields(item, fields));
  }
  
  if (typeof data === 'object') {
    const result = { ...data };
    fields.forEach(field => {
      if (result[field]) {
        result[field] = maskValue(result[field]);
      }
    });
    return result;
  }
  
  return data;
};

const maskValue = (value) => {
  if (!value || typeof value !== 'string') return value;
  
  if (value.length <= 4) return '*'.repeat(value.length);
  if (value.length <= 8) return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
  return value.slice(0, 3) + '*'.repeat(value.length - 6) + value.slice(-3);
};

const encrypt = (text) => {
  return CryptoJS.AES.encrypt(text, config.encryption.secretKey).toString();
};

const decrypt = (ciphertext) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, config.encryption.secretKey);
  return bytes.toString(CryptoJS.enc.Utf8);
};

const encryptSensitiveFields = (data, fields = ['phone', 'idCard', 'bankAccount']) => {
  if (!data) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => encryptSensitiveFields(item, fields));
  }
  
  if (typeof data === 'object') {
    const result = { ...data };
    fields.forEach(field => {
      if (result[field]) {
        result[field] = encrypt(result[field]);
      }
    });
    return result;
  }
  
  return data;
};

const decryptSensitiveFields = (data, fields = ['phone', 'idCard', 'bankAccount']) => {
  if (!data) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => decryptSensitiveFields(item, fields));
  }
  
  if (typeof data === 'object') {
    const result = { ...data };
    fields.forEach(field => {
      if (result[field]) {
        try {
          result[field] = decrypt(result[field]);
        } catch (e) {
        }
      }
    });
    return result;
  }
  
  return data;
};

module.exports = {
  maskSensitiveFields,
  maskValue,
  encrypt,
  decrypt,
  encryptSensitiveFields,
  decryptSensitiveFields
};
