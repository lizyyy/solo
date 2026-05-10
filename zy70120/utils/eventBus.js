const EventEmitter = require('events');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  emitEvent(type, payload) {
    const event = {
      id: Date.now(),
      type,
      timestamp: new Date().toISOString(),
      payload
    };
    console.log(`[EVENT] ${type}:`, JSON.stringify(payload));
    this.emit(type, event);
    this.emit('*', event);
  }
}

module.exports = new EventBus();
