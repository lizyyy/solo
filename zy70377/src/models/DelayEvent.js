const { generateId, getCurrentTime } = require('../utils/idGenerator');

const delayEvents = new Map();
const orderDelayEvents = new Map();

class DelayEvent {
  constructor(data) {
    this.id = data.id || generateId('delay');
    this.orderId = data.orderId;
    this.type = data.type;
    this.reason = data.reason;
    this.delayMinutes = data.delayMinutes || 0;
    this.affectedAreas = data.affectedAreas || [];
    this.timestamp = data.timestamp || getCurrentTime();
    this.resolved = data.resolved || false;
    this.resolvedAt = null;
  }

  static create(data) {
    const event = new DelayEvent(data);
    delayEvents.set(event.id, event);
    
    if (!orderDelayEvents.has(data.orderId)) {
      orderDelayEvents.set(data.orderId, []);
    }
    orderDelayEvents.get(data.orderId).push(event);
    
    return event;
  }

  static findByOrderId(orderId) {
    return orderDelayEvents.get(orderId) || [];
  }

  static findActiveByOrderId(orderId) {
    const events = DelayEvent.findByOrderId(orderId);
    return events.filter(e => !e.resolved);
  }

  static resolve(id) {
    const event = delayEvents.get(id);
    if (event) {
      event.resolved = true;
      event.resolvedAt = getCurrentTime();
    }
    return event;
  }
}

module.exports = DelayEvent;
