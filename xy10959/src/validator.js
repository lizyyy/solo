const fs = require('fs');
const path = require('path');

function validateInput(options) {
  const errors = [];

  if (!options.input) {
    errors.push('必须指定输入文件路径 (-i, --input)');
  } else {
    const inputPath = path.resolve(options.input);
    if (!fs.existsSync(inputPath)) {
      errors.push(`输入文件不存在: ${inputPath}`);
    } else if (path.extname(inputPath).toLowerCase() !== '.csv') {
      errors.push('输入文件必须是CSV格式');
    }
  }

  if (options.threshold < 0 || options.threshold > 1) {
    errors.push('模糊匹配阈值必须在 0-1 之间');
  }

  if (!options.priority || options.priority.split(',').length === 0) {
    errors.push('来源优先级不能为空');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateRow(row, index, headers) {
  const issues = [];
  
  if (!row['手机号'] && !row['邮箱'] && !row['公司名']) {
    issues.push('手机号、邮箱、公司名不能同时为空');
  }

  if (row['邮箱'] && !isValidEmail(row['邮箱'])) {
    issues.push(`邮箱格式无效: ${row['邮箱']}`);
  }

  if (row['手机号'] && !isValidPhone(row['手机号'])) {
    issues.push(`手机号格式无效: ${row['手机号']}`);
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function isValidPhone(phone) {
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length >= 7 && cleanPhone.length <= 15;
}

module.exports = {
  validateInput,
  validateRow,
  isValidEmail,
  isValidPhone
};
