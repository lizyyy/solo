const { getTopicsPath } = require('../utils/path');
const { readJSON, writeJSON, findJSON, appendJSON, removeJSON } = require('../utils/fs');
const Topic = require('../models/topic');

class TopicStore {
  constructor() {
    this.filePath = getTopicsPath();
  }

  getAll() {
    const data = readJSON(this.filePath, []);
    return data.map(Topic.fromJSON);
  }

  get(name) {
    const data = findJSON(this.filePath, t => t.name === name);
    return data ? Topic.fromJSON(data) : null;
  }

  exists(name) {
    return this.get(name) !== null;
  }

  save(topic) {
    const existing = this.get(topic.name);
    if (existing) {
      throw new Error(`主题 ${topic.name} 已存在`);
    }
    appendJSON(this.filePath, topic.toJSON());
    return topic;
  }

  update(topic) {
    const updated = writeJSON(
      this.filePath,
      readJSON(this.filePath, []).map(t => 
        t.name === topic.name ? topic.toJSON() : t
      )
    );
    return topic;
  }

  delete(name) {
    return removeJSON(this.filePath, t => t.name === name) > 0;
  }

  initDefault() {
    if (this.getAll().length === 0) {
      const defaults = [
        new Topic({ name: 'order.created', description: '订单创建', consumerGroup: 'order-service', maxRetry: 3 }),
        new Topic({ name: 'inventory.deducted', description: '库存扣减', consumerGroup: 'inventory-service', maxRetry: 5 }),
        new Topic({ name: 'notification.sms', description: '短信通知', consumerGroup: 'notification-service', maxRetry: 2 })
      ];
      defaults.forEach(t => appendJSON(this.filePath, t.toJSON()));
    }
  }
}

module.exports = TopicStore;
