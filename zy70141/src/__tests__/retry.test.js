const {
  RetryableOperation,
  withRetry,
  createRerunStrategy,
} = require('../utils/retry');

describe('Retry Utility', () => {
  describe('RetryableOperation', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const retryOp = new RetryableOperation({ maxAttempts: 3, delayMs: 0 });
      const result = await retryOp.execute(operation);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      let callCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });
      
      const retryOp = new RetryableOperation({ maxAttempts: 3, delayMs: 0 });
      const result = await retryOp.execute(operation);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should fail after max attempts', async () => {
      const error = new Error('Permanent failure');
      const operation = jest.fn().mockRejectedValue(error);
      
      const retryOp = new RetryableOperation({ maxAttempts: 3, delayMs: 0 });
      const result = await retryOp.execute(operation);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should respect shouldRetry callback', async () => {
      const error = new Error('Validation error');
      error.code = 'VALIDATION_ERROR';
      const operation = jest.fn().mockRejectedValue(error);
      
      const shouldRetry = (err) => err.code !== 'VALIDATION_ERROR';
      
      const retryOp = new RetryableOperation({ maxAttempts: 3, delayMs: 0, shouldRetry });
      const result = await retryOp.execute(operation);
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('withRetry', () => {
    it('should wrap operation with retry logic', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await withRetry(
        operation,
        { maxAttempts: 3, delayMs: 0 },
        { context: 'test' }
      );
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
    });

    it('should pass context to retries', async () => {
      let callCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Retry me');
        }
        return 'success';
      });
      
      const result = await withRetry(
        operation,
        { maxAttempts: 3, delayMs: 0 }
      );
      
      expect(result.attempts).toBe(2);
    });
  });

  describe('createRerunStrategy', () => {
    describe('rerunFailedTask', () => {
      it('should rerun failed task with extra retries', async () => {
        const strategy = createRerunStrategy();
        const executionFn = jest.fn().mockResolvedValue({ success: true, result: 'done' });
        
        const result = await strategy.rerunFailedTask('task-123', 'process_access_log', executionFn);
        
        expect(result.success).toBe(true);
        expect(executionFn).toHaveBeenCalled();
      });

      it('should handle rerun failures', async () => {
        const strategy = createRerunStrategy();
        const error = new Error('Still failing');
        const executionFn = jest.fn().mockRejectedValue(error);
        
        const result = await strategy.rerunFailedTask('task-123', 'process_access_log', executionFn);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe(error);
      });
    });

    describe('shouldContinueProcessing', () => {
      it('should stop on VALIDATION_ERROR', () => {
        const strategy = createRerunStrategy();
        const error = new Error('Validation failed');
        error.code = 'VALIDATION_ERROR';
        
        expect(strategy.shouldContinueProcessing(error, 1)).toBe(false);
      });

      it('should stop on NOT_FOUND', () => {
        const strategy = createRerunStrategy();
        const error = new Error('Not found');
        error.code = 'NOT_FOUND';
        
        expect(strategy.shouldContinueProcessing(error, 1)).toBe(false);
      });

      it('should continue for other errors', () => {
        const strategy = createRerunStrategy();
        const error = new Error('Database timeout');
        error.code = 'DATABASE_TIMEOUT';
        
        expect(strategy.shouldContinueProcessing(error, 1)).toBe(true);
      });

      it('should stop after max attempts', () => {
        const strategy = createRerunStrategy();
        const error = new Error('Database timeout');
        
        expect(strategy.shouldContinueProcessing(error, 3)).toBe(false);
      });
    });
  });
});
