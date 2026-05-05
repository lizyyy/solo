const CircuitBreaker = require('./circuitBreaker');
const OverloadProtection = require('./overloadProtection');
const FallbackManager = require('./fallbackManager');

class ProtectionEngine {
  constructor(config = {}) {
    this.circuitBreakers = new Map();
    this.overloadProtectors = new Map();
    this.fallbackManager = new FallbackManager(config.fallback || {});
    this.rateLimiters = new Map();
  }

  addCircuitBreaker(name, config) {
    const cb = new CircuitBreaker({ name, ...config });
    this.circuitBreakers.set(name, cb);
    return cb;
  }

  addOverloadProtection(name, config) {
    const op = new OverloadProtection({ name, ...config });
    this.overloadProtectors.set(name, op);
    return op;
  }

  addRateLimiter(name, type, config) {
    const { createRateLimiter } = require('../algorithms');
    const rl = createRateLimiter(type, config);
    this.rateLimiters.set(name, { type, instance: rl });
    return rl;
  }

  evaluateRequest(requestInfo, protectionConfigs) {
    const results = [];
    let finalAction = 'allow';
    let finalReason = '所有策略检查通过';
    let triggeredPolicy = null;
    
    for (const config of protectionConfigs) {
      const result = this.evaluateSingleProtection(requestInfo, config);
      results.push(result);
      
      if (!result.allowed) {
        if (result.action === 'reject') {
          finalAction = 'reject';
          finalReason = result.reason;
          triggeredPolicy = config;
          break;
        } else if (result.action === 'fallback' && finalAction === 'allow') {
          finalAction = 'fallback';
          finalReason = result.reason;
          triggeredPolicy = config;
        } else if (result.action === 'queue' && finalAction === 'allow') {
          finalAction = 'queue';
          finalReason = result.reason;
          triggeredPolicy = config;
        }
      }
    }
    
    return {
      finalAction,
      finalReason,
      triggeredPolicy,
      allResults: results
    };
  }

  evaluateSingleProtection(requestInfo, config) {
    const { type, name } = config;
    
    switch (type) {
      case 'rate_limit': {
        const rlInfo = this.rateLimiters.get(name);
        if (!rlInfo) {
          return { allowed: true, action: 'allow', reason: '限流策略不存在' };
        }
        
        const { type: rlType, instance } = rlInfo;
        let result;
        
        switch (rlType) {
          case 'token_bucket':
            result = instance.tryConsume(config.tokens || 1);
            break;
          case 'leaky_bucket':
            result = instance.tryAdd(config.waterAmount || 1);
            break;
          case 'sliding_window':
            result = instance.tryRequest(requestInfo.timestamp || Date.now());
            break;
          default:
            result = { allowed: true, action: 'allow', reason: '未知限流类型' };
        }
        
        return { ...result, policyType: 'rate_limit', policyName: name };
      }
      
      case 'circuit_breaker': {
        const cb = this.circuitBreakers.get(name);
        if (!cb) {
          return { allowed: true, action: 'allow', reason: '熔断器不存在' };
        }
        const result = cb.tryExecute();
        return { ...result, policyType: 'circuit_breaker', policyName: name };
      }
      
      case 'overload_protection': {
        const op = this.overloadProtectors.get(name);
        if (!op) {
          return { allowed: true, action: 'allow', reason: '过载保护不存在' };
        }
        const result = op.tryAcquire();
        return { ...result, policyType: 'overload_protection', policyName: name };
      }
      
      case 'fallback': {
        return {
          allowed: false,
          action: 'fallback',
          reason: config.reason || '触发降级策略',
          policyType: 'fallback',
          policyName: name
        };
      }
      
      default:
        return { allowed: true, action: 'allow', reason: '未知保护类型' };
    }
  }

  getStats() {
    return {
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([name, cb]) => ({
        name,
        ...cb.getStats()
      })),
      overloadProtections: Array.from(this.overloadProtectors.entries()).map(([name, op]) => ({
        name,
        ...op.getStats()
      })),
      rateLimiters: Array.from(this.rateLimiters.entries()).map(([name, rl]) => ({
        name,
        type: rl.type,
        ...rl.instance.getStats()
      }))
    };
  }
}

module.exports = {
  CircuitBreaker,
  OverloadProtection,
  FallbackManager,
  ProtectionEngine
};
