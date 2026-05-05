class TokenBucket {
  constructor(config) {
    this.capacity = config.capacity || 100;
    this.rate = config.rate || 10;
    this.tokens = config.initialTokens || this.capacity;
    this.lastRefillTime = Date.now();
    this.queueEnabled = config.queueEnabled || false;
    this.maxQueueSize = config.maxQueueSize || 50;
    this.queue = [];
  }

  refill() {
    const now = Date.now();
    const timePassed = (now - this.lastRefillTime) / 1000;
    const tokensToAdd = timePassed * this.rate;
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefillTime = now;
    }
  }

  tryConsume(tokens = 1) {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return {
        allowed: true,
        action: 'allow',
        reason: '令牌桶有足够令牌',
        tokensRemaining: this.tokens
      };
    }
    
    if (this.queueEnabled && this.queue.length < this.maxQueueSize) {
      const queuePosition = this.queue.length + 1;
      this.queue.push({ tokens, timestamp: Date.now() });
      return {
        allowed: false,
        action: 'queue',
        reason: `令牌不足，已加入队列（位置：${queuePosition}）`,
        queuePosition,
        tokensRemaining: this.tokens
      };
    }
    
    return {
      allowed: false,
      action: 'reject',
      reason: '令牌桶已满且队列已满',
      tokensRemaining: this.tokens
    };
  }

  processQueue() {
    const processed = [];
    while (this.queue.length > 0 && this.tokens > 0) {
      const item = this.queue[0];
      if (this.tokens >= item.tokens) {
        this.tokens -= item.tokens;
        const waitTime = Date.now() - item.timestamp;
        processed.push({
          ...item,
          waitTime,
          action: 'allow'
        });
        this.queue.shift();
      } else {
        break;
      }
    }
    return processed;
  }

  getStats() {
    return {
      capacity: this.capacity,
      rate: this.rate,
      tokens: this.tokens,
      queueSize: this.queue.length,
      maxQueueSize: this.maxQueueSize
    };
  }
}

module.exports = TokenBucket;
