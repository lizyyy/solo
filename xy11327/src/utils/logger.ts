import winston from 'winston';
import { maskLogData } from './sensitiveData';

const sensitiveFormat = winston.format((info) => {
  const masked = maskLogData(info.message);
  return { ...info, message: masked };
})();

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    sensitiveFormat,
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});
