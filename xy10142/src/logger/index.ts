import type { ExecutionLogEntry } from '../types/index.js';

export class ExecutionLogger {
  private logs: ExecutionLogEntry[] = [];
  private maxLogs: number = 1000;

  constructor(maxLogs: number = 1000) {
    this.maxLogs = maxLogs;
  }

  log(
    action: string,
    success: boolean,
    message: string,
    details?: unknown
  ): ExecutionLogEntry {
    const entry: ExecutionLogEntry = {
      timestamp: Date.now(),
      action,
      success,
      message,
      details,
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    return entry;
  }

  success(action: string, message: string, details?: unknown): ExecutionLogEntry {
    return this.log(action, true, message, details);
  }

  error(action: string, message: string, details?: unknown): ExecutionLogEntry {
    return this.log(action, false, message, details);
  }

  getLogs(): ExecutionLogEntry[] {
    return [...this.logs];
  }

  getErrors(): ExecutionLogEntry[] {
    return this.logs.filter(log => !log.success);
  }

  getSuccesses(): ExecutionLogEntry[] {
    return this.logs.filter(log => log.success);
  }

  getByAction(action: string): ExecutionLogEntry[] {
    return this.logs.filter(log => log.action === action);
  }

  getRecent(count: number = 50): ExecutionLogEntry[] {
    return this.logs.slice(-count);
  }

  clear(): void {
    this.logs = [];
  }

  getStats(): {
    total: number;
    success: number;
    error: number;
    successRate: number;
  } {
    const total = this.logs.length;
    const success = this.logs.filter(l => l.success).length;
    const error = total - success;
    const successRate = total > 0 ? (success / total) * 100 : 0;

    return { total, success, error, successRate };
  }

  export(format: 'json' | 'csv'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }

    const headers = ['timestamp', 'action', 'success', 'message', 'details'];
    const csvLines = [headers.join(',')];

    for (const log of this.logs) {
      const line = [
        log.timestamp,
        `"${log.action.replace(/"/g, '""')}"`,
        log.success,
        `"${log.message.replace(/"/g, '""')}"`,
        log.details ? `"${JSON.stringify(log.details).replace(/"/g, '""')}"` : ''
      ].join(',');
      csvLines.push(line);
    }

    return csvLines.join('\n');
  }
}
