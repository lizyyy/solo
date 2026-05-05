const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const CacheLayer = require('./CacheLayer');
const Database = require('./Database');

class CacheSystem {
  constructor(config = {}) {
    this.id = uuidv4();
    this.name = config.name || 'Cache System';
    this.createdAt = moment();
    this.updatedAt = moment();
    
    this.l1Cache = new CacheLayer({
      name: 'L1 Cache',
      type: 'l1',
      capacity: config.l1Capacity || 50,
      ttl: config.l1Ttl || 60,
      ttlJitter: config.l1TtlJitter || 0
    });
    
    this.l2Cache = new CacheLayer({
      name: 'L2 Redis',
      type: 'l2',
      capacity: config.l2Capacity || 200,
      ttl: config.l2Ttl || 300,
      ttlJitter: config.l2TtlJitter || 0
    });
    
    this.database = new Database({
      name: 'Database',
      queryLatencyMs: config.dbQueryLatencyMs || 100
    });
    
    this.strategy = config.strategy || 'cache-aside';
    this.writeStrategy = config.writeStrategy || 'write-through';
    this.delayDoubleDelete = config.delayDoubleDelete || false;
    this.delayDeleteMs = config.delayDeleteMs || 1000;
    this.useMutex = config.useMutex || false;
    this.mutexTimeoutMs = config.mutexTimeoutMs || 5000;
    this.useBloomFilter = config.useBloomFilter || false;
    this.bloomFilterKeys = new Set();
    this.enablePreheating = config.enablePreheating || false;
    this.preheatedKeys = new Set();
    
    this.mutexLocks = new Map();
    this.events = [];
    this.consistencyWindows = [];
    this.penetrationEvents = [];
    this.breakdownEvents = [];
    this.avalancheEvents = [];
    
    this.totalReads = 0;
    this.totalWrites = 0;
    this.totalDeletes = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.dbReads = 0;
    this.dbWrites = 0;
  }

  recordEvent(type, details) {
    const event = {
      id: uuidv4(),
      timestamp: moment().toISOString(),
      type,
      details
    };
    this.events.push(event);
    return event;
  }

  checkConsistency(key, value) {
    const dbEntry = this.database.data.get(key);
    const l1Entry = this.l1Cache.cache.get(key);
    const l2Entry = this.l2Cache.cache.get(key);
    
    const dbValue = dbEntry?.value;
    const l1Value = l1Entry?.value;
    const l2Value = l2Entry?.value;
    
    const isL1Consistent = l1Value === undefined || l1Value === dbValue;
    const isL2Consistent = l2Value === undefined || l2Value === dbValue;
    
    if (!isL1Consistent || !isL2Consistent) {
      this.consistencyWindows.push({
        key,
        startTime: moment().toISOString(),
        l1Inconsistent: !isL1Consistent,
        l2Inconsistent: !isL2Consistent,
        l1Value,
        l2Value,
        dbValue
      });
    }
    
    return isL1Consistent && isL2Consistent;
  }

  async acquireMutex(key) {
    if (!this.useMutex) return true;
    
    const now = moment();
    const lock = this.mutexLocks.get(key);
    
    if (lock && now.isBefore(lock.expiresAt)) {
      return false;
    }
    
    this.mutexLocks.set(key, {
      key,
      acquiredAt: now,
      expiresAt: now.add(this.mutexTimeoutMs, 'milliseconds')
    });
    
    this.recordEvent('mutex_acquired', { key });
    return true;
  }

  releaseMutex(key) {
    if (!this.useMutex) return;
    
    this.mutexLocks.delete(key);
    this.recordEvent('mutex_released', { key });
  }

  checkBloomFilter(key) {
    if (!this.useBloomFilter) return true;
    return this.bloomFilterKeys.has(key);
  }

  addToBloomFilter(key) {
    if (!this.useBloomFilter) return;
    this.bloomFilterKeys.add(key);
  }

