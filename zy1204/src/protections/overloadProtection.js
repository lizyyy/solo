class OverloadProtection {
  constructor(config) {
    this.name = config.name || 'default';
    this.maxConcurrency = config.maxConcurrency || 100;
    this.maxQueueSize = config.maxQueueSize || 50;
    this.queueTimeout = config.queueTimeout || 5000;
    this.fallbackEnabled = config.fallbackEnabled || true;
    this.latencyThreshold = config.latencyThreshold || 1000;
    this.adaptiveEnabled = config.adaptiveEnabled || false;
    this.minConcurrency = config.minConcurrency || 10;
    this.targetLatency = config.targetLatency || 500;
    
    this.currentConcurrency = 0;
    this.queue = [];
    this.latencyHistory = [];
    this.maxLatencyHistory = 100;
  }

  recordLatency(latency) {
    this.latencyHistory.push({
      latency,
      timestamp: Date.now()
    });
    
    if (this.latencyHistory.length > this.maxLatencyHistory) {
      this.latencyHistory.shift();
    }
    
    if (this.adaptiveEnabled) {
      this.adjustConcurrency();
    }
  }

  adjustConcurrency() {
    if (this.latencyHistory.length < 10) return;
    
    const recentLatencies = this.latencyHistory.slice(-10);
    const avgLatency = recentLatencies.reduce((sum, l) => sum + l.latency, 0) / recentLatencies.length;
    
    if (avgLatency > this.targetLatency * 1.5 && this.currentConcurrency > this.minConcurrency) {
      this.maxConcurrency = Math.max(this.minConcurrency, this.maxConcurrency - 5);
    } else if (avgLatency < this.targetLatency * 0.8) {
      this.maxConcurrency = Math.min(this.maxConcurrency + 5, this.maxConcurrency * 1.5);
    }
  }

  tryAcquire() {
    const now = Date.now();
    
    while (this.queue.length > 0) {
      const item = this.queue[0];
      if (now - item.timestamp > this.queueTimeout) {
        this.queue.shift();
      } else {
        break;
      }
    }
    
    if (this.currentConcurrency < this.maxConcurrency) {
      this.currentConcurrency++;
      return {
        allowed: true,
        action: 'allow',
        reason: '并发数未超限',
        concurrency: this.currentConcurrency,
        maxConcurrency: this.maxConcurrency
      };
    }
    
    if (this.queue.length < this.maxQueueSize) {
      const queuePosition = this.queue.length + 1;
      this.queue.push({ timestamp: now, position: queuePosition });
      return {
        allowed: false,
        action: 'queue',
        reason: `并发数已满，已加入队列（位置：${queuePosition}）`,
        queuePosition,
        concurrency: this.currentConcurrency,
        maxConcurrency: this.maxConcurrency
      };
    }
    
    return {
      allowed: false,
      action: this.fallbackEnabled ? 'fallback' : 'reject',
      reason: '并发数已满且队列已满',
      concurrency: this.currentConcurrency,
      maxConcurrency: this.maxConcurrency
    };
  }

  release() {
    this.currentConcurrency = Math.max(0, this.currentConcurrency - 1);
    
    while (this.currentConcurrency < this.maxConcurrency && this.queue.length > 0) {
      const item = this.queue.shift();
      this.currentConcurrency++;
      return {
        action: 'allow',
        waitTime: Date.now() - item.timestamp,
        queuePosition: item.position
      };
    }
    
    return null;
  }

  getStats() {
    const recentLatencies = this.latencyHistory.slice(-20);
    const avgLatency = recentLatencies.length > 0 
      ? recentLatencies.reduce((sum, l) => sum + l.latency, 0) / recentLatencies.length 
      : 0;
    
    return {
      name: this.name,
      currentConcurrency: this.currentConcurrency,
      maxConcurrency: this.maxConcurrency,
      queueSize: this.queue.length,
      maxQueueSize: this.maxQueueSize,
      avgLatency: Math.round(avgLatency),
      adaptiveEnabled: this.adaptiveEnabled
    };
  }
}

module.exports = OverloadProtection;
