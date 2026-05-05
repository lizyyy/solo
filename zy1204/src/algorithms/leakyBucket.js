class LeakyBucket {
  constructor(config) {
    this.capacity = config.capacity || 100;
    this.rate = config.rate || 10;
    this.water = 0;
    this.lastLeakTime = Date.now();
    this.queueEnabled = config.queueEnabled || false;
    this.maxQueueSize = config.maxQueueSize || 50;
    this.queue = [];
  }

  leak() {
    const now = Date.now();
    const timePassed = (now - this.lastLeakTime) / 1000;
    const waterToLeak = timePassed * this.rate;
    
    if (waterToLeak > 0) {
      this.water = Math.max(0, this.water - waterToLeak);
      this.lastLeakTime = now;
    }
  }

  tryAdd(waterAmount = 1) {
    this.leak();
    
    if (this.water + waterAmount <= this.capacity) {
      this.water += waterAmount;
      return {
        allowed: true,
        action: 'allow',
        reason: '漏桶有足够空间',
        waterLevel: this.water
      };
    }
    
    if (this.queueEnabled && this.queue.length < this.maxQueueSize) {
      const queuePosition = this.queue.length + 1;
      this.queue.push({ waterAmount, timestamp: Date.now() });
      return {
        allowed: false,
        action: 'queue',
        reason: `漏桶已满，已加入队列（位置：${queuePosition}）`,
        queuePosition,
        waterLevel: this.water
      };
    }
    
    return {
      allowed: false,
      action: 'reject',
      reason: '漏桶已满且队列已满',
      waterLevel: this.water
    };
  }

  processQueue() {
    const processed = [];
    while (this.queue.length > 0) {
      this.leak();
      const item = this.queue[0];
      if (this.water + item.waterAmount <= this.capacity) {
        this.water += item.waterAmount;
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
      waterLevel: this.water,
      queueSize: this.queue.length,
      maxQueueSize: this.maxQueueSize
    };
  }
}

module.exports = LeakyBucket;
