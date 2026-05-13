import { v4 as uuidv4 } from 'uuid';
import { AuditRecord } from '../types';

class AuditService {
  private records: AuditRecord[] = [];
  private maxRecords: number = 1000;

  createRecord(
    action: string, shardId: string, operation: string, details: Record<string, any>, source: string = 'routing-engine'): AuditRecord {
    const record: AuditRecord = {
      recordId: uuidv4(),
      timestamp: new Date().toISOString(),
      action,
      shardId,
      operation,
      details,
      source,
    };
    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }
    return record;
  }

  getRecentRecords(limit: number = 100): AuditRecord[] {
    return this.records.slice(-limit);
  }
}

export const auditService = new AuditService();
