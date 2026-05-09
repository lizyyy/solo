import { v4 as uuidv4 } from 'uuid';
import { LogEntry, TransactionContext, ErrorInfo, SystemInfo } from '../types';
import { isLockError } from '../config/default';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  logFilePath?: string;
  maxEntries: number;
  maxFileSize: number;
}

export class Logger {
  private readonly config: LoggerConfig;
  private readonly logs: LogEntry[] = [];
  private readonly errorLogs: LogEntry[] = [];
  private readonly logListeners = new Set<(entry: LogEntry) => void>();

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level || 'INFO',
      enableConsole: config.enableConsole !== false,
      enableFile: config.enableFile || false,
      logFilePath: config.logFilePath,
      maxEntries: config.maxEntries || 10000,
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024,
    };
  }

  addListener(listener: (entry: LogEntry) => void): void {
    this.logListeners.add(listener);
  }

  removeListener(listener: (entry: LogEntry) => void): void {
    this.logListeners.delete(listener);
  }

  logOperationStart(entry: LogEntry): void {
    entry.status = 'PENDING';
    this.addLog(entry);

    if (this.shouldLog('DEBUG')) {
      this.consoleLog('DEBUG', `[${entry.operationType}] ${entry.sql?.substring(0, 100)}...`);
    }
  }

  logOperationEnd(entry: LogEntry): void {
    this.addLog(entry);

    if (entry.status === 'FAILED') {
      this.errorLogs.push(entry);
      if (entry.error?.isLockError) {
        this.consoleLog('WARN', `Lock error detected: ${entry.error.message}`);
      } else {
        this.consoleLog('ERROR', `Operation failed: ${entry.error?.message}`);
      }
    } else if (this.shouldLog('INFO')) {
      this.consoleLog('INFO', `[${entry.operationType}] completed in ${entry.duration}ms`);
    }

    this.notifyListeners(entry);
  }

  logRetry(entry: LogEntry, retryCount: number, error: unknown): void {
    const retryEntry: LogEntry = {
      ...entry,
      id: uuidv4(),
      timestamp: Date.now(),
      status: 'RETRY',
      retryCount,
      error: this.serializeError(error),
    };

    this.addLog(retryEntry);
    this.consoleLog('WARN', `Retry attempt ${retryCount}: ${retryEntry.error?.message}`);
    this.notifyListeners(retryEntry);
  }

  logTransactionStart(entry: LogEntry, context: TransactionContext): void {
    entry.status = 'PENDING';
    this.addLog(entry);
    this.consoleLog('INFO', `Transaction started: ${context.id}`);
  }

  logTransactionEnd(entry: LogEntry, context: TransactionContext): void {
    entry.status = context.state === 'COMMITTED' ? 'SUCCESS' : 'FAILED';
    this.addLog(entry);

    if (context.state === 'COMMITTED') {
      this.consoleLog('INFO', `Transaction committed: ${context.id} (${context.operations.length} ops)`);
    } else {
      this.errorLogs.push(entry);
      this.consoleLog('ERROR', `Transaction rolled back: ${context.id}, ${entry.error?.message}`);
    }

    this.notifyListeners(entry);
  }

  logError(error: unknown, context?: Record<string, unknown>): ErrorInfo {
    const errorInfo = this.serializeError(error);
    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      operationId: uuidv4(),
      transactionId: null,
      connectionId: 'system',
      operationType: 'READ',
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0,
      status: 'FAILED',
      error: errorInfo,
      lockState: {
        connectionId: 'system',
        lockType: 'NONE',
        walFileSize: 0,
        checkpointProgress: 1,
        pendingWrites: 0,
        activeReaders: 0,
      },
      retryCount: 0,
      metadata: context,
    };

    this.errorLogs.push(entry);
    this.consoleLog('ERROR', `${errorInfo.message}`, context);
    this.notifyListeners(entry);

    return errorInfo;
  }

  getSystemInfo(): SystemInfo {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }

  getErrorLogs(): LogEntry[] {
    return [...this.errorLogs];
  }

  getLogsByOperationId(operationId: string): LogEntry[] {
    return this.logs.filter((l) => l.operationId === operationId);
  }

  getLogsByTransactionId(transactionId: string): LogEntry[] {
    return this.logs.filter((l) => l.transactionId === transactionId);
  }

  getLogsByConnectionId(connectionId: string): LogEntry[] {
    return this.logs.filter((l) => l.connectionId === connectionId);
  }

  getLockErrors(): LogEntry[] {
    return this.errorLogs.filter((l) => l.error?.isLockError);
  }

  getStatistics(): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    lockErrors: number;
    retries: number;
    avgLatencyMs: number;
    activeTransactions: number;
  } {
    const total = this.logs.filter((l) => l.status !== 'PENDING');
    const successful = total.filter((l) => l.status === 'SUCCESS');
    const failed = total.filter((l) => l.status === 'FAILED');
    const retries = total.filter((l) => l.status === 'RETRY');
    const lockErrors = this.getLockErrors();

    const avgLatency = successful.length > 0
      ? successful.reduce((sum, l) => sum + (l.duration || 0), 0) / successful.length
      : 0;

    return {
      totalOperations: total.length,
      successfulOperations: successful.length,
      failedOperations: failed.length,
      lockErrors: lockErrors.length,
      retries: retries.length,
      avgLatencyMs: avgLatency,
      activeTransactions: 0,
    };
  }

  clearLogs(): void {
    this.logs.length = 0;
    this.errorLogs.length = 0;
  }

  exportLogs(): string {
    return JSON.stringify({
      systemInfo: this.getSystemInfo(),
      logs: this.getAllLogs(),
      errors: this.getErrorLogs(),
      statistics: this.getStatistics(),
    }, null, 2);
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry);

    if (this.logs.length > this.config.maxEntries) {
      const removeCount = Math.floor(this.config.maxEntries * 0.1);
      this.logs.splice(0, removeCount);
    }
  }

  private notifyListeners(entry: LogEntry): void {
    this.logListeners.forEach((listener) => {
      try {
        listener(entry);
      } catch {
        // ignore listener errors
      }
    });
  }

  private serializeError(error: unknown): ErrorInfo {
    const err = error as { message?: string; code?: string; stack?: string };
    return {
      message: err.message || String(error),
      code: err.code || 'UNKNOWN',
      stack: err.stack,
      isLockError: isLockError(error),
    };
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    return levels.indexOf(level) >= levels.indexOf(this.config.level);
  }

  private consoleLog(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
    if (!this.config.enableConsole || !this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;

    switch (level) {
      case 'ERROR':
        console.error(prefix, message, extra || '');
        break;
      case 'WARN':
        console.warn(prefix, message, extra || '');
        break;
      case 'INFO':
        console.info(prefix, message, extra || '');
        break;
      case 'DEBUG':
        console.log(prefix, message, extra || '');
        break;
    }
  }
}
