class MockCacheService {
  constructor() {
    this.cache = new Map();
    this.keyPrefix = 'v1:';
  }

  setKeyPrefix(prefix) {
    this.keyPrefix = prefix;
    console.log(`缓存Key前缀已变更为: ${prefix}`);
  }

  getKeyPrefix() {
    return this.keyPrefix;
  }

  set(key, value, ttl = 3600) {
    const fullKey = this.keyPrefix + key;
    const expireAt = Date.now() + ttl * 1000;
    this.cache.set(fullKey, { value, expireAt });
    console.log(`缓存设置: ${fullKey} = ${JSON.stringify(value)}`);
    return true;
  }

  get(key) {
    const fullKey = this.keyPrefix + key;
    const data = this.cache.get(fullKey);
    
    if (!data) {
      console.log(`缓存未命中: ${fullKey}`);
      return null;
    }

    if (Date.now() > data.expireAt) {
      this.cache.delete(fullKey);
      console.log(`缓存已过期: ${fullKey}`);
      return null;
    }

    console.log(`缓存命中: ${fullKey} = ${JSON.stringify(data.value)}`);
    
    const isNullCache = data.value === null;
    return {
      value: data.value,
      isNullCache,
      fullKey
    };
  }

  delete(key) {
    const fullKey = this.keyPrefix + key;
    const existed = this.cache.has(fullKey);
    this.cache.delete(fullKey);
    console.log(`缓存删除: ${fullKey}, 存在: ${existed}`);
    return existed;
  }

  clear() {
    const count = this.cache.size;
    this.cache.clear();
    console.log(`缓存已清空, 共清除 ${count} 条记录`);
    return count;
  }

  getAllKeys() {
    return Array.from(this.cache.keys());
  }

  getStats() {
    return {
      totalKeys: this.cache.size,
      keyPrefix: this.keyPrefix,
      nullCacheCount: Array.from(this.cache.values()).filter(v => v.value === null).length
    };
  }
}

module.exports = new MockCacheService();