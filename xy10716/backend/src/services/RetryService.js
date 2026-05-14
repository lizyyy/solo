const StateHistory = require('../models/StateHistory');
const stateMachineService = require('./StateMachineService');

class RetryService {
  constructor() {
    this.defaultMaxRetries = 3;
  }

  async canRetry(historyId, maxRetries = this.defaultMaxRetries) {
    const history = await StateHistory.findById(historyId);
    if (!history) {
      throw new Error('History record not found');
    }

    return history.retryCount < maxRetries && history.status === 'FAILED';
  }

  async retryOperation(historyId, operator, retryFn, maxRetries = this.defaultMaxRetries) {
    const history = await StateHistory.findById(historyId);
    if (!history) {
      throw new Error('History record not found');
    }

    if (!(await this.canRetry(historyId, maxRetries))) {
      throw new Error('Maximum retry limit reached or operation not in FAILED state');
    }

    history.retryCount += 1;
    await history.save();

    try {
      const result = await retryFn();
      await stateMachineService.transitionState(historyId, 'SUCCESS');
      return { success: true, result, retryCount: history.retryCount };
    } catch (error) {
      await stateMachineService.transitionState(historyId, 'FAILED', {
        errorMessage: error.message
      });
      return { 
        success: false, 
        error: error.message, 
        retryCount: history.retryCount,
        canRetryAgain: history.retryCount < maxRetries
      };
    }
  }

  async getRetryHistory(switchId) {
    return await StateHistory.find({
      switchId,
      retryCount: { $gt: 0 }
    }).sort({ createdAt: -1 });
  }

  async executeWithRetry(operationFn, switchId, requestId, operator, maxRetries = this.defaultMaxRetries) {
    let lastError;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        const result = await operationFn();
        return { success: true, result, retryCount };
      } catch (error) {
        lastError = error;
        retryCount++;
        
        if (retryCount <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
    }

    return { 
      success: false, 
      error: lastError?.message, 
      retryCount: maxRetries 
    };
  }
}

module.exports = new RetryService();
