import { createLogger, format, transports, Logger } from 'winston';
import config from '../config';

const { combine, timestamp, printf, errors, json } = format;

interface LogContext {
  traceId?: string;
  messageId?: string;
  roomId?: string;
  userId?: string;
  [key: string]: unknown;
}

class AppLogger {
  private logger: Logger;
  private context: LogContext = {};

  constructor() {
    this.logger = createLogger({
      level: config.logging.level,
      format: combine(
        errors({ stack: true }),
        timestamp({ format: 'ISO8601' }),
        printf(({ level, message, timestamp: ts, stack, ...meta }) => {
          const logEntry: Record<string, unknown> = {
            level,
            message,
            timestamp: ts,
            ...this.context,
            ...meta,
          };
          if (stack) {
            logEntry.stack = stack;
          }
          return JSON.stringify(logEntry);
        })
      ),
      transports: [
        new transports.Console({
          handleExceptions: true,
        }),
      ],
      exitOnError: false,
    });
  }

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    if (error) {
      this.logger.error(message, { error: error.message, stack: error.stack, ...meta });
    } else {
      this.logger.error(message, meta);
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }

  child(context: LogContext): AppLogger {
    const childLogger = new AppLogger();
    childLogger.setContext({ ...this.context, ...context });
    return childLogger;
  }
}

export default new AppLogger();
