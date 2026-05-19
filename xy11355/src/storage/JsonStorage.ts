import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface StorageRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export class JsonStorage<T extends StorageRecord> {
  private filePath: string;
  private idempotencyKeys: Map<string, string> = new Map();

  constructor(private dataDir: string, private collectionName: string) {
    this.filePath = path.join(dataDir, `${collectionName}.json`);
    this.ensureFileExists();
    this.loadIdempotencyKeys();
  }

  private ensureFileExists(): void {
    if (!fs.existsSync(this.filePath)) {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf8');
    }
  }

  private loadIdempotencyKeys(): void {
    const records = this.readAll();
    records.forEach(record => {
      if ('idempotencyKey' in (record as any)) {
        const key = (record as any).idempotencyKey;
        if (key) {
          this.idempotencyKeys.set(key, record.id);
        }
      }
    });
  }

  private readAll(): T[] {
    try {
      const content = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(content) as T[];
    } catch (error) {
      return [];
    }
  }

  private writeAll(records: T[]): void {
    fs.writeFileSync(this.filePath, JSON.stringify(records, null, 2), 'utf8');
  }

  findById(id: string): T | undefined {
    const records = this.readAll();
    return records.find(r => r.id === id);
  }

  findOne(predicate: (record: T) => boolean): T | undefined {
    const records = this.readAll();
    return records.find(predicate);
  }

  findMany(predicate?: (record: T) => boolean): T[] {
    const records = this.readAll();
    return predicate ? records.filter(predicate) : records;
  }

  findByIdempotencyKey(key: string): T | undefined {
    const recordId = this.idempotencyKeys.get(key);
    return recordId ? this.findById(recordId) : undefined;
  }

  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>, idempotencyKey?: string): T {
    if (idempotencyKey) {
      const existing = this.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    const now = new Date().toISOString();
    const record = {
      ...data,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      ...(idempotencyKey && { idempotencyKey })
    } as unknown as T;

    const records = this.readAll();
    records.push(record);
    this.writeAll(records);

    if (idempotencyKey) {
      this.idempotencyKeys.set(idempotencyKey, record.id);
    }

    return record;
  }

  update(id: string, data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): T | undefined {
    const records = this.readAll();
    const index = records.findIndex(r => r.id === id);

    if (index === -1) {
      return undefined;
    }

    const updated = {
      ...records[index],
      ...data,
      updatedAt: new Date().toISOString()
    } as T;

    records[index] = updated;
    this.writeAll(records);

    return updated;
  }

  delete(id: string): boolean {
    const records = this.readAll();
    const index = records.findIndex(r => r.id === id);

    if (index === -1) {
      return false;
    }

    records.splice(index, 1);
    this.writeAll(records);

    return true;
  }

  count(predicate?: (record: T) => boolean): number {
    const records = this.readAll();
    return predicate ? records.filter(predicate).length : records.length;
  }

  exists(predicate: (record: T) => boolean): boolean {
    return this.findOne(predicate) !== undefined;
  }
}
