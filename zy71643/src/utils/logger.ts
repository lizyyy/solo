import type { OperationLog } from '../types';

const LOG_STORAGE_KEY = 'pipeline_inspection_logs';
const MAX_LOGS = 1000;

class Logger {
  private logs: OperationLog[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(LOG_STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load logs from storage:', e);
      this.logs = [];
    }
  }

  private saveToStorage(): void {
    try {
      if (this.logs.length > MAX_LOGS) {
        this.logs = this.logs.slice(-MAX_LOGS);
      }
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.logs));
    } catch (e) {
      console.error('Failed to save logs to storage:', e);
    }
  }

  private addLog(
    level: OperationLog['level'],
    module: OperationLog['module'],
    message: string,
    details?: any
  ): void {
    const log: OperationLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      details,
    };
    this.logs.push(log);
    this.saveToStorage();
    console[level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log'](
      `[${module}] ${message}`,
      details || ''
    );
  }

  info(module: OperationLog['module'], message: string, details?: any): void {
    this.addLog('info', module, message, details);
  }

  warning(module: OperationLog['module'], message: string, details?: any): void {
    this.addLog('warning', module, message, details);
  }

  error(module: OperationLog['module'], message: string, details?: any): void {
    this.addLog('error', module, message, details);
  }

  getAll(): OperationLog[] {
    return [...this.logs].reverse();
  }

  getByModule(module: OperationLog['module']): OperationLog[] {
    return this.logs.filter((log) => log.module === module).reverse();
  }

  getByLevel(level: OperationLog['level']): OperationLog[] {
    return this.logs.filter((log) => log.level === level).reverse();
  }

  getErrors(): OperationLog[] {
    return this.getByLevel('error');
  }

  clear(): void {
    this.logs = [];
    localStorage.removeItem(LOG_STORAGE_KEY);
  }
}

export const logger = new Logger();
