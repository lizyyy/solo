const fs = require('fs');

class RequestSimulator {
  constructor(options = {}) {
    this.requestsFile = options.requestsFile || null;
    this.requests = [];
    this.latencyBaseline = options.latencyBaseline || 50;
  }

  loadRequests(filePath) {
    this.requestsFile = filePath;
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    this.requests = Array.isArray(data) ? data : data.requests || [];
    return this.requests;
  }

  getRequests() {
    return this.requests;
  }

  isRequestApplicable(request, config) {
    const requirements = request.requires || {};
    
    for (const [key, value] of Object.entries(requirements)) {
      const configValue = this._getNestedValue(config, key);
      if (JSON.stringify(configValue) !== JSON.stringify(value)) {
        return false;
      }
    }
    
    return true;
  }

  simulateRequest(request, config) {
    if (!this.isRequestApplicable(request, config)) {
      return {
        applicable: false,
        result: null,
        latency: 0,
        rulesHit: [],
        reason: '请求样本不适用于此配置版本'
      };
    }

    const result = {
      applicable: true,
      result: {},
      latency: this.latencyBaseline,
      rulesHit: []
    };

    this._checkRateLimiting(request, config, result);
    this._checkRecommendation(request, config, result);
    this._checkCaching(request, config, result);

    return result;
  }

  _checkRateLimiting(request, config, result) {
    const rateLimit = config.rateLimit || {};
    
    if (!rateLimit.enabled) {
      result.rulesHit.push({
        rule: 'rate_limit_disabled',
        effect: '无限制',
        latencyDelta: 0
      });
      return;
    }

    const threshold = rateLimit.threshold || 100;
    const windowMs = rateLimit.windowMs || 60000;
    const requestCount = request.metadata?.requestCount || 0;

    result.result.rateLimited = requestCount > threshold;

    if (requestCount > threshold) {
      result.rulesHit.push({
        rule: 'rate_limit_triggered',
        effect: '请求被限流',
        threshold,
        requestCount,
        latencyDelta: 5
      });
      result.latency += 5;
    } else {
      const checkOverhead = this._calculateCheckOverhead(threshold);
      result.rulesHit.push({
        rule: 'rate_limit_check',
        effect: '通过限流检查',
        threshold,
        requestCount,
        latencyDelta: checkOverhead
      });
      result.latency += checkOverhead;
    }
  }

  _calculateCheckOverhead(threshold) {
    if (threshold <= 10) return 2;
    if (threshold <= 50) return 5;
    if (threshold <= 200) return 10;
    if (threshold <= 500) return 20;
    return 30;
  }

  _checkRecommendation(request, config, result) {
    const recommendation = config.recommendation || {};
    
    if (!recommendation.enabled) {
      result.rulesHit.push({
        rule: 'recommendation_disabled',
        effect: '推荐功能关闭',
        latencyDelta: 0
      });
      result.result.recommendations = [];
      return;
    }

    const algorithm = recommendation.algorithm || 'simple';
    const maxResults = recommendation.maxResults || 10;
    
    let latencyDelta = 0;
    let effect = '';

    switch (algorithm) {
      case 'simple':
        latencyDelta = 15;
        effect = '使用简单推荐算法';
        break;
      case 'collaborative':
        latencyDelta = 50;
        effect = '使用协同过滤算法';
        break;
      case 'deep_learning':
        latencyDelta = 150;
        effect = '使用深度学习模型';
        break;
      case 'hybrid':
        latencyDelta = 100;
        effect = '使用混合推荐算法';
        break;
      default:
        latencyDelta = 20;
        effect = '使用默认推荐算法';
    }

    if (recommendation.personalization) {
      latencyDelta += 30;
      effect += '（含个性化）';
    }

    if (recommendation.realTime) {
      latencyDelta += 50;
      effect += '（实时更新）';
    }

    result.latency += latencyDelta;
    result.rulesHit.push({
      rule: 'recommendation_enabled',
      effect,
      algorithm,
      maxResults,
      latencyDelta
    });

    result.result.recommendations = {
      count: Math.min(maxResults, 5),
      algorithm
    };
  }

  _checkCaching(request, config, result) {
    const caching = config.caching || {};
    
    if (!caching.enabled) {
      result.rulesHit.push({
        rule: 'caching_disabled',
        effect: '缓存功能关闭',
        latencyDelta: 0
      });
      result.result.cacheHit = false;
      return;
    }

    const ttl = caching.ttl || 300;
    const requestId = request.id || '';
    const isCacheable = this._isCacheable(request, caching);

    if (!isCacheable) {
      result.rulesHit.push({
        rule: 'caching_not_applicable',
        effect: '请求不可缓存',
        latencyDelta: 5
      });
      result.latency += 5;
      result.result.cacheHit = false;
      return;
    }

    const cacheHitChance = this._calculateCacheHitChance(ttl);
    const isHit = request.metadata?.cacheState === 'hit' || Math.random() < cacheHitChance;
    
    let latencyDelta = 0;
    if (isHit) {
      latencyDelta = -Math.max(0, result.latency - this.latencyBaseline - 10);
      result.rulesHit.push({
        rule: 'cache_hit',
        effect: '缓存命中',
        ttl,
        latencyDelta
      });
    } else {
      const cacheWriteOverhead = ttl > 3600 ? 15 : (ttl > 60 ? 10 : 5);
      latencyDelta = cacheWriteOverhead;
      result.rulesHit.push({
        rule: 'cache_miss',
        effect: '缓存未命中',
        ttl,
        latencyDelta
      });
    }

    result.latency += latencyDelta;
    result.latency = Math.max(5, result.latency);
    result.result.cacheHit = isHit;
    result.result.cacheTtl = ttl;
  }

  _isCacheable(request, caching) {
    const method = request.method?.toUpperCase() || 'GET';
    const path = request.path || '';
    
    if (caching.methods && !caching.methods.includes(method)) {
      return false;
    }
    
    if (caching.excludePaths) {
      for (const excludePattern of caching.excludePaths) {
        if (path.includes(excludePattern)) {
          return false;
        }
      }
    }
    
    return true;
  }

  _calculateCacheHitChance(ttl) {
    if (ttl <= 0) return 0;
    if (ttl < 60) return 0.3;
    if (ttl < 300) return 0.5;
    if (ttl < 3600) return 0.7;
    if (ttl < 86400) return 0.85;
    return 0.95;
  }

  _getNestedValue(obj, keyPath) {
    if (!keyPath) return undefined;
    const keys = keyPath.split('.');
    let current = obj;
    for (const key of keys) {
      if (current === undefined || current === null) return undefined;
      current = current[key];
    }
    return current;
  }

  simulateAllRequests(config) {
    const results = [];
    let totalLatency = 0;
    let applicableCount = 0;

    for (const request of this.requests) {
      const simulation = this.simulateRequest(request, config);
      results.push({
        requestId: request.id,
        ...simulation
      });

      if (simulation.applicable) {
        totalLatency += simulation.latency;
        applicableCount++;
      }
    }

    return {
      results,
      summary: {
        total: this.requests.length,
        applicable: applicableCount,
        notApplicable: this.requests.length - applicableCount,
        avgLatency: applicableCount > 0 ? totalLatency / applicableCount : 0,
        totalLatency
      }
    };
  }
}

module.exports = RequestSimulator;
