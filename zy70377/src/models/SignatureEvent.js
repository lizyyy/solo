const { generateId, getCurrentTime } = require('../utils/idGenerator');

const signatureEvents = new Map();

class SignatureEvent {
  constructor(data) {
    this.id = data.id || generateId('sign');
    this.orderId = data.orderId;
    this.riderId = data.riderId;
    this.signedBy = data.signedBy;
    this.signatureType = data.signatureType || 'direct';
    this.timestamp = data.timestamp || getCurrentTime();
    this.notes = data.notes || '';
  }

  static create(data) {
    const event = new SignatureEvent(data);
    signatureEvents.set(event.id, event);
    return event;
  }

  static findByOrderId(orderId) {
    const events = Array.from(signatureEvents.values());
    return events.filter(e => e.orderId === orderId);
  }

  static getSignatureByOrderId(orderId) {
    const events = SignatureEvent.findByOrderId(orderId);
    if (events.length === 0) return null;
    return events.reduce((latest, event) => 
      event.timestamp > latest.timestamp ? event : latest
    );
  }
}

module.exports = SignatureEvent;
