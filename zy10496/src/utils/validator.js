const fs = require('fs');
const path = require('path');

const VALID_FORMATS = ['nginx', 'apache', 'common', 'combined'];

function validateInputs(options) {
  const errors = [];

  if (!options.input) {
    errors.push('必须指定输入路径 (-i, --input)');
  } else {
    const inputPath = path.resolve(options.input);
    if (!fs.existsSync(inputPath)) {
      errors.push(`输入路径不存在: ${inputPath}`);
    }
  }

  if (options.format && !VALID_FORMATS.includes(options.format)) {
    errors.push(`不支持的日志格式: ${options.format}。支持格式: ${VALID_FORMATS.join(', ')}`);
  }

  if (options.sampleCount) {
    const count = parseInt(options.sampleCount, 10);
    if (isNaN(count) || count < 1 || count > 1000) {
      errors.push('样本数量必须是 1-1000 之间的整数');
    }
  }

  if (options.config) {
    const configPath = path.resolve(options.config);
    if (!fs.existsSync(configPath)) {
      errors.push(`配置文件不存在: ${configPath}`);
    } else {
      try {
        const content = fs.readFileSync(configPath, 'utf8');
        JSON.parse(content);
      } catch (e) {
        errors.push(`配置文件不是有效的JSON格式: ${e.message}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function isValidIP(ip) {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

function isValidDate(dateStr) {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function isEmpty(value) {
  return value === null || value === undefined || value === '';
}

module.exports = {
  validateInputs,
  isValidIP,
  isValidDate,
  isEmpty,
  VALID_FORMATS
};
