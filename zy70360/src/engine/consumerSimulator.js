class ConsumerSimulator {
  constructor(options = {}) {
    this.delay = options.delay || 100;
    this.errorRate = options.errorRate || 0;
    this.alwaysSuccess = options.alwaysSuccess !== undefined ? options.alwaysSuccess : false;
    this.alwaysFail = options.alwaysFail !== undefined ? options.alwaysFail : false;
    this.customHandler = options.customHandler || null;
    this.consumerLog = [];
  }

  async consume(message, attempt = 1) {
    this.consumerLog.push({
      messageId: message.id,
      businessKey: message.businessKey,
      topic: message.topic,
      attempt,
      timestamp: Date.now(),
      action: 'received'
    });

    if (this.alwaysFail) {
      return this._createFailureResult(message, attempt, 'CONSUMER_ALWAYS_FAIL');
    }

    if (this.alwaysSuccess) {
      return this._createSuccessResult(message, attempt, 'CONSUMER_ACK_SUCCESS');
    }

    if (this.customHandler) {
      try {
        const result = await this.customHandler(message, attempt);
        return this._createResultFromCustom(message, attempt, result);
      } catch (error) {
        return this._createFailureResult(message, attempt, error.message || 'CUSTOM_HANDLER_ERROR');
      }
    }

    await this._simulateDelay();

    if (this._shouldFail()) {
      return this._createFailureResult(message, attempt, 'RANDOM_FAILURE');
    }

    return this._createSuccessResult(message, attempt, 'CONSUMER_ACK_SUCCESS');
  }

  async _simulateDelay() {
    return new Promise(resolve => setTimeout(resolve, this.delay));
  }

  _shouldFail() {
    return Math.random() < this.errorRate;
  }

  _createSuccessResult(message, attempt, reason) {
    this.consumerLog.push({
      messageId: message.id,
      businessKey: message.businessKey,
      topic: message.topic,
      attempt,
      timestamp: Date.now(),
      action: 'ack',
      result: 'success',
      reason
    });

    return {
      success: true,
      messageId: message.id,
      businessKey: message.businessKey,
      topic: message.topic,
      attempt,
      reason,
      timestamp: Date.now(),
      processingTime: this.delay
    };
  }

  _createFailureResult(message, attempt, reason) {
    this.consumerLog.push({
      messageId: message.id,
      businessKey: message.businessKey,
      topic: message.topic,
      attempt,
      timestamp: Date.now(),
      action: 'nack',
      result: 'failure',
      reason
    });

    return {
      success: false,
      messageId: message.id,
      businessKey: message.businessKey,
      topic: message.topic,
      attempt,
      reason,
      timestamp: Date.now(),
      processingTime: this.delay,
      shouldRetry: true
    };
  }

  _createResultFromCustom(message, attempt, result) {
    if (result && typeof result === 'object') {
      if (result.success) {
        return this._createSuccessResult(message, attempt, result.reason || 'CUSTOM_SUCCESS');
      } else {
        return this._createFailureResult(message, attempt, result.reason || 'CUSTOM_FAILURE');
      }
    }
    return this._createSuccessResult(message, attempt, 'DEFAULT_SUCCESS');
  }

  getConsumerLog() {
    return [...this.consumerLog];
  }

  getTriggerCount(messageId) {
    return this.consumerLog.filter(l => l.messageId === messageId && l.action === 'received').length;
  }

  reset() {
    this.consumerLog = [];
  }
}

module.exports = ConsumerSimulator;
