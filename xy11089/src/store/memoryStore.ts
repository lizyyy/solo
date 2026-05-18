import { v4 as uuidv4 } from 'uuid';
import { AuditRecord, AuditStatus, WindWarningLevel } from '../types';

class MemoryStore {
  private records: Map<string, AuditRecord> = new Map();
  private static instance: MemoryStore;

  private constructor() {}

  static getInstance(): MemoryStore {
    if (!MemoryStore.instance) {
      MemoryStore.instance = new MemoryStore();
    }
    return MemoryStore.instance;
  }

  generateApplicationNo(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const sequence = String(this.records.size + 1).padStart(4, '0');
    return `HW-${dateStr}-${sequence}`;
  }

  create(record: Omit<AuditRecord, 'id' | 'applicationNo' | 'version' | 'operationHistories' | 'hasWindWarningViolation' | 'createdAt' | 'updatedAt'>): AuditRecord {
    const now = new Date().toISOString();
    const id = uuidv4();
    const newRecord: AuditRecord = {
      ...record,
      id,
      applicationNo: this.generateApplicationNo(),
      version: 1,
      hasWindWarningViolation: false,
      operationHistories: [],
      createdAt: now,
      updatedAt: now
    };
    this.records.set(id, newRecord);
    return newRecord;
  }

  findById(id: string): AuditRecord | undefined {
    return this.records.get(id);
  }

  findAll(): AuditRecord[] {
    return Array.from(this.records.values());
  }

  findByStatus(status: AuditStatus): AuditRecord[] {
    return this.findAll().filter(r => r.status === status);
  }

  findByApplicationNo(applicationNo: string): AuditRecord | undefined {
    return this.findAll().find(r => r.applicationNo === applicationNo);
  }

  update(id: string, updates: Partial<AuditRecord>): AuditRecord | null {
    const record = this.records.get(id);
    if (!record) return null;

    const updatedRecord: AuditRecord = {
      ...record,
      ...updates,
      version: record.version + 1,
      updatedAt: new Date().toISOString()
    };
    this.records.set(id, updatedRecord);
    return updatedRecord;
  }

  delete(id: string): boolean {
    return this.records.delete(id);
  }

  findWindWarningViolations(): AuditRecord[] {
    return this.findAll().filter(r => r.hasWindWarningViolation);
  }

  clear(): void {
    this.records.clear();
  }

  count(): number {
    return this.records.size;
  }

  bulkInsert(records: Omit<AuditRecord, 'id' | 'applicationNo' | 'version' | 'operationHistories' | 'hasWindWarningViolation' | 'createdAt' | 'updatedAt'>[]): AuditRecord[] {
    return records.map(r => this.create(r));
  }
}

export const store = MemoryStore.getInstance();
