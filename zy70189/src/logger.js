const winston = require('winston');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const logDir = path.dirname(config.log.file);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: config.log.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'refund-permission-api' },
  transports: [
    new winston.transports.File({ 
      filename: config.log.file,
      maxsize: 10485760,
      maxFiles: 5
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

logger.formatOperation = (operation, data) => {
  return {
    operation,
    ...data,
    timestamp: new Date().toISOString()
  };
};

module.exports = logger;
