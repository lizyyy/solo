const DeliveryRule = require('../models/deliveryRule');

class RuleEngine {
  constructor(rule = {}) {
    this.rule = DeliveryRule.fromJSON(rule);
  }

  shouldDuplicateDelivery() {
    if (!this.rule.duplicateDelivery.enabled) return false;
    return Math.random() < this.rule.duplicateDelivery.probability;
  }

  getDuplicateCount() {
    return this.rule.duplicateDelivery.count || 1;
  }

  shouldOutOfOrder() {
    if (!this.rule.outOfOrder.enabled) return false;
    return Math.random() < this.rule.outOfOrder.probability;
  }

  shouldDelay() {
    return this.rule.delay.enabled;
  }

  getRandomDelay() {
    if (!this.rule.delay.enabled) return 0;
    const { min = 0, max = 0 } = this.rule.delay;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  shouldConsumerFail() {
    if (!this.rule.consumerFailure.enabled) return false;
    return Math.random() < this.rule.consumerFailure.probability;
  }

  shouldDuplicateAck() {
    if (!this.rule.duplicateAck.enabled) return false;
    return Math.random() < this.rule.duplicateAck.probability;
  }

  shouldMergeByBusinessKey() {
    return this.rule.mergeByBusinessKey.enabled;
  }

  shouldIgnoreHistory() {
    return this.rule.ignoreHistory === true;
  }

  applyOutOfOrder(messages) {
    if (!this.shouldOutOfOrder() || messages.length < 2) {
      return [...messages];
    }

    const result = [...messages];
    const numSwaps = Math.max(1, Math.floor(messages.length * 0.3));
    
    for (let i = 0; i < numSwaps; i++) {
      const idx1 = Math.floor(Math.random() * result.length);
      const idx2 = Math.floor(Math.random() * result.length);
      [result[idx1], result[idx2]] = [result[idx2], result[idx1]];
    }

    return result;
  }

  mergeMessagesByBusinessKey(messages) {
    if (!this.shouldMergeByBusinessKey()) {
      return messages;
    }

    const grouped = new Map();
    
    messages.forEach((msg, idx) => {
      const key = msg.businessKey || msg.id;
      if (!grouped.has(key)) {
        grouped.set(key, { message: msg, count: 0 });
      }
      grouped.get(key).count++;
    });

    return Array.from(grouped.values()).map(item => ({
      ...item.message,
      mergeInfo: {
        totalCount: item.count,
        isMerged: item.count > 1
      }
    }));
  }

  getRuleSummary() {
    return {
      duplicateDelivery: this.rule.duplicateDelivery,
      outOfOrder: this.rule.outOfOrder,
      delay: this.rule.delay,
      consumerFailure: this.rule.consumerFailure,
      duplicateAck: this.rule.duplicateAck,
      mergeByBusinessKey: this.rule.mergeByBusinessKey,
      ignoreHistory: this.rule.ignoreHistory
    };
  }
}

module.exports = RuleEngine;
