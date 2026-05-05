const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class CacheLayer {
  constructor(config = {}) {
    this.id = uuidv4();
    this.name = config.name || 'Cache Layer';
    this.type = config.type || 'memory';
    this.capacity = config.capacity || 100;
    this.ttl = config.ttl || 300;
    this.ttlJitter = config.ttlJitter || 0;
    this.cache = new Map();
    this.hitCount = 0;
    this.missCount = 0;
    this.writeCount = 0;
    this.deleteCount = 0;
  }

  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.missCount++;
      return null;
    }

    if (entry.expiresAt && moment().isAfter(entry.expiresAt)) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return entry.value;
  }

  set(key, value, customTtl = null) {
    const ttl = customTtl || this.ttl;
    const jitter = Math.random() * this.ttlJitter * 2 - this.ttlJitter;
    const actualTtl = Math.max(0, ttl + jitter);
    
    const existingEntry = this.cache.get(key);
    const entry = {
      key,
      value,
      createdAt: moment(),
      expiresAt: actualTtl > 0 ? moment().add(actualTtl, 'seconds') : null,
      version: existingEntry?.version ? existingEntry.version + 1 : 1
    };

    this.evictIfNeeded();
    this.cache.set(key, entry);
    this.writeCount++;
    return entry;
  }

  delete(key) {
    const existed = this.cache.has(key);
    if (existed) {
      this.cache.delete(key);
      this.deleteCount++;
    }
    return existed;
  }

  evictIfNeeded() {
    if (this.capacity <= 0 || this.cache.size < this.capacity) {
      return;
    }

    const keysToDelete = Array.from(this.cache.keys()).slice(0, this.cache.size - this.capacity + 1);
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  clear() {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.writeCount = 0;
    this.deleteCount = 0;
  }

  getStats() {
    const totalRequests = this.hitCount + this.missCount;
    return {
      name: this.name,
      type: this.type,
      size: this.cache.size,
      capacity: this.capacity,
      hitCount: this.hitCount,
      missCount: this.missCount,
      writeCount: this.writeCount,
      deleteCount: this.deleteCount,
      hitRate: totalRequests > 0 ? this.hitCount / totalRequests : 0,
      missRate: totalRequests > 0 ? this.missCount / totalRequests : 0
    };
  }

  getAllEntries() {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      value: entry.value,
      createdAt: entry.createdAt.toISOString(),
      expiresAt: entry.expiresAt ? entry.expiresAt.toISOString() : null,
      version: entry.version
    }));
  }
}

module.exports = CacheLayer;
