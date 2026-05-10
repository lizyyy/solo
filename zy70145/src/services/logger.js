const config = require('../config');

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const configuredLevel = LEVELS[config.log.level] || LEVELS.info;

function format(level, message, data) {
  const ts = new Date().toISOString();
  const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
  return `[${ts}] [${level.toUpperCase()}] ${message}${dataStr}`;
}

function log(level, message, data) {
  if (LEVELS[level] >= configuredLevel) {
    const output = format(level, message, data);
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }
}

module.exports = {
  debug: (msg, data) => log('debug', msg, data),
  info: (msg, data) => log('info', msg, data),
  warn: (msg, data) => log('warn', msg, data),
  error: (msg, data) => log('error', msg, data)
};
