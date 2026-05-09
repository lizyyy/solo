import { PoolService } from '../../src/core/pool-service';
import { PoolConfig } from '../../src/types';

const testPoolConfig: PoolConfig = {
  name: 'integration-test-pool',
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'test',
    user: 'test',
    password: 'test'
  },
  min: 1,
  max: 3,
  acquireTimeout: 3000,
  idleTimeout: 5000,
  reapInterval: 2000,
  testOnBorrow: true,
  testOnReturn: false,
  testWhileIdle: true
};

describe('PoolService Integration', () => {
  let poolService: PoolService;

  beforeEach(async () => {
    poolService = new PoolService(
      { pool: testPoolConfig, cacheStrategy: 'read-through' },
      {
        enableEvents: true,
        enableCache: true,
        enableCircuitBreaker: true,
        enableRetry: true,
        enableIdempotency: true
      }
    );
    await poolService.initialize();
  });

  afterEach(async () => {
    await poolService.close();
  });

  describe('Full workflow', () => {
    it('should execute operation with all features enabled', async () => {
      const result = await poolService.execute(
        async (conn) => {
          return await conn.query('SELECT 1');
        },
        {
          requestId: 'test-001',
          idempotencyKey: 'idempotent-key-1',
          timeout: 5000,
          retries: 2
        }
      );

      expect(result).toBeDefined();
    });

    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => 
        poolService.execute(
          async (conn) => {
            await new Promise(resolve => setTimeout(resolve, 50));
            return await conn.query(`SELECT ${i}`);
          },
          { requestId: `concurrent-${i}` }
        )
      );

      const results = await Promise.all(operations);
      expect(results).toHaveLength(10);
    });

    it('should cache results with read-through strategy', async () => {
      const cacheKey = 'test-cache-key';
      
      const result1 = await poolService.executeWithCache(
        cacheKey,
        async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { data: 'cached-data' };
        },
        { strategy: 'read-through' }
      );

      const result2 = await poolService.executeWithCache(
        cacheKey,
        async () => {
          throw new Error('Should not be called');
        },
        { strategy: 'read-through' }
      );

      expect(result1).toEqual(result2);
    });

    it('should handle idempotency correctly', async () => {
      const idempotencyKey = 'idempotent-test-2';
      let innerOperationCount = 0;

      const result1 = await poolService.execute(
        async (conn) => {
          innerOperationCount++;
          return await conn.query('SELECT 1');
        },
        {
          idempotencyKey,
          requestId: 'idempotent-request-1'
        }
      );

      const result2 = await poolService.execute(
        async (conn) => {
          innerOperationCount++;
          return await conn.query('SELECT 1');
        },
        {
          idempotencyKey,
          requestId: 'idempotent-request-2'
        }
      );

      expect(result1).toEqual(result2);
      expect(innerOperationCount).toBe(1);
    });

    it('should generate report', async () => {
      for (let i = 0; i < 5; i++) {
        await poolService.execute(
          async (conn) => {
            return await conn.query('SELECT 1');
          },
          { requestId: `report-test-${i}` }
        );
      }

      const report = poolService.generateReport({
        title: 'Integration Test Report',
        includeEvents: true,
        maxEvents: 100
      });

      expect(report).toContain('#');
      expect(report).toContain('概览');
      expect(report).toContain('总请求数');
    });

    it('should save report to file', async () => {
      const fs = require('fs');
      const path = require('path');
      const tempDir = path.join(__dirname, '../../temp-reports');
      const reportPath = path.join(tempDir, `test-report-${Date.now()}.md`);

      await poolService.saveReport(reportPath);

      expect(fs.existsSync(reportPath)).toBe(true);
      
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Error scenarios', () => {
    it('should trigger circuit breaker on repeated failures', async () => {
      for (let i = 0; i < 20; i++) {
        try {
          await poolService.execute(
            async (conn) => {
              throw new Error('Simulated failure');
            },
            { requestId: `failure-${i}` }
          );
        } catch {
        }
      }

      const snapshot = poolService.getCircuitBreakerSnapshot();
      expect(snapshot).toBeDefined();
    });

    it('should reset circuit breaker', async () => {
      for (let i = 0; i < 20; i++) {
        try {
          await poolService.execute(
            async (conn) => {
              throw new Error('Simulated failure');
            },
            { requestId: `failure-${i}` }
          );
        } catch {
        }
      }

      poolService.resetCircuitBreaker();
      const snapshot = poolService.getCircuitBreakerSnapshot();
      
      expect(snapshot?.state).toBe('closed');
    });

    it('should invalidate cache', async () => {
      const cacheKey = 'invalidate-test-key';
      
      await poolService.executeWithCache(
        cacheKey,
        async () => ({ data: 'original' }),
        { strategy: 'read-through' }
      );

      const invalidated = poolService.invalidateCache(cacheKey);
      expect(invalidated).toBe(true);
    });
  });

  describe('Health and metrics', () => {
    it('should return health check', () => {
      const health = poolService.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.metrics).toBeDefined();
    });

    it('should return metrics', () => {
      const metrics = poolService.getMetrics();
      expect(metrics.totalConnections).toBeGreaterThan(0);
    });

    it('should return service stats', () => {
      const stats = poolService.getServiceStats();
      expect(stats.initialized).toBe(true);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return connection infos', () => {
      const connections = poolService.getConnectionInfos();
      expect(connections.length).toBeGreaterThan(0);
    });
  });

  describe('Event replay', () => {
    it('should record events during operations', async () => {
      await poolService.execute(
        async (conn) => {
          return await conn.query('SELECT 1');
        },
        { requestId: 'event-test' }
      );

      const events = poolService.getEvents({ limit: 10 });
      expect(events.length).toBeGreaterThan(0);
    });

    it('should filter events by type', async () => {
      await poolService.execute(
        async (conn) => {
          return await conn.query('SELECT 1');
        },
        { requestId: 'filter-test' }
      );

      const acquireEvents = poolService.getEvents({
        types: ['connection:acquired'],
        limit: 10
      });

      expect(acquireEvents.every(e => e.type === 'connection:acquired')).toBe(true);
    });

    it('should replay events', async () => {
      await poolService.execute(
        async (conn) => {
          return await conn.query('SELECT 1');
        },
        { requestId: 'replay-test' }
      );

      let replayedCount = 0;
      const result = await poolService.replayEvents(
        async () => {
          replayedCount++;
        },
        { limit: 10 }
      );

      expect(result.total).toBeGreaterThan(0);
      expect(replayedCount).toBe(result.replayed);
    });
  });
});
