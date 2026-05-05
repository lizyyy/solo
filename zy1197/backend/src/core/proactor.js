const { Event, EventQueue, EventTimeline } = require('./eventSystem');

class Proactor {
  constructor(config = {}) {
    this.config = {
      maxConnections: config.maxConnections || 1000,
      readTimeout: config.readTimeout || 5000,
      writeTimeout: config.writeTimeout || 5000,
      handlerTimeout: config.handlerTimeout || 1000,
      failureRate: config.failureRate || 0,
      callbackDelay: config.callbackDelay || 10,
      threadPoolSize: config.threadPoolSize || 4,
      ...config
    };
    
    this.eventQueue = new EventQueue();
    this.timeline = new EventTimeline();
    this.connections = new Map();
    this.isRunning = false;
    this.completionPortId = null;
    
    this.threadPool = {
      size: this.config.threadPoolSize,
      activeThreads: 0,
      taskQueue: []
    };
    
    this.metrics = {
      eventsProcessed: 0,
      eventsFailed: 0,
      totalLatency: 0,
      queueSizeHistory: [],
      threadUsage: [],
      callbackOrder: [],
      activeConnections: 0,
      completionEvents: 0
    };
  }

  start() {
    this.isRunning = true;
    this.runCompletionPort();
    return this;
  }

  stop() {
    this.isRunning = false;
    if (this.completionPortId) {
      clearTimeout(this.completionPortId);
      this.completionPortId = null;
    }
    return this;
  }

  runCompletionPort() {
    const loop = () => {
      if (!this.isRunning) return;
      
      this.metrics.queueSizeHistory.push({
        timestamp: Date.now(),
        size: this.eventQueue.size()
      });

      while (this.threadPool.taskQueue.length > 0 && 
             this.threadPool.activeThreads < this.threadPool.size &&
             this.isRunning) {
        const task = this.threadPool.taskQueue.shift();
        this.executeInThreadPool(task);
      }

      this.metrics.threadUsage.push({
        timestamp: Date.now(),
        active: this.threadPool.activeThreads,
        max: this.threadPool.size
      });

      this.completionPortId = setTimeout(loop, 10);
    };

    loop();
  }

  executeInThreadPool(task) {
    this.threadPool.activeThreads++;
    
    setTimeout(() => {
      try {
        task();
      } finally {
        this.threadPool.activeThreads--;
      }
    }, 0);
  }

  processCompletionEvent(event) {
    const startTime = Date.now();
    this.metrics.callbackOrder.push(event.id);
    this.metrics.completionEvents++;

    try {
      if (this.shouldFail()) {
        throw new Error(`Simulated failure for completion event ${event.id}`);
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
    
    this.threadPool.taskQueue.push(() => {
      this.processCompletionEvent(new Event('connection_accepted', { connectionId }));
    });
    
    return connection;
  }

  asyncRead(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const asyncOperationId = require('uuid').v4();
    
    setTimeout(() => {
      if (!this.isRunning) return;
      
      const data = `async-data-${asyncOperationId}`;
      connection.readBuffer.push(data);
      connection.lastActivity = Date.now();

      const completionEvent = new Event('read_completed', {
        connectionId,
        data,
        asyncOperationId,
        bufferSize: connection.readBuffer.length
      });

      this.threadPool.taskQueue.push(() => {
        this.processCompletionEvent(completionEvent);
      });
    }, Math.random() * 100);

    setTimeout(() => {
      if (this.connections.has(connectionId)) {
        const conn = this.connections.get(connectionId);
        if (Date.now() - conn.lastActivity > conn.options.readTimeout) {
          const timeoutEvent = new Event('read_timeout', { connectionId, asyncOperationId });
          this.threadPool.taskQueue.push(() => {
            this.processCompletionEvent(timeoutEvent);
          });
        }
      }
    }, connection.options.readTimeout);

    return asyncOperationId;
  }

  asyncWrite(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const asyncOperationId = require('uuid').v4();
    
    setTimeout(() => {
      if (!this.isRunning) return;
      
      connection.writeBuffer.push(data);
      connection.lastActivity = Date.now();

      const completionEvent = new Event('write_completed', {
        connectionId,
        data,
        asyncOperationId,
        bytesWritten: data.length,
        bufferSize: connection.writeBuffer.length
      });

      this.threadPool.taskQueue.push(() => {
        this.processCompletionEvent(completionEvent);
      });
    }, Math.random() * 100);

    setTimeout(() => {
      if (this.connections.has(connectionId)) {
        const conn = this.connections.get(connectionId);
        if (Date.now() - conn.lastActivity > conn.options.writeTimeout) {
          const timeoutEvent = new Event('write_timeout', { connectionId, asyncOperationId });
          this.threadPool.taskQueue.push(() => {
            this.processCompletionEvent(timeoutEvent);
          });
        }
      }
    }, connection.options.writeTimeout);

    return asyncOperationId;
  }

  closeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    connection.status = 'closed';
    this.metrics.activeConnections--;
    
    this.threadPool.taskQueue.push(() => {
      this.processCompletionEvent(new Event('connection_closed', { connectionId }));
    });
    
    return true;
  }

  getMetrics() {
    const timelineStats = this.timeline.getStatistics();
    const avgLatency = this.metrics.eventsProcessed > 0 
      ? (this.metrics.totalLatency / this.metrics.eventsProcessed).toFixed(2)
      : 0;

    const avgThreadUsage = this.metrics.threadUsage.length > 0
      ? (this.metrics.threadUsage.reduce((sum, u) => sum + u.active, 0) / this.metrics.threadUsage.length).toFixed(2)
      : 0;

    return {
      ...this.metrics,
      timeline: timelineStats,
      avgLatency,
      avgThreadUsage,
      currentQueueSize: this.eventQueue.size(),
      activeThreads: this.threadPool.activeThreads,
      maxThreads: this.threadPool.size,
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
    this.threadPool = {
      size: this.config.threadPoolSize,
      activeThreads: 0,
      taskQueue: []
    };
    this.metrics = {
      eventsProcessed: 0,
      eventsFailed: 0,
      totalLatency: 0,
      queueSizeHistory: [],
      threadUsage: [],
      callbackOrder: [],
      activeConnections: 0,
      completionEvents: 0
    };
    return this;
  }
}

module.exports = Proactor;
