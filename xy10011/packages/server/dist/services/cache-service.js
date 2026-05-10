"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = void 0;
const database_1 = require("../database");
class CacheService {
    inMemoryCache = new Map();
    async set(key, value, ttl) {
        const now = Date.now();
        const entry = {
            key,
            value,
            updatedAt: now,
            ttl: ttl ? now + ttl : undefined,
        };
        this.inMemoryCache.set(key, entry);
        this.persistCache(entry);
    }
    async get(key) {
        const inMemory = this.inMemoryCache.get(key);
        if (inMemory) {
            if (this.isValid(inMemory)) {
                return inMemory.value;
            }
            else {
                this.inMemoryCache.delete(key);
            }
        }
        const persisted = this.getFromDB(key);
        if (persisted) {
            if (this.isValid(persisted)) {
                this.inMemoryCache.set(key, persisted);
                return persisted.value;
            }
            else {
                this.invalidate(key);
            }
        }
        return null;
    }
    async invalidate(key) {
        this.inMemoryCache.delete(key);
        const db = (0, database_1.getDatabase)();
        db.prepare('DELETE FROM cache WHERE key = ?').run(key);
    }
    async invalidatePattern(pattern) {
        const keysToRemove = [];
        this.inMemoryCache.forEach((value, key) => {
            if (key.includes(pattern)) {
                keysToRemove.push(key);
            }
        });
        keysToRemove.forEach(key => this.inMemoryCache.delete(key));
        const db = (0, database_1.getDatabase)();
        db.prepare('DELETE FROM cache WHERE key LIKE ?').run(`%${pattern}%`);
    }
    async invalidateAll() {
        this.inMemoryCache.clear();
        const db = (0, database_1.getDatabase)();
        db.prepare('DELETE FROM cache').run();
    }
    async getOrSet(key, fetcher, ttl) {
        const cached = await this.get(key);
        if (cached !== null) {
            return cached;
        }
        const value = await fetcher();
        await this.set(key, value, ttl);
        return value;
    }
    isValid(entry) {
        if (entry.ttl === undefined)
            return true;
        return Date.now() < entry.ttl;
    }
    persistCache(entry) {
        const db = (0, database_1.getDatabase)();
        db.prepare(`
      INSERT OR REPLACE INTO cache (key, value, updated_at, ttl)
      VALUES (?, ?, ?, ?)
    `).run(entry.key, JSON.stringify(entry.value), entry.updatedAt, entry.ttl || null);
    }
    getFromDB(key) {
        const db = (0, database_1.getDatabase)();
        const row = db.prepare('SELECT * FROM cache WHERE key = ?').get(key);
        if (!row)
            return null;
        return {
            key: row.key,
            value: JSON.parse(row.value),
            updatedAt: row.updated_at,
            ttl: row.ttl || undefined,
        };
    }
}
exports.cacheService = new CacheService();
