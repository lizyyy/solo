const { validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value
    }));
    
    throw new ValidationError('输入参数校验失败', errorDetails);
  }
  
  next();
};

const validateId = (value) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new Error('无效的ID格式');
  }
  return true;
};

const validatePositiveNumber = (value) => {
  if (typeof value !== 'number' || value <= 0) {
    throw new Error('必须是正数');
  }
  return true;
};

const validateNonNegativeNumber = (value) => {
  if (typeof value !== 'number' || value < 0) {
    throw new Error('必须是非负数');
  }
  return true;
};

const validatePhone = (value) => {
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(value)) {
    throw new Error('无效的手机号格式');
  }
  return true;
};

const validateEmail = (value) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    throw new Error('无效的邮箱格式');
  }
  return true;
};

const validatePassword = (value) => {
  if (value.length < 8) {
    throw new Error('密码长度至少8位');
  }
  if (!/[A-Z]/.test(value)) {
    throw new Error('密码必须包含大写字母');
  }
  if (!/[a-z]/.test(value)) {
    throw new Error('密码必须包含小写字母');
  }
  if (!/[0-9]/.test(value)) {
    throw new Error('密码必须包含数字');
  }
  return true;
};

const validateSerialSuffix = (value) => {
  const suffixRegex = /^[A-Z0-9]{4}$/i;
  if (!suffixRegex.test(value)) {
    throw new Error('序列号后四位必须是4位字母或数字');
  }
  return true;
};

const validateDepositRatio = (value) => {
  if (typeof value !== 'number' || value < 0.1 || value > 0.5) {
    throw new Error('订金比例必须在0.1到0.5之间（10%-50%）');
  }
  return true;
};

const validateUrl = (value) => {
  try {
    new URL(value);
    return true;
  } catch {
    throw new Error('无效的URL格式');
  }
};

module.exports = {
  validate,
  validateId,
  validatePositiveNumber,
  validateNonNegativeNumber,
  validatePhone,
  validateEmail,
  validatePassword,
  validateSerialSuffix,
  validateDepositRatio,
  validateUrl
};
