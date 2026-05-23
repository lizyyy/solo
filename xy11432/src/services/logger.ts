import db from '../database';
import { generateId, now, safeJsonStringify } from '../utils';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export const logSystem = (
  level: LogLevel,
  message: string,
  details?: any,
  stackTrace?: string,
  correlationId?: string
): void => {
  const stmt = db.prepare(`
    INSERT INTO system_logs (id, log_level, message, details, stack_trace, created_at, correlation_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    generateId(),
    level,
    message,
    details ? safeJsonStringify(details) : null,
    stackTrace,
    now(),
    correlationId
  );
};

export const logError = (
  message: string,
  error?: Error,
  details?: any,
  correlationId?: string
): void => {
  logSystem(
    'error',
    message,
    details,
    error?.stack,
    correlationId
  );
};

export const logInfo = (message: string, details?: any, correlationId?: string): void => {
  logSystem('info', message, details, correlationId);
};

export const logWarn = (message: string, details?: any, correlationId?: string): void => {
  logSystem('warn', message, details, correlationId);
};

export const getRecentErrors = (limit: number = 100): any[] => {
  const stmt = db.prepare(`
    SELECT * FROM system_logs 
    WHERE log_level IN ('error', 'fatal')
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  return stmt.all(limit);
};
