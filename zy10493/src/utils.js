const chalk = require('chalk');
const { ERROR_CODES } = require('./config');

class StitcherError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'StitcherError';
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details
    };
  }
}

const logger = {
  info: (msg) => console.log(chalk.blue(`ℹ  ${msg}`)),
  success: (msg) => console.log(chalk.green(`✓  ${msg}`)),
  warn: (msg) => console.log(chalk.yellow(`⚠  ${msg}`)),
  error: (msg, err) => {
    console.log(chalk.red(`✗  ${msg}`));
    if (err) console.error(err);
  },
  debug: (msg) => process.env.DEBUG && console.log(chalk.gray(`  ${msg}`))
};

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
};

const parseTime = (value, format = 'ms') => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!isNaN(parsed)) return parsed;
    const num = parseInt(value, 10);
    if (!isNaN(num)) return num;
  }
  throw new StitcherError(
    `无法解析时间值: ${value}`,
    ERROR_CODES.VALIDATION_ERROR,
    { value }
  );
};

const validateEvent = (event, config, sourceInfo) => {
  const errors = [];
  const { userKey, sessionKey, timeKey } = config;

  if (!event[userKey]) {
    errors.push(`缺少用户标识字段: ${userKey}`);
  }
  if (!event[sessionKey]) {
    errors.push(`缺少会话标识字段: ${sessionKey}`);
  }
  if (event[timeKey] === undefined || event[timeKey] === null) {
    errors.push(`缺少时间字段: ${timeKey}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    sourceInfo
  };
};

module.exports = {
  StitcherError,
  logger,
  formatBytes,
  formatDuration,
  parseTime,
  validateEvent
};