type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  replacementId?: string;
  step?: string;
  message: string;
  details?: Record<string, unknown>;
}

class EventLogger {
  private logs: LogEntry[] = [];
  private consoleLogging: boolean = true;

  setConsoleLogging(enabled: boolean): void {
    this.consoleLogging = enabled;
  }

  debug(message: string, details?: Record<string, unknown>, replacementId?: string, step?: string): void {
    this.log('DEBUG', message, details, replacementId, step);
  }

  info(message: string, details?: Record<string, unknown>, replacementId?: string, step?: string): void {
    this.log('INFO', message, details, replacementId, step);
  }

  warn(message: string, details?: Record<string, unknown>, replacementId?: string, step?: string): void {
    this.log('WARN', message, details, replacementId, step);
  }

  error(message: string, details?: Record<string, unknown>, replacementId?: string, step?: string): void {
    this.log('ERROR', message, details, replacementId, step);
  }

  private log(
    level: LogLevel,
    message: string,
    details?: Record<string, unknown>,
    replacementId?: string,
    step?: string
  ): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      ...(replacementId && { replacementId }),
      ...(step && { step }),
      ...(details && { details })
    };
    this.logs.push(entry);
    if (this.consoleLogging) {
      console.log(this.formatEntry(entry));
    }
  }

  private formatEntry(entry: LogEntry): string {
    const time = new Date(entry.timestamp).toISOString();
    const parts = [
      `[${time}]`,
      `[${entry.level}]`,
      entry.replacementId ? `[${entry.replacementId}]` : '',
      entry.step ? `[${entry.step}]` : '',
      entry.message
    ].filter(Boolean);
    return parts.join(' ');
  }

  getLogs(replacementId?: string): LogEntry[] {
    if (!replacementId) {
      return [...this.logs];
    }
    return this.logs.filter((l) => l.replacementId === replacementId);
  }

  clear(): void {
    this.logs = [];
  }
}

const globalLogger = new EventLogger();

export const getLogger = (): EventLogger => {
  return globalLogger;
};
