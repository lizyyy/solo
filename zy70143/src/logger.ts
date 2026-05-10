import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let logMessage = `${timestamp} [${level}]: ${stack || message}`;
  if (Object.keys(metadata).length > 0) {
    logMessage += ` ${JSON.stringify(metadata)}`;
  }
  return logMessage;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        logFormat
      )
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

export const createAuditLogger = (module: string) => ({
  info: (message: string, data?: Record<string, unknown>) =>
    logger.info(`[${module}] ${message}`, data),
  warn: (message: string, data?: Record<string, unknown>) =>
    logger.warn(`[${module}] ${message}`, data),
  error: (message: string, data?: Record<string, unknown>) =>
    logger.error(`[${module}] ${message}`, data),
  debug: (message: string, data?: Record<string, unknown>) =>
    logger.debug(`[${module}] ${message}`, data)
});
