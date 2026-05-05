const { Producer, Topic, Message, DeliveryEvent, ReplayTask, AnalysisResult, Report } = require('../models');

class DataStore {
  constructor() {
    this.producers = new Map();
    this.topics = new Map();
    this.messages = new Map();
    this.deliveryEvents = new Map();
    this.replayTasks = new Map();
    this.analysisResults = new Map();
    this.reports = new Map();
  }

  clear() {
    this.producers.clear();
    this.topics.clear();
    this.messages.clear();
    this.deliveryEvents.clear();
    this.replayTasks.clear();
    this.analysisResults.clear();
    this.reports.clear();
  }

  addProducer(data) {
    const producer = new Producer(data);
    this.producers.set(producer.id, producer);
    return producer;
  }

  getProducer(id) {
    return this.producers.get(id);
  }

  getAllProducers() {
    return Array.from(this.producers.values());
  }

  addTopic(data) {
    const topic = new Topic(data);
    this.topics.set(topic.id, topic);
    return topic;
  }

  getTopic(id) {
    return this.topics.get(id);
  }

  getTopicByName(name) {
    return Array.from(this.topics.values()).find(t => t.name === name);
  }

  getAllTopics() {
    return Array.from(this.topics.values());
  }

  addMessage(data) {
    const message = new Message(data);
    this.messages.set(message.id, message);
    return message;
  }

  getMessage(id) {
    return this.messages.get(id);
  }

  getMessagesByTopic(topicName) {
    return Array.from(this.messages.values()).filter(m => m.topic === topicName);
  }

  getMessagesByOrderKey(orderKey) {
    return Array.from(this.messages.values()).filter(m => m.orderKey === orderKey);
  }

  getAllMessages() {
    return Array.from(this.messages.values());
  }

  addDeliveryEvent(data) {
    const event = new DeliveryEvent(data);
    this.deliveryEvents.set(event.id, event);
    return event;
  }

  getDeliveryEvent(id) {
    return this.deliveryEvents.get(id);
  }

  getDeliveryEventsByMessageId(messageId) {
    return Array.from(this.deliveryEvents.values())
      .filter(e => e.messageId === messageId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  getDeliveryEventsByConsumerGroup(consumerGroup) {
    return Array.from(this.deliveryEvents.values())
      .filter(e => e.consumerGroup === consumerGroup)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  getAllDeliveryEvents() {
    return Array.from(this.deliveryEvents.values());
  }

  addReplayTask(data) {
    const task = new ReplayTask(data);
    this.replayTasks.set(task.id, task);
    return task;
  }

  getReplayTask(id) {
    return this.replayTasks.get(id);
  }

  updateReplayTask(id, updates) {
    const task = this.replayTasks.get(id);
    if (task) {
      Object.assign(task, updates);
      task.updatedAt = new Date();
    }
    return task;
  }

  getAllReplayTasks() {
    return Array.from(this.replayTasks.values());
  }

  addAnalysisResult(data) {
    const result = new AnalysisResult(data);
    this.analysisResults.set(result.id, result);
    return result;
  }

  getAnalysisResult(id) {
    return this.analysisResults.get(id);
  }

  getAnalysisResultsByMessageId(messageId) {
    return Array.from(this.analysisResults.values())
      .filter(r => r.messageId === messageId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  getAnalysisResultsByTaskId(taskId) {
    return Array.from(this.analysisResults.values())
      .filter(r => r.taskId === taskId);
  }

  getAllAnalysisResults() {
    return Array.from(this.analysisResults.values());
  }

  addReport(data) {
    const report = new Report(data);
    this.reports.set(report.id, report);
    return report;
  }

  getReport(id) {
    return this.reports.get(id);
  }

  getReportsByTaskId(taskId) {
    return Array.from(this.reports.values())
      .filter(r => r.taskId === taskId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  getAllReports() {
    return Array.from(this.reports.values());
  }
}

module.exports = new DataStore();
