import winston from 'winston';

const sensitiveFields = ['customerName', 'operator', 'judgedBy', 'reviewedBy', 'approvedBy', 'inspector'];

function maskSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const masked = { ...obj };
  for (const key of sensitiveFields) {
    if (masked[key] && typeof masked[key] === 'string') {
      const value = masked[key];
      if (value.length > 2) {
        masked[key] = value.substring(0, 1) + '*'.repeat(value.length - 2) + value.substring(value.length - 1);
      } else {
        masked[key] = '*'.repeat(value.length);
      }
    }
  }
  return masked;
}

const sensitiveMaskFormat = winston.format((info) => {
  if (info.message && typeof info.message === 'object') {
    info.message = JSON.stringify(maskSensitiveData(info.message));
  }
  if (info.meta && typeof info.meta === 'object') {
    info.meta = maskSensitiveData(info.meta);
  }
  return info;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    sensitiveMaskFormat(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'print-qc-system' },
  transports: [
    new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: './logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

export { maskSensitiveData };
