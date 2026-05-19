const winston = require('winston');
const path = require('path');

const sensitiveFields = ['phone', 'id_card', 'email', 'contact_info'];

function maskSensitiveData(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const masked = { ...obj };
  for (const key of Object.keys(masked)) {
    if (sensitiveFields.includes(key.toLowerCase()) || 
        sensitiveFields.some(f => key.toLowerCase().includes(f))) {
      if (typeof masked[key] === 'string' && masked[key].length > 4) {
        masked[key] = masked[key].substring(0, 2) + '****' + masked[key].substring(masked[key].length - 2);
      } else if (typeof masked[key] === 'string') {
        masked[key] = '****';
      }
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }
  return masked;
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format((info) => {
      return maskSensitiveData(info);
    })()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(__dirname, '../../logs/error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(__dirname, '../../logs/combined.log') })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

logger.maskSensitiveData = maskSensitiveData;

module.exports = logger;
