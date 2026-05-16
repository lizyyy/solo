import * as fs from 'fs';
import * as path from 'path';
import { QuotaConfig, UsageRecord, RejectEvent, AuditLog } from './types';

interface DataStore {
  quotaConfigs: QuotaConfig[];
  usageRecords: UsageRecord[];
  rejectEvents: RejectEvent[];
  auditLogs: AuditLog[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'quota-data.json');

export class Storage {
  private static instance: Storage;
  private data: DataStore;

  private constructor() {
    this.ensureDataDir();
    this.data = this.loadData();
  }

  public static getInstance(): Storage {
    if (!Storage.instance) {
      Storage.instance = new Storage();
    }
    return Storage.instance;
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadData(): DataStore {
    if (fs.existsSync(DATA_FILE)) {
      try {
        const content = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.error('Failed to load data, initializing empty store:', error);
      }
    }
    return {
      quotaConfigs: [],
      usageRecords: [],
      rejectEvents: [],
      auditLogs: []
    };
  }

  private saveData(): void {
    fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  public getQuotaConfigs(): QuotaConfig[] {
    return [...this.data.quotaConfigs];
  }

  public getQuotaConfig(id: string): QuotaConfig | undefined {
    return this.data.quotaConfigs.find(q => q.id === id);
  }

  public findQuotaConfig(teamName: string, modelName: string, usageTag: string): QuotaConfig | undefined {
    return this.data.quotaConfigs.find(q =>
      q.teamName === teamName &&
      q.modelName === modelName &&
      q.usageTag === usageTag
    );
  }

  public addQuotaConfig(config: QuotaConfig): void {
    this.data.quotaConfigs.push(config);
    this.saveData();
  }

  public updateQuotaConfig(id: string, updates: Partial<QuotaConfig>): QuotaConfig | undefined {
    const index = this.data.quotaConfigs.findIndex(q => q.id === id);
    if (index === -1) return undefined;
    
    this.data.quotaConfigs[index] = {
      ...this.data.quotaConfigs[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.saveData();
    return this.data.quotaConfigs[index];
  }

  public addUsageRecord(record: UsageRecord): void {
    this.data.usageRecords.push(record);
    this.saveData();
  }

  public getUsageRecords(quotaId?: string): UsageRecord[] {
    if (quotaId) {
      return this.data.usageRecords.filter(r => r.quotaId === quotaId);
    }
    return [...this.data.usageRecords];
  }

  public addRejectEvent(event: RejectEvent): void {
    this.data.rejectEvents.push(event);
    this.saveData();
  }

  public getRejectEvents(quotaId?: string): RejectEvent[] {
    if (quotaId) {
      return this.data.rejectEvents.filter(e => e.quotaId === quotaId);
    }
    return [...this.data.rejectEvents];
  }

  public addAuditLog(log: AuditLog): void {
    this.data.auditLogs.push(log);
    this.saveData();
  }

  public getAuditLogs(quotaId?: string): AuditLog[] {
    if (quotaId) {
      return this.data.auditLogs.filter(l => l.quotaId === quotaId);
    }
    return [...this.data.auditLogs];
  }

  public getAllData(): DataStore {
    return { ...this.data };
  }
}
