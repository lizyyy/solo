import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { WorkRecord, AuditLog, BillingConfig } from '../types';
import { DATA_PATHS, DEFAULT_CONFIG } from '../config';

export class DataStore {
  private records: Map<string, WorkRecord> = new Map();
  private auditLogs: AuditLog[] = [];
  private config: BillingConfig = { ...DEFAULT_CONFIG };

  constructor() {
    this.ensureDataDirectory();
    this.loadData();
  }

  private ensureDataDirectory(): void {
    const dataDir = path.dirname(DATA_PATHS.records);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  private loadData(): void {
    try {
      if (fs.existsSync(DATA_PATHS.records)) {
        const data = fs.readFileSync(DATA_PATHS.records, 'utf-8');
        const records = JSON.parse(data) as WorkRecord[];
        records.forEach(r => {
          r.startTime = new Date(r.startTime);
          r.endTime = new Date(r.endTime);
          r.createdAt = new Date(r.createdAt);
          r.updatedAt = new Date(r.updatedAt);
          if (r.billedAt) r.billedAt = new Date(r.billedAt);
          if (r.reviewedAt) r.reviewedAt = new Date(r.reviewedAt);
          r.exceptions.forEach(e => {
            e.timestamp = new Date(e.timestamp);
          });
          this.records.set(r.id, r);
        });
      }
    } catch (error) {
      console.warn('Failed to load records, starting with empty store');
    }

    try {
      if (fs.existsSync(DATA_PATHS.auditLogs)) {
        const data = fs.readFileSync(DATA_PATHS.auditLogs, 'utf-8');
        this.auditLogs = JSON.parse(data).map((log: AuditLog) => ({
          ...log,
          timestamp: new Date(log.timestamp),
        }));
      }
    } catch (error) {
      console.warn('Failed to load audit logs, starting with empty logs');
    }

    try {
      if (fs.existsSync(DATA_PATHS.config)) {
        const data = fs.readFileSync(DATA_PATHS.config, 'utf-8');
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch (error) {
      console.warn('Failed to load config, using defaults');
    }
  }

  private saveData(): void {
    const recordsArray = Array.from(this.records.values());
    fs.writeFileSync(DATA_PATHS.records, JSON.stringify(recordsArray, null, 2), 'utf-8');
    fs.writeFileSync(DATA_PATHS.auditLogs, JSON.stringify(this.auditLogs, null, 2), 'utf-8');
    fs.writeFileSync(DATA_PATHS.config, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  getConfig(): BillingConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<BillingConfig>, operator: string): BillingConfig {
    this.config = { ...this.config, ...config };
    this.addAuditLog('update_config', operator, { config });
    this.saveData();
    return { ...this.config };
  }

  addRecord(record: Omit<WorkRecord, 'id' | 'createdAt' | 'updatedAt'>, operator: string): WorkRecord {
    const now = new Date();
    const newRecord: WorkRecord = {
      ...record,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(newRecord.id, newRecord);
    this.addAuditLog('create_record', operator, { recordId: newRecord.id, recordNo: newRecord.recordNo });
    this.saveData();
    return newRecord;
  }

  updateRecord(id: string, updates: Partial<WorkRecord>, operator: string): WorkRecord | null {
    const record = this.records.get(id);
    if (!record) return null;

    const updatedRecord: WorkRecord = {
      ...record,
      ...updates,
      updatedAt: new Date(),
      updatedBy: operator,
    };
    this.records.set(id, updatedRecord);
    this.addAuditLog('update_record', operator, { recordId: id, updates });
    this.saveData();
    return updatedRecord;
  }

  getRecordById(id: string): WorkRecord | undefined {
    return this.records.get(id);
  }

  getRecordByRecordNo(recordNo: string): WorkRecord | undefined {
    return Array.from(this.records.values()).find(r => r.recordNo === recordNo);
  }

  getAllRecords(): WorkRecord[] {
    return Array.from(this.records.values());
  }

  addAuditLog(action: string, operator: string, details: Record<string, any> = {}): AuditLog {
    const log: AuditLog = {
      id: uuidv4(),
      action,
      operator,
      timestamp: new Date(),
      details,
    };
    this.auditLogs.push(log);
    return log;
  }

  getAuditLogs(filter?: { recordId?: string; action?: string; operator?: string }): AuditLog[] {
    let logs = [...this.auditLogs];
    if (filter?.recordId) {
      logs = logs.filter(l => l.details.recordId === filter.recordId);
    }
    if (filter?.action) {
      logs = logs.filter(l => l.action === filter.action);
    }
    if (filter?.operator) {
      logs = logs.filter(l => l.operator === filter.operator);
    }
    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  recordExists(recordNo: string): boolean {
    return Array.from(this.records.values()).some(r => r.recordNo === recordNo);
  }
}

export const dataStore = new DataStore();
