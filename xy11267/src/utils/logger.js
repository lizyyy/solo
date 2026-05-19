const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { maskText } = require('./masking');

const logDir = path.join(__dirname, '../../logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const maskingFormat = winston.format((info) => {
  if (typeof info.message === 'string') {
    info.message = maskText(info.message);
  }
  if (info.meta && typeof info.meta === 'object') {
    info.meta = JSON.parse(maskText(JSON.stringify(info.meta)));
  }
  return info;
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    maskingFormat(),
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'quality-inspection' },
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880,
      maxFiles: 10
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      maskingFormat(),
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
