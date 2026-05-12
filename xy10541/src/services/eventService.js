const store = require('../stores/memoryStore');
const { EVENT_TYPES } = require('../config/constants');

class EventService {
  static logEvent(orderId, eventType, details = {}, operator = 'system') {
    const event = store.createEvent({
      orderId,
      eventType,
      details,
      operator
    });
    return event;
  }

  static getOrderTimeline(orderId) {
    const events = store.listEvents(orderId);
    const order = store.getOrder(orderId);
    const reschedules = store.listReschedulesByOrder(orderId);
    const compensations = store.listCompensations({ orderId });

    return {
      order,
      events: events.map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        eventType: e.eventType,
        details: e.details,
        operator: e.operator
      })),
      rescheduleHistory: reschedules,
      compensationHistory: compensations
    };
  }

  static logManualCorrection(orderId, beforeState, afterState, operator, reason) {
    return this.logEvent(orderId, EVENT_TYPES.MANUAL_CORRECTION, {
      before: beforeState,
      after: afterState,
      reason
    }, operator);
  }
}

module.exports = EventService;
