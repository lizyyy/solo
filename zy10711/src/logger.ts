import * as winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

export class StableLogger {
  private logger: winston.Logger;
  private logFilePath: string;
  private overwrite: boolean;

  constructor(logFilePath: string, overwrite: boolean = true) {
    this.logFilePath = logFilePath;
    this.overwrite = overwrite;
    
    this.ensureLogDirectory();
    
    if (overwrite && fs.existsSync(logFilePath)) {
      fs.unlinkSync(logFilePath);
    }

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: logFilePath,
          options: { flags: overwrite ? 'w' : 'a' }
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  private ensureLogDirectory(): void {
    const dir = path.dirname(this.logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }
}