  async get(key, options = {}) {
    this.totalReads++;
    this.recordEvent('read_start', { key });
    
    if (!this.checkBloomFilter(key)) {
      this.penetrationEvents.push({
        key,
        timestamp: moment().toISOString(),
        type: 'cache_penetration',
        reason: 'bloom_filter_rejected'
      });
      this.recordEvent('bloom_filter_rejected', { key });
      return null;
    }
    
    let value = null;
    let fromLayer = null;
    
    value = this.l1Cache.get(key);
    if (value !== null) {
      this.cacheHits++;
      fromLayer = 'l1';
      this.recordEvent('l1_hit', { key, value });
      return { value, fromLayer, isConsistent: this.checkConsistency(key, value) };
    }
    
    value = this.l2Cache.get(key);
    if (value !== null) {
      this.cacheHits++;
      fromLayer = 'l2';
      this.l1Cache.set(key, value);
      this.recordEvent('l2_hit', { key, value });
      return { value, fromLayer, isConsistent: this.checkConsistency(key, value) };
    }
    
    this.cacheMisses++;
    
    if (this.useMutex) {
      const acquired = await this.acquireMutex(key);
      if (!acquired) {
        this.breakdownEvents.push({
          key,
          timestamp: moment().toISOString(),
          type: 'cache_breakdown',
          reason: 'mutex_contention'
        });
        this.recordEvent('mutex_contention', { key });
        return { value: null, fromLayer: null, isConsistent: true };
      }
      
      value = this.l2Cache.get(key);
      if (value !== null) {
        this.releaseMutex(key);
        this.l1Cache.set(key, value);
        return { value, fromLayer: 'l2', isConsistent: this.checkConsistency(key, value) };
      }
    }
    
    value = await this.database.get(key);
    this.dbReads++;
    
    if (value !== null) {
      this.l2Cache.set(key, value);
      this.l1Cache.set(key, value);
      this.addToBloomFilter(key);
      this.recordEvent('db_hit', { key, value });
    } else {
      this.penetrationEvents.push({
        key,
        timestamp: moment().toISOString(),
        type: 'cache_penetration',
        reason: 'key_not_exist'
      });
      this.recordEvent('db_miss', { key });
    }
    
    if (this.useMutex) {
      this.releaseMutex(key);
    }
    
    return { value, fromLayer: value ? 'db' : null, isConsistent: true };
  }

  async set(key, value, options = {}) {
    this.totalWrites++;
    this.recordEvent('write_start', { key, value });
    
    let result = null;
    
    if (this.writeStrategy === 'write-through') {
      result = await this.database.set(key, value);
      this.dbWrites++;
      
      this.l2Cache.set(key, value);
      this.l1Cache.set(key, value);
      this.addToBloomFilter(key);
      
      this.recordEvent('write_through_complete', { key, value });
    } else if (this.writeStrategy === 'write-behind') {
      this.l2Cache.set(key, value);
      this.l1Cache.set(key, value);
      this.addToBloomFilter(key);
      
      setTimeout(async () => {
        await this.database.set(key, value);
        this.dbWrites++;
        this.recordEvent('write_behind_db_complete', { key, value });
      }, 100);
      
      this.recordEvent('write_behind_complete', { key, value });
      result = { key, value };
    } else {
      result = await this.database.set(key, value);
      this.dbWrites++;
      
      this.l2Cache.delete(key);
      this.l1Cache.delete(key);
      
      if (this.delayDoubleDelete) {
        setTimeout(() => {
          this.l2Cache.delete(key);
          this.l1Cache.delete(key);
          this.recordEvent('delay_double_delete', { key });
        }, this.delayDeleteMs);
      }
      
      this.recordEvent('cache_invalidate_complete', { key, value });
    }
    
    return { result, isConsistent: this.checkConsistency(key, value) };
  }

  async delete(key, options = {}) {
    this.totalDeletes++;
    this.recordEvent('delete_start', { key });
    
    const dbExisted = await this.database.delete(key);
    
    if (dbExisted) {
      this.l2Cache.delete(key);
      this.l1Cache.delete(key);
      
      if (this.delayDoubleDelete) {
        setTimeout(() => {
          this.l2Cache.delete(key);
          this.l1Cache.delete(key);
          this.recordEvent('delay_double_delete_after_delete', { key });
        }, this.delayDeleteMs);
      }
      
      this.recordEvent('delete_complete', { key });
    } else {
      this.recordEvent('delete_key_not_found', { key });
    }
    
    return { deleted: dbExisted };
  }

