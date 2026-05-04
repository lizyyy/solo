class Simulator {
  constructor(analysisData) {
    this.data = analysisData;
    this.baseConfig = this.extractBaseConfig();
  }

  extractBaseConfig() {
    const base = {
      maxOldSpaceSize: 512,
      semiSpaceSize: 32,
      newSpaceSize: 64,
      cacheTTL: 300,
      poolMaxSize: 500,
      batchSize: 100,
      batchFlushInterval: 5000
    };

    if (this.data.config && this.data.config.v8Flags) {
      const v8 = this.data.config.v8Flags.parsed;
      if (v8.maxOldSpaceSize) base.maxOldSpaceSize = v8.maxOldSpaceSize;
      if (v8.semiSpaceSize) base.semiSpaceSize = v8.semiSpaceSize;
    }

    if (this.data.config && this.data.config.caches) {
      const cache = this.data.config.caches[0];
      if (cache && cache.ttl) base.cacheTTL = cache.ttl;
    }

    if (this.data.config && this.data.config.objectPools) {
      const pool = this.data.config.objectPools[0];
      if (pool && pool.maxSize !== Infinity) base.poolMaxSize = pool.maxSize;
    }

    if (this.data.config && this.data.config.batchProcessing) {
      const batch = this.data.config.batchProcessing[0];
      if (batch) {
        if (batch.batchSize) base.batchSize = batch.batchSize;
        if (batch.flushInterval) base.batchFlushInterval = batch.flushInterval;
      }
    }

    if (this.data.gcLog && this.data.gcLog.stats) {
      const stats = this.data.gcLog.stats;
      base.actualGCFrequency = this.calculateActualGCFrequency();
      base.actualSurvivalRate = stats.avgSurvivalRate || 40;
      base.actualPromotionRate = stats.avgPromotionKB ? (stats.avgPromotionKB / 1024) : 1;
    }

    return base;
  }

  calculateActualGCFrequency() {
    if (!this.data.gcLog || !this.data.gcLog.events) return 0;
    
    const events = this.data.gcLog.events;
    if (events.length < 2) return 0;

    const sortedEvents = [...events].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const firstTs = sortedEvents[0].timestamp || 0;
    const lastTs = sortedEvents[sortedEvents.length - 1].timestamp || 0;
    
    if (lastTs - firstTs <= 0) return 0;

    const durationMinutes = (lastTs - firstTs) / 60;
    return events.length / durationMinutes;
  }

  simulate(params) {
    const config = { ...this.baseConfig, ...params };
    const result = {
      config,
      baseConfig: this.baseConfig,
      estimatedPeakMemoryMB: 0,
      estimatedSteadyStateMemoryMB: 0,
      gcFrequency: 0,
      majorGCFrequency: 0,
      minorGCFrequency: 0,
      estimatedSurvivalRate: 0,
      estimatedPromotionRate: 0,
      cacheEfficiency: 0,
      poolEfficiency: 0,
      batchEfficiency: 0,
      riskLevel: 'low',
      warnings: [],
      improvements: []
    };

    this.calculateMemoryMetrics(result, config);
    this.calculateGCMetrics(result, config);
    this.calculateCacheMetrics(result, config);
    this.calculatePoolMetrics(result, config);
    this.calculateBatchMetrics(result, config);
    this.assessRisk(result, config);
    this.identifyImprovements(result, config);

    return result;
  }

  calculateMemoryMetrics(result, config) {
    const heapSummary = this.data.heapSummary;
    let baseUsedMemory = 200;

    if (heapSummary && heapSummary.summary) {
      const summary = heapSummary.summary;
      if (summary.usedHeapSize) {
        baseUsedMemory = summary.usedHeapSize / (1024 * 1024);
      } else if (summary.usedJSHeapSize) {
        baseUsedMemory = summary.usedJSHeapSize / (1024 * 1024);
      }
    }

    if (this.data.gcLog && this.data.gcLog.stats) {
      const stats = this.data.gcLog.stats;
      if (stats.oldSpaceGrowthKB) {
        baseUsedMemory += stats.oldSpaceGrowthKB / 1024 * 0.3;
      }
    }

    const oldSpaceRatio = config.maxOldSpaceSize / this.baseConfig.maxOldSpaceSize;
    const semiSpaceRatio = config.semiSpaceSize / this.baseConfig.semiSpaceSize;

    result.estimatedPeakMemoryMB = baseUsedMemory * Math.min(oldSpaceRatio, 1.5);
    result.estimatedSteadyStateMemoryMB = baseUsedMemory * Math.min(oldSpaceRatio * 0.7, 1.2);

    if (config.semiSpaceSize > this.baseConfig.semiSpaceSize) {
      result.estimatedPeakMemoryMB += (config.semiSpaceSize - this.baseConfig.semiSpaceSize) * 2;
      result.estimatedSteadyStateMemoryMB += (config.semiSpaceSize - this.baseConfig.semiSpaceSize) * 1.5;
    }

    const maxSafeMemory = config.maxOldSpaceSize * 0.9;
    if (result.estimatedPeakMemoryMB > maxSafeMemory) {
      result.warnings.push({
        type: 'memory_too_high',
        message: `预计峰值内存 (${result.estimatedPeakMemoryMB.toFixed(1)}MB) 接近 max-old-space-size 限制 (${config.maxOldSpaceSize}MB)`,
        severity: 'warning'
      });
    }
  }

  calculateGCMetrics(result, config) {
    const baseFrequency = this.baseConfig.actualGCFrequency || 5;
    const baseSurvivalRate = this.baseConfig.actualSurvivalRate || 40;
    const basePromotionRate = this.baseConfig.actualPromotionRate || 1;

    const semiSpaceRatio = config.semiSpaceSize / this.baseConfig.semiSpaceSize;
    const oldSpaceRatio = config.maxOldSpaceSize / this.baseConfig.maxOldSpaceSize;

    result.minorGCFrequency = baseFrequency * (1 / Math.sqrt(semiSpaceRatio));
    result.majorGCFrequency = baseFrequency * 0.3 * (1 / oldSpaceRatio);
    result.gcFrequency = (result.minorGCFrequency + result.majorGCFrequency);

    if (config.semiSpaceSize > this.baseConfig.semiSpaceSize) {
      result.estimatedSurvivalRate = Math.max(10, baseSurvivalRate - 10);
      result.estimatedPromotionRate = basePromotionRate * 0.8;
    } else if (config.semiSpaceSize < this.baseConfig.semiSpaceSize) {
      result.estimatedSurvivalRate = Math.min(80, baseSurvivalRate + 10);
      result.estimatedPromotionRate = basePromotionRate * 1.3;
    } else {
      result.estimatedSurvivalRate = baseSurvivalRate;
      result.estimatedPromotionRate = basePromotionRate;
    }

    if (result.minorGCFrequency > 20) {
      result.warnings.push({
        type: 'high_minor_gc',
        message: `预计 Minor GC 频率过高 (${result.minorGCFrequency.toFixed(1)}/min)，考虑增加 semi-space-size`,
        severity: 'warning'
      });
    }

    if (result.majorGCFrequency > 2) {
      result.warnings.push({
        type: 'high_major_gc',
        message: `预计 Major GC 频率过高 (${result.majorGCFrequency.toFixed(1)}/min)，考虑增加 max-old-space-size`,
        severity: 'warning'
      });
    }

    if (result.estimatedSurvivalRate > 60) {
      result.warnings.push({
        type: 'high_survival_rate',
        message: `预计对象存活率过高 (${result.estimatedSurvivalRate.toFixed(1)}%)，可能导致频繁晋升`,
        severity: 'warning'
      });
    }
  }

  calculateCacheMetrics(result, config) {
    const baseCache = this.data.config?.caches?.[0];
    let baseEfficiency = 0.7;

    if (baseCache && baseCache.hitRate !== null) {
      baseEfficiency = baseCache.hitRate;
    }

    const ttlRatio = config.cacheTTL / this.baseConfig.cacheTTL;

    if (config.cacheTTL > this.baseConfig.cacheTTL) {
      result.cacheEfficiency = Math.min(0.95, baseEfficiency + 0.05);
      result.estimatedPeakMemoryMB += 20 * (ttlRatio - 1);
      result.estimatedSteadyStateMemoryMB += 15 * (ttlRatio - 1);
    } else if (config.cacheTTL < this.baseConfig.cacheTTL) {
      result.cacheEfficiency = Math.max(0.3, baseEfficiency - 0.1);
      result.estimatedPeakMemoryMB -= 10 * (1 - ttlRatio);
      result.estimatedSteadyStateMemoryMB -= 8 * (1 - ttlRatio);
    } else {
      result.cacheEfficiency = baseEfficiency;
    }

    if (result.cacheEfficiency < 0.5) {
      result.warnings.push({
        type: 'low_cache_efficiency',
        message: `预计缓存效率较低 (${(result.cacheEfficiency * 100).toFixed(1)}%)，可能需要调整 TTL 或缓存策略`,
        severity: 'info'
      });
    }
  }

  calculatePoolMetrics(result, config) {
    const basePool = this.data.config?.objectPools?.[0];
    let baseEfficiency = 0.8;

    if (basePool) {
      if (basePool.idleCount !== undefined && basePool.activeCount !== undefined) {
        const total = basePool.idleCount + basePool.activeCount;
        if (total > 0) {
          baseEfficiency = basePool.activeCount / total;
        }
      }
    }

    const poolRatio = config.poolMaxSize / this.baseConfig.poolMaxSize;

    if (config.poolMaxSize > this.baseConfig.poolMaxSize) {
      result.poolEfficiency = Math.max(0.5, baseEfficiency - 0.1);
      result.estimatedPeakMemoryMB += 10 * (poolRatio - 1);
      result.estimatedSteadyStateMemoryMB += 8 * (poolRatio - 1);
    } else if (config.poolMaxSize < this.baseConfig.poolMaxSize) {
      result.poolEfficiency = Math.min(0.95, baseEfficiency + 0.1);
      result.estimatedPeakMemoryMB -= 5 * (1 - poolRatio);
      result.estimatedSteadyStateMemoryMB -= 4 * (1 - poolRatio);
    } else {
      result.poolEfficiency = baseEfficiency;
    }

    if (config.poolMaxSize === Infinity) {
      result.warnings.push({
        type: 'unbounded_pool',
        message: '对象池无上限，存在内存风险',
        severity: 'critical'
      });
    }

    if (result.poolEfficiency < 0.6) {
      result.warnings.push({
        type: 'low_pool_efficiency',
        message: `预计对象池效率较低 (${(result.poolEfficiency * 100).toFixed(1)}%)，可能存在过多空闲对象`,
        severity: 'warning'
      });
    }
  }

  calculateBatchMetrics(result, config) {
    const baseBatch = this.data.config?.batchProcessing?.[0];
    let baseEfficiency = 0.75;

    if (baseBatch) {
      if (baseBatch.batchSize && baseBatch.maxPending) {
        baseEfficiency = Math.min(0.95, baseBatch.batchSize / Math.max(baseBatch.maxPending, 100));
      }
    }

    const batchRatio = config.batchSize / this.baseConfig.batchSize;

    if (config.batchSize > this.baseConfig.batchSize) {
      result.batchEfficiency = Math.min(0.95, baseEfficiency + 0.05);
      result.estimatedPeakMemoryMB += 5 * (batchRatio - 1);
      result.estimatedSteadyStateMemoryMB += 3 * (batchRatio - 1);
    } else if (config.batchSize < this.baseConfig.batchSize) {
      result.batchEfficiency = Math.max(0.5, baseEfficiency - 0.1);
      result.estimatedPeakMemoryMB -= 3 * (1 - batchRatio);
      result.estimatedSteadyStateMemoryMB -= 2 * (1 - batchRatio);
    } else {
      result.batchEfficiency = baseEfficiency;
    }

    if (config.batchSize > 1000) {
      result.warnings.push({
        type: 'batch_too_large',
        message: `批处理大小 (${config.batchSize}) 可能过大，会增加单次处理的内存压力`,
        severity: 'warning'
      });
    }

    if (config.batchFlushInterval === null || config.batchFlushInterval === 0) {
      result.warnings.push({
        type: 'no_flush_interval',
        message: '批处理无刷新间隔，可能导致内存积压',
        severity: 'warning'
      });
    }
  }

  assessRisk(result, config) {
    let riskScore = 0;

    if (result.warnings.some(w => w.severity === 'critical')) {
      riskScore += 50;
    }

    const warningCount = result.warnings.filter(w => w.severity === 'warning').length;
    riskScore += warningCount * 10;

    const memoryRatio = result.estimatedPeakMemoryMB / config.maxOldSpaceSize;
    if (memoryRatio > 0.85) {
      riskScore += 30;
    } else if (memoryRatio > 0.7) {
      riskScore += 10;
    }

    if (result.gcFrequency > 15) {
      riskScore += 20;
    } else if (result.gcFrequency > 10) {
      riskScore += 10;
    }

    if (riskScore >= 60) {
      result.riskLevel = 'high';
    } else if (riskScore >= 30) {
      result.riskLevel = 'medium';
    } else {
      result.riskLevel = 'low';
    }

    result.riskScore = riskScore;
  }

  identifyImprovements(result, config) {
    const improvements = [];

    if (config.maxOldSpaceSize < this.baseConfig.maxOldSpaceSize) {
      const memoryReduction = (this.baseConfig.maxOldSpaceSize - config.maxOldSpaceSize);
      improvements.push({
        type: 'memory_reduction',
        title: '减少老年代内存限制',
        description: `将 max-old-space-size 从 ${this.baseConfig.maxOldSpaceSize}MB 减少到 ${config.maxOldSpaceSize}MB`,
        impact: `预计减少约 ${memoryReduction * 0.3.toFixed(0)}MB 的峰值内存使用`,
        tradeoff: '可能增加 Major GC 频率'
      });
    }

    if (config.semiSpaceSize > this.baseConfig.semiSpaceSize) {
      improvements.push({
        type: 'reduce_promotion',
        title: '增加年轻代大小',
        description: `将 semi-space-size 从 ${this.baseConfig.semiSpaceSize}MB 增加到 ${config.semiSpaceSize}MB`,
        impact: `预计减少对象晋升率约 ${((1 - result.estimatedPromotionRate / this.baseConfig.actualPromotionRate) * 100).toFixed(1)}%`,
        tradeoff: '增加了年轻代内存占用'
      });
    }

    if (config.cacheTTL < this.baseConfig.cacheTTL) {
      improvements.push({
        type: 'cache_ttl_optimization',
        title: '缩短缓存 TTL',
        description: `将缓存 TTL 从 ${this.baseConfig.cacheTTL} 秒减少到 ${config.cacheTTL} 秒`,
        impact: `预计减少缓存内存占用约 ${((1 - config.cacheTTL / this.baseConfig.cacheTTL) * 100).toFixed(1)}%`,
        tradeoff: `可能降低缓存命中率约 ${((this.baseConfig.cacheTTL - config.cacheTTL) / this.baseConfig.cacheTTL * 10).toFixed(1)}%`
      });
    }

    if (config.poolMaxSize < this.baseConfig.poolMaxSize) {
      improvements.push({
        type: 'pool_size_optimization',
        title: '缩小对象池',
        description: `将对象池最大容量从 ${this.baseConfig.poolMaxSize} 减少到 ${config.poolMaxSize}`,
        impact: `预计减少对象池内存占用约 ${((1 - config.poolMaxSize / this.baseConfig.poolMaxSize) * 100).toFixed(1)}%`,
        tradeoff: '可能增加对象创建开销'
      });
    }

    result.improvements = improvements;
  }

  runAllSimulations() {
    const simulations = {
      v8Flags: {
        scenarios: [],
        recommendation: null
      },
      cache: {
        scenarios: [],
        recommendation: null
      },
      objectPool: {
        scenarios: [],
        recommendation: null
      },
      batchProcessing: {
        scenarios: [],
        recommendation: null
      }
    };

    const v8Scenarios = [
      { maxOldSpaceSize: 256, label: '256MB (保守)' },
      { maxOldSpaceSize: 512, label: '512MB (推荐)' },
      { maxOldSpaceSize: 1024, label: '1GB (宽松)' },
      { maxOldSpaceSize: 2048, label: '2GB (大内存)' },
      { semiSpaceSize: 16, label: 'Semi-space 16MB' },
      { semiSpaceSize: 32, label: 'Semi-space 32MB' },
      { semiSpaceSize: 64, label: 'Semi-space 64MB' }
    ];

    for (const scenario of v8Scenarios) {
      simulations.v8Flags.scenarios.push({
        label: scenario.label,
        params: scenario,
        result: this.simulate(scenario)
      });
    }

    const cacheScenarios = [
      { cacheTTL: 60, label: 'TTL 60秒 (激进)' },
      { cacheTTL: 300, label: 'TTL 5分钟 (推荐)' },
      { cacheTTL: 1800, label: 'TTL 30分钟 (保守)' },
      { cacheTTL: 3600, label: 'TTL 1小时 (宽松)' }
    ];

    for (const scenario of cacheScenarios) {
      simulations.cache.scenarios.push({
        label: scenario.label,
        params: scenario,
        result: this.simulate(scenario)
      });
    }

    const poolScenarios = [
      { poolMaxSize: 100, label: '上限 100 (小)' },
      { poolMaxSize: 500, label: '上限 500 (推荐)' },
      { poolMaxSize: 1000, label: '上限 1000 (中)' },
      { poolMaxSize: 5000, label: '上限 5000 (大)' }
    ];

    for (const scenario of poolScenarios) {
      simulations.objectPool.scenarios.push({
        label: scenario.label,
        params: scenario,
        result: this.simulate(scenario)
      });
    }

    const batchScenarios = [
      { batchSize: 50, label: '批大小 50 (小)' },
      { batchSize: 100, label: '批大小 100 (推荐)' },
      { batchSize: 500, label: '批大小 500 (大)' },
      { batchSize: 1000, label: '批大小 1000 (超大)' }
    ];

    for (const scenario of batchScenarios) {
      simulations.batchProcessing.scenarios.push({
        label: scenario.label,
        params: scenario,
        result: this.simulate(scenario)
      });
    }

    simulations.v8Flags.recommendation = this.findBestScenario(simulations.v8Flags.scenarios);
    simulations.cache.recommendation = this.findBestScenario(simulations.cache.scenarios);
    simulations.objectPool.recommendation = this.findBestScenario(simulations.objectPool.scenarios);
    simulations.batchProcessing.recommendation = this.findBestScenario(simulations.batchProcessing.scenarios);

    return simulations;
  }

  findBestScenario(scenarios) {
    if (scenarios.length === 0) return null;

    let best = null;
    let bestScore = Infinity;

    for (const scenario of scenarios) {
      const result = scenario.result;
      let score = 0;

      score += result.estimatedPeakMemoryMB * 2;
      score += result.gcFrequency * 10;
      score += result.riskScore * 5;

      score += (1 - result.cacheEfficiency) * 100;
      score += (1 - result.poolEfficiency) * 100;
      score += (1 - result.batchEfficiency) * 100;

      if (score < bestScore) {
        bestScore = score;
        best = scenario;
      }
    }

    return best;
  }

  getRecommendations() {
    const recommendations = [];

    const baseResult = this.simulate({});

    if (baseResult.riskLevel === 'high' || baseResult.riskLevel === 'medium') {
      recommendations.push({
        priority: 'high',
        title: '调整 V8 内存参数',
        description: '当前配置存在内存风险，建议调整 max-old-space-size 和 semi-space-size',
        suggestedValues: {
          maxOldSpaceSize: Math.max(512, this.baseConfig.maxOldSpaceSize),
          semiSpaceSize: Math.max(32, this.baseConfig.semiSpaceSize)
        },
        expectedBenefit: '降低内存风险，减少 GC 压力'
      });
    }

    if (this.data.config?.caches?.some(c => c.ttl === null || c.maxSize === Infinity)) {
      recommendations.push({
        priority: 'high',
        title: '配置缓存限制',
        description: '发现无界缓存或无 TTL 缓存，这是内存泄漏的高风险',
        suggestedValues: {
          maxSize: 10000,
          ttl: 300
        },
        expectedBenefit: '防止缓存无限增长'
      });
    }

    if (this.data.config?.objectPools?.some(p => p.maxSize === Infinity)) {
      recommendations.push({
        priority: 'high',
        title: '配置对象池限制',
        description: '发现无界对象池，可能导致内存无限增长',
        suggestedValues: {
          maxSize: 500,
          idleTimeout: 60000
        },
        expectedBenefit: '防止对象池失控'
      });
    }

    if (baseResult.gcFrequency > 10) {
      recommendations.push({
        priority: 'medium',
        title: '减少 GC 频率',
        description: `当前 GC 频率较高 (${baseResult.gcFrequency.toFixed(1)}/min)`,
        suggestedValues: {
          maxOldSpaceSize: this.baseConfig.maxOldSpaceSize * 1.5,
          semiSpaceSize: this.baseConfig.semiSpaceSize * 1.5
        },
        expectedBenefit: '减少 GC 开销，提升性能'
      });
    }

    if (this.data.config?.weakRefUsage?.length > 0 || this.data.config?.finalizationRegistryUsage?.length > 0) {
      recommendations.push({
        priority: 'medium',
        title: '审查弱引用使用',
        description: '使用了 WeakRef 或 FinalizationRegistry，需要确保正确使用',
        checkList: [
          'WeakRef 是否同时持有强引用',
          'FinalizationRegistry 是否正确调用 unregister',
          '是否有更好的替代方案（如显式清理）'
        ]
      });
    }

    if (this.data.config?.batchProcessing?.some(b => b.maxPending === Infinity)) {
      recommendations.push({
        priority: 'medium',
        title: '配置批处理限制',
        description: '发现无界批处理队列，可能导致内存积压',
        suggestedValues: {
          maxPending: 10000,
          flushInterval: 5000
        },
        expectedBenefit: '防止批处理内存积压'
      });
    }

    recommendations.push({
      priority: 'low',
      title: '持续监控',
      description: '建议持续监控内存使用和 GC 情况',
      recommendedActions: [
        '开启 --trace-gc 日志',
        '定期采集 heap snapshot',
        '监控 RSS 和 Heap Used 指标',
        '设置内存告警阈值'
      ]
    });

    return recommendations;
  }
}

module.exports = Simulator;
