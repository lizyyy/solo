class CircuitBreaker {
  constructor(config) {
    this.name = config.name || 'default';
    this.failureThreshold = config.failureThreshold || 0.5;
    this.minimumRequests = config.minimumRequests || 10;
    this.halfOpenRequestLimit = config.halfOpenRequestLimit || 3;
    this.resetTimeout = config.resetTimeout || 60000;
    this.fallbackEnabled = config.fallbackEnabled || true;
    this.fallbackMethod = config.fallbackMethod || null;
    
    this.state = 'closed';
    this.requests = [];
    this.lastFailureTime = null;
    this.halfOpenRequests = 0;
  }

  recordRequest(success, latency = 0) {
    const now = Date.now();
    this.requests.push({
      success,
      latency,
      timestamp: now
    });
    
    if (!success) {
      this.lastFailureTime = now;
    }
    
    this.evaluateState(now);
  }

  evaluateState(now = Date.now()) {
    if (this.state === 'open') {
      if (now - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'half_open';
        this.halfOpenRequests = 0;
      }
      return;
    }
    
    if (this.state === 'half_open') {
      if (this.halfOpenRequests >= this.halfOpenRequestLimit) {
        const recentFailures = this.requests
          .slice(-this.halfOpenRequestLimit)
          .filter(r => !r.success).length;
        
        if (recentFailures === 0) {
          this.state = 'closed';
          this.requests = [];
        } else {
          this.state = 'open';
          this.lastFailureTime = now;
        }
      }
      return;
    }
    
    if (this.requests.length >= this.minimumRequests) {
      const recentRequests = this.requests.slice(-this.minimumRequests);
      const failureCount = recentRequests.filter(r => !r.success).length;
      const failureRate = failureCount / this.minimumRequests;
      
      if (failureRate >= this.failureThreshold) {
        this.state = 'open';
        this.lastFailureTime = now;
      }
    }
  }

  tryExecute() {
    const now = Date.now();
    this.evaluateState(now);
    
    if (this.state === 'open') {
      return {
        allowed: false,
        action: this.fallbackEnabled ? 'fallback' : 'reject',
        reason: '熔断器已打开',
        circuitState: this.state,
        canTryAfter: this.resetTimeout - (now - this.lastFailureTime)
      };
    }
    
    if (this.state === 'half_open') {
      if (this.halfOpenRequests >= this.halfOpenRequestLimit) {
        return {
          allowed: false,
          action: this.fallbackEnabled ? 'fallback' : 'reject',
          reason: '半开状态下探测请求已达上限',
          circuitState: this.state
        };
      }
      this.halfOpenRequests++;
    }
    
    return {
      allowed: true,
      action: 'allow',
      reason: '熔断器允许请求',
      circuitState: this.state
    };
  }

  getStats() {
    const totalRequests = this.requests.length;
    const successCount = this.requests.filter(r => r.success).length;
    const failureCount = totalRequests - successCount;
    
    return {
      name: this.name,
      state: this.state,
      totalRequests,
      successCount,
      failureCount,
      failureRate: totalRequests > 0 ? failureCount / totalRequests : 0,
      lastFailureTime: this.lastFailureTime,
      halfOpenRequests: this.halfOpenRequests
    };
  }
}

module.exports = CircuitBreaker;