  preheat(keys, values) {
    if (!this.enablePreheating) return;
    
    keys.forEach((key, index) => {
      const value = values[index];
      this.l2Cache.set(key, value);
      this.l1Cache.set(key, value);
      this.addToBloomFilter(key);
      this.preheatedKeys.add(key);
      this.recordEvent('preheat', { key, value });
    });
  }

  getStats() {
    const totalRequests = this.totalReads + this.totalWrites + this.totalDeletes;
    const readRequests = this.totalReads;
    const hitRate = readRequests > 0 ? this.cacheHits / readRequests : 0;
    const missRate = readRequests > 0 ? this.cacheMisses / readRequests : 0;
    
    return {
      id: this.id,
      name: this.name,
      strategy: this.strategy,
      writeStrategy: this.writeStrategy,
      delayDoubleDelete: this.delayDoubleDelete,
      useMutex: this.useMutex,
      useBloomFilter: this.useBloomFilter,
      enablePreheating: this.enablePreheating,
      stats: {
        totalRequests,
        totalReads: this.totalReads,
        totalWrites: this.totalWrites,
        totalDeletes: this.totalDeletes,
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,
        dbReads: this.dbReads,
        dbWrites: this.dbWrites,
        hitRate,
        missRate,
        sourceRatio: {
          l1: this.l1Cache.hitCount,
          l2: this.l2Cache.hitCount,
          db: this.dbReads
        }
      },
      layers: {
        l1: this.l1Cache.getStats(),
        l2: this.l2Cache.getStats(),
        database: this.database.getStats()
      },
      events: {
        count: this.events.length,
        consistencyWindows: this.consistencyWindows.length,
        penetrations: this.penetrationEvents.length,
        breakdowns: this.breakdownEvents.length,
        avalanches: this.avalancheEvents.length
      }
    };
  }

  getEvents(options = {}) {
    let filtered = [...this.events];
    
    if (options.type) {
      filtered = filtered.filter(e => e.type === options.type);
    }
    
    if (options.limit) {
      filtered = filtered.slice(-options.limit);
    }
    
    return filtered;
  }

  getConsistencyRisk() {
    return {
      windows: this.consistencyWindows,
      count: this.consistencyWindows.length,
      totalTime: this.consistencyWindows.length * 1
    };
  }

  getPenetrationRisk() {
    return {
      events: this.penetrationEvents,
      count: this.penetrationEvents.length,
      byReason: this.penetrationEvents.reduce((acc, e) => {
        acc[e.reason] = (acc[e.reason] || 0) + 1;
        return acc;
      }, {})
    };
  }

  getBreakdownRisk() {
    return {
      events: this.breakdownEvents,
      count: this.breakdownEvents.length
    };
  }

  getAvalancheRisk() {
    const ttlGroups = new Map();
    
    this.l2Cache.cache.forEach((entry, key) => {
      if (entry.expiresAt) {
        const timeBucket = moment(entry.expiresAt).startOf('second').unix();
        if (!ttlGroups.has(timeBucket)) {
          ttlGroups.set(timeBucket, []);
        }
        ttlGroups.get(timeBucket).push(key);
      }
    });
    
    const highRiskBuckets = [];
    ttlGroups.forEach((keys, bucket) => {
      if (keys.length >= 5) {
        highRiskBuckets.push({
          bucket,
          keys: keys.length,
          keyList: keys
        });
      }
    });
    
    if (highRiskBuckets.length > 0) {
      this.avalancheEvents.push({
        timestamp: moment().toISOString(),
        type: 'potential_avalanche',
        buckets: highRiskBuckets
      });
    }
    
    return {
      events: this.avalancheEvents,
      count: this.avalancheEvents.length,
      highRiskBuckets,
      ttlDistribution: Object.fromEntries(ttlGroups)
    };
  }

  clear() {
    this.l1Cache.clear();
    this.l2Cache.clear();
    this.database.clear();
    this.events = [];
    this.consistencyWindows = [];
    this.penetrationEvents = [];
    this.breakdownEvents = [];
    this.avalancheEvents = [];
    this.mutexLocks.clear();
    this.bloomFilterKeys.clear();
    this.preheatedKeys.clear();
    
    this.totalReads = 0;
    this.totalWrites = 0;
    this.totalDeletes = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.dbReads = 0;
    this.dbWrites = 0;
  }
}

module.exports = CacheSystem;
