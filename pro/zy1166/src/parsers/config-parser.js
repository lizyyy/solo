const fs = require('fs');

class ConfigParser {
  constructor(filePath) {
    this.filePath = filePath;
  }

  parse() {
    const content = fs.readFileSync(this.filePath, 'utf-8');
    const data = JSON.parse(content);
    
    return this.analyzeConfig(data);
  }

  analyzeConfig(data) {
    const result = {
      meta: {
        parsedAt: new Date().toISOString()
      },
      v8Flags: {},
      caches: [],
      objectPools: [],
      batchProcessing: [],
      weakRefUsage: [],
      finalizationRegistryUsage: [],
      potentialIssues: [],
      recommendations: [],
      summary: {}
    };

    if (data.v8Flags || data.nodeFlags || data.flags) {
      result.v8Flags = this.parseV8Flags(data.v8Flags || data.nodeFlags || data.flags);
    }

    if (data.caches || data.cache) {
      result.caches = this.parseCaches(data.caches || (data.cache ? [data.cache] : []));
    }

    if (data.objectPools || data.pools || data.pool) {
      result.objectPools = this.parseObjectPools(data.objectPools || data.pools || (data.pool ? [data.pool] : []));
    }

    if (data.batchProcessing || data.batching) {
      result.batchProcessing = this.parseBatchProcessing(data.batchProcessing || data.batching);
    }

    if (data.weakRefs || data.weakRef) {
      result.weakRefUsage = this.parseWeakRefUsage(data.weakRefs || (data.weakRef ? [data.weakRef] : []));
    }

    if (data.finalizationRegistry || data.finalization) {
      result.finalizationRegistryUsage = this.parseFinalizationRegistry(
        data.finalizationRegistry || (data.finalization ? [data.finalization] : [])
      );
    }

    result.potentialIssues = this.identifyPotentialIssues(result);
    result.recommendations = this.generateRecommendations(result);
    result.summary = this.generateSummary(result);

    return result;
  }

  parseV8Flags(flags) {
    const result = {
      raw: flags,
      parsed: {},
      issues: []
    };

    if (typeof flags === 'string') {
      const flagArray = flags.split(/\s+/).filter(f => f.trim());
      for (const flag of flagArray) {
        this.parseSingleFlag(flag, result);
      }
    } else if (Array.isArray(flags)) {
      for (const flag of flags) {
        if (typeof flag === 'string') {
          this.parseSingleFlag(flag, result);
        }
      }
    } else if (typeof flags === 'object') {
      result.parsed = { ...flags };
    }

    return result;
  }

  parseSingleFlag(flag, result) {
    const match = flag.match(/^--?([^=]+)(?:=(.+))?$/);
    if (match) {
      const key = match[1];
      const value = match[2] !== undefined ? match[2] : true;
      
      result.parsed[key] = value;

      if (key === 'max-old-space-size' || key === 'max_old_space_size') {
        result.parsed.maxOldSpaceSize = parseInt(value);
      }
      if (key === 'semi-space-size' || key === 'semi_space_size') {
        result.parsed.semiSpaceSize = parseInt(value);
      }
      if (key === 'trace-gc' || key === 'trace_gc') {
        result.parsed.traceGC = true;
      }
      if (key === 'trace-gc-verbose' || key === 'trace_gc_verbose') {
        result.parsed.traceGCVerbose = true;
      }
      if (key === 'expose-gc' || key === 'expose_gc') {
        result.parsed.exposeGC = true;
      }
    }
  }

  parseCaches(caches) {
    return caches.map((cache, index) => {
      const result = {
        id: cache.id || `cache_${index}`,
        name: cache.name || `Cache ${index}`,
        type: cache.type || 'generic',
        maxSize: cache.maxSize || cache.max || Infinity,
        ttl: cache.ttl || cache.ttlSeconds || null,
        evictionPolicy: cache.evictionPolicy || cache.policy || 'LRU',
        currentSize: cache.currentSize || cache.size || 0,
        hitRate: cache.hitRate || null,
        missRate: cache.missRate || null,
        config: { ...cache }
      };

      result.issues = [];

      if (result.maxSize === Infinity && result.ttl === null) {
        result.issues.push({
          type: 'unbounded_cache',
          severity: 'critical',
          message: '缓存没有设置最大容量和 TTL，可能导致内存无限增长'
        });
      }

      if (result.maxSize === Infinity) {
        result.issues.push({
          type: 'no_max_size',
          severity: 'warning',
          message: '缓存没有设置最大容量'
        });
      }

      if (result.ttl === null) {
        result.issues.push({
          type: 'no_ttl',
          severity: 'warning',
          message: '缓存没有设置 TTL，对象可能永远不会过期'
        });
      }

      if (result.maxSize !== Infinity && result.maxSize > 100000) {
        result.issues.push({
          type: 'large_max_size',
          severity: 'warning',
          message: `缓存最大容量(${result.maxSize})可能过大`
        });
      }

      if (result.currentSize > result.maxSize * 0.9) {
        result.issues.push({
          type: 'near_capacity',
          severity: 'warning',
          message: `缓存使用率超过 90% (当前: ${result.currentSize}, 最大: ${result.maxSize})`
        });
      }

      return result;
    });
  }

