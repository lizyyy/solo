const config = require('../config');
const logger = require('./logger');

class RetryableOperation {
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts || config.retry.maxAttempts;
    this.delayMs = options.delayMs || config.retry.delayMs;
    this.shouldRetry = options.shouldRetry || (() => true);
  }

  async execute(operation, context = {}) {
    let lastError;
    let attempt = 0;

    while (attempt < this.maxAttempts) {
      try {
        attempt++;
        logger.debug(`Attempt ${attempt}/${this.maxAttempts} for operation`, context);
        const result = await operation();
        return { success: true, result, attempts: attempt };
      } catch (error) {
        lastError = error;
        logger.warn(`Attempt ${attempt} failed`, {
          error: error.message,
          ...context,
        });

        if (attempt === this.maxAttempts || !this.shouldRetry(error)) {
          logger.error(`Operation failed after ${attempt} attempts`, {
            error: error.message,
            stack: error.stack,
            ...context,
          });
          break;
        }

        await this.delay(attempt);
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: attempt,
    };
  }

  async delay(attempt) {
    const backoffDelay = this.delayMs * Math.pow(2, attempt - 1);
    return new Promise((resolve) => setTimeout(resolve, backoffDelay));
  }
}

async function withRetry(operation, options = {}, context = {}) {
  const retryOp = new RetryableOperation(options);
  return retryOp.execute(operation, context);
}

function createRerunStrategy() {
  return {
    async rerunFailedTask(taskId, taskType, executionFn) {
      logger.info(`Starting rerun for failed task: ${taskId}`, { taskType });
      
      const result = await withRetry(
        executionFn,
        { maxAttempts: 5, delayMs: 2000 },
        { taskId, taskType, rerun: true }
      );

      if (result.success) {
        logger.info(`Task rerun succeeded: ${taskId}`, { taskType });
      } else {
        logger.error(`Task rerun failed after all retries: ${taskId}`, {
          taskType,
          error: result.error?.message,
        });
      }

      return result;
    },

    shouldContinueProcessing(error, attempt) {
      const nonRetryableErrors = [
        'VALIDATION_ERROR',
        'NOT_FOUND',
        'DUPLICATE_ENTRY',
      ];
      
      if (nonRetryableErrors.includes(error.code)) {
        logger.warn('Non-retryable error detected, stopping', {
          error: error.message,
          code: error.code,
        });
        return false;
      }

      return attempt < 3;
    },
  };
}

module.exports = {
  RetryableOperation,
  withRetry,
  createRerunStrategy,
};
