import { RateLimiter } from '../RateLimiter';

describe('RateLimiter', () => {
  describe('constructor', () => {
    it('should create limiter with default rate (100)', () => {
      const limiter = new RateLimiter();
      expect(limiter).toBeDefined();
    });

    it('should create limiter with custom rate', () => {
      const limiter = new RateLimiter(50);
      expect(limiter).toBeDefined();
    });
  });

  describe('acquire', () => {
    it('should acquire immediately when tokens are available', async () => {
      const limiter = new RateLimiter(100);
      const startTime = Date.now();

      await limiter.acquire();

      expect(Date.now() - startTime).toBeLessThan(100);
    });

    it('should wait when tokens are exhausted', async () => {
      const limiter = new RateLimiter(10);
      const startTime = Date.now();

      for (let i = 0; i < 15; i++) {
        await limiter.acquire();
      }

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(400);
    }, 3000);
  });

  describe('acquireWithDelay', () => {
    it('should execute function after acquiring token', async () => {
      const limiter = new RateLimiter(100);
      const mockFn = jest.fn().mockResolvedValue('result');

      const result = await limiter.acquireWithDelay(mockFn);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(result).toBe('result');
    });

    it('should propagate errors from the function', async () => {
      const limiter = new RateLimiter(100);
      const expectedError = new Error('Function failed');
      const mockFn = jest.fn().mockRejectedValue(expectedError);

      await expect(limiter.acquireWithDelay(mockFn)).rejects.toThrow('Function failed');
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const limiter = new RateLimiter(50);
      const stats = limiter.getStats();

      expect(stats.maxRequestsPerSecond).toBe(50);
      expect(stats.tokenInterval).toBeCloseTo(20);
      expect(stats.tokens).toBeLessThanOrEqual(50);
    });

    it('should update stats as requests are made', async () => {
      const limiter = new RateLimiter(100);

      await limiter.acquire();
      await limiter.acquire();

      const stats = limiter.getStats();
      expect(stats.tokens).toBeLessThan(100);
    });
  });

  describe('setRateLimit', () => {
    it('should update the rate limit', async () => {
      const limiter = new RateLimiter(10);
      limiter.setRateLimit(100);

      const startTime = Date.now();
      for (let i = 0; i < 50; i++) {
        await limiter.acquire();
      }
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid consecutive acquires', async () => {
      const limiter = new RateLimiter(100);
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 50; i++) {
        promises.push(limiter.acquire());
      }

      await Promise.all(promises);
      const stats = limiter.getStats();
      expect(stats.tokens).toBeLessThan(100);
    });

    it('should handle very high rate limits', async () => {
      const limiter = new RateLimiter(1000);
      const startTime = Date.now();

      for (let i = 0; i < 200; i++) {
        await limiter.acquire();
      }

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(500);
    });
  });

});
