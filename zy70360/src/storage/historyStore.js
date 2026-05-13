const { getHistoryPath } = require('../utils/path');
const { readJSON, writeJSON, findJSON, appendJSON, updateJSON, filterJSON } = require('../utils/fs');
const DeliveryRecord = require('../models/deliveryRecord');

class HistoryStore {
  constructor() {
    this.filePath = getHistoryPath();
  }

  getAll() {
    const data = readJSON(this.filePath, []);
    return data.map(DeliveryRecord.fromJSON);
  }

  get(id) {
    const data = findJSON(this.filePath, r => r.id === id || r.messageId === id);
    return data ? DeliveryRecord.fromJSON(data) : null;
  }

  getByPlan(planId) {
    const data = filterJSON(this.filePath, r => r.planId === planId);
    return data.map(DeliveryRecord.fromJSON);
  }

  getByBusinessKey(businessKey) {
    const data = filterJSON(this.filePath, r => r.businessKey === businessKey);
    return data.map(DeliveryRecord.fromJSON);
  }

  getByTopic(topic) {
    const data = filterJSON(this.filePath, r => r.topic === topic);
    return data.map(DeliveryRecord.fromJSON);
  }

  getDeadLetters() {
    const data = filterJSON(this.filePath, r => r.isDeadLetter);
    return data.map(DeliveryRecord.fromJSON);
  }

  existsByMessageId(messageId) {
    return findJSON(this.filePath, r => r.messageId === messageId) !== null;
  }

  save(record) {
    appendJSON(this.filePath, record.toJSON());
    return record;
  }

  update(record) {
    return updateJSON(
      this.filePath,
      r => r.id === record.id,
      () => record.toJSON()
    );
  }

  clear() {
    writeJSON(this.filePath, []);
  }
}

module.exports = HistoryStore;
