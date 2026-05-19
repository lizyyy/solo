const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { maskSensitiveFields } = require('./security');

const logDir = config.logging.dir;
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const sensitiveMaskFormatter = winston.format((info) => {
  if (info.message && typeof info.message === 'object') {
    info.message = JSON.stringify(maskSensitiveFields(info.message));
  }
  if (info.meta) {
    info.meta = maskSensitiveFields(info.meta);
  }
  return info;
});

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    sensitiveMaskFormatter(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'agri-coop-finance' },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log') 
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

const logOperation = (operation, operator, details = {}) => {
  logger.info({
    operation,
    operator,
    details,
    timestamp: new Date().toISOString()
  });
};

const logError = (operation, error, operator = 'system', details = {}) => {
  logger.error({
    operation,
    operator,
    error: error.message || error,
    stack: error.stack,
    details,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  logger,
  logOperation,
  logError
};
