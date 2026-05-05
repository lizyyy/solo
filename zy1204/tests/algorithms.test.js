const { TokenBucket, LeakyBucket, SlidingWindow } = require('../src/algorithms');

describe('限流算法测试', () => {
  describe('令牌桶算法', () => {
    test('应该正确初始化令牌桶', () => {
      const bucket = new TokenBucket({
        capacity: 100,
        rate: 10,
        initialTokens: 50
      });
      
      const stats = bucket.getStats();
      expect(stats.capacity).toBe(100);
      expect(stats.rate).toBe(10);
      expect(stats.tokens).toBe(50);
    });
    
    test('应该正确消耗令牌', () => {
      const bucket = new TokenBucket({
        capacity: 100,
        rate: 10,
        initialTokens: 10,
        queueEnabled: false
      });
      
      const result = bucket.tryConsume(5);
      expect(result.allowed).toBe(true);
      expect(result.action).toBe('allow');
      
      const stats = bucket.getStats();
      expect(stats.tokens).toBe(5);
    });
    
    test('令牌不足时应该拒绝请求', () => {
      const bucket = new TokenBucket({
        capacity: 100,
        rate: 10,
        initialTokens: 5,
        queueEnabled: false
      });
      
      const result = bucket.tryConsume(10);
      expect(result.allowed).toBe(false);
      expect(result.action).toBe('reject');
    });
    
    test('启用队列时应该加入队列', () => {
      const bucket = new TokenBucket({
        capacity: 100,
        rate: 10,
        initialTokens: 5,
        queueEnabled: true,
        maxQueueSize: 10
      });
      
      const result = bucket.tryConsume(10);
      expect(result.allowed).toBe(false);
      expect(result.action).toBe('queue');
      expect(result.queuePosition).toBe(1);
      
      const stats = bucket.getStats();
      expect(stats.queueSize).toBe(1);
    });
    
    test('队列满时应该拒绝', () => {
      const bucket = new TokenBucket({
        capacity: 100,
        rate: 10,
        initialTokens: 0,
        queueEnabled: true,
        maxQueueSize: 2
      });
      
      bucket.tryConsume(1);
      bucket.tryConsume(1);
      const result = bucket.tryConsume(1);
      
      expect(result.allowed).toBe(false);
      expect(result.action).toBe('reject');
    });
  });
  
  describe('漏桶算法', () => {
    test('应该正确初始化漏桶', () => {
      const bucket = new LeakyBucket({
        capacity: 100,
        rate: 10
      });
      
      const stats = bucket.getStats();
      expect(stats.capacity).toBe(100);
      expect(stats.rate).toBe(10);
      expect(stats.waterLevel).toBe(0);
    });
    
    test('应该正确添加请求', () => {
      const bucket = new LeakyBucket({
        capacity: 100,
        rate: 10,
        queueEnabled: false
      });
      
      const result = bucket.tryAdd(50);
      expect(result.allowed).toBe(true);
      expect(result.action).toBe('allow');
      
      const stats = bucket.getStats();
      expect(stats.waterLevel).toBe(50);
    });
    
    test('桶满时应该拒绝', () => {
      const bucket = new LeakyBucket({
        capacity: 50,
        rate: 10,
        queueEnabled: false
      });
      
      bucket.tryAdd(40);
      const result = bucket.tryAdd(20);
      
      expect(result.allowed).toBe(false);
      expect(result.action).toBe('reject');
    });
    
    test('应该正确漏水', () => {
      const bucket = new LeakyBucket({
        capacity: 100,
        rate: 10,
        queueEnabled: false
      });
      
      bucket.tryAdd(50);
      
      bucket.leak();
      const stats = bucket.getStats();
      expect(stats.waterLevel).toBeLessThanOrEqual(50);
    });
  });
  
  describe('滑动窗口算法', () => {
    test('应该正确初始化滑动窗口', () => {
      const window = new SlidingWindow({
        windowSize: 60,
        maxRequests: 100
      });
      
      const stats = window.getStats();
      expect(stats.windowSize).toBe(60);
      expect(stats.maxRequests).toBe(100);
      expect(stats.currentCount).toBe(0);
    });
    
    test('应该正确计数请求', () => {
      const window = new SlidingWindow({
        windowSize: 60,
        maxRequests: 100,
        queueEnabled: false
      });
      
      for (let i = 0; i < 50; i++) {
        window.tryRequest();
      }
      
      const stats = window.getStats();
      expect(stats.currentCount).toBe(50);
    });
    
    test('超过限制时应该拒绝', () => {
      const window = new SlidingWindow({
        windowSize: 60,
        maxRequests: 10,
        queueEnabled: false
      });
      
      for (let i = 0; i < 10; i++) {
        const result = window.tryRequest();
        expect(result.allowed).toBe(true);
      }
      
      const result = window.tryRequest();
      expect(result.allowed).toBe(false);
      expect(result.action).toBe('reject');
    });
    
    test('应该正确清理过期请求', () => {
      const window = new SlidingWindow({
        windowSize: 1,
        maxRequests: 100,
        queueEnabled: false
      });
      
      const now = Date.now();
      window.tryRequest(now - 2000);
      
      const stats = window.getStats(now);
      expect(stats.currentCount).toBe(0);
    });
    
    test('启用队列时应该加入队列', () => {
      const window = new SlidingWindow({
        windowSize: 60,
        maxRequests: 2,
        queueEnabled: true,
        maxQueueSize: 5
      });
      
      window.tryRequest();
      window.tryRequest();
      const result = window.tryRequest();
      
      expect(result.allowed).toBe(false);
      expect(result.action).toBe('queue');
    });
  });
});
