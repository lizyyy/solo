import { getDatabase } from '../database';

interface CacheEntry<T> {
  key: string;
  value: T;
  updatedAt: number;
  ttl?: number;
}

class CacheService {
  private inMemoryCache: Map<string, CacheEntry<unknown>> = new Map();

  async set<T>(
    key: string,
    value: T,
    ttl?: number
  ): Promise<void> {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      value,
      updatedAt: now,
      ttl: ttl ? now + ttl : undefined,
    };

    this.inMemoryCache.set(key, entry as CacheEntry<unknown>);
    this.persistCache(entry);
  }

  async get<T>(key: string): Promise<T | null> {
    const inMemory = this.inMemoryCache.get(key);
    if (inMemory) {
      if (this.isValid(inMemory)) {
        return inMemory.value as T;
      } else {
        this.inMemoryCache.delete(key);
      }
    }

    const persisted = this.getFromDB(key);
    if (persisted) {
      if (this.isValid(persisted)) {
        this.inMemoryCache.set(key, persisted);
        return persisted.value as T;
      } else {
        this.invalidate(key);
      }
    }

    return null;
  }

  async invalidate(key: string): Promise<void> {
    this.inMemoryCache.delete(key);
    
    const db = getDatabase();
    db.prepare('DELETE FROM cache WHERE key = ?').run(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keysToRemove: string[] = [];
    
    this.inMemoryCache.forEach((value, key) => {
      if (key.includes(pattern)) {
        keysToRemove.push(key);
      }
    });

    keysToRemove.forEach(key => this.inMemoryCache.delete(key));

    const db = getDatabase();
    db.prepare('DELETE FROM cache WHERE key LIKE ?').run(`%${pattern}%`);
  }

  async invalidateAll(): Promise<void> {
    this.inMemoryCache.clear();
    
    const db = getDatabase();
    db.prepare('DELETE FROM cache').run();
  }

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttl);
    return value;
  }

  private isValid(entry: CacheEntry<unknown>): boolean {
    if (entry.ttl === undefined) return true;
    return Date.now() < entry.ttl;
  }

  private persistCache<T>(entry: CacheEntry<T>): void {
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO cache (key, value, updated_at, ttl)
      VALUES (?, ?, ?, ?)
    `).run(
      entry.key,
      JSON.stringify(entry.value),
      entry.updatedAt,
      entry.ttl || null
    );
  }

  private getFromDB<T>(key: string): CacheEntry<T> | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM cache WHERE key = ?').get(key) as any | undefined;
    
    if (!row) return null;

    return {
      key: row.key,
      value: JSON.parse(row.value) as T,
      updatedAt: row.updated_at,
      ttl: row.ttl || undefined,
    };
  }
}

export const cacheService = new CacheService();