  parseObjectPools(pools) {
    return pools.map((pool, index) => {
      const result = {
        id: pool.id || `pool_${index}`,
        name: pool.name || `Object Pool ${index}`,
        type: pool.type || 'generic',
        objectType: pool.objectType || pool.type || 'object',
        maxSize: pool.maxSize || pool.max || Infinity,
        minSize: pool.minSize || pool.min || 0,
        idleTimeout: pool.idleTimeout || pool.idleTimeoutMs || null,
        maxIdleTime: pool.maxIdleTime || null,
        currentSize: pool.currentSize || pool.size || 0,
        idleCount: pool.idleCount || 0,
        activeCount: pool.activeCount || 0,
        config: { ...pool }
      };

      result.issues = [];

      if (result.maxSize === Infinity) {
        result.issues.push({
          type: 'unbounded_pool',
          severity: 'critical',
          message: '对象池没有设置最大容量，可能导致内存无限增长'
        });
      }

      if (result.maxSize !== Infinity && result.maxSize > 5000) {
        result.issues.push({
          type: 'large_max_size',
          severity: 'warning',
          message: `对象池最大容量(${result.maxSize})可能过大`
        });
      }

      if (result.idleTimeout === null && result.maxIdleTime === null) {
        result.issues.push({
          type: 'no_idle_timeout',
          severity: 'warning',
          message: '对象池没有设置空闲超时，空闲对象可能永远不会被释放'
        });
      }

      if (result.idleCount > 100 && result.idleCount > result.activeCount * 2) {
        result.issues.push({
          type: 'too_many_idle',
          severity: 'warning',
          message: `空闲对象过多 (空闲: ${result.idleCount}, 活跃: ${result.activeCount})`
        });
      }

      if (result.currentSize > result.maxSize * 0.9 && result.maxSize !== Infinity) {
        result.issues.push({
          type: 'near_capacity',
          severity: 'warning',
          message: `对象池使用率超过 90% (当前: ${result.currentSize}, 最大: ${result.maxSize})`
        });
      }

      return result;
    });
  }

  parseBatchProcessing(batching) {
    const configs = Array.isArray(batching) ? batching : [batching];
    
    return configs.map((batch, index) => {
      const result = {
        id: batch.id || `batch_${index}`,
        name: batch.name || `Batch Processing ${index}`,
        batchSize: batch.batchSize || batch.size || 100,
        maxBatchSize: batch.maxBatchSize || batch.maxSize || null,
        flushInterval: batch.flushInterval || batch.interval || null,
        maxPending: batch.maxPending || batch.maxQueueSize || Infinity,
        currentPending: batch.currentPending || 0,
        config: { ...batch }
      };

      result.issues = [];

      if (result.maxPending === Infinity && result.flushInterval === null) {
        result.issues.push({
          type: 'unbounded_pending',
          severity: 'critical',
          message: '批处理队列没有设置最大待处理数量和刷新间隔，可能导致内存积压'
        });
      }

      if (result.maxPending === Infinity) {
        result.issues.push({
          type: 'no_max_pending',
          severity: 'warning',
          message: '批处理队列没有设置最大待处理数量'
        });
      }

      if (result.flushInterval === null) {
        result.issues.push({
          type: 'no_flush_interval',
          severity: 'warning',
          message: '批处理没有设置刷新间隔'
        });
      }

      if (result.batchSize > 1000) {
        result.issues.push({
          type: 'large_batch_size',
          severity: 'warning',
          message: `批处理大小(${result.batchSize})可能过大，会增加单次处理的内存压力`
        });
      }

      if (result.currentPending > result.maxPending * 0.8 && result.maxPending !== Infinity) {
        result.issues.push({
          type: 'near_pending_capacity',
          severity: 'warning',
          message: `批处理待处理队列接近容量 (当前: ${result.currentPending}, 最大: ${result.maxPending})`
        });
      }

      return result;
    });
  }

