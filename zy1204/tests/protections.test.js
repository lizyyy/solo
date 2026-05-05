const { CircuitBreaker, OverloadProtection, FallbackManager, ProtectionEngine } = require('../src/protections');

describe('保护机制测试', () => {
  describe('熔断器', () => {
    test('应该正确初始化熔断器', () => {
      const cb = new CircuitBreaker({
        failureThreshold: 0.5,
        minimumRequests: 10,
        halfOpenRequestLimit: 3,
        resetTimeout: 60000
      });
      
      const stats = cb.getStats();
      expect(stats.state).toBe('closed');
      expect(stats.failureRate).toBe(0);
    });
    
    test('应该在关闭状态下允许请求', () => {
      const cb = new CircuitBreaker({
        failureThreshold: 0.5,
        minimumRequests: 10,
        halfOpenRequestLimit: 3,
        resetTimeout: 60000
      });
      
      const result = cb.tryExecute();
      expect(result.allowed).toBe(true);
      expect(result.action).toBe('allow');
    });
    
    test('应该在失败率超过阈值时打开', () => {
      const cb = new CircuitBreaker({
        failureThreshold: 0.5,
        minimumRequests: 10,
        halfOpenRequestLimit: 3,
        resetTimeout: 60000
      });
      
      for (let i = 0; i < 10; i++) {
        cb.recordRequest(i < 6 ? false : true);
      }
      
      const stats = cb.getStats();
      expect(stats.state).toBe('open');
      
      const result = cb.tryExecute();
      expect(result.allowed).toBe(false);
      expect(result.action).toBe('fallback');
    });
    
    test('应该在重置超时后进入半开状态', () => {
      const cb = new CircuitBreaker({
        failureThreshold: 0.5,
        minimumRequests: 2,
        halfOpenRequestLimit: 1,
        resetTimeout: 100
      });
      
      cb.recordRequest(false);
      cb.recordRequest(false);
      
      expect(cb.getStats().state).toBe('open');
      
      const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      
      return wait(150).then(() => {
        const result = cb.tryExecute();
        expect(cb.getStats().state).toBe('half_open');
      });
    });
    
    test('应该在半开状态探测成功后关闭', () => {
      const cb = new CircuitBreaker({
        failureThreshold: 0.5,
        minimumRequests: 2,
        halfOpenRequestLimit: 2,
        resetTimeout: 60000
      });
      
      cb.state = 'half_open';
      cb.halfOpenRequests = 0;
      
      cb.tryExecute();
      cb.recordRequest(true);
      
      cb.tryExecute();
      cb.recordRequest(true);
      
      expect(cb.getStats().state).toBe('closed');
    });
    
    test('应该在半开状态探测失败后重新打开', () => {
      const cb = new CircuitBreaker({
        failureThreshold: 0.5,
        minimumRequests: 2,
        halfOpenRequestLimit: 2,
        resetTimeout: 60000
      });
      
      cb.state = 'half_open';
      cb.halfOpenRequests = 0;
      
      cb.tryExecute();
      cb.recordRequest(true);
      
      cb.tryExecute();
      cb.recordRequest(false);
      
      expect(cb.getStats().state).toBe('open');
    });
    
    test('未启用降级时应该拒绝请求', () => {
      const cb = new CircuitBreaker({
        failureThreshold: 0.5,
        minimumRequests: 2,
        halfOpenRequestLimit: 3,
        resetTimeout: 60000,
        fallbackEnabled: false
      });
      
      cb.recordRequest(false);
      cb.recordRequest(false);
      
      const result = cb.tryExecute();
      expect(result.action).toBe('reject');
    });
  });
  
  describe('过载保护', () => {
    test('应该正确初始化过载保护', () => {
      const op = new OverloadProtection({
        maxConcurrency: 100,
        maxQueueSize: 50
      });
      
      const stats = op.getStats();
      expect(stats.maxConcurrency).toBe(100);
      expect(stats.currentConcurrency).toBe(0);
      expect(stats.queueSize).toBe(0);
    });
    
    test('并发数未超限时应该允许请求', () => {
      const op = new OverloadProtection({
        maxConcurrency: 10,
        maxQueueSize: 50
      });
      
      const result = op.tryAcquire();
      expect(result.allowed).toBe(true);
      expect(result.action).toBe('allow');
      
      const stats = op.getStats();
      expect(stats.currentConcurrency).toBe(1);
    });
    
    test('并发数超限时应该加入队列', () => {
      const op = new OverloadProtection({
        maxConcurrency: 2,
        maxQueueSize: 5,
        queueTimeout: 5000
      });
      
      op.tryAcquire();
      op.tryAcquire();
      const result = op.tryAcquire();
      
      expect(result.allowed).toBe(false);
      expect(result.action).toBe('queue');
      expect(result.queuePosition).toBe(1);
    });
    
    test('队列满时应该拒绝', () => {
      const op = new OverloadProtection({
        maxConcurrency: 1,
        maxQueueSize: 1,
        queueTimeout: 5000
      });
      
      op.tryAcquire();
      op.tryAcquire();
      const result = op.tryAcquire();
      
      expect(result.allowed).toBe(false);
      expect(result.action).toBe('fallback');
    });
    
    test('未启用降级时队列满应该拒绝', () => {
      const op = new OverloadProtection({
        maxConcurrency: 1,
        maxQueueSize: 1,
        queueTimeout: 5000,
        fallbackEnabled: false
      });
      
      op.tryAcquire();
      op.tryAcquire();
      const result = op.tryAcquire();
      
      expect(result.action).toBe('reject');
    });
    
    test('释放时应该处理队列中的请求', () => {
      const op = new OverloadProtection({
        maxConcurrency: 1,
        maxQueueSize: 5,
        queueTimeout: 5000
      });
      
      op.tryAcquire();
      op.tryAcquire();
      
      const queueResult = op.release();
      
      expect(queueResult).not.toBeNull();
      expect(queueResult.action).toBe('allow');
    });
    
    test('应该记录延迟', () => {
      const op = new OverloadProtection({
        maxConcurrency: 100,
        maxQueueSize: 50
      });
      
      op.recordLatency(50);
      op.recordLatency(100);
      op.recordLatency(150);
      
      const stats = op.getStats();
      expect(stats.avgLatency).toBe(100);
    });
  });
  
  describe('降级管理器', () => {
    test('应该正确初始化降级管理器', () => {
      const fm = new FallbackManager({
        defaultValue: 'default-value'
      });
      
      const strategies = fm.getAvailableStrategies();
      expect(strategies).toContain('return_default');
      expect(strategies).toContain('return_cache');
      expect(strategies).toContain('return_error');
      expect(strategies).toContain('retry');
    });
    
    test('应该执行返回默认值策略', () => {
      const fm = new FallbackManager({
        defaultValue: 'my-default-value'
      });
      
      const result = fm.executeFallback({ url: '/api/test' }, 'return_default');
      
      expect(result.action).toBe('fallback');
      expect(result.result).toBe('my-default-value');
    });
    
    test('应该执行返回错误策略', () => {
      const fm = new FallbackManager();
      
      const result = fm.executeFallback({ url: '/api/test' }, 'return_error', {
        errorMessage: '服务暂时不可用',
        errorCode: 'SERVICE_DOWN'
      });
      
      expect(result.action).toBe('fallback');
      expect(result.result.error).toBe('服务暂时不可用');
      expect(result.result.code).toBe('SERVICE_DOWN');
    });
    
    test('应该执行重试策略', () => {
      const fm = new FallbackManager();
      
      const result = fm.executeFallback({ url: '/api/test' }, 'retry', {
        retryCount: 5,
        retryDelay: 2000
      });
      
      expect(result.action).toBe('fallback');
      expect(result.result.retry).toBe(true);
      expect(result.result.retryCount).toBe(5);
      expect(result.result.retryDelay).toBe(2000);
    });
    
    test('应该支持自定义策略', () => {
      const fm = new FallbackManager();
      
      fm.registerStrategy('custom_strategy', {
        description: '自定义降级策略',
        execute: (requestInfo, options) => ({
          custom: true,
          url: requestInfo.url,
          ...options
        }),
        details: { type: 'custom' }
      });
      
      const strategies = fm.getAvailableStrategies();
      expect(strategies).toContain('custom_strategy');
      
      const result = fm.executeFallback({ url: '/api/custom' }, 'custom_strategy', { foo: 'bar' });
      
      expect(result.action).toBe('fallback');
      expect(result.result.custom).toBe(true);
      expect(result.result.url).toBe('/api/custom');
    });
  });
  
  describe('保护引擎', () => {
    test('应该正确初始化保护引擎', () => {
      const engine = new ProtectionEngine();
      
      const stats = engine.getStats();
      expect(stats.circuitBreakers.length).toBe(0);
      expect(stats.overloadProtections.length).toBe(0);
      expect(stats.rateLimiters.length).toBe(0);
    });
    
    test('应该正确评估单个保护策略', () => {
      const engine = new ProtectionEngine();
      
      engine.addRateLimiter('api_rate_limit', 'token_bucket', {
        capacity: 5,
        rate: 1,
        initialTokens: 5,
        queueEnabled: false
      });
      
      for (let i = 0; i < 5; i++) {
        const result = engine.evaluateSingleProtection(
          { url: '/api/test' },
          { type: 'rate_limit', name: 'api_rate_limit' }
        );
        expect(result.allowed).toBe(true);
      }
      
      const rejectResult = engine.evaluateSingleProtection(
        { url: '/api/test' },
        { type: 'rate_limit', name: 'api_rate_limit' }
      );
      expect(rejectResult.allowed).toBe(false);
      expect(rejectResult.action).toBe('reject');
    });
    
    test('应该正确评估多个保护策略', () => {
      const engine = new ProtectionEngine();
      
      engine.addRateLimiter('api_rate_limit', 'token_bucket', {
        capacity: 100,
        rate: 10,
        initialTokens: 100,
        queueEnabled: false
      });
      
      engine.addCircuitBreaker('user_service_circuit', {
        failureThreshold: 0.5,
        minimumRequests: 10,
        halfOpenRequestLimit: 3,
        resetTimeout: 60000,
        fallbackEnabled: true
      });
      
      const result = engine.evaluateRequest(
        { url: '/api/users', method: 'GET' },
        [
          { type: 'rate_limit', name: 'api_rate_limit' },
          { type: 'circuit_breaker', name: 'user_service_circuit' }
        ]
      );
      
      expect(result.finalAction).toBe('allow');
    });
    
    test('应该优先触发拒绝策略', () => {
      const engine = new ProtectionEngine();
      
      engine.addRateLimiter('strict_rate_limit', 'token_bucket', {
        capacity: 0,
        rate: 0,
        initialTokens: 0,
        queueEnabled: false
      });
      
      engine.addCircuitBreaker('user_service_circuit', {
        failureThreshold: 0.5,
        minimumRequests: 10,
        halfOpenRequestLimit: 3,
        resetTimeout: 60000,
        fallbackEnabled: true
      });
      
      const result = engine.evaluateRequest(
        { url: '/api/users', method: 'GET' },
        [
          { type: 'rate_limit', name: 'strict_rate_limit' },
          { type: 'circuit_breaker', name: 'user_service_circuit' }
        ]
      );
      
      expect(result.finalAction).toBe('reject');
    });
  });
});
