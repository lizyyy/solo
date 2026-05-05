class Event {
  constructor(type, data = {}, timestamp = Date.now()) {
    this.id = require('uuid').v4();
    this.type = type;
    this.data = data;
    this.timestamp = timestamp;
    this.status = 'pending';
    this.error = null;
  }

  markComplete() {
    this.status = 'completed';
  }

  markFailed(error) {
    this.status = 'failed';
    this.error = error;
  }
}

class EventQueue {
  constructor() {
    this.queue = [];
    this.handlers = new Map();
  }

  enqueue(event) {
    this.queue.push(event);
  }

  dequeue() {
    return this.queue.shift();
  }

  isEmpty() {
    return this.queue.length === 0;
  }

  size() {
    return this.queue.length;
  }

  registerHandler(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);
  }

  getHandlers(eventType) {
    return this.handlers.get(eventType) || [];
  }

  clear() {
    this.queue = [];
    this.handlers.clear();
  }
}

class EventTimeline {
  constructor() {
    this.events = [];
  }

  addEvent(event) {
    this.events.push({
      ...event,
      addedAt: Date.now()
    });
  }

  getEvents() {
    return [...this.events];
  }

  getEventsByType(type) {
    return this.events.filter(e => e.type === type);
  }

  getEventsByStatus(status) {
    return this.events.filter(e => e.status === status);
  }

  getStatistics() {
    const total = this.events.length;
    const completed = this.events.filter(e => e.status === 'completed').length;
    const failed = this.events.filter(e => e.status === 'failed').length;
    const pending = this.events.filter(e => e.status === 'pending').length;

    const eventTypes = {};
    this.events.forEach(e => {
      eventTypes[e.type] = (eventTypes[e.type] || 0) + 1;
    });

    return {
      total,
      completed,
      failed,
      pending,
      eventTypes,
      successRate: total > 0 ? (completed / total * 100).toFixed(2) : 0
    };
  }

  clear() {
    this.events = [];
  }
}

module.exports = { Event, EventQueue, EventTimeline };
