import { PoolManager } from '../../src/core/pool-manager';
import { PoolConfig, PoolState } from '../../src/types';

const testConfig: PoolConfig = {
  name: 'test-pool',
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'test',
    user: 'test',
    password: 'test'
  },
  min: 2,
  max: 5,
  acquireTimeout: 5000,
  idleTimeout: 10000,
  reapInterval: 5000,
  testOnBorrow: true,
  testOnReturn: false,
  testWhileIdle: true
};

describe('PoolManager', () => {
  let pool: PoolManager;

  beforeEach(async () => {
    pool = new PoolManager(testConfig);
    await pool.initialize();
  });

  afterEach(async () => {
    await pool.close();
  });

  describe('Initialization', () => {
    it('should initialize with correct state', () => {
      expect(pool.getState()).toBe(PoolState.READY);
    });

    it('should create minimum connections', () => {
      const metrics = pool.getMetrics();
      expect(metrics.totalConnections).toBeGreaterThanOrEqual(testConfig.min);
      expect(metrics.availableConnections).toBeGreaterThanOrEqual(testConfig.min);
    });

    it('should validate config on initialization', () => {
      const invalidConfig = { ...testConfig, min: 10, max: 5 };
      expect(() => new PoolManager(invalidConfig as PoolConfig)).toThrow();
    });
  });

  describe('Connection acquisition', () => {
    it('should acquire connection successfully', async () => {
      const connection = await pool.acquire('test-request-1');
      expect(connection).toBeDefined();
      expect(connection.isInUse()).toBe(true);
      await pool.release(connection);
    });

    it('should track metrics during acquire', async () => {
      const initialMetrics = pool.getMetrics();
      const connection = await pool.acquire('test-request-2');
      const afterAcquire = pool.getMetrics();
      
      expect(afterAcquire.acquireCount).toBe(initialMetrics.acquireCount + 1);
      expect(afterAcquire.borrowedConnections).toBe(initialMetrics.borrowedConnections + 1);
      
      await pool.release(connection);
    });

    it('should handle concurrent acquisitions', async () => {
      const connections = await Promise.all([
        pool.acquire('concurrent-1'),
        pool.acquire('concurrent-2'),
        pool.acquire('concurrent-3')
      ]);

      const metrics = pool.getMetrics();
      expect(metrics.borrowedConnections).toBe(3);

      await Promise.all(connections.map(c => pool.release(c)));
    });
  });

  describe('Connection release', () => {
    it('should release connection back to pool', async () => {
      const connection = await pool.acquire('test-release');
      const initialAvailable = pool.getMetrics().availableConnections;
      
      await pool.release(connection);
      
      const afterRelease = pool.getMetrics();
      expect(afterRelease.availableConnections).toBe(initialAvailable + 1);
      expect(connection.isIdle()).toBe(true);
    });

    it('should track release metrics', async () => {
      const connection = await pool.acquire('test-metrics');
      const initialReleaseCount = pool.getMetrics().releaseCount;
      
      await pool.release(connection);
      
      const afterRelease = pool.getMetrics();
      expect(afterRelease.releaseCount).toBe(initialReleaseCount + 1);
    });
  });

  describe('withConnection', () => {
    it('should execute operation with connection', async () => {
      const result = await pool.withConnection(async (conn) => {
        const connection = await conn;
        return await connection.query('SELECT 1');
      });

      expect(result).toBeDefined();
    });

    it('should release connection after operation', async () => {
      const initialBorrowed = pool.getMetrics().borrowedConnections;
      
      await pool.withConnection(async (conn) => {
        await conn;
      });

      const finalBorrowed = pool.getMetrics().borrowedConnections;
      expect(finalBorrowed).toBe(initialBorrowed);
    });

    it('should destroy connection on error', async () => {
      const initialTotal = pool.getMetrics().totalConnections;
      
      await expect(pool.withConnection(async (conn) => {
        await conn;
        throw new Error('Test error');
      })).rejects.toThrow('Test error');

      const finalTotal = pool.getMetrics().totalConnections;
      expect(finalTotal).toBeLessThanOrEqual(initialTotal);
    });
  });

  describe('Pool exhaustion', () => {
    it('should queue requests when pool is exhausted', async () => {
      const connections = await Promise.all(
        Array.from({ length: testConfig.max }, (_, i) => 
          pool.acquire(`exhaust-${i}`)
        )
      );

      const metrics = pool.getMetrics();
      expect(metrics.borrowedConnections).toBe(testConfig.max);

      const queuedPromise = pool.acquire('queued-request', 1000);
      
      await expect(queuedPromise).rejects.toThrow();

      await Promise.all(connections.map(c => pool.release(c)));
    });
  });

  describe('Health check', () => {
    it('should return healthy status for ready pool', () => {
      const health = pool.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.state).toBe(PoolState.READY);
    });

    it('should include metrics in health check', () => {
      const health = pool.healthCheck();
      expect(health.metrics).toBeDefined();
      expect(health.metrics.totalConnections).toBeGreaterThan(0);
    });
  });

  describe('Pool draining', () => {
    it('should drain pool gracefully', async () => {
      const connection = await pool.acquire('drain-test');
      
      setTimeout(() => pool.release(connection), 100);
      
      await pool.drain();
      
      expect(pool.getState()).toBe(PoolState.STOPPED);
      expect(pool.getMetrics().totalConnections).toBe(0);
    });
  });

  describe('Event emission', () => {
    it('should emit connection:acquired event', async () => {
      const eventSpy = jest.fn();
      pool.on('connection:acquired', eventSpy);

      const connection = await pool.acquire('event-test');
      
      expect(eventSpy).toHaveBeenCalled();
      expect(eventSpy.mock.calls[0][0]).toHaveProperty('id');
      
      await pool.release(connection);
    });

    it('should emit connection:released event', async () => {
      const eventSpy = jest.fn();
      pool.on('connection:released', eventSpy);

      const connection = await pool.acquire('event-test-2');
      await pool.release(connection);
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });
});
