import { ConcurrencyPool } from '../ConcurrencyPool';

describe('ConcurrencyPool', () => {
  describe('constructor', () => {
    it('should create pool with default concurrency (10)', () => {
      const pool = new ConcurrencyPool();
      expect(pool).toBeDefined();
    });

    it('should create pool with custom concurrency', () => {
      const pool = new ConcurrencyPool(5);
      expect(pool).toBeDefined();
    });
  });

  describe('submit', () => {
    it('should execute task immediately when under concurrency limit', async () => {
      const pool = new ConcurrencyPool(2);
      const task = jest.fn().mockResolvedValue('result');

      const result = await pool.submit(task);

      expect(task).toHaveBeenCalledTimes(1);
      expect(result).toBe('result');
    });

    it('should handle multiple concurrent tasks within limit', async () => {
      const pool = new ConcurrencyPool(2);
      const results: number[] = [];

      const createTask = (delay: number, value: number) => async () => {
        await new Promise(resolve => setTimeout(resolve, delay));
        results.push(value);
        return value;
      };

      const promise1 = pool.submit(createTask(50, 1));
      const promise2 = pool.submit(createTask(50, 2));
      const promise3 = pool.submit(createTask(10, 3));

      await Promise.all([promise1, promise2, promise3]);

      expect(results.length).toBe(3);
      expect(results).toContain(1);
      expect(results).toContain(2);
      expect(results).toContain(3);
    });

    it('should queue tasks when exceeding concurrency limit', async () => {
      const pool = new ConcurrencyPool(2);
      const executionOrder: number[] = [];

      const createTask = (value: number) => async () => {
        executionOrder.push(value);
        await new Promise(resolve => setTimeout(resolve, 20));
        return value;
      };

      const startTime = Date.now();
      const promises = [
        pool.submit(createTask(1)),
        pool.submit(createTask(2)),
        pool.submit(createTask(3)),
        pool.submit(createTask(4)),
      ];

      await Promise.all(promises);
      const elapsed = Date.now() - startTime;

      expect(executionOrder).toHaveLength(4);
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });

    it('should propagate task errors', async () => {
      const pool = new ConcurrencyPool(1);
      const expectedError = new Error('Task failed');
      const task = jest.fn().mockRejectedValue(expectedError);

      await expect(pool.submit(task)).rejects.toThrow('Task failed');
    });
  });

  describe('waitForAll', () => {
    it('should wait for all tasks to complete', async () => {
      const pool = new ConcurrencyPool(2);
      let completed = 0;

      const createTask = () => async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        completed++;
      };

      pool.submit(createTask());
      pool.submit(createTask());
      pool.submit(createTask());

      expect(completed).toBeLessThanOrEqual(2);
      await pool.waitForAll();
      expect(completed).toBe(3);
    });

    it('should resolve immediately when no tasks are running', async () => {
      const pool = new ConcurrencyPool(5);
      const startTime = Date.now();

      await pool.waitForAll();

      expect(Date.now() - startTime).toBeLessThan(100);
    });
  });

  describe('setMaxConcurrency', () => {
    it('should update max concurrency', async () => {
      const pool = new ConcurrencyPool(2);
      pool.setMaxConcurrency(5);

      const executionOrder: number[] = [];
      const createTask = (value: number) => async () => {
        executionOrder.push(value);
        await new Promise(resolve => setTimeout(resolve, 30));
      };

      const promises = [
        pool.submit(createTask(1)),
        pool.submit(createTask(2)),
        pool.submit(createTask(3)),
        pool.submit(createTask(4)),
        pool.submit(createTask(5)),
      ];

      await Promise.all(promises);
      expect(executionOrder.length).toBe(5);
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const pool = new ConcurrencyPool(5);
      const stats = pool.getStats();

      expect(stats.maxConcurrency).toBe(5);
      expect(stats.active).toBe(0);
      expect(stats.queued).toBe(0);
    });

    it('should update stats as tasks are submitted and completed', async () => {
      const pool = new ConcurrencyPool(1);

      pool.submit(() => new Promise(resolve => setTimeout(resolve, 50)));

      let stats = pool.getStats();
      expect(stats.active).toBe(1);

      await pool.waitForAll();

      stats = pool.getStats();
      expect(stats.active).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle high concurrency with many tasks', async () => {
      const pool = new ConcurrencyPool(10);
      const taskCount = 100;
      let completed = 0;

      const createTask = () => async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        completed++;
      };

      const promises: Promise<void>[] = [];
      for (let i = 0; i < taskCount; i++) {
        promises.push(pool.submit(createTask()));
      }

      await Promise.all(promises);
      expect(completed).toBe(taskCount);
    });

    it('should handle tasks that throw errors', async () => {
      const pool = new ConcurrencyPool(2);
      const successfulTask = jest.fn().mockResolvedValue('success');
      const failingTask = jest.fn().mockRejectedValue(new Error('Failed'));

      const result1 = pool.submit(successfulTask);
      const result2 = pool.submit(failingTask);

      await expect(result1).resolves.toBe('success');
      await expect(result2).rejects.toThrow('Failed');
    });
  });
});
