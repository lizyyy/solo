import * as winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { PoolError, EventRecord } from '../types';

const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  const metaStr = Object.keys(metadata).length > 0 
    ? JSON.stringify(metadata, null, 0) 
    : '';
  return `${timestamp} [${level}] ${message} ${metaStr}`;
});

export interface LoggerContext {
  poolName?: string;
  connectionId?: string;
  requestId?: string;
  traceId?: string;
  [key: string]: unknown;
}

export class PoolLogger {
  private logger: winston.Logger;
  private context: LoggerContext = {};
  private static instance: PoolLogger | null = null;

  private constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'connection-pool-monitor' },
      transports: [
        new winston.transports.File({ 
          filename: './logs/error.log', 
          level: 'error',
          maxsize: 10485760,
          maxFiles: 5
        }),
        new winston.transports.File({ 
          filename: './logs/combined.log',
          maxsize: 10485760,
          maxFiles: 10
        })
      ]
    });

    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          customFormat
        )
      }));
    }
  }

  static getInstance(): PoolLogger {
    if (!PoolLogger.instance) {
      PoolLogger.instance = new PoolLogger();
    }
    return PoolLogger.instance;
  }

  createChild(context: LoggerContext): PoolLogger {
    const child = Object.create(PoolLogger.prototype) as PoolLogger;
    child.logger = this.logger;
    child.context = { ...this.context, ...context };
    return child;
  }

  info(message: string, context: LoggerContext = {}): void {
    this.logger.info(message, { ...this.context, ...context });
  }

  warn(message: string, context: LoggerContext = {}): void {
    this.logger.warn(message, { ...this.context, ...context });
  }

  error(message: string, error?: Error | PoolError, context: LoggerContext = {}): void {
    const errorContext = error ? {
      error: {
        message: error.message,
        stack: (error as Error).stack,
        code: (error as PoolError).code,
        connectionId: (error as PoolError).connectionId,
        requestId: (error as PoolError).requestId
      }
    } : {};
    
    this.logger.error(message, { 
      ...this.context, 
      ...context, 
      ...errorContext 
    });
  }

  debug(message: string, context: LoggerContext = {}): void {
    this.logger.debug(message, { ...this.context, ...context });
  }

  recordEvent(event: EventRecord): void {
    const level = event.level === 'debug' ? 'info' : event.level;
    this.logger.log(level, event.message, {
      eventId: event.id,
      eventType: event.type,
      timestamp: event.timestamp,
      connectionId: event.connectionId,
      requestId: event.requestId,
      duration: event.duration,
      metadata: event.metadata
    });
  }

  logOperation(
    operation: string,
    startTime: number,
    result: 'success' | 'failure',
    context: LoggerContext = {}
  ): void {
    const duration = Date.now() - startTime;
    const message = result === 'success' 
      ? `Operation ${operation} completed successfully` 
      : `Operation ${operation} failed`;
    
    this.info(message, {
      operation,
      duration,
      result,
      ...context
    });
  }

  static generateTraceId(): string {
    return uuidv4();
  }

  static generateRequestId(): string {
    return `req_${uuidv4().substring(0, 8)}`;
  }
}

export const logger = PoolLogger.getInstance();
