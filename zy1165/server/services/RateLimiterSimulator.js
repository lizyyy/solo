class TokenBucket {
  constructor(rate, capacity) {
    this.rate = rate;
    this.capacity = capacity;
    this.tokens = capacity;
    this.lastTime = Date.now();
  }

  _refill(currentTime) {
    const elapsed = (currentTime - this.lastTime) / 1000;
    const tokensToAdd = elapsed * this.rate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastTime = currentTime;
  }

  tryConsume(tokens = 1) {
    const currentTime = Date.now();
    this._refill(currentTime);
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return { allowed: true, waitTime: 0 };
    }
    
    const tokensNeeded = tokens - this.tokens;
    const waitTime = (tokensNeeded / this.rate) * 1000;
    return { allowed: false, waitTime };
  }

  getTokens() {
    return this.tokens;
  }
}

class LeakyBucket {
  constructor(leakRate, capacity, queueLength, timeout) {
    this.leakRate = leakRate;
    this.capacity = capacity;
    this.queueLength = queueLength;
    this.timeout = timeout;
    this.water = 0;
    this.queue = [];
    this.lastLeakTime = Date.now();
  }

  _leak(currentTime) {
    const elapsed = (currentTime - this.lastLeakTime) / 1000;
    const amountToLeak = elapsed * this.leakRate;
    this.water = Math.max(0, this.water - amountToLeak);
    this.lastLeakTime = currentTime;
  }

  tryAdd(request) {
    const currentTime = Date.now();
    this._leak(currentTime);
    
    if (this.water < this.capacity) {
      this.water += 1;
      const processTime = this.water / this.leakRate * 1000;
      return { allowed: true, waitTime: processTime, queued: false };
    }
    
    if (this.queue.length < this.queueLength) {
      const queuePosition = this.queue.length + 1;
      const waitTime = ((this.water + queuePosition) / this.leakRate) * 1000;
      
      if (waitTime > this.timeout) {
        return { allowed: false, waitTime: 0, queued: false, timeout: true };
      }
      
      this.queue.push({ request, enqueueTime: currentTime });
      return { allowed: false, waitTime, queued: true };
    }
    
    return { allowed: false, waitTime: 0, queued: false, rejected: true };
  }

  getWater() {
    return this.water;
  }

  getQueueLength() {
    return this.queue.length;
  }
}

class RateLimiterSimulator {
  constructor() {
    this.latencyRanges = [
      { min: 0, max: 10, range: '0-10' },
      { min: 10, max: 50, range: '10-50' },
      { min: 50, max: 100, range: '50-100' },
      { min: 100, max: 500, range: '100-500' },
      { min: 500, max: 1000, range: '500-1000' },
      { min: 1000, max: Infinity, range: '>1000' }
    ];
  }

  runSimulation(config) {
    this._validateConfig(config);
    
    const requests = this._generateRequests(config);
    
    const tokenBucketResult = this._simulateTokenBucket(requests, config);
    const leakyBucketResult = this._simulateLeakyBucket(requests, config);
    
    return {
      tokenBucket: tokenBucketResult,
      leakyBucket: leakyBucketResult,
      requests: requests.map(r => ({ time: r.time, index: r.index }))
    };
  }

  _validateConfig(config) {
    const errors = [];
    
    if (!config.totalRequests || config.totalRequests <= 0) {
      errors.push('总请求数必须大于0');
    }
    if (!config.tokenRate || config.tokenRate <= 0) {
      errors.push('令牌生成速率必须大于0');
    }
    if (!config.tokenCapacity || config.tokenCapacity <= 0) {
      errors.push('令牌桶容量必须大于0');
    }
    if (!config.leakRate || config.leakRate <= 0) {
      errors.push('漏出速率必须大于0');
    }
    if (!config.leakCapacity || config.leakCapacity <= 0) {
      errors.push('漏桶容量必须大于0');
    }
    if (config.queueLength === undefined || config.queueLength < 0) {
      errors.push('队列长度不能为负数');
    }
    if (config.timeout === undefined || config.timeout < 0) {
      errors.push('超时时间不能为负数');
    }
    
    if (errors.length > 0) {
      throw new Error('配置错误: ' + errors.join('; '));
    }
  }

  _generateRequests(config) {
    const { totalRequests, burstDuration, burstRate, steadyDuration, steadyRate, seed } = config;
    const requests = [];
    let time = 0;
    let index = 0;
    
    const random = this._createRandom(seed);
    
    const burstRequests = Math.min(totalRequests, Math.floor(burstDuration * burstRate));
    for (let i = 0; i < burstRequests; i++) {
      const interval = 1000 / burstRate * (0.8 + random() * 0.4);
      time += interval;
      requests.push({ time, index: index++ });
    }
    
    const steadyRequests = Math.min(totalRequests - burstRequests, Math.floor(steadyDuration * steadyRate));
    for (let i = 0; i < steadyRequests; i++) {
      const interval = 1000 / steadyRate * (0.8 + random() * 0.4);
      time += interval;
      requests.push({ time, index: index++ });
    }
    
    return requests;
  }

