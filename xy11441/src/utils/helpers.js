const crypto = require('crypto');
const moment = require('moment');
const chalk = require('chalk');

function generateUniqueKey(fields) {
  const keyParts = [
    fields.source_type || '',
    fields.supplier_name || '',
    fields.product_code || fields.product_name || '',
    fields.batch_no || '',
    fields.delivery_date || ''
  ].map(p => String(p).trim().toLowerCase()).join('|');
  
  return crypto.createHash('md5').update(keyParts).digest('hex');
}

function generateFileHash(filePath) {
  const fs = require('fs');
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function formatDate(date, format = 'YYYY-MM-DD') {
  return moment(date).format(format);
}

function parseDate(dateStr) {
  const formats = ['YYYY-MM-DD', 'YYYY/MM/DD', 'DD-MM-YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY'];
  for (const fmt of formats) {
    const m = moment(dateStr, fmt, true);
    if (m.isValid()) {
      return m.format('YYYY-MM-DD');
    }
  }
  return null;
}

function isEmpty(value) {
  return value === null || value === undefined || value === '' || (typeof value === 'number' && isNaN(value));
}

function parseFloatSafe(value, defaultValue = 0) {
  if (isEmpty(value)) return defaultValue;
  const parsed = parseFloat(String(value).replace(/[^\d.-]/g, ''));
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseIntSafe(value, defaultValue = 0) {
  if (isEmpty(value)) return defaultValue;
  const parsed = parseInt(String(value).replace(/[^\d-]/g, ''), 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function printSuccess(message) {
  console.log(chalk.green(`✓ ${message}`));
}

function printError(message) {
  console.log(chalk.red(`✗ ${message}`));
}

function printWarning(message) {
  console.log(chalk.yellow(`⚠ ${message}`));
}

function printInfo(message) {
  console.log(chalk.blue(`ℹ ${message}`));
}

const ERROR_TYPES = {
  missing_field: { name: '缺字段', color: 'red' },
  cross_date: { name: '跨日', color: 'yellow' },
  name_change: { name: '改名', color: 'blue' },
  amount_conflict: { name: '金额冲突', color: 'magenta' },
  quantity_conflict: { name: '数量冲突', color: 'cyan' }
};

const SOURCE_TYPES = {
  delivery: { name: '供应商送货单', color: 'green' },
  weight: { name: '称重记录', color: 'blue' },
  return_basket: { name: '退筐照片', color: 'yellow' },
  price_adjust: { name: '手工改价表', color: 'magenta' }
};

module.exports = {
  generateUniqueKey,
  generateFileHash,
  formatDate,
  parseDate,
  isEmpty,
  parseFloatSafe,
  parseIntSafe,
  printSuccess,
  printError,
  printWarning,
  printInfo,
  ERROR_TYPES,
  SOURCE_TYPES
};
