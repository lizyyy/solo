import * as fs from 'fs';
import * as path from 'path';
import { maskObject } from './mask';

const LOG_DIR = path.join(process.cwd(), 'logs');

type LogLevel = 'info' | 'warn' | 'error' | 'audit';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
}

export class Logger {
  private static instance: Logger;
  private logFilePath: string;

  private constructor() {
    this.logFilePath = path.join(LOG_DIR, 'app.log');
    this.ensureLogDirExists();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private ensureLogDirExists(): void {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  }

  private write(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const maskedData = data ? maskObject(data) : undefined;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: maskedData
    };

    const logLine = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.logFilePath, logLine, 'utf8');
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.write('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.write('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.write('error', message, data);
  }

  audit(message: string, data?: Record<string, unknown>): void {
    this.write('audit', message, data);
  }

  readLogs(limit: number = 100): LogEntry[] {
    try {
      const content = fs.readFileSync(this.logFilePath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines
        .slice(-limit)
        .map(line => JSON.parse(line))
        .reverse();
    } catch (error) {
      return [];
    }
  }
}

export const logger = Logger.getInstance();
