const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LOG_FILE = path.join(LOG_DIR, `travel-budget-${new Date().toISOString().slice(0, 10)}.log`);

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const log = (level, message, context = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    context,
  };

  const formattedLog = `[${timestamp}] [${level}] ${message}`;
  console.log(formattedLog);

  const jsonLog = JSON.stringify(logEntry) + '\n';
  fs.appendFileSync(LOG_FILE, jsonLog);
};

const logger = {
  debug: (message, context = {}) => log('DEBUG', message, context),
  info: (message, context = {}) => log('INFO', message, context),
  warn: (message, context = {}) => log('WARN', message, context),
  error: (message, context = {}) => log('ERROR', message, context),
};

module.exports = logger;
