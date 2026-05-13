const { v4: uuidv4 } = require('uuid');

class DeliveryPlan {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.name = options.name;
    this.description = options.description || '';
    this.topic = options.topic;
    this.messages = options.messages || [];
    this.rules = options.rules || {};
    this.schedule = options.schedule || 'immediate';
    this.createdAt = options.createdAt || Date.now();
    this.status = options.status || 'pending';
  }

  validate() {
    if (!this.name) throw new Error('计划名称不能为空');
    if (!this.topic) throw new Error('主题不能为空');
    if (!this.messages || this.messages.length === 0) {
      throw new Error('消息列表不能为空');
    }
    return true;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      topic: this.topic,
      messages: this.messages,
      rules: this.rules,
      schedule: this.schedule,
      createdAt: this.createdAt,
      status: this.status
    };
  }

  static fromJSON(json) {
    return new DeliveryPlan(json);
  }
}

module.exports = DeliveryPlan;
