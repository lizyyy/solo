const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class Database {
  constructor(config = {}) {
    this.id = uuidv4();
    this.name = config.name || 'Database';
    this.data = new Map();
    this.readCount = 0;
    this.writeCount = 0;
    this.updateCount = 0;
    this.deleteCount = 0;
    this.queryLatencyMs = config.queryLatencyMs || 100;
  }

  async get(key) {
    this.readCount++;
    return this.data.get(key) || null;
  }

  async set(key, value) {
    const existing = this.data.has(key);
    this.data.set(key, {
      key,
      value,
      createdAt: existing ? this.data.get(key).createdAt : moment(),
      updatedAt: moment(),
      version: existing ? this.data.get(key).version + 1 : 1
    });
    
    if (existing) {
      this.updateCount++;
    } else {
      this.writeCount++;
    }
    
    return this.data.get(key);
  }

  async delete(key) {
    const existed = this.data.has(key);
    if (existed) {
      this.data.delete(key);
      this.deleteCount++;
    }
    return existed;
  }

  clear() {
    this.data.clear();
    this.readCount = 0;
    this.writeCount = 0;
    this.updateCount = 0;
    this.deleteCount = 0;
  }

  getStats() {
    return {
      name: this.name,
      size: this.data.size,
      readCount: this.readCount,
      writeCount: this.writeCount,
      updateCount: this.updateCount,
      deleteCount: this.deleteCount,
      queryLatencyMs: this.queryLatencyMs
    };
  }

  getAllEntries() {
    return Array.from(this.data.entries()).map(([key, entry]) => ({
      key,
      value: entry.value,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      version: entry.version
    }));
  }
}

module.exports = Database;
