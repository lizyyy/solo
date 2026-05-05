class SlidingWindow {
  constructor(config) {
    this.windowSize = config.windowSize || 60;
    this.maxRequests = config.maxRequests || 100;
    this.requests = [];
    this.queueEnabled = config.queueEnabled || false;
    this.maxQueueSize = config.maxQueueSize || 50;
    this.queue = [];
  }

  cleanOldRequests(now = Date.now()) {
    const cutoff = now - (this.windowSize * 1000);
    this.requests = this.requests.filter(timestamp => timestamp > cutoff);
  }

  tryRequest(timestamp = Date.now()) {
    this.cleanOldRequests(timestamp);
    
    if (this.requests.length < this.maxRequests) {
      this.requests.push(timestamp);
      return {
        allowed: true,
        action: 'allow',
        reason: '滑动窗口内请求数未超限',
        currentCount: this.requests.length,
        maxRequests: this.maxRequests
      };
    }
    
    if (this.queueEnabled && this.queue.length < this.maxQueueSize) {
      const queuePosition = this.queue.length + 1;
      this.queue.push({ timestamp, requestTime: timestamp });
      return {
        allowed: false,
        action: 'queue',
        reason: `滑动窗口已满，已加入队列（位置：${queuePosition}）`,
        queuePosition,
        currentCount: this.requests.length,
        maxRequests: this.maxRequests
      };
    }
    
    return {
      allowed: false,
      action: 'reject',
      reason: '滑动窗口已满且队列已满',
      currentCount: this.requests.length,
      maxRequests: this.maxRequests
    };
  }

  processQueue(now = Date.now()) {
    const processed = [];
    this.cleanOldRequests(now);
    
    while (this.queue.length > 0 && this.requests.length < this.maxRequests) {
      const item = this.queue[0];
      this.requests.push(now);
      const waitTime = now - item.requestTime;
      processed.push({
        ...item,
        waitTime,
        action: 'allow'
      });
      this.queue.shift();
    }
    return processed;
  }

  getStats(now = Date.now()) {
    this.cleanOldRequests(now);
    return {
      windowSize: this.windowSize,
      maxRequests: this.maxRequests,
      currentCount: this.requests.length,
      queueSize: this.queue.length,
      maxQueueSize: this.maxQueueSize
    };
  }
}

module.exports = SlidingWindow;
