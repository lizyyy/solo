const { Event, EventQueue, EventTimeline } = require('./eventSystem');

class Reactor {
  constructor(config = {}) {
    this.config = {
      maxConnections: config.maxConnections || 1000,
      readTimeout: config.readTimeout || 5000,
      writeTimeout: config.writeTimeout || 5000,
      handlerTimeout: config.handlerTimeout || 1000,
      failureRate: config.failureRate || 0,
      callbackDelay: config.callbackDelay || 10,
      ...config
    };
    
    this.eventQueue = new EventQueue();
    this.timeline = new EventTimeline();
    this.connections = new Map();
    this.isRunning = false;
    this.eventLoopId = null;
    
    this.metrics = {
      eventsProcessed: 0,
      eventsFailed: 0,
      totalLatency: 0,
      queueSizeHistory: [],
      threadUsage: 0,
      callbackOrder: [],
      activeConnections: 0
    };
  }

  start() {
    this.isRunning = true;
    this.runEventLoop();
    return this;
  }

  stop() {
    this.isRunning = false;
    if (this.eventLoopId) {
      clearTimeout(this.eventLoopId);
      this.eventLoopId = null;
    }
    return this;
  }

  runEventLoop() {
    const loop = () => {
      if (!this.isRunning) return;
      
      this.metrics.queueSizeHistory.push({
        timestamp: Date.now(),
        size: this.eventQueue.size()
      });

      while (!this.eventQueue.isEmpty() && this.isRunning) {
        const event = this.eventQueue.dequeue();
        this.processEvent(event);
      }

      this.eventLoopId = setTimeout(loop, 10);
    };

    loop();
  }

  processEvent(event) {
    const startTime = Date.now();
    this.metrics.callbackOrder.push(event.id);

    try {
      if (this.shouldFail()) {
        throw new Error(`Simulated failure for event ${event.id}`);
      }

      const handlers = this.eventQueue.getHandlers(event.type);
      for (const handler of handlers) {
        if (this.config.callbackDelay > 0) {
          this.delay(this.config.callbackDelay);
        }
        handler(event);
      }

      event.markComplete();
      this.metrics.eventsProcessed++;
      this.metrics.totalLatency += (Date.now() - startTime);
    } catch (error) {
      event.markFailed(error);
      this.metrics.eventsFailed++;
    }

    this.timeline.addEvent(event);
  }

  shouldFail() {
    return Math.random() < this.config.failureRate;
  }

  delay(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      
    }
  }

  registerHandler(eventType, handler) {
    this.eventQueue.registerHandler(eventType, handler);
    return this;
  }

  createConnection(connectionId, options = {}) {
    const connection = {
      id: connectionId,
      createdAt: Date.now(),
      status: 'active',
      readBuffer: [],
      writeBuffer: [],
      lastActivity: Date.now(),
      options: {
        readTimeout: options.readTimeout || this.config.readTimeout,
        writeTimeout: options.writeTimeout || this.config.writeTimeout,
        ...options
      }
    };

    this.connections.set(connectionId, connection);
    this.metrics.activeConnections++;
    
    this.eventQueue.enqueue(new Event('connection_accepted', { connectionId }));
    
    return connection;
  }

  simulateRead(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    connection.readBuffer.push(data);
    connection.lastActivity = Date.now();

    const event = new Event('read_ready', {
      connectionId,
      data,
      bufferSize: connection.readBuffer.length
    });

    this.eventQueue.enqueue(event);

    setTimeout(() => {
      if (this.connections.has(connectionId)) {
        const conn = this.connections.get(connectionId);
        if (Date.now() - conn.lastActivity > conn.options.readTimeout) {
          const timeoutEvent = new Event('read_timeout', { connectionId });
          this.eventQueue.enqueue(timeoutEvent);
        }
      }
    }, connection.options.readTimeout);

    return event;
  }

  simulateWrite(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    connection.writeBuffer.push(data);
    connection.lastActivity = Date.now();

    const event = new Event('write_ready', {
      connectionId,
      data,
      bufferSize: connection.writeBuffer.length
    });

    this.eventQueue.enqueue(event);

    setTimeout(() => {
      if (this.connections.has(connectionId)) {
        const conn = this.connections.get(connectionId);
        if (Date.now() - conn.lastActivity > conn.options.writeTimeout) {
          const timeoutEvent = new Event('write_timeout', { connectionId });
          this.eventQueue.enqueue(timeoutEvent);
        }
      }
    }, connection.options.writeTimeout);

    return event;
  }

  closeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    connection.status = 'closed';
    this.metrics.activeConnections--;
    
    const event = new Event('connection_closed', { connectionId });
    this.eventQueue.enqueue(event);
    
    return true;
  }

  getMetrics() {
    const timelineStats = this.timeline.getStatistics();
    const avgLatency = this.metrics.eventsProcessed > 0 
      ? (this.metrics.totalLatency / this.metrics.eventsProcessed).toFixed(2)
      : 0;

    return {
      ...this.metrics,
      timeline: timelineStats,
      avgLatency,
      currentQueueSize: this.eventQueue.size(),
      activeConnections: this.metrics.activeConnections,
      totalConnections: this.connections.size,
      successRate: (this.metrics.eventsProcessed + this.metrics.eventsFailed) > 0
        ? (this.metrics.eventsProcessed / (this.metrics.eventsProcessed + this.metrics.eventsFailed) * 100).toFixed(2)
        : 0
    };
  }

  getTimeline() {
    return this.timeline.getEvents();
  }

  reset() {
    this.eventQueue.clear();
    this.timeline.clear();
    this.connections.clear();
    this.metrics = {
      eventsProcessed: 0,
      eventsFailed: 0,
      totalLatency: 0,
      queueSizeHistory: [],
      threadUsage: 0,
      callbackOrder: [],
      activeConnections: 0
    };
    return this;
  }
}

module.exports = Reactor;