  parseWeakRefUsage(weakRefs) {
    return weakRefs.map((wr, index) => {
      const result = {
        id: wr.id || `weakref_${index}`,
        name: wr.name || `WeakRef ${index}`,
        usage: wr.usage || wr.purpose || 'unknown',
        hasDeref: wr.hasDeref !== undefined ? wr.hasDeref : true,
        hasHeldValue: wr.hasHeldValue !== undefined ? wr.hasHeldValue : false,
        config: { ...wr }
      };

      result.issues = [];

      if (result.hasHeldValue) {
        result.issues.push({
          type: 'held_value_used',
          severity: 'warning',
          message: 'WeakRef 持有了强引用，这可能抵消弱引用的效果'
        });
      }

      if (!result.hasDeref) {
        result.issues.push({
          type: 'no_deref_check',
          severity: 'warning',
          message: 'WeakRef 没有检查 deref() 返回值，可能导致空引用错误'
        });
      }

      return result;
    });
  }

  parseFinalizationRegistry(registries) {
    return registries.map((fr, index) => {
      const result = {
        id: fr.id || `finalization_${index}`,
        name: fr.name || `FinalizationRegistry ${index}`,
        usage: fr.usage || fr.purpose || 'unknown',
        hasCleanupCallback: fr.hasCleanupCallback !== undefined ? fr.hasCleanupCallback : true,
        hasUnregister: fr.hasUnregister !== undefined ? fr.hasUnregister : false,
        config: { ...fr }
      };

      result.issues = [];

      if (!result.hasUnregister) {
        result.issues.push({
          type: 'no_unregister',
          severity: 'warning',
          message: 'FinalizationRegistry 没有使用 unregister()，可能导致内存泄漏'
        });
      }

      if (result.hasCleanupCallback && !result.hasUnregister) {
        result.issues.push({
          type: 'callback_without_unregister',
          severity: 'critical',
          message: 'FinalizationRegistry 有回调但没有 unregister，回调可能持有对象引用'
        });
      }

      return result;
    });
  }

