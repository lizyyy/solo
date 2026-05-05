const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class Producer {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.topic = data.topic;
    this.enabled = data.enabled !== false;
    this.createdAt = data.createdAt ? moment(data.createdAt).toDate() : new Date();
    this.metadata = data.metadata || {};
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      topic: this.topic,
      enabled: this.enabled,
      createdAt: this.createdAt.toISOString(),
      metadata: this.metadata
    };
  }
}

class Topic {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.partitions = data.partitions || 1;
    this.replicationFactor = data.replicationFactor || 1;
    this.retentionMs = data.retentionMs || 86400000; // 1 day
    this.orderKeyEnabled = data.orderKeyEnabled !== false;
    this.createdAt = data.createdAt ? moment(data.createdAt).toDate() : new Date();
    this.metadata = data.metadata || {};
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      partitions: this.partitions,
      replicationFactor: this.replicationFactor,
      retentionMs: this.retentionMs,
      orderKeyEnabled: this.orderKeyEnabled,
      createdAt: this.createdAt.toISOString(),
      metadata: this.metadata
    };
  }
}

class Message {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.topic = data.topic;
    this.partition = data.partition || 0;
    this.offset = data.offset;
    this.key = data.key;
    this.value = data.value;
    this.orderKey = data.orderKey;
    this.producerId = data.producerId;
    this.timestamp = data.timestamp ? moment(data.timestamp).toDate() : new Date();
    this.headers = data.headers || {};
    this.metadata = data.metadata || {};
  }

  toJSON() {
    return {
      id: this.id,
      topic: this.topic,
      partition: this.partition,
      offset: this.offset,
      key: this.key,
      value: this.value,
      orderKey: this.orderKey,
      producerId: this.producerId,
      timestamp: this.timestamp.toISOString(),
      headers: this.headers,
      metadata: this.metadata
    };
  }
}

class DeliveryEvent {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.messageId = data.messageId;
    this.consumerId = data.consumerId;
    this.consumerGroup = data.consumerGroup;
    this.type = data.type; // 'deliver', 'ack', 'nack', 'retry', 'dead-letter'
    this.attempt = data.attempt || 1;
    this.timestamp = data.timestamp ? moment(data.timestamp).toDate() : new Date();
    this.durationMs = data.durationMs;
    this.error = data.error;
    this.metadata = data.metadata || {};
  }

  toJSON() {
    return {
      id: this.id,
      messageId: this.messageId,
      consumerId: this.consumerId,
      consumerGroup: this.consumerGroup,
      type: this.type,
      attempt: this.attempt,
      timestamp: this.timestamp.toISOString(),
      durationMs: this.durationMs,
      error: this.error,
      metadata: this.metadata
    };
  }
}

class ReplayTask {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.description = data.description;
    this.status = data.status || 'pending'; // pending, running, completed, failed
    this.messageIds = data.messageIds || [];
    this.consumerGroup = data.consumerGroup;
    this.speed = data.speed || 1; // 1 = real time, 0 = as fast as possible
    this.startTime = data.startTime ? moment(data.startTime).toDate() : null;
    this.endTime = data.endTime ? moment(data.endTime).toDate() : null;
    this.results = data.results || {};
    this.createdAt = data.createdAt ? moment(data.createdAt).toDate() : new Date();
    this.updatedAt = data.updatedAt ? moment(data.updatedAt).toDate() : new Date();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      status: this.status,
      messageIds: this.messageIds,
      consumerGroup: this.consumerGroup,
      speed: this.speed,
      startTime: this.startTime ? this.startTime.toISOString() : null,
      endTime: this.endTime ? this.endTime.toISOString() : null,
      results: this.results,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}

class AnalysisResult {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.messageId = data.messageId;
    this.taskId = data.taskId;
    this.problems = data.problems || [];
    this.deliveryChain = data.deliveryChain || [];
    this.finalStatus = data.finalStatus;
    this.ackLost = data.ackLost || false;
    this.duplicateDeliveries = data.duplicateDeliveries || 0;
    this.maxRetryReached = data.maxRetryReached || false;
    this.deadLetterReason = data.deadLetterReason;
    this.orderKeyViolation = data.orderKeyViolation || false;
    this.consumerBacklog = data.consumerBacklog || 0;
    this.idempotencyRisk = data.idempotencyRisk || false;
    this.createdAt = data.createdAt ? moment(data.createdAt).toDate() : new Date();
  }

  toJSON() {
    return {
      id: this.id,
      messageId: this.messageId,
      taskId: this.taskId,
      problems: this.problems,
      deliveryChain: this.deliveryChain,
      finalStatus: this.finalStatus,
      ackLost: this.ackLost,
      duplicateDeliveries: this.duplicateDeliveries,
      maxRetryReached: this.maxRetryReached,
      deadLetterReason: this.deadLetterReason,
      orderKeyViolation: this.orderKeyViolation,
      consumerBacklog: this.consumerBacklog,
      idempotencyRisk: this.idempotencyRisk,
      createdAt: this.createdAt.toISOString()
    };
  }
}

class Report {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.taskId = data.taskId;
    this.format = data.format; // 'markdown' or 'json'
    this.title = data.title;
    this.summary = data.summary;
    this.details = data.details;
    this.createdAt = data.createdAt ? moment(data.createdAt).toDate() : new Date();
  }

  toJSON() {
    return {
      id: this.id,
      taskId: this.taskId,
      format: this.format,
      title: this.title,
      summary: this.summary,
      details: this.details,
      createdAt: this.createdAt.toISOString()
    };
  }
}

module.exports = {
  Producer,
  Topic,
  Message,
  DeliveryEvent,
  ReplayTask,
  AnalysisResult,
  Report
};
