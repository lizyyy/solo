const winston = require('winston');
const config = require('../../config/default');
const fs = require('fs');
const path = require('path');

const logDir = path.dirname(config.logging.filename);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const maskSensitiveData = (message) => {
  if (typeof message !== 'string') return message;
  
  const phoneRegex = /1[3-9]\d{9}/g;
  const idCardRegex = /\d{17}[\dXx]/g;
  
  return message
    .replace(phoneRegex, '****')
    .replace(idCardRegex, '****');
};

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
      const maskedMessage = maskSensitiveData(JSON.stringify(message));
      return `[${timestamp}] [${level.toUpperCase()}]: ${maskedMessage}`;
    })
  ),
  transports: [
    new winston.transports.File({ 
      filename: config.logging.filename,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

module.exports = logger;