  identifyPotentialIssues(result) {
    const issues = [];

    const v8Flags = result.v8Flags.parsed;
    
    if (!v8Flags.maxOldSpaceSize) {
      issues.push({
        category: 'v8',
        type: 'no_max_old_space',
        severity: 'warning',
        message: '没有设置 --max-old-space-size，可能使用默认值导致内存限制'
      });
    } else if (v8Flags.maxOldSpaceSize < 256) {
      issues.push({
        category: 'v8',
        type: 'small_max_old_space',
        severity: 'warning',
        message: `--max-old-space-size (${v8Flags.maxOldSpaceSize}MB) 设置过小，可能导致频繁 GC`
      });
    }

    if (!v8Flags.semiSpaceSize) {
      issues.push({
        category: 'v8',
        type: 'no_semi_space',
        severity: 'info',
        message: '没有设置 --semi-space-size，使用默认值'
      });
    }

    for (const cache of result.caches) {
      for (const issue of cache.issues) {
        issues.push({
          category: 'cache',
          cacheName: cache.name,
          ...issue
        });
      }
    }

    for (const pool of result.objectPools) {
      for (const issue of pool.issues) {
        issues.push({
          category: 'object_pool',
          poolName: pool.name,
          ...issue
        });
      }
    }

    for (const batch of result.batchProcessing) {
      for (const issue of batch.issues) {
        issues.push({
          category: 'batch_processing',
          batchName: batch.name,
          ...issue
        });
      }
    }

    for (const wr of result.weakRefUsage) {
      for (const issue of wr.issues) {
        issues.push({
          category: 'weak_ref',
          weakRefName: wr.name,
          ...issue
        });
      }
    }

    for (const fr of result.finalizationRegistryUsage) {
      for (const issue of fr.issues) {
        issues.push({
          category: 'finalization_registry',
          registryName: fr.name,
          ...issue
        });
      }
    }

    return issues.sort((a, b) => {
      const severityOrder = { critical: 3, warning: 2, info: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  generateRecommendations(result) {
    const recommendations = [];

    const v8Flags = result.v8Flags.parsed;

    if (!v8Flags.maxOldSpaceSize) {
      recommendations.push({
        priority: 'high',
        category: 'v8',
        title: '设置 max-old-space-size',
        description: '建议设置 --max-old-space-size 以避免内存限制问题，推荐根据可用内存设置为 512MB 或更大',
        action: '添加 --max-old-space-size=512 到启动参数'
      });
    }

    for (const cache of result.caches) {
      if (cache.maxSize === Infinity) {
        recommendations.push({
          priority: 'high',
          category: 'cache',
          title: `为缓存 "${cache.name}" 设置最大容量`,
          description: '无界缓存是内存泄漏的常见原因，建议设置合理的 maxSize',
          action: `设置 cache.maxSize = 10000 (根据实际需求调整)`
        });
      }

      if (cache.ttl === null) {
        recommendations.push({
          priority: 'medium',
          category: 'cache',
          title: `为缓存 "${cache.name}" 设置 TTL`,
          description: '设置 TTL 可以确保过期对象被自动清理',
          action: `设置 cache.ttl = 300 (5分钟，根据实际需求调整)`
        });
      }
    }

    for (const pool of result.objectPools) {
      if (pool.maxSize === Infinity) {
        recommendations.push({
          priority: 'high',
          category: 'object_pool',
          title: `为对象池 "${pool.name}" 设置最大容量`,
          description: '无界对象池可能导致内存无限增长',
          action: `设置 pool.maxSize = 500 (根据实际需求调整)`
        });
      }

      if (pool.idleTimeout === null && pool.maxIdleTime === null) {
        recommendations.push({
          priority: 'medium',
          category: 'object_pool',
          title: `为对象池 "${pool.name}" 设置空闲超时`,
          description: '空闲超时可以释放长期不用的对象',
          action: `设置 pool.idleTimeout = 60000 (1分钟)`
        });
      }
    }

    for (const batch of result.batchProcessing) {
      if (batch.maxPending === Infinity) {
        recommendations.push({
          priority: 'high',
          category: 'batch_processing',
          title: `为批处理 "${batch.name}" 设置最大待处理数量`,
          description: '无界队列可能导致内存积压',
          action: `设置 batch.maxPending = 10000`
        });
      }
    }

    for (const fr of result.finalizationRegistryUsage) {
      if (!fr.hasUnregister) {
        recommendations.push({
          priority: 'high',
          category: 'finalization_registry',
          title: `为 FinalizationRegistry "${fr.name}" 使用 unregister`,
          description: 'FinalizationRegistry 的回调可能持有对象引用，必须使用 unregister 来避免泄漏',
          action: '在对象销毁时调用 registry.unregister(token)'
        });
      }
    }

    return recommendations;
  }

  generateSummary(result) {
    const summary = {
      overview: {
        cacheCount: result.caches.length,
        objectPoolCount: result.objectPools.length,
        batchProcessingCount: result.batchProcessing.length,
        weakRefCount: result.weakRefUsage.length,
        finalizationRegistryCount: result.finalizationRegistryUsage.length,
        totalIssues: result.potentialIssues.length,
        criticalIssues: result.potentialIssues.filter(i => i.severity === 'critical').length,
        warningIssues: result.potentialIssues.filter(i => i.severity === 'warning').length
      },
      v8Config: {},
      cacheSummary: [],
      poolSummary: [],
      batchSummary: []
    };

    if (result.v8Flags.parsed.maxOldSpaceSize) {
      summary.v8Config.maxOldSpaceSize = result.v8Flags.parsed.maxOldSpaceSize + ' MB';
    }
    if (result.v8Flags.parsed.semiSpaceSize) {
      summary.v8Config.semiSpaceSize = result.v8Flags.parsed.semiSpaceSize + ' MB';
    }
    summary.v8Config.traceGC = result.v8Flags.parsed.traceGC || false;
    summary.v8Config.exposeGC = result.v8Flags.parsed.exposeGC || false;

    summary.cacheSummary = result.caches.map(cache => ({
      name: cache.name,
      maxSize: cache.maxSize === Infinity ? 'Unbounded' : cache.maxSize,
      ttl: cache.ttl || 'None',
      currentSize: cache.currentSize,
      issues: cache.issues.length
    }));

    summary.poolSummary = result.objectPools.map(pool => ({
      name: pool.name,
      objectType: pool.objectType,
      maxSize: pool.maxSize === Infinity ? 'Unbounded' : pool.maxSize,
      currentSize: pool.currentSize,
      idleCount: pool.idleCount,
      issues: pool.issues.length
    }));

    summary.batchSummary = result.batchProcessing.map(batch => ({
      name: batch.name,
      batchSize: batch.batchSize,
      maxPending: batch.maxPending === Infinity ? 'Unbounded' : batch.maxPending,
      flushInterval: batch.flushInterval || 'None',
      issues: batch.issues.length
    }));

    return summary;
  }
}

module.exports = ConfigParser;
