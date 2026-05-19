const winston = require('winston');
const path = require('path');

const maskSensitiveData = (obj) => {
  if (!obj) return obj;
  
  const sensitiveFields = ['phone', 'mobile', 'email', 'idCard', 'identity', 'address'];
  
  const mask = (value) => {
    if (typeof value !== 'string') return value;
    if (value.length <= 4) return '****';
    return value.slice(0, 2) + '****' + value.slice(-2);
  };
  
  const maskObject = (data) => {
    if (Array.isArray(data)) {
      return data.map(item => maskObject(item));
    }
    
    if (typeof data === 'object' && data !== null) {
      const result = {};
      for (const key in data) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          result[key] = mask(data[key]);
        } else {
          result[key] = maskObject(data[key]);
        }
      }
      return result;
    }
    
    return data;
  };
  
  return maskObject(obj);
};

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const maskedMeta = maskSensitiveData(meta);
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...maskedMeta
      });
    })
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/combined.log') 
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const maskedMeta = maskSensitiveData(meta);
        return `${timestamp} [${level}]: ${message} ${Object.keys(maskedMeta).length ? JSON.stringify(maskedMeta) : ''}`;
      })
    )
  }));
}

logger.maskSensitiveData = maskSensitiveData;

module.exports = logger;
