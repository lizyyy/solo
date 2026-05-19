const winston = require('winston');
const path = require('path');
const { runQuery } = require('./database');

const sensitiveFields = ['phone', 'password', 'email', 'address'];

const maskSensitiveData = (data) => {
  if (!data) return data;
  if (typeof data === 'string') {
    return data;
  }
  if (typeof data === 'object') {
    const masked = { ...data };
    for (const key of Object.keys(masked)) {
      if (sensitiveFields.includes(key.toLowerCase()) || sensitiveFields.includes(key)) {
        if (typeof masked[key] === 'string' && masked[key].length > 4) {
          masked[key] = masked[key].substring(0, 3) + '****' + masked[key].substring(masked[key].length - 2);
        } else {
          masked[key] = '****';
        }
      } else if (typeof masked[key] === 'object') {
        masked[key] = maskSensitiveData(masked[key]);
      }
    }
    return masked;
  }
  return data;
};

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

const logAudit = async (userId, userName, action, resourceType, resourceId, details, ipAddress, userAgent) => {
  const maskedDetails = maskSensitiveData(details);
  const detailsStr = typeof maskedDetails === 'string' ? maskedDetails : JSON.stringify(maskedDetails);
  
  try {
    await runQuery(
      'INSERT INTO audit_logs (user_id, user_name, action, resource_type, resource_id, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, userName, action, resourceType, resourceId, detailsStr, ipAddress, userAgent]
    );
    logger.info('审计日志', { user: userName, action, resourceType, resourceId });
  } catch (err) {
    logger.error('写入审计日志失败', err);
  }
};

module.exports = { logger, logAudit, maskSensitiveData };
