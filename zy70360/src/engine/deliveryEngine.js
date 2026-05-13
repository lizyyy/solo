const Message = require('../models/message');
const DeliveryRecord = require('../models/deliveryRecord');
const ConsumerSimulator = require('./consumerSimulator');
const RuleEngine = require('./ruleEngine');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class DeliveryEngine {
  constructor(options = {}) {
    this.topicStore = options.topicStore;
    this.historyStore = options.historyStore;
    this.planStore = options.planStore;
    this.consumerHandler = options.consumerHandler;
    this.executionLog = [];
  }

  async executePlan(plan, options = {}) {
    const ruleEngine = new RuleEngine(plan.rules);
    const ruleSummary = ruleEngine.getRuleSummary();

    const topic = this.topicStore.get(plan.topic);
    if (!topic) {
      throw new Error(`主题 ${plan.topic} 不存在`);
    }

    this.executionLog = [];
    const executionResult = {
      planId: plan.id,
      planName: plan.name,
      topic: plan.topic,
      startTime: Date.now(),
      ruleSummary,
      messages: [],
      consumerLog: []
    };

    const consumer = this._createConsumer(ruleEngine, options);

    let processedMessages = plan.messages.map(m => Message.fromJSON(m));

    if (ruleEngine.shouldMergeByBusinessKey()) {
      processedMessages = ruleEngine.mergeMessagesByBusinessKey(processedMessages);
      this._log('info', `按业务键归并，原始 ${plan.messages.length} 条，归并后 ${processedMessages.length} 条`);
    }

    if (ruleEngine.shouldOutOfOrder()) {
      processedMessages = ruleEngine.applyOutOfOrder(processedMessages);
      this._log('info', '已乱序重排消息顺序');
    }

    const ignoreHistory = ruleEngine.shouldIgnoreHistory();

    for (const message of processedMessages) {
      const messageResult = await this._processMessage(
        message,
        topic,
        consumer,
        ruleEngine,
        ignoreHistory
      );
      executionResult.messages.push(messageResult);
    }

    executionResult.endTime = Date.now();
    executionResult.duration = executionResult.endTime - executionResult.startTime;
    executionResult.consumerLog = consumer.getConsumerLog();
    executionResult.executionLog = this.executionLog;

    this._updatePlanStatus(plan.id, 'completed');

    return executionResult;
  }

  async _processMessage(message, topic, consumer, ruleEngine, ignoreHistory) {
    const messageResult = {
      messageId: message.id,
      businessKey: message.businessKey,
      deliveries: [],
      finalStatus: 'pending'
    };

    let record = this.historyStore.get(message.id);
    const alreadyExists = !!record;

    if (alreadyExists && !ignoreHistory) {
      this._log('warn', `消息 ${message.id} (${message.businessKey}) 已存在历史记录，跳过`);
      return {
        ...messageResult,
        skipped: true,
        reason: 'history_exists'
      };
    }

    if (!record) {
      record = new DeliveryRecord({
        messageId: message.id,
        businessKey: message.businessKey,
        topic: message.topic || topic.name,
        planId: message.planId
      });
      this.historyStore.save(record);
    }

    const maxRetry = topic.maxRetry;
    let attempt = 0;
    let finalSuccess = false;
    let isDuplicateIgnored = false;

    while (attempt < maxRetry + 1) {
      attempt++;

      if (ruleEngine.shouldDelay()) {
        const delay = ruleEngine.getRandomDelay();
        this._log('info', `延迟投递 ${message.id}，等待 ${delay}ms`);
        await sleep(delay);
      }

      const consumerResult = await this._deliverMessage(
        message,
        consumer,
        attempt,
        ruleEngine,
        record
      );

      messageResult.deliveries.push({
        attempt,
        ...consumerResult
      });

      if (consumerResult.success) {
        finalSuccess = true;
        record.status = 'success';
        record.setConsumerResult(consumerResult, isDuplicateIgnored);
        this.historyStore.update(record);
        messageResult.finalStatus = 'success';
        this._log('success', `消息 ${message.id} 第 ${attempt} 次投递成功`);

        if (ruleEngine.shouldDuplicateDelivery()) {
          await this._injectDuplicateDeliveries(message, consumer, ruleEngine, record);
        }
        break;
      }

      if (attempt < maxRetry + 1) {
        this._log('warn', `消息 ${message.id} 第 ${attempt} 次投递失败，等待重试...`);
        await sleep(topic.retryDelay);
      }
    }

    if (!finalSuccess) {
      record.markDeadLetter();
      this.historyStore.update(record);
      messageResult.finalStatus = 'dead_letter';
      this._log('error', `消息 ${message.id} 超过最大重试次数，进入死信队列`);
    }

    return messageResult;
  }

  async _deliverMessage(message, consumer, attempt, ruleEngine, record) {
    record.addDelivery({
      type: 'delivery',
      attempt,
      status: 'in_progress'
    });
    this.historyStore.update(record);

    let result;
    try {
      result = await consumer.consume(message, attempt);
    } catch (error) {
      result = {
        success: false,
        reason: `UNHANDLED_EXCEPTION: ${error.message}`,
        shouldRetry: true
      };
    }

    const lastDelivery = record.deliveries[record.deliveries.length - 1];
    lastDelivery.status = result.success ? 'success' : 'failed';
    lastDelivery.result = result;
    this.historyStore.update(record);

    return result;
  }

  async _injectDuplicateDeliveries(message, consumer, ruleEngine, record) {
    const duplicateCount = ruleEngine.getDuplicateCount();
    this._log('info', `注入 ${duplicateCount} 次重复投递，测试幂等性`);

    for (let i = 0; i < duplicateCount; i++) {
      if (ruleEngine.shouldDelay()) {
        const delay = ruleEngine.getRandomDelay();
        await sleep(delay);
      }

      const result = await consumer.consume(message, `duplicate-${i + 1}`);

      record.addDelivery({
        type: 'duplicate_delivery',
        attempt: `duplicate-${i + 1}`,
        status: result.success ? 'success' : 'failed',
        result,
        isDuplicate: true
      });

      this.historyStore.update(record);

      this._log(
        result.success ? 'success' : 'warn',
        `重复投递 #${i + 1}: ${result.success ? '消费者收到 (需检查是否忽略)' : '失败'}`
      );
    }
  }

  _createConsumer(ruleEngine, options = {}) {
    const consumerOptions = {
      delay: options.delay || 100,
      alwaysSuccess: ruleEngine.rule.consumerFailure.enabled !== true,
      alwaysFail: options.alwaysFail || false,
      customHandler: this.consumerHandler
    };

    if (ruleEngine.shouldConsumerFail()) {
      consumerOptions.errorRate = ruleEngine.rule.consumerFailure.probability;
      consumerOptions.alwaysSuccess = false;
    }

    return new ConsumerSimulator(consumerOptions);
  }

  _log(level, message) {
    const entry = {
      level,
      message,
      timestamp: Date.now()
    };
    this.executionLog.push(entry);
  }

  _updatePlanStatus(planId, status) {
    if (this.planStore) {
      this.planStore.updateStatus(planId, status);
    }
  }

  async redeliverDeadLetter(deadLetterRecord, options = {}) {
    const topic = this.topicStore.get(deadLetterRecord.topic);
    if (!topic) {
      throw new Error(`主题 ${deadLetterRecord.topic} 不存在`);
    }

    const message = new Message({
      id: deadLetterRecord.messageId,
      businessKey: deadLetterRecord.businessKey,
      topic: deadLetterRecord.topic
    });

    const consumer = new ConsumerSimulator({
      delay: options.delay || 100,
      alwaysSuccess: true,
      customHandler: this.consumerHandler
    });

    const result = await consumer.consume(message, 'redelivery');

    deadLetterRecord.isDeadLetter = false;
    deadLetterRecord.status = 'success';
    deadLetterRecord.addDelivery({
      type: 'redelivery',
      attempt: 'redelivery',
      status: result.success ? 'success' : 'failed',
      result
    });
    this.historyStore.update(deadLetterRecord);

    return {
      messageId: deadLetterRecord.messageId,
      businessKey: deadLetterRecord.businessKey,
      success: result.success,
      result
    };
  }
}

module.exports = DeliveryEngine;
