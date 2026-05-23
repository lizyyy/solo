import * as fs from 'fs';
import * as path from 'path';
import { LedgerRecord, SourceEvidence, ChangeLog, AuditLog } from '../models/types';

const DATA_DIR = path.join(process.cwd(), 'data', 'processed');

export class FileStore {
  private static instance: FileStore;
  private records: Map<string, LedgerRecord> = new Map();
  private evidences: Map<string, SourceEvidence> = new Map();
  private changeLogs: Map<string, ChangeLog> = new Map();
  private auditLogs: AuditLog[] = [];
  private factKeyIndex: Map<string, string> = new Map();

  private constructor() {
    this.ensureDir();
    this.loadAll();
  }

  static getInstance(): FileStore {
    if (!FileStore.instance) {
      FileStore.instance = new FileStore();
    }
    return FileStore.instance;
  }

  private ensureDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private getFilePath(name: string): string {
    return path.join(DATA_DIR, `${name}.json`);
  }

  private loadAll(): void {
    this.loadFromFile('records', this.records);
    this.loadFromFile('evidences', this.evidences);
    this.loadFromFile('changeLogs', this.changeLogs);
    this.loadAuditLogs();
    this.buildFactKeyIndex();
  }

  private loadFromFile<T>(name: string, map: Map<string, T>): void {
    const filePath = this.getFilePath(name);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        Object.entries(data).forEach(([key, value]) => {
          map.set(key, value as T);
        });
      } catch (e) {
        console.error(`Failed to load ${name}:`, e);
      }
    }
  }

  private loadAuditLogs(): void {
    const filePath = this.getFilePath('auditLogs');
    if (fs.existsSync(filePath)) {
      try {
        this.auditLogs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (e) {
        console.error('Failed to load auditLogs:', e);
        this.auditLogs = [];
      }
    }
  }

  private buildFactKeyIndex(): void {
    this.records.forEach((record, id) => {
      this.factKeyIndex.set(record.factKey, id);
    });
  }

  private saveToFile<T>(name: string, map: Map<string, T>): void {
    const data = Object.fromEntries(map.entries());
    fs.writeFileSync(this.getFilePath(name), JSON.stringify(data, null, 2));
  }

  private saveAuditLogs(): void {
    fs.writeFileSync(this.getFilePath('auditLogs'), JSON.stringify(this.auditLogs, null, 2));
  }

  saveAll(): void {
    this.saveToFile('records', this.records);
    this.saveToFile('evidences', this.evidences);
    this.saveToFile('changeLogs', this.changeLogs);
    this.saveAuditLogs();
  }

  findRecordByFactKey(factKey: string): LedgerRecord | undefined {
    const recordId = this.factKeyIndex.get(factKey);
    return recordId ? this.records.get(recordId) : undefined;
  }

  getRecord(id: string): LedgerRecord | undefined {
    return this.records.get(id);
  }

  getAllRecords(): LedgerRecord[] {
    return Array.from(this.records.values());
  }

  saveRecord(record: LedgerRecord): void {
    const existing = this.records.get(record.id);
    if (existing && existing.factKey !== record.factKey) {
      this.factKeyIndex.delete(existing.factKey);
    }
    this.records.set(record.id, record);
    this.factKeyIndex.set(record.factKey, record.id);
    this.saveToFile('records', this.records);
  }

  getEvidence(id: string): SourceEvidence | undefined {
    return this.evidences.get(id);
  }

  getEvidences(ids: string[]): SourceEvidence[] {
    return ids.map(id => this.evidences.get(id)).filter(Boolean) as SourceEvidence[];
  }

  saveEvidence(evidence: SourceEvidence): void {
    this.evidences.set(evidence.id, evidence);
    this.saveToFile('evidences', this.evidences);
  }

  findEvidenceByChecksum(checksum: string): SourceEvidence | undefined {
    for (const evidence of this.evidences.values()) {
      if (evidence.checksum === checksum) {
        return evidence;
      }
    }
    return undefined;
  }

  getChangeLogsForRecord(recordId: string): ChangeLog[] {
    return Array.from(this.changeLogs.values())
      .filter(log => log.recordId === recordId)
      .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
  }

  saveChangeLog(changeLog: ChangeLog): void {
    this.changeLogs.set(changeLog.id, changeLog);
    this.saveToFile('changeLogs', this.changeLogs);
  }

  addAuditLog(log: AuditLog): void {
    this.auditLogs.push(log);
    this.saveAuditLogs();
  }

  getAuditLogsForRecord(recordId: string): AuditLog[] {
    return this.auditLogs
      .filter(log => log.recordId === recordId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getAllAuditLogs(): AuditLog[] {
    return [...this.auditLogs].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
}

export const store = FileStore.getInstance();
