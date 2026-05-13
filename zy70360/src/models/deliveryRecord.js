const { v4: uuidv4 } = require('uuid');

class DeliveryRecord {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.messageId = options.messageId;
    this.businessKey = options.businessKey;
    this.topic = options.topic;
    this.deliveryCount = options.deliveryCount || 0;
    this.status = options.status || 'pending';
    this.consumerResult = options.consumerResult || null;
    this.isDuplicateIgnored = options.isDuplicateIgnored || false;
    this.isDeadLetter = options.isDeadLetter || false;
    this.deliveries = options.deliveries || [];
    this.createdAt = options.createdAt || Date.now();
    this.updatedAt = options.updatedAt || Date.now();
    this.planId = options.planId;
  }

  addDelivery(delivery) {
    this.deliveries.push({
      id: uuidv4(),
      attempt: this.deliveryCount + 1,
      timestamp: Date.now(),
      ...delivery
    });
    this.deliveryCount++;
    this.updatedAt = Date.now();
  }

  setConsumerResult(result, isIgnored = false) {
    this.consumerResult = result;
    this.isDuplicateIgnored = isIgnored;
    this.updatedAt = Date.now();
  }

  markDeadLetter() {
    this.isDeadLetter = true;
    this.status = 'dead_letter';
    this.updatedAt = Date.now();
  }

  toJSON() {
    return {
      id: this.id,
      messageId: this.messageId,
      businessKey: this.businessKey,
      topic: this.topic,
      deliveryCount: this.deliveryCount,
      status: this.status,
      consumerResult: this.consumerResult,
      isDuplicateIgnored: this.isDuplicateIgnored,
      isDeadLetter: this.isDeadLetter,
      deliveries: this.deliveries,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      planId: this.planId
    };
  }

  static fromJSON(json) {
    return new DeliveryRecord(json);
  }
}

module.exports = DeliveryRecord;
