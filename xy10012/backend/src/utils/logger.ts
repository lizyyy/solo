import winston from 'winston';
import { env } from '../config/env';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const context = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `${timestamp} ${level}: ${stack || message} ${context}`;
});

export const logger = winston.createLogger({
  level: env.logLevel,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    colorize(),
    logFormat
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

export class RequestContext {
  requestId: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;

  constructor(opts: { requestId: string; userId?: string; ipAddress?: string; userAgent?: string }) {
    this.requestId = opts.requestId;
    this.userId = opts.userId;
    this.ipAddress = opts.ipAddress;
    this.userAgent = opts.userAgent;
  }

  toJSON() {
    return {
      requestId: this.requestId,
      userId: this.userId,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
    };
  }
}