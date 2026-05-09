import { CircuitBreaker } from '../../src/core/circuit-breaker';
import { CircuitBreakerState } from '../../src/types';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker('test-breaker', {
      failureThreshold: 0.5,
      recoveryTimeout: 100,
      successThreshold: 3,
      timeout: 1000
    });
  });

  describe('Initial state', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should allow execution in CLOSED state', () => {
      expect(circuitBreaker.canExecute()).toBe(true);
    });
  });

  describe('State transitions', () => {
    it('should transition to OPEN when failure threshold exceeded', async () => {
      for (let i = 0; i < 15; i++) {
        try {
          await circuitBreaker.execute(() => 
            Promise.reject(new Error('Test error'))
          );
        } catch {
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should reject execution when OPEN', async () => {
      for (let i = 0; i < 15; i++) {
        try {
          await circuitBreaker.execute(() => 
            Promise.reject(new Error('Test error'))
          );
        } catch {
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      expect(circuitBreaker.canExecute()).toBe(false);
    });

    it('should transition to HALF_OPEN after recovery timeout', async () => {
      for (let i = 0; i < 15; i++) {
        try {
          await circuitBreaker.execute(() => 
            Promise.reject(new Error('Test error'))
          );
        } catch {
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(circuitBreaker.canExecute()).toBe(true);
    });

    it('should reset to CLOSED after successful executions in HALF_OPEN', async () => {
      for (let i = 0; i < 15; i++) {
        try {
          await circuitBreaker.execute(() => 
            Promise.reject(new Error('Test error'))
          );
        } catch {
        }
      }

      await new Promise(resolve => setTimeout(resolve, 150));

      for (let i = 0; i < 3; i++) {
        await circuitBreaker.execute(() => Promise.resolve('success'));
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('Execution', () => {
    it('should execute successful operations', async () => {
      const result = await circuitBreaker.execute(() => 
        Promise.resolve('success')
      );

      expect(result).toBe('success');
    });

    it('should handle operation timeout', async () => {
      const slowBreaker = new CircuitBreaker('slow-breaker', {
        failureThreshold: 0.5,
        recoveryTimeout: 1000,
        successThreshold: 3,
        timeout: 50
      });

      await expect(
        slowBreaker.execute(() => 
          new Promise(resolve => setTimeout(() => resolve('slow'), 100))
        )
      ).rejects.toThrow();
    });

    it('should use fallback when circuit is open', async () => {
      for (let i = 0; i < 15; i++) {
        try {
          await circuitBreaker.execute(() => 
            Promise.reject(new Error('Test error'))
          );
        } catch {
        }
      }

      const result = await circuitBreaker.execute(
        () => Promise.reject(new Error('will not execute')),
        { fallback: () => Promise.resolve('fallback') }
      );

      expect(result).toBe('fallback');
    });
  });

  describe('Statistics', () => {
    it('should track success count', async () => {
      for (let i = 0; i < 5; i++) {
        await circuitBreaker.execute(() => Promise.resolve('success'));
      }

      const stats = circuitBreaker.getStats();
      expect(stats.successCount).toBe(5);
      expect(stats.totalRequests).toBe(5);
    });

    it('should track failure count', async () => {
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(() => 
            Promise.reject(new Error('Test error'))
          );
        } catch {
        }
      }

      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(5);
    });

    it('should return snapshot with current state', () => {
      const snapshot = circuitBreaker.getSnapshot();
      expect(snapshot.state).toBe(CircuitBreakerState.CLOSED);
      expect(snapshot.canExecute).toBe(true);
      expect(snapshot.config).toBeDefined();
      expect(snapshot.stats).toBeDefined();
    });
  });

  describe('Manual control', () => {
    it('should force open circuit', () => {
      circuitBreaker.forceOpen('manual test');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      expect(circuitBreaker.canExecute()).toBe(false);
    });

    it('should force close circuit', () => {
      circuitBreaker.forceOpen('manual test');
      circuitBreaker.forceClose();
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should reset all stats', async () => {
      for (let i = 0; i < 5; i++) {
        await circuitBreaker.execute(() => Promise.resolve('success'));
      }

      circuitBreaker.reset();

      const stats = circuitBreaker.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successCount).toBe(0);
    });
  });
});
