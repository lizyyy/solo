const winston = require('winston');
const path = require('path');

const maskSensitive = (info) => {
  const sensitiveFields = ['phone', 'idCard', 'id_card', 'phoneNumber', 'phone_number', 'contact'];
  let message = info.message;
  
  if (typeof message === 'object') {
    message = JSON.stringify(message);
  }
  
  sensitiveFields.forEach(field => {
    const regex = new RegExp(`"${field}":"([^"]+)"`, 'gi');
    message = message.replace(regex, `"${field}":"***"`);
  });
  
  info.message = message;
  return info;
};

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format(maskSensitive)(),
    winston.format.timestamp(),
    winston.format.json()
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
      winston.format.simple()
    )
  }));
}

module.exports = logger;
