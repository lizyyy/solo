import type { AuditLogEntry, AuditAction } from '../../shared/types';

export class AuditLogger {
  private static logs: AuditLogEntry[] = [];

  static log(
    entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
  ): AuditLogEntry {
    const fullEntry: AuditLogEntry = {
      ...entry,
      id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.logs.push(fullEntry);
    return fullEntry;
  }

  static getLogsByRecordId(recordId: string): AuditLogEntry[] {
    return this.logs
      .filter((l) => l.recordId === recordId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  static getAllLogs(): AuditLogEntry[] {
    return [...this.logs].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  static clear(): void {
    this.logs = [];
  }
}

export function createLogEntry(
  recordId: string,
  operator: string,
  action: AuditAction,
  remark: string,
  fieldName?: string,
  oldValue?: string,
  newValue?: string
): Omit<AuditLogEntry, 'id' | 'timestamp'> {
  return {
    recordId,
    operator,
    action,
    fieldName,
    oldValue,
    newValue,
    remark,
  };
}
