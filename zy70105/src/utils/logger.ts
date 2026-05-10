import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, requestId, context, stack }) => {
  const logEntry = {
    timestamp,
    level,
    requestId: requestId || 'N/A',
    message,
    context: context || {}
  };
  
  if (stack) {
    return JSON.stringify({ ...logEntry, stack });
  }
  
  return JSON.stringify(logEntry);
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      printf(({ level, message, timestamp, requestId }) => {
        return `${timestamp} [${level}] ${requestId ? `[${requestId}] ` : ''}${message}`;
      })
    )
  }));
}

export class LoggerContext {
  private requestId: string;
  private context: Record<string, unknown>;

  constructor(requestId?: string) {
    this.requestId = requestId || uuidv4();
    this.context = {};
  }

  getRequestId(): string {
    return this.requestId;
  }

  addContext(key: string, value: unknown): void {
    this.context[key] = value;
  }

  private log(level: string, message: string, meta?: Record<string, unknown>): void {
    logger.log({
      level,
      message,
      requestId: this.requestId,
      context: { ...this.context, ...meta }
    });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    this.log('error', message, {
      ...meta,
      errorName: error?.name,
      errorMessage: error?.message,
      stack: error?.stack
    });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }
}

export const createLoggerContext = (requestId?: string): LoggerContext => {
  return new LoggerContext(requestId);
};
