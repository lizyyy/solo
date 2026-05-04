class SeedGenerator {
  constructor() {
    this.baseTime = Date.now() - 3600000;
  }

  generate(type) {
    if (type === 'good') {
      return this.generateGoodSample();
    }
    return this.generateBadSample();
  }

  generateGoodSample() {
    return {
      gcLog: this.generateGoodGCLog(),
      heapSummary: this.generateGoodHeapSummary(),
      retainerPaths: this.generateGoodRetainerPaths(),
      trafficCSV: this.generateGoodTrafficCSV(),
      config: this.generateGoodConfig()
    };
  }

  generateBadSample() {
    return {
      gcLog: this.generateBadGCLog(),
      heapSummary: this.generateBadHeapSummary(),
      retainerPaths: this.generateBadRetainerPaths(),
      trafficCSV: this.generateBadTrafficCSV(),
      config: this.generateBadConfig()
    };
  }

  generateGoodGCLog() {
    const lines = [];
    let currentTime = 0;
    
    for (let i = 0; i < 50; i++) {
      currentTime += Math.random() * 5 + 2;
      
      if (i % 10 === 0) {
        const beforeSize = 200000 + Math.random() * 50000;
        const afterSize = 80000 + Math.random() * 20000;
        const duration = Math.random() * 0.05 + 0.01;
        
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}: [Full GC (Mark-Sweep) ${beforeSize.toFixed(0)}K->${afterSize.toFixed(0)}K(512000K), ${duration.toFixed(4)} secs]`);
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}:   [Mark-Sweep: ${(beforeSize - afterSize).toFixed(0)}K]`);
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}:   Old generation: 150000K->60000K(400000K)`);
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}:   Young generation: 50000K->20000K(128000K)`);
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}:   [Summary: reclaimed ${((beforeSize - afterSize) / beforeSize * 100).toFixed(1)}%]`);
        lines.push('');
      } else {
        const beforeSize = 60000 + Math.random() * 30000;
        const afterSize = 20000 + Math.random() * 10000;
        const duration = Math.random() * 0.01 + 0.002;
        const promoted = Math.random() * 500 + 100;
        const survivalRate = 30 + Math.random() * 20;
        
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}: [GC (Scavenge) ${beforeSize.toFixed(0)}K->${afterSize.toFixed(0)}K(512000K), ${duration.toFixed(4)} secs]`);
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}:   [Scavenge: ${(beforeSize - afterSize).toFixed(0)}K]`);
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}:   Young generation: ${(beforeSize * 0.8).toFixed(0)}K->${(afterSize * 0.8).toFixed(0)}K(128000K)`);
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}:   Promoted ${promoted.toFixed(0)}K`);
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}:   Survival rate: ${survivalRate.toFixed(1)}%`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  generateBadGCLog() {
    const lines = [];
    let currentTime = 0;
    let oldSpaceSize = 100000;
    
    for (let i = 0; i < 60; i++) {
      currentTime += Math.random() * 3 + 1;
      oldSpaceSize += Math.random() * 5000 + 2000;
      
      if (i % 8 === 0) {
        const beforeSize = oldSpaceSize + Math.random() * 30000;
        const afterSize = oldSpaceSize * 0.85 + Math.random() * 10000;
        const duration = Math.random() * 0.2 + 0.1;
        const reclamationRate = (beforeSize - afterSize) / beforeSize * 100;
        
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}: [Full GC (Mark-Sweep) ${beforeSize.toFixed(0)}K->${afterSize.toFixed(0)}K(512000K), ${duration.toFixed(4)} secs]`);
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}:   [Mark-Sweep: ${(beforeSize - afterSize).toFixed(0)}K]`);
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}:   Old generation: ${(beforeSize * 0.9).toFixed(0)}K->${(afterSize * 0.9).toFixed(0)}K(400000K)`);
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}:   Young generation: ${(beforeSize * 0.1).toFixed(0)}K->${(afterSize * 0.1).toFixed(0)}K(128000K)`);
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}:   [Summary: reclaimed ${reclamationRate.toFixed(1)}% (LOW!)]`);
        lines.push('');
      } else {
        const beforeSize = 50000 + Math.random() * 20000;
        const afterSize = 30000 + Math.random() * 15000;
        const duration = Math.random() * 0.015 + 0.005;
        const promoted = Math.random() * 3000 + 1000;
        const survivalRate = 65 + Math.random() * 25;
        
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}: [GC (Scavenge) ${beforeSize.toFixed(0)}K->${afterSize.toFixed(0)}K(512000K), ${duration.toFixed(4)} secs]`);
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}:   [Scavenge: ${(beforeSize - afterSize).toFixed(0)}K]`);
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}:   Young generation: ${(beforeSize * 0.8).toFixed(0)}K->${(afterSize * 0.8).toFixed(0)}K(128000K)`);
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}:   Promoted ${promoted.toFixed(0)}K (HIGH!)`);
        lines.push(`[${process.pid}] ${currentTime.toFixed(3)}:   Survival rate: ${survivalRate.toFixed(1)}% (HIGH!)`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  generateGoodHeapSummary() {
    return {
      generatedAt: new Date().toISOString(),
      version: '1.0',
      summary: {
        totalHeapSize: 512 * 1024 * 1024,
        usedHeapSize: 180 * 1024 * 1024,
        heapSizeLimit: 512 * 1024 * 1024,
        totalJSHeapSize: 256 * 1024 * 1024,
        usedJSHeapSize: 150 * 1024 * 1024,
        jsHeapSizeLimit: 512 * 1024 * 1024
      },
      spaces: [
        { name: 'old_space', size: 400 * 1024 * 1024, used_size: 120 * 1024 * 1024, usagePercent: 30 },
        { name: 'new_space', size: 128 * 1024 * 1024, used_size: 40 * 1024 * 1024, usagePercent: 31 },
        { name: 'code_space', size: 64 * 1024 * 1024, used_size: 15 * 1024 * 1024, usagePercent: 23 },
        { name: 'map_space', size: 32 * 1024 * 1024, used_size: 5 * 1024 * 1024, usagePercent: 15 }
      ],
      nodes: [
        { type: 'string', name: 'string', self_size: 30 * 1024 * 1024, size: 30 * 1024 * 1024, count: 15000 },
        { type: 'object', name: 'object', self_size: 40 * 1024 * 1024, size: 40 * 1024 * 1024, count: 5000 },
        { type: 'array', name: 'array', self_size: 25 * 1024 * 1024, size: 25 * 1024 * 1024, count: 3000 },
        { type: 'function', name: 'function', self_size: 15 * 1024 * 1024, size: 15 * 1024 * 1024, count: 8000 },
        { type: 'Buffer', name: 'Buffer', self_size: 5 * 1024 * 1024, size: 5 * 1024 * 1024, count: 100 }
      ],
      typeDistribution: [
        { type: 'object', count: 5000, totalSize: 40 * 1024 * 1024, avgSize: 8192 },
        { type: 'string', count: 15000, totalSize: 30 * 1024 * 1024, avgSize: 2048 },
        { type: 'array', count: 3000, totalSize: 25 * 1024 * 1024, avgSize: 8533 },
        { type: 'function', count: 8000, totalSize: 15 * 1024 * 1024, avgSize: 1920 },
        { type: 'Buffer', count: 100, totalSize: 5 * 1024 * 1024, avgSize: 51200 }
      ],
      topTypes: [
        { type: 'object', count: 5000, totalSize: 40 * 1024 * 1024, avgSize: 8192 },
        { type: 'string', count: 15000, totalSize: 30 * 1024 * 1024, avgSize: 2048 }
      ],
      largeObjects: [],
      bufferAnalysis: {
        totalBuffers: 100,
        totalBufferSize: 5 * 1024 * 1024,
        avgBufferSize: 51200,
        largestBuffer: 500 * 1024,
        bufferTypes: []
      },
      natives: [],
      nativeMemory: {
        totalExternal: 10 * 1024 * 1024,
        categories: []
      },
      potentialLeakIndicators: [],
      stats: {
        heapUsagePercent: 35,
        jsHeapUsagePercent: 30,
        spaceWithHighestUsage: { name: 'new_space', usagePercent: 31 },
        largestType: { type: 'object', totalSize: 40 * 1024 * 1024 },
        totalLargeObjects: 0,
        potentialLeakCount: 0
      }
    };
  }

  generateBadHeapSummary() {
    return {
      generatedAt: new Date().toISOString(),
      version: '1.0',
      summary: {
        totalHeapSize: 512 * 1024 * 1024,
        usedHeapSize: 450 * 1024 * 1024,
        heapSizeLimit: 512 * 1024 * 1024,
        totalJSHeapSize: 480 * 1024 * 1024,
        usedJSHeapSize: 420 * 1024 * 1024,
        jsHeapSizeLimit: 512 * 1024 * 1024
      },
      spaces: [
        { name: 'old_space', size: 400 * 1024 * 1024, used_size: 380 * 1024 * 1024, usagePercent: 95 },
        { name: 'new_space', size: 128 * 1024 * 1024, used_size: 60 * 1024 * 1024, usagePercent: 47 },
        { name: 'code_space', size: 64 * 1024 * 1024, used_size: 10 * 1024 * 1024, usagePercent: 15 },
        { name: 'map_space', size: 32 * 1024 * 1024, used_size: 25 * 1024 * 1024, usagePercent: 78 }
      ],
      nodes: [
        { type: 'string', name: 'string', self_size: 80 * 1024 * 1024, size: 80 * 1024 * 1024, count: 50000 },
        { type: 'object', name: 'object', self_size: 120 * 1024 * 1024, size: 120 * 1024 * 1024, count: 15000 },
        { type: 'array', name: 'array', self_size: 60 * 1024 * 1024, size: 60 * 1024 * 1024, count: 8000 },
        { type: 'function', name: 'function', self_size: 30 * 1024 * 1024, size: 30 * 1024 * 1024, count: 15000 },
        { type: 'Buffer', name: 'Buffer', self_size: 80 * 1024 * 1024, size: 80 * 1024 * 1024, count: 1500 },
        { type: 'ArrayBuffer', name: 'ArrayBuffer', self_size: 40 * 1024 * 1024, size: 40 * 1024 * 1024, count: 200 }
      ],
      typeDistribution: [
        { type: 'object', count: 15000, totalSize: 120 * 1024 * 1024, avgSize: 8192 },
        { type: 'Buffer', count: 1500, totalSize: 80 * 1024 * 1024, avgSize: 54613 },
        { type: 'string', count: 50000, totalSize: 80 * 1024 * 1024, avgSize: 1638 },
        { type: 'array', count: 8000, totalSize: 60 * 1024 * 1024, avgSize: 7680 },
        { type: 'function', count: 15000, totalSize: 30 * 1024 * 1024, avgSize: 2048 }
      ],
      topTypes: [
        { type: 'object', count: 15000, totalSize: 120 * 1024 * 1024, avgSize: 8192 },
        { type: 'Buffer', count: 1500, totalSize: 80 * 1024 * 1024, avgSize: 54613 },
        { type: 'string', count: 50000, totalSize: 80 * 1024 * 1024, avgSize: 1638 }
      ],
      largeObjects: [
        { type: 'ArrayBuffer', size: 15 * 1024 * 1024, id: 1 },
        { type: 'Buffer', size: 12 * 1024 * 1024, id: 2 },
        { type: 'Buffer', size: 8 * 1024 * 1024, id: 3 }
      ],
      bufferAnalysis: {
        totalBuffers: 1500,
        totalBufferSize: 80 * 1024 * 1024,
        avgBufferSize: 54613,
        largestBuffer: 15 * 1024 * 1024,
        bufferTypes: []
      },
      natives: [
        { type: 'NativeModule', size: 30 * 1024 * 1024, count: 5 },
        { type: 'ExternalMemory', size: 50 * 1024 * 1024, count: 1 }
      ],
      nativeMemory: {
        totalExternal: 80 * 1024 * 1024,
        categories: [
          { type: 'NativeModule', count: 5, totalSize: 30 * 1024 * 1024, avgSize: 6 * 1024 * 1024 },
          { type: 'ExternalMemory', count: 1, totalSize: 50 * 1024 * 1024, avgSize: 50 * 1024 * 1024 }
        ]
      },
      potentialLeaks: [
        { type: 'detached_node', count: 50, details: [] },
        { type: 'event_listener', count: 30, details: [] }
      ],
      stats: {
        heapUsagePercent: 88,
        jsHeapUsagePercent: 88,
        spaceWithHighestUsage: { name: 'old_space', usagePercent: 95 },
        largestType: { type: 'object', totalSize: 120 * 1024 * 1024 },
        totalLargeObjects: 3,
        potentialLeakCount: 80
      }
    };
  }

  generateGoodRetainerPaths() {
    return {
      generatedAt: new Date().toISOString(),
      totalPaths: 100,
      paths: [],
      groupedPaths: {
        byRootType: {},
        byObjectType: {},
        byPathLength: {}
      },
      suspiciousPaths: [],
      keyRoots: [
        { type: '(Global properties)', count: 30, isCommon: true },
        { type: '(array)', count: 20, isCommon: true },
        { type: '(object)', count: 25, isCommon: true },
        { type: '(closure)', count: 15, isCommon: true }
      ],
      commonRetainers: [],
      statistics: {
        totalPaths: 100,
        suspiciousPaths: 0,
        criticalPaths: 0,
        warningPaths: 0,
        byRootType: {},
        byObjectType: {},
        avgPathLength: 3.5
      }
    };
  }

  generateBadRetainerPaths() {
    const suspiciousPaths = [];
    
    for (let i = 0; i < 25; i++) {
      suspiciousPaths.push({
        path: {},
        pathString: `global -> eventListeners["click_${i}"] -> Element@${1000 + i}`,
        matchedPatterns: [
          { name: '事件监听器', description: '事件监听器未正确移除可能导致内存泄漏', severity: 'critical' },
          { name: '全局对象引用', description: '全局对象上的引用不会被释放', severity: 'critical' }
        ],
        highestSeverity: 'critical'
      });
    }

    for (let i = 0; i < 15; i++) {
      suspiciousPaths.push({
        path: {},
        pathString: `setTimeout@${2000 + i} -> callback@${3000 + i} -> context@${4000 + i} -> largeData@${5000 + i}`,
        matchedPatterns: [
          { name: '定时器引用', description: '定时器未清理可能导致持续引用', severity: 'warning' },
          { name: 'Closure 引用', description: '闭包可能持有对外部变量的引用', severity: 'warning' }
        ],
        highestSeverity: 'warning'
      });
    }

    for (let i = 0; i < 10; i++) {
      suspiciousPaths.push({
        path: {},
        pathString: `WeakRef@${6000 + i} -> target@${7000 + i} -> strongRef@${8000 + i}`,
        matchedPatterns: [
          { name: 'WeakRef/FinalizationRegistry 引用', description: 'WeakRef 和 FinalizationRegistry 的使用需要特别关注', severity: 'warning' }
        ],
        highestSeverity: 'warning'
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      totalPaths: 200,
      paths: [],
      groupedPaths: {
        byRootType: {},
        byObjectType: {},
        byPathLength: {}
      },
      suspiciousPaths: suspiciousPaths,
      keyRoots: [
        { type: '(Global properties)', count: 80, isCommon: true },
        { type: '(event listener)', count: 40, isCommon: true },
        { type: '(timer)', count: 25, isCommon: true },
        { type: '(closure)', count: 35, isCommon: true },
        { type: '(WeakRef)', count: 15, isCommon: true }
      ],
      commonRetainers: [],
      statistics: {
        totalPaths: 200,
        suspiciousPaths: 50,
        criticalPaths: 25,
        warningPaths: 25,
        byRootType: {},
        byObjectType: {},
        avgPathLength: 5.2
      }
    };
  }

  generateGoodTrafficCSV() {
    const lines = [];
    const headers = ['timestamp', 'endpoint', 'method', 'status', 'latency', 'memory_before', 'memory_after', 'heap_used', 'rss'];
    lines.push(headers.join(','));

    const endpoints = ['/api/users', '/api/products', '/api/orders', '/api/search', '/api/health'];
    const methods = ['GET', 'GET', 'GET', 'POST', 'GET'];

    for (let i = 0; i < 100; i++) {
      const endpointIdx = Math.floor(Math.random() * endpoints.length);
      const timestamp = this.baseTime + i * 60000;
      const memoryBefore = 180 + Math.random() * 20;
      const memoryAfter = 175 + Math.random() * 15;
      const latency = 10 + Math.random() * 50;
      const status = Math.random() > 0.02 ? 200 : 500;

      const row = [
        new Date(timestamp).toISOString(),
        endpoints[endpointIdx],
        methods[endpointIdx],
        status,
        latency.toFixed(2),
        `${memoryBefore.toFixed(2)}MB`,
        `${memoryAfter.toFixed(2)}MB`,
        `${(memoryBefore * 0.8).toFixed(2)}MB`,
        `${(memoryBefore * 1.5).toFixed(2)}MB`
      ];
      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  generateBadTrafficCSV() {
    const lines = [];
    const headers = ['timestamp', 'endpoint', 'method', 'status', 'latency', 'memory_before', 'memory_after', 'heap_used', 'rss'];
    lines.push(headers.join(','));

    const endpoints = ['/api/users', '/api/products', '/api/orders', '/api/search', '/api/health'];
    const methods = ['GET', 'GET', 'GET', 'POST', 'GET'];

    let baseMemory = 200;

    for (let i = 0; i < 150; i++) {
      const endpointIdx = Math.floor(Math.random() * endpoints.length);
      const timestamp = this.baseTime + i * 30000;
      const memoryBefore = baseMemory + Math.random() * 30;
      baseMemory += Math.random() * 5 + 2;
      const memoryAfter = memoryBefore + Math.random() * 10;
      const latency = 50 + Math.random() * 200;
      const status = Math.random() > 0.1 ? 200 : (Math.random() > 0.5 ? 500 : 404);

      const row = [
        new Date(timestamp).toISOString(),
        endpoints[endpointIdx],
        methods[endpointIdx],
        status,
        latency.toFixed(2),
        `${memoryBefore.toFixed(2)}MB`,
        `${memoryAfter.toFixed(2)}MB`,
        `${(memoryBefore * 0.85).toFixed(2)}MB`,
        `${(memoryBefore * 1.8).toFixed(2)}MB`
      ];
      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  generateGoodConfig() {
    return {
      v8Flags: {
        raw: '--max-old-space-size=512 --semi-space-size=32 --trace-gc',
        parsed: {
          'max-old-space-size': '512',
          'semi-space-size': '32',
          'trace-gc': true,
          maxOldSpaceSize: 512,
          semiSpaceSize: 32,
          traceGC: true
        },
        issues: []
      },
      caches: [
        {
          id: 'cache_0',
          name: 'userCache',
          type: 'LRU',
          maxSize: 10000,
          ttl: 300,
          evictionPolicy: 'LRU',
          currentSize: 4500,
          hitRate: 0.85,
          missRate: 0.15,
          issues: []
        },
        {
          id: 'cache_1',
          name: 'productCache',
          type: 'TTL',
          maxSize: 5000,
          ttl: 600,
          evictionPolicy: 'TTL',
          currentSize: 2000,
          hitRate: 0.75,
          missRate: 0.25,
          issues: []
        }
      ],
      objectPools: [
        {
          id: 'pool_0',
          name: 'connectionPool',
          type: 'database',
          objectType: 'DBConnection',
          maxSize: 50,
          minSize: 10,
          idleTimeout: 60000,
          maxIdleTime: 300000,
          currentSize: 25,
          idleCount: 10,
          activeCount: 15,
          issues: []
        },
        {
          id: 'pool_1',
          name: 'bufferPool',
          type: 'buffer',
          objectType: 'Buffer',
          maxSize: 200,
          minSize: 50,
          idleTimeout: 30000,
          maxIdleTime: 120000,
          currentSize: 120,
          idleCount: 40,
          activeCount: 80,
          issues: []
        }
      ],
      batchProcessing: [
        {
          id: 'batch_0',
          name: 'logBatch',
          batchSize: 100,
          maxBatchSize: 500,
          flushInterval: 5000,
          maxPending: 10000,
          currentPending: 150,
          issues: []
        }
      ],
      weakRefUsage: [],
      finalizationRegistryUsage: [],
      potentialIssues: [],
      recommendations: [],
      summary: {
        overview: {
          cacheCount: 2,
          objectPoolCount: 2,
          batchProcessingCount: 1,
          weakRefCount: 0,
          finalizationRegistryCount: 0,
          totalIssues: 0,
          criticalIssues: 0,
          warningIssues: 0
        },
        v8Config: {
          maxOldSpaceSize: '512 MB',
          semiSpaceSize: '32 MB',
          traceGC: true,
          exposeGC: false
        },
        cacheSummary: [
          { name: 'userCache', maxSize: 10000, ttl: 300, currentSize: 4500, issues: 0 },
          { name: 'productCache', maxSize: 5000, ttl: 600, currentSize: 2000, issues: 0 }
        ],
        poolSummary: [
          { name: 'connectionPool', objectType: 'DBConnection', maxSize: 50, currentSize: 25, idleCount: 10, issues: 0 },
          { name: 'bufferPool', objectType: 'Buffer', maxSize: 200, currentSize: 120, idleCount: 40, issues: 0 }
        ],
        batchSummary: [
          { name: 'logBatch', batchSize: 100, maxPending: 10000, flushInterval: 5000, issues: 0 }
        ]
      }
    };
  }

  generateBadConfig() {
    return {
      v8Flags: {
        raw: '--max-old-space-size=256',
        parsed: {
          'max-old-space-size': '256',
          maxOldSpaceSize: 256
        },
        issues: []
      },
      caches: [
        {
          id: 'cache_0',
          name: 'unboundedCache',
          type: 'generic',
          maxSize: Infinity,
          ttl: null,
          evictionPolicy: 'none',
          currentSize: 50000,
          hitRate: 0.3,
          missRate: 0.7,
          issues: [
            { type: 'unbounded_cache', severity: 'critical', message: '缓存没有设置最大容量和 TTL，可能导致内存无限增长' },
            { type: 'no_max_size', severity: 'warning', message: '缓存没有设置最大容量' },
            { type: 'no_ttl', severity: 'warning', message: '缓存没有设置 TTL，对象可能永远不会过期' }
          ]
        },
        {
          id: 'cache_1',
          name: 'hugeCache',
          type: 'LRU',
          maxSize: 200000,
          ttl: 3600,
          evictionPolicy: 'LRU',
          currentSize: 180000,
          hitRate: 0.4,
          missRate: 0.6,
          issues: [
            { type: 'large_max_size', severity: 'warning', message: '缓存最大容量可能过大' },
            { type: 'near_capacity', severity: 'warning', message: '缓存使用率超过 90%' }
          ]
        }
      ],
      objectPools: [
        {
          id: 'pool_0',
          name: 'unboundedPool',
          type: 'generic',
          objectType: 'object',
          maxSize: Infinity,
          minSize: 100,
          idleTimeout: null,
          maxIdleTime: null,
          currentSize: 5000,
          idleCount: 4500,
          activeCount: 500,
          issues: [
            { type: 'unbounded_pool', severity: 'critical', message: '对象池没有设置最大容量限制' },
            { type: 'no_idle_timeout', severity: 'warning', message: '对象池没有设置空闲超时' },
            { type: 'too_many_idle', severity: 'warning', message: '空闲对象过多' }
          ]
        },
        {
          id: 'pool_1',
          name: 'hugePool',
          type: 'buffer',
          objectType: 'LargeBuffer',
          maxSize: 10000,
          minSize: 5000,
          idleTimeout: null,
          maxIdleTime: null,
          currentSize: 8000,
          idleCount: 6000,
          activeCount: 2000,
          issues: [
            { type: 'pool_too_large', severity: 'warning', message: '对象池容量过大' },
            { type: 'no_idle_timeout', severity: 'warning', message: '对象池没有设置空闲超时' }
          ]
        }
      ],
      batchProcessing: [
        {
          id: 'batch_0',
          name: 'unboundedBatch',
          batchSize: 2000,
          maxBatchSize: 5000,
          flushInterval: null,
          maxPending: Infinity,
          currentPending: 50000,
          issues: [
            { type: 'unbounded_pending', severity: 'critical', message: '批处理队列没有设置最大待处理数量和刷新间隔' },
            { type: 'no_max_pending', severity: 'warning', message: '批处理队列没有设置最大待处理数量' },
            { type: 'no_flush_interval', severity: 'warning', message: '批处理没有设置刷新间隔' },
            { type: 'batch_too_large', severity: 'warning', message: '批处理大小可能过大' }
          ]
        }
      ],
      weakRefUsage: [
        {
          id: 'weakref_0',
          name: 'badWeakRef',
          usage: '缓存持有',
          hasDeref: false,
          hasHeldValue: true,
          issues: [
            { type: 'weakref_with_held_value', severity: 'warning', message: 'WeakRef 持有强引用' },
            { type: 'weakref_no_deref_check', severity: 'warning', message: 'WeakRef 未检查 deref 结果' }
          ]
        }
      ],
      finalizationRegistryUsage: [
        {
          id: 'finalization_0',
          name: 'badFinalization',
          usage: '对象清理',
          hasCleanupCallback: true,
          hasUnregister: false,
          issues: [
            { type: 'finalization_without_unregister', severity: 'critical', message: 'FinalizationRegistry 回调可能泄漏' },
            { type: 'finalization_no_unregister', severity: 'warning', message: 'FinalizationRegistry 未使用 unregister' }
          ]
        }
      ],
      potentialIssues: [
        { category: 'cache', cacheName: 'unboundedCache', type: 'unbounded_cache_no_ttl', severity: 'critical', message: '缓存没有设置最大容量和 TTL' },
        { category: 'object_pool', poolName: 'unboundedPool', type: 'unbounded_pool', severity: 'critical', message: '对象池没有设置最大容量限制' },
        { category: 'batch_processing', batchName: 'unboundedBatch', type: 'unbounded_pending', severity: 'critical', message: '批处理队列没有设置限制' },
        { category: 'finalization_registry', registryName: 'badFinalization', type: 'finalization_without_unregister', severity: 'critical', message: 'FinalizationRegistry 回调可能泄漏' }
      ],
      recommendations: [],
      summary: {
        overview: {
          cacheCount: 2,
          objectPoolCount: 2,
          batchProcessingCount: 1,
          weakRefCount: 1,
          finalizationRegistryCount: 1,
          totalIssues: 15,
          criticalIssues: 4,
          warningIssues: 11
        },
        v8Config: {
          maxOldSpaceSize: '256 MB',
          semiSpaceSize: 'N/A',
          traceGC: false,
          exposeGC: false
        },
        cacheSummary: [
          { name: 'unboundedCache', maxSize: 'Unbounded', ttl: 'None', currentSize: 50000, issues: 3 },
          { name: 'hugeCache', maxSize: 200000, ttl: 3600, currentSize: 180000, issues: 2 }
        ],
        poolSummary: [
          { name: 'unboundedPool', objectType: 'object', maxSize: 'Unbounded', currentSize: 5000, idleCount: 4500, issues: 3 },
          { name: 'hugePool', objectType: 'LargeBuffer', maxSize: 10000, currentSize: 8000, idleCount: 6000, issues: 2 }
        ],
        batchSummary: [
          { name: 'unboundedBatch', batchSize: 2000, maxPending: 'Unbounded', flushInterval: 'None', issues: 4 }
        ]
      }
    };
  }
}

module.exports = new SeedGenerator();
