const fs = require('fs');
const path = require('path');

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

function validateInput(options) {
  const errors = [];

  if (!options.arrival) {
    errors.push('必须指定到货单文件路径 (-a, --arrival)');
  } else if (!fs.existsSync(options.arrival)) {
    errors.push(`到货单文件不存在: ${options.arrival}`);
  } else if (path.extname(options.arrival).toLowerCase() !== '.csv') {
    errors.push(`到货单文件必须是 CSV 格式: ${options.arrival}`);
  }

  if (!options.temperature) {
    errors.push('必须指定温度记录文件路径 (-t, --temperature)');
  } else if (!fs.existsSync(options.temperature)) {
    errors.push(`温度记录文件不存在: ${options.temperature}`);
  } else if (path.extname(options.temperature).toLowerCase() !== '.csv') {
    errors.push(`温度记录文件必须是 CSV 格式: ${options.temperature}`);
  }

  if (options.config && !fs.existsSync(options.config)) {
    errors.push(`配置文件不存在: ${options.config}`);
  }

  if (options.defaultThreshold !== undefined) {
    const threshold = parseFloat(options.defaultThreshold);
    if (isNaN(threshold)) {
      errors.push(`默认阈值必须是数字: ${options.defaultThreshold}`);
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('\n  • ' + errors.join('\n  • '));
  }

  return true;
}

function validateCSVRow(row, rowNumber, expectedColumns, fileType) {
  const errors = [];
  const missingColumns = [];

  for (const col of expectedColumns) {
    if (row[col] === undefined || row[col] === null || row[col] === '') {
      missingColumns.push(col);
    }
  }

  if (missingColumns.length > 0) {
    errors.push(`缺少必填列: ${missingColumns.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    rowNumber,
    fileType
  };
}

module.exports = {
  validateInput,
  validateCSVRow,
  ValidationError
};