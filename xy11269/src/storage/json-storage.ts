import * as fs from 'fs';
import * as path from 'path';
import { DataMasker } from '../utils/data-masker';

interface StorageOptions<T> {
  filePath: string;
  backupEnabled?: boolean;
  backupInterval?: number;
}

export class JsonStorage<T extends { id: string }> {
  private filePath: string;
  private data: Map<string, T> = new Map();
  private backupEnabled: boolean;
  private backupInterval: number;
  private lastBackupTime: number = 0;

  constructor(options: StorageOptions<T>) {
    this.filePath = options.filePath;
    this.backupEnabled = options.backupEnabled ?? true;
    this.backupInterval = options.backupInterval ?? 300000;
    this.ensureDirectory();
    this.loadFromDisk();
  }

  private ensureDirectory() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        const items = JSON.parse(content) as T[];
        items.forEach(item => this.data.set(item.id, item));
        console.log(`[Storage] Loaded ${this.data.size} records from ${path.basename(this.filePath)}`);
      }
    } catch (error) {
      console.error(`[Storage] Failed to load from ${this.filePath}:`, (error as Error).message);
      this.tryLoadBackup();
    }
  }

  private tryLoadBackup() {
    const backupPath = `${this.filePath}.bak`;
    try {
      if (fs.existsSync(backupPath)) {
        const content = fs.readFileSync(backupPath, 'utf-8');
        const items = JSON.parse(content) as T[];
        items.forEach(item => this.data.set(item.id, item));
        console.log(`[Storage] Recovered ${this.data.size} records from backup`);
      }
    } catch (backupError) {
      console.error(`[Storage] Backup load failed:`, (backupError as Error).message);
    }
  }

  private saveToDisk() {
    try {
      const items = Array.from(this.data.values());
      const content = JSON.stringify(items, null, 2);
      
      if (this.backupEnabled && fs.existsSync(this.filePath)) {
        const now = Date.now();
        if (now - this.lastBackupTime > this.backupInterval) {
          fs.copyFileSync(this.filePath, `${this.filePath}.bak`);
          this.lastBackupTime = now;
        }
      }

      fs.writeFileSync(this.filePath, content, 'utf-8');
    } catch (error) {
      console.error(`[Storage] Failed to save to ${this.filePath}:`, (error as Error).message);
      throw error;
    }
  }

  getAll(): T[] {
    return Array.from(this.data.values());
  }

  getById(id: string): T | undefined {
    return this.data.get(id);
  }

  find(predicate: (item: T) => boolean): T[] {
    return Array.from(this.data.values()).filter(predicate);
  }

  findOne(predicate: (item: T) => boolean): T | undefined {
    return Array.from(this.data.values()).find(predicate);
  }

  create(item: T): T {
    if (this.data.has(item.id)) {
      throw new Error(`Item with id ${item.id} already exists`);
    }
    this.data.set(item.id, item);
    this.saveToDisk();
    this.logOperation('CREATE', item);
    return item;
  }

  createMany(items: T[]): T[] {
    const created: T[] = [];
    for (const item of items) {
      if (!this.data.has(item.id)) {
        this.data.set(item.id, item);
        created.push(item);
      }
    }
    this.saveToDisk();
    this.logOperation('CREATE_BATCH', { count: created.length });
    return created;
  }

  update(id: string, updates: Partial<T>): T | undefined {
    const item = this.data.get(id);
    if (!item) return undefined;
    
    const updated = { ...item, ...updates } as T;
    this.data.set(id, updated);
    this.saveToDisk();
    this.logOperation('UPDATE', updated);
    return updated;
  }

  delete(id: string): boolean {
    const existed = this.data.has(id);
    if (existed) {
      this.data.delete(id);
      this.saveToDisk();
      this.logOperation('DELETE', { id });
    }
    return existed;
  }

  clear(): void {
    this.data.clear();
    this.saveToDisk();
    this.logOperation('CLEAR', {});
  }

  count(): number {
    return this.data.size;
  }

  exists(id: string): boolean {
    return this.data.has(id);
  }

  private logOperation(operation: string, data: any) {
    const logPath = path.join(path.dirname(path.dirname(this.filePath)), 'logs', 'storage.log');
    const logDir = path.dirname(logPath);
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const timestamp = new Date().toISOString();
    const maskedData = DataMasker.forLog(data);
    const logEntry = `[${timestamp}] ${operation} - ${maskedData}\n`;
    
    fs.appendFileSync(logPath, logEntry);
  }
}
