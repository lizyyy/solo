import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import * as fs from 'fs';
import * as path from 'path';
import {
  Fund,
  DividendAnnouncement,
  ClientAccount,
  DividendChoice,
  ShareRecord,
  NavRecord,
  SettlementRecord,
  CalculationResult,
  ProcessingTask,
  VersionInfo,
} from '../types/models';

type EntityType =
  | 'fund'
  | 'announcement'
  | 'account'
  | 'choice'
  | 'share'
  | 'nav'
  | 'settlement'
  | 'calculation'
  | 'task';

interface StorageConfig {
  dataDir: string;
  enableVersioning: boolean;
  maxVersions: number;
}

interface StoredData<T> {
  data: T[];
  versions: Record<string, VersionInfo<T>[]>;
  lastModified: string;
}

const defaultConfig: StorageConfig = {
  dataDir: './data',
  enableVersioning: true,
  maxVersions: 10,
};

export class LocalStorage {
  private config: StorageConfig;
  private caches: Map<EntityType, Map<string, any>> = new Map();
  private versionCaches: Map<EntityType, Map<string, any[]>> = new Map();

  constructor(config?: Partial<StorageConfig>) {
    this.config = { ...defaultConfig, ...config };
    this.ensureDataDir();
    this.initializeCaches();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.config.dataDir)) {
      fs.mkdirSync(this.config.dataDir, { recursive: true });
    }
  }

  private initializeCaches(): void {
    const types: EntityType[] = ['fund', 'announcement', 'account', 'choice', 'share', 'nav', 'settlement', 'calculation', 'task'];
    for (const type of types) {
      this.caches.set(type, new Map());
      this.versionCaches.set(type, new Map());
      this.loadFromDisk(type);
    }
  }

  private getFilePath(type: EntityType): string {
    return path.join(this.config.dataDir, `${type}.json`);
  }

  private loadFromDisk<T>(type: EntityType): void {
    const filePath = this.getFilePath(type);
    const cache = this.caches.get(type)!;
    const versionCache = this.versionCaches.get(type)!;

    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const stored: StoredData<T> = JSON.parse(content);
        
        for (const item of stored.data) {
          cache.set((item as any).id, item);
        }
        
        if (stored.versions) {
          for (const [id, versions] of Object.entries(stored.versions)) {
            versionCache.set(id, versions);
          }
        }
      } catch (e) {
        console.error(`Failed to load ${type} from disk:`, e);
      }
    }
  }

  private saveToDisk<T>(type: EntityType): void {
    const filePath = this.getFilePath(type);
    const cache = this.caches.get(type)!;
    const versionCache = this.versionCaches.get(type)!;

    const data = Array.from(cache.values());
    const versions: Record<string, VersionInfo<T>[]> = {};
    
    for (const [id, vers] of versionCache.entries()) {
      versions[id] = vers as VersionInfo<T>[];
    }

    const stored: StoredData<T> = {
      data,
      versions,
      lastModified: dayjs().toISOString(),
    };

    fs.writeFileSync(filePath, JSON.stringify(stored, null, 2), 'utf-8');
  }

  private saveVersion<T>(type: EntityType, entity: T & { id: string }, changeReason?: string): void {
    if (!this.config.enableVersioning) return;

    const versionCache = this.versionCaches.get(type)!;
    const entityId = entity.id;
    
    if (!versionCache.has(entityId)) {
      versionCache.set(entityId, []);
    }
    
    const versions = versionCache.get(entityId)!;
    const versionInfo: VersionInfo<T> = {
      id: uuidv4(),
      entityId,
      entityType: type,
      version: versions.length + 1,
      data: JSON.parse(JSON.stringify(entity)),
      changeReason,
      createdAt: dayjs().toISOString(),
    };
    
    versions.push(versionInfo);
    
    if (versions.length > this.config.maxVersions) {
      versions.shift();
    }
  }

  public save<T extends { id: string }>(
    type: EntityType,
    entity: T,
    changeReason?: string
  ): T {
    const cache = this.caches.get(type)!;
    const existing = cache.get(entity.id);
    
    if (existing) {
      this.saveVersion(type, existing, changeReason);
    }
    
    cache.set(entity.id, entity);
    this.saveToDisk(type);
    
    return entity;
  }

  public saveBatch<T extends { id: string }>(
    type: EntityType,
    entities: T[],
    changeReason?: string
  ): T[] {
    const cache = this.caches.get(type)!;
    
    for (const entity of entities) {
      const existing = cache.get(entity.id);
      if (existing) {
        this.saveVersion(type, existing, changeReason);
      }
      cache.set(entity.id, entity);
    }
    
    this.saveToDisk(type);
    return entities;
  }

  public getById<T>(type: EntityType, id: string): T | null {
    const cache = this.caches.get(type)!;
    return (cache.get(id) as T) || null;
  }

  public getAll<T>(type: EntityType): T[] {
    const cache = this.caches.get(type)!;
    return Array.from(cache.values()) as T[];
  }

  public find<T>(type: EntityType, predicate: (item: T) => boolean): T[] {
    const cache = this.caches.get(type)!;
    return Array.from(cache.values()).filter(predicate as any) as T[];
  }

  public findOne<T>(type: EntityType, predicate: (item: T) => boolean): T | null {
    const cache = this.caches.get(type)!;
    for (const item of cache.values()) {
      if (predicate(item as T)) {
        return item as T;
      }
    }
    return null;
  }

  public getVersions<T>(type: EntityType, entityId: string): VersionInfo<T>[] {
    const versionCache = this.versionCaches.get(type)!;
    return (versionCache.get(entityId) as VersionInfo<T>[]) || [];
  }

  public getVersion<T>(
    type: EntityType,
    entityId: string,
    version: number
  ): VersionInfo<T> | null {
    const versions = this.getVersions<T>(type, entityId);
    return versions.find(v => v.version === version) || null;
  }

  public restoreVersion<T extends { id: string }>(
    type: EntityType,
    entityId: string,
    version: number
  ): T | null {
    const versionInfo = this.getVersion<T>(type, entityId, version);
    if (!versionInfo) return null;

    const restored = { ...versionInfo.data };
    return this.save(type, restored, `回滚到版本 ${version}`);
  }

  public delete(type: EntityType, id: string): boolean {
    const cache = this.caches.get(type)!;
    const existed = cache.has(id);
    if (existed) {
      cache.delete(id);
      this.saveToDisk(type);
    }
    return existed;
  }

  public clear(type?: EntityType): void {
    if (type) {
      this.caches.get(type)!.clear();
      this.versionCaches.get(type)!.clear();
      this.saveToDisk(type);
    } else {
      for (const t of this.caches.keys()) {
        this.caches.get(t)!.clear();
        this.versionCaches.get(t)!.clear();
        this.saveToDisk(t);
      }
    }
  }

  public count(type: EntityType): number {
    return this.caches.get(type)!.size;
  }

  public saveFund(fund: Fund, reason?: string): Fund {
    return this.save('fund', fund, reason);
  }

  public getFund(id: string): Fund | null {
    return this.getById('fund', id);
  }

  public getAllFunds(): Fund[] {
    return this.getAll('fund');
  }

  public saveAnnouncement(announcement: DividendAnnouncement, reason?: string): DividendAnnouncement {
    return this.save('announcement', announcement, reason);
  }

  public getAnnouncement(id: string): DividendAnnouncement | null {
    return this.getById('announcement', id);
  }

  public getAnnouncementsByFund(fundId: string): DividendAnnouncement[] {
    return this.find('announcement', (a: DividendAnnouncement) => a.fundId === fundId);
  }

  public saveAccount(account: ClientAccount, reason?: string): ClientAccount {
    return this.save('account', account, reason);
  }

  public getAccount(id: string): ClientAccount | null {
    return this.getById('account', id);
  }

  public saveChoice(choice: DividendChoice, reason?: string): DividendChoice {
    return this.save('choice', choice, reason);
  }

  public getChoicesByAccount(accountId: string): DividendChoice[] {
    return this.find('choice', (c: DividendChoice) => c.accountId === accountId);
  }

  public saveShareRecord(record: ShareRecord, reason?: string): ShareRecord {
    return this.save('share', record, reason);
  }

  public getShareRecordsByAccount(accountId: string): ShareRecord[] {
    return this.find('share', (s: ShareRecord) => s.accountId === accountId);
  }

  public saveNavRecord(record: NavRecord): NavRecord {
    return this.save('nav', record);
  }

  public saveSettlement(record: SettlementRecord): SettlementRecord {
    return this.save('settlement', record);
  }

  public saveCalculationResult(result: CalculationResult, reason?: string): CalculationResult {
    return this.save('calculation', result, reason);
  }

  public getCalculationResultsByTask(taskId: string): CalculationResult[] {
    return this.find('calculation', (r: CalculationResult) => (r as any).taskId === taskId);
  }

  public saveTask(task: ProcessingTask, reason?: string): ProcessingTask {
    return this.save('task', task, reason);
  }

  public getTask(id: string): ProcessingTask | null {
    return this.getById('task', id);
  }

  public getAllTasks(): ProcessingTask[] {
    return this.getAll('task');
  }

  public exportAll(): Record<string, any[]> {
    const result: Record<string, any[]> = {};
    for (const type of this.caches.keys()) {
      result[type] = this.getAll(type);
    }
    return result;
  }

  public importAll(data: Record<string, any[]>): void {
    for (const [type, items] of Object.entries(data)) {
      this.saveBatch(type as EntityType, items as any[], '批量导入');
    }
  }
}
