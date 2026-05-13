const { v4: uuidv4 } = require('uuid');

class Message {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.topic = options.topic;
    this.businessKey = options.businessKey;
    this.payload = options.payload || {};
    this.createdAt = options.createdAt || Date.now();
    this.metadata = options.metadata || {};
    this.sequence = options.sequence || 0;
  }

  toJSON() {
    return {
      id: this.id,
      topic: this.topic,
      businessKey: this.businessKey,
      payload: this.payload,
      createdAt: this.createdAt,
      metadata: this.metadata,
      sequence: this.sequence
    };
  }

  static fromJSON(json) {
    return new Message(json);
  }
}

module.exports = Message;
