const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const maskSensitiveData = (data) => {
  if (typeof data === 'string') {
    return data
      .replace(/(\d{3})\d{4}(\d{4})/g, '$1****$2')
      .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '***@***.***')
      .replace(/1[3-9]\d{9}/g, '1*******');
  }
  if (typeof data === 'object' && data !== null) {
    const masked = {};
    for (const key in data) {
      if (['phone', 'mobile', 'id_card', 'idCard', 'email', 'password', 'secret'].includes(key)) {
        masked[key] = maskSensitiveData(String(data[key]));
      } else {
        masked[key] = data[key];
      }
    }
    return masked;
  }
  return data;
};

const sensitiveMask = winston.format((info) => {
  return maskSensitiveData(info);
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    sensitiveMask(),
    winston.format.json()
  ),
  defaultMeta: { service: 'school-bus-reconciliation' },
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760,
      maxFiles: 10
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

module.exports = logger;