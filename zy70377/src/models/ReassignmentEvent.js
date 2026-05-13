const { generateId, getCurrentTime } = require('../utils/idGenerator');

const reassignmentEvents = new Map();
const orderReassignmentEvents = new Map();

class ReassignmentEvent {
  constructor(data) {
    this.id = data.id || generateId('reassign');
    this.orderId = data.orderId;
    this.oldRiderId = data.oldRiderId;
    this.newRiderId = data.newRiderId;
    this.reason = data.reason || 'rider_offline';
    this.timestamp = data.timestamp || getCurrentTime();
    this.effectiveFrom = data.effectiveFrom || this.timestamp;
  }

  static create(data) {
    const event = new ReassignmentEvent(data);
    reassignmentEvents.set(event.id, event);
    
    if (!orderReassignmentEvents.has(data.orderId)) {
      orderReassignmentEvents.set(data.orderId, []);
    }
    orderReassignmentEvents.get(data.orderId).push(event);
    
    return event;
  }

  static findByOrderId(orderId) {
    return orderReassignmentEvents.get(orderId) || [];
  }

  static findLatestByOrderId(orderId) {
    const events = ReassignmentEvent.findByOrderId(orderId);
    if (events.length === 0) return null;
    return events.reduce((latest, event) => 
      event.timestamp > latest.timestamp ? event : latest
    );
  }

  static getActiveRider(orderId, currentRiderId) {
    const events = ReassignmentEvent.findByOrderId(orderId);
    if (events.length === 0) return currentRiderId;
    
    const latest = ReassignmentEvent.findLatestByOrderId(orderId);
    return latest ? latest.newRiderId : currentRiderId;
  }
}

module.exports = ReassignmentEvent;
