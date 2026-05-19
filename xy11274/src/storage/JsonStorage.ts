import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class JsonStorage<T extends { id: string }> {
  private filePath: string;
  private data: Map<string, T> = new Map();
  private idempotentKeys: Map<string, string> = new Map();

  constructor(fileName: string) {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = path.join(dataDir, `${fileName}.json`);
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed.items && Array.isArray(parsed.items)) {
          parsed.items.forEach((item: T) => {
            this.data.set(item.id, item);
          });
        }
        if (parsed.idempotentKeys && typeof parsed.idempotentKeys === 'object') {
          Object.entries(parsed.idempotentKeys).forEach(([key, value]) => {
            this.idempotentKeys.set(key, value as string);
          });
        }
      }
    } catch (error) {
      console.error(`加载数据文件 ${this.filePath} 失败:`, error);
      this.data = new Map();
      this.idempotentKeys = new Map();
    }
  }

  private save(): void {
    try {
      const items = Array.from(this.data.values());
      const idempotentKeysObj = Object.fromEntries(this.idempotentKeys);
      const content = JSON.stringify({
        items,
        idempotentKeys: idempotentKeysObj,
        savedAt: new Date().toISOString()
      }, null, 2);
      fs.writeFileSync(this.filePath, content, 'utf-8');
    } catch (error) {
      console.error(`保存数据文件 ${this.filePath} 失败:`, error);
      throw error;
    }
  }

  generateId(): string {
    return uuidv4();
  }

  create(item: Omit<T, 'id'> & { id?: string }): T {
    const id = item.id || this.generateId();
    const newItem = { ...item, id } as T;
    this.data.set(id, newItem);
    this.save();
    return newItem;
  }

  getById(id: string): T | undefined {
    return this.data.get(id);
  }

  getAll(): T[] {
    return Array.from(this.data.values());
  }

  find(predicate: (item: T) => boolean): T[] {
    return Array.from(this.data.values()).filter(predicate);
  }

  findOne(predicate: (item: T) => boolean): T | undefined {
    return Array.from(this.data.values()).find(predicate);
  }

  update(id: string, updates: Partial<T>): T | undefined {
    const existing = this.data.get(id);
    if (!existing) {
      return undefined;
    }
    const updated = { ...existing, ...updates } as T;
    this.data.set(id, updated);
    this.save();
    return updated;
  }

  delete(id: string): boolean {
    const existed = this.data.has(id);
    if (existed) {
      this.data.delete(id);
      this.save();
    }
    return existed;
  }

  clear(): void {
    this.data.clear();
    this.idempotentKeys.clear();
    this.save();
  }

  count(): number {
    return this.data.size;
  }

  getIdempotentResult(key: string): string | undefined {
    return this.idempotentKeys.get(key);
  }

  setIdempotentResult(key: string, resultId: string): void {
    this.idempotentKeys.set(key, resultId);
    this.save();
  }

  hasIdempotentKey(key: string): boolean {
    return this.idempotentKeys.has(key);
  }
}