  _createRandom(seed) {
    if (seed) {
      let s = seed;
      return () => {
        s = Math.sin(s * 9999) * 9999;
        return s - Math.floor(s);
      };
    }
    return Math.random;
  }

  _simulateTokenBucket(requests, config) {
    const { tokenRate, tokenCapacity } = config;
    const bucket = new TokenBucket(tokenRate, tokenCapacity);
    
    const timeline = [];
    const tokenLevels = [];
    const latencies = [];
    const stats = {
      total: requests.length,
      allowed: 0,
      queued: 0,
      rejected: 0,
      timeout: 0,
      avgLatency: 0,
      maxLatency: 0
    };
    
    let totalLatency = 0;
    let maxLatency = 0;
    
    requests.forEach((request, i) => {
      const result = bucket.tryConsume(1);
      
      tokenLevels.push({
        time: request.time,
        tokens: bucket.getTokens()
      });
      
      if (result.allowed) {
        stats.allowed++;
        timeline.push({
          time: request.time,
          status: 'allowed',
          latency: result.waitTime,
          algorithm: 'token-bucket'
        });
        latencies.push(result.waitTime);
        totalLatency += result.waitTime;
        if (result.waitTime > maxLatency) maxLatency = result.waitTime;
      } else {
        stats.rejected++;
        timeline.push({
          time: request.time,
          status: 'rejected',
          latency: 0,
          algorithm: 'token-bucket'
        });
      }
    });
    
    stats.avgLatency = stats.allowed > 0 ? totalLatency / stats.allowed : 0;
    stats.maxLatency = maxLatency;
    
    return {
      stats,
      timeline,
      tokenLevels,
      latencyDistribution: this._calculateLatencyDistribution(latencies)
    };
  }

  _simulateLeakyBucket(requests, config) {
    const { leakRate, leakCapacity, queueLength, timeout } = config;
    const bucket = new LeakyBucket(leakRate, leakCapacity, queueLength, timeout);
    
    const timeline = [];
    const waterLevels = [];
    const latencies = [];
    const stats = {
      total: requests.length,
      allowed: 0,
      queued: 0,
      rejected: 0,
      timeout: 0,
      avgLatency: 0,
      maxLatency: 0
    };
    
    let totalLatency = 0;
    let maxLatency = 0;
    
    requests.forEach((request, i) => {
      const result = bucket.tryAdd(request);
      
      waterLevels.push({
        time: request.time,
        water: bucket.getWater(),
        queueLength: bucket.getQueueLength()
      });
      
      if (result.allowed) {
        stats.allowed++;
        timeline.push({
          time: request.time,
          status: 'allowed',
          latency: result.waitTime,
          algorithm: 'leaky-bucket'
        });
        latencies.push(result.waitTime);
        totalLatency += result.waitTime;
        if (result.waitTime > maxLatency) maxLatency = result.waitTime;
      } else if (result.queued) {
        stats.queued++;
        timeline.push({
          time: request.time,
          status: 'queued',
          latency: result.waitTime,
          algorithm: 'leaky-bucket'
        });
        latencies.push(result.waitTime);
        totalLatency += result.waitTime;
        if (result.waitTime > maxLatency) maxLatency = result.waitTime;
      } else if (result.timeout) {
        stats.timeout++;
        timeline.push({
          time: request.time,
          status: 'timeout',
          latency: 0,
          algorithm: 'leaky-bucket'
        });
      } else {
        stats.rejected++;
        timeline.push({
          time: request.time,
          status: 'rejected',
          latency: 0,
          algorithm: 'leaky-bucket'
        });
      }
    });
    
    const processedCount = stats.allowed + stats.queued;
    stats.avgLatency = processedCount > 0 ? totalLatency / processedCount : 0;
    stats.maxLatency = maxLatency;
    
    return {
      stats,
      timeline,
      waterLevels,
      latencyDistribution: this._calculateLatencyDistribution(latencies)
    };
  }

  _calculateLatencyDistribution(latencies) {
    const distribution = this.latencyRanges.map(r => ({ range: r.range, count: 0 }));
    
    latencies.forEach(latency => {
      for (let i = 0; i < this.latencyRanges.length; i++) {
        const range = this.latencyRanges[i];
        if (latency >= range.min && latency < range.max) {
          distribution[i].count++;
          break;
        }
      }
    });
    
    return distribution;
  }
}

module.exports = RateLimiterSimulator;
