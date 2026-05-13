class DeliveryRule {
  constructor(options = {}) {
    this.duplicateDelivery = options.duplicateDelivery || { enabled: false, probability: 0, count: 1 };
    this.outOfOrder = options.outOfOrder || { enabled: false, probability: 0 };
    this.delay = options.delay || { enabled: false, min: 0, max: 0 };
    this.consumerFailure = options.consumerFailure || { enabled: false, probability: 0 };
    this.duplicateAck = options.duplicateAck || { enabled: false, probability: 0 };
    this.mergeByBusinessKey = options.mergeByBusinessKey || { enabled: false };
    this.ignoreHistory = options.ignoreHistory || false;
  }

  toJSON() {
    return {
      duplicateDelivery: this.duplicateDelivery,
      outOfOrder: this.outOfOrder,
      delay: this.delay,
      consumerFailure: this.consumerFailure,
      duplicateAck: this.duplicateAck,
      mergeByBusinessKey: this.mergeByBusinessKey,
      ignoreHistory: this.ignoreHistory
    };
  }

  static fromJSON(json) {
    return new DeliveryRule(json);
  }
}

module.exports = DeliveryRule;
