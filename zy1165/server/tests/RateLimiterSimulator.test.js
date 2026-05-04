const RateLimiterSimulator = require('../services/RateLimiterSimulator');

describe('RateLimiterSimulator', () => {
  let simulator;
  
  beforeEach(() => {
    simulator = new RateLimiterSimulator();
  });
  
  describe('配置验证', () => {
    it('应该拒绝无效的配置', () => {
      const invalidConfig = {
        totalRequests: -1,
        tokenRate: 10,
        tokenCapacity: 100,
        leakRate: 10,
        leakCapacity: 100,
        queueLength: 50,
        timeout: 5000
      };
      
      expect(() => simulator.runSimulation(invalidConfig)).toThrow();
    });
    
    it('应该拒绝令牌生成速率为0的配置', () => {
      const invalidConfig = {
        totalRequests: 100,
        burstDuration: 5,
        burstRate: 20,
        steadyDuration: 10,
        steadyRate: 5,
        tokenRate: 0,
        tokenCapacity: 100,
        leakRate: 10,
        leakCapacity: 100,
        queueLength: 50,
        timeout: 5000
      };
      
      expect(() => simulator.runSimulation(invalidConfig)).toThrow();
    });
    
    it('应该拒绝负数的队列长度', () => {
      const invalidConfig = {
        totalRequests: 100,
        burstDuration: 5,
        burstRate: 20,
        steadyDuration: 10,
        steadyRate: 5,
        tokenRate: 10,
        tokenCapacity: 100,
        leakRate: 10,
        leakCapacity: 100,
        queueLength: -1,
        timeout: 5000
      };
      
      expect(() => simulator.runSimulation(invalidConfig)).toThrow();
    });
    
    it('应该接受有效的配置', () => {
      const validConfig = {
        totalRequests: 100,
        burstDuration: 5,
        burstRate: 20,
        steadyDuration: 10,
        steadyRate: 5,
        tokenRate: 10,
        tokenCapacity: 100,
        leakRate: 10,
        leakCapacity: 100,
        queueLength: 50,
        timeout: 5000,
        seed: 42
      };
      
      expect(() => simulator.runSimulation(validConfig)).not.toThrow();
    });
  });
  
  describe('模拟运行', () => {
    it('应该返回正确的结果结构', () => {
      const config = {
        totalRequests: 100,
        burstDuration: 5,
        burstRate: 20,
        steadyDuration: 10,
        steadyRate: 5,
        tokenRate: 10,
        tokenCapacity: 100,
        leakRate: 10,
        leakCapacity: 100,
        queueLength: 50,
        timeout: 5000,
        seed: 42
      };
      
      const result = simulator.runSimulation(config);
      
      expect(result).toHaveProperty('tokenBucket');
      expect(result).toHaveProperty('leakyBucket');
      expect(result).toHaveProperty('requests');
      
      expect(result.tokenBucket).toHaveProperty('stats');
      expect(result.tokenBucket).toHaveProperty('timeline');
      expect(result.tokenBucket).toHaveProperty('tokenLevels');
      expect(result.tokenBucket).toHaveProperty('latencyDistribution');
      
      expect(result.leakyBucket).toHaveProperty('stats');
      expect(result.leakyBucket).toHaveProperty('timeline');
      expect(result.leakyBucket).toHaveProperty('waterLevels');
      expect(result.leakyBucket).toHaveProperty('latencyDistribution');
    });
    
    it('相同的seed应该产生相同的结果', () => {
      const config = {
        totalRequests: 50,
        burstDuration: 2,
        burstRate: 25,
        steadyDuration: 3,
        steadyRate: 5,
        tokenRate: 10,
        tokenCapacity: 50,
        leakRate: 10,
        leakCapacity: 50,
        queueLength: 20,
        timeout: 5000,
        seed: 12345
      };
      
      const result1 = simulator.runSimulation(config);
      const result2 = simulator.runSimulation(config);
      
      expect(result1.tokenBucket.stats.allowed).toBe(result2.tokenBucket.stats.allowed);
      expect(result1.leakyBucket.stats.allowed).toBe(result2.leakyBucket.stats.allowed);
    });
    
    it('令牌桶在高突发流量下应该有较高的拒绝率', () => {
      const config = {
        totalRequests: 100,
        burstDuration: 2,
        burstRate: 100,
        steadyDuration: 3,
        steadyRate: 5,
        tokenRate: 5,
        tokenCapacity: 10,
        leakRate: 5,
        leakCapacity: 10,
        queueLength: 0,
        timeout: 5000,
        seed: 999
      };
      
      const result = simulator.runSimulation(config);
      
      expect(result.tokenBucket.stats.rejected).toBeGreaterThan(0);
      expect(result.tokenBucket.stats.allowed).toBeLessThan(result.tokenBucket.stats.total);
    });
  });
  
  describe('统计计算', () => {
    it('应该正确计算延迟分布', () => {
      const config = {
        totalRequests: 50,
        burstDuration: 3,
        burstRate: 20,
        steadyDuration: 5,
        steadyRate: 10,
        tokenRate: 15,
        tokenCapacity: 30,
        leakRate: 15,
        leakCapacity: 30,
        queueLength: 20,
        timeout: 5000,
        seed: 777
      };
      
      const result = simulator.runSimulation(config);
      
      expect(result.tokenBucket.latencyDistribution).toBeInstanceOf(Array);
      expect(result.leakyBucket.latencyDistribution).toBeInstanceOf(Array);
      
      const tbTotal = result.tokenBucket.latencyDistribution.reduce((sum, d) => sum + d.count, 0);
      const lbTotal = result.leakyBucket.latencyDistribution.reduce((sum, d) => sum + d.count, 0);
      
      expect(tbTotal).toBe(result.tokenBucket.stats.allowed + result.tokenBucket.stats.queued);
    });
  });
});
