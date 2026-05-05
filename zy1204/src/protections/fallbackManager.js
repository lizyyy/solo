class FallbackManager {
  constructor(config = {}) {
    this.fallbackStrategies = new Map();
    this.defaultStrategy = config.defaultStrategy || 'return_default';
    this.defaultValue = config.defaultValue || null;
  }

  registerStrategy(name, strategy) {
    this.fallbackStrategies.set(name, strategy);
  }

  executeFallback(requestInfo, strategyName, options = {}) {
    const strategy = this.fallbackStrategies.get(strategyName) || 
                     this.getDefaultStrategy(strategyName);
    
    if (!strategy) {
      return {
        action: 'fallback',
        strategy: 'none',
        reason: '未找到降级策略',
        result: null
      };
    }
    
    try {
      const result = strategy.execute(requestInfo, options);
      return {
        action: 'fallback',
        strategy: strategyName,
        reason: strategy.description || '执行降级策略',
        result,
        details: strategy.details || {}
      };
    } catch (error) {
      return {
        action: 'reject',
        strategy: strategyName,
        reason: `降级策略执行失败: ${error.message}`,
        error: error.message
      };
    }
  }

  getDefaultStrategy(strategyName) {
    const strategies = {
      return_default: {
        description: '返回默认值',
        execute: (requestInfo, options) => options.defaultValue || this.defaultValue,
        details: { type: 'return_default' }
      },
      return_cache: {
        description: '返回缓存数据',
        execute: (requestInfo, options) => {
          if (options.cache && options.cacheKey) {
            return options.cache.get(options.cacheKey);
          }
          return null;
        },
        details: { type: 'return_cache' }
      },
      return_error: {
        description: '返回错误信息',
        execute: (requestInfo, options) => ({
          error: options.errorMessage || '服务暂时不可用，请稍后重试',
          code: options.errorCode || 'SERVICE_UNAVAILABLE'
        }),
        details: { type: 'return_error' }
      },
      retry: {
        description: '重试请求',
        execute: (requestInfo, options) => ({
          retry: true,
          retryCount: options.retryCount || 3,
          retryDelay: options.retryDelay || 1000
        }),
        details: { type: 'retry' }
      }
    };
    
    return strategies[strategyName] || strategies.return_default;
  }

  getAvailableStrategies() {
    const builtIn = ['return_default', 'return_cache', 'return_error', 'retry'];
    const custom = Array.from(this.fallbackStrategies.keys());
    return [...new Set([...builtIn, ...custom])];
  }
}

module.exports = FallbackManager;
