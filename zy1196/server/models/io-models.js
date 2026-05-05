const { v4: uuidv4 } = require('uuid');

const IO_TYPES = {
  BLOCKING: 'blocking',
  NON_BLOCKING: 'non_blocking',
  MULTIPLEXING: 'multiplexing',
  ASYNC: 'async'
};

const FD_STATES = {
  IDLE: 'idle',
  WAITING: 'waiting',
  READY: 'ready',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  TIMEOUT: 'timeout',
  ERROR: 'error'
};

class FileDescriptor {
  constructor(id, config) {
    this.id = id;
    this.fdNum = id + 3;
    this.state = FD_STATES.IDLE;
    this.bufferSize = config.bufferSize || 1024;
    this.buffer = Buffer.alloc(this.bufferSize);
    this.dataArrivalTime = config.dataArrivalTime || 100;
    this.processingTime = config.processingTime || 50;
    this.timeout = config.timeout || 5000;
    
    this.createdAt = Date.now();
    this.startedAt = null;
    this.readyAt = null;
    this.processingStartedAt = null;
    this.completedAt = null;
    
    this.bytesRead = 0;
    this.bytesWritten = 0;
    this.pollCount = 0;
    this.emptyPollCount = 0;
  }

  start() {
    this.state = FD_STATES.WAITING;
    this.startedAt = Date.now();
  }

  markReady() {
    if (this.state === FD_STATES.WAITING) {
      this.state = FD_STATES.READY;
      this.readyAt = Date.now();
    }
  }

  startProcessing() {
    if (this.state === FD_STATES.READY) {
      this.state = FD_STATES.PROCESSING;
      this.processingStartedAt = Date.now();
    }
  }

  complete(bytesRead = this.bufferSize) {
    this.state = FD_STATES.COMPLETED;
    this.completedAt = Date.now();
    this.bytesRead = bytesRead;
  }

  markTimeout() {
    this.state = FD_STATES.TIMEOUT;
    this.completedAt = Date.now();
  }

  getMetrics() {
    const now = Date.now();
    return {
      id: this.id,
      fdNum: this.fdNum,
      state: this.state,
      waitTime: this.readyAt ? this.readyAt - this.startedAt : null,
      processingTime: this.completedAt && this.processingStartedAt 
        ? this.completedAt - this.processingStartedAt 
        : null,
      totalTime: this.completedAt 
        ? this.completedAt - this.startedAt 
        : (this.startedAt ? now - this.startedAt : null),
      bytesRead: this.bytesRead,
      pollCount: this.pollCount,
      emptyPollCount: this.emptyPollCount
    };
  }
}

class ReadyQueue {
  constructor() {
    this.queue = [];
  }

  enqueue(fd) {
    if (!this.queue.includes(fd)) {
      this.queue.push(fd);
    }
  }

  dequeue() {
    return this.queue.shift();
  }

  peek() {
    return this.queue[0];
  }

  size() {
    return this.queue.length;
  }

  isEmpty() {
    return this.queue.length === 0;
  }

  toArray() {
    return [...this.queue];
  }

  clear() {
    this.queue = [];
  }
}

class CompletionQueue {
  constructor() {
    this.queue = [];
  }

  add(fd, result) {
    this.queue.push({
      fd,
      result,
      timestamp: Date.now()
    });
  }

  poll() {
    return this.queue.shift();
  }

  size() {
    return this.queue.length;
  }

  isEmpty() {
    return this.queue.length === 0;
  }

  toArray() {
    return [...this.queue];
  }

  clear() {
    this.queue = [];
  }
}

class IOModelSimulator {
  constructor(type, config) {
    this.type = type;
    this.config = config;
    this.id = uuidv4();
    this.name = this.getModelName(type);
    
    this.fds = [];
    this.readyQueue = new ReadyQueue();
    this.completionQueue = new CompletionQueue();
    
    this.eventLoopTicks = 0;
    this.isRunning = false;
    this.startedAt = null;
    this.stoppedAt = null;
    
    this.metrics = {
      threadCount: this.getInitialThreadCount(),
      cpuSpins: 0,
      totalWaitTime: 0,
      totalProcessingTime: 0,
      totalBytesRead: 0,
      completedCount: 0,
      timeoutCount: 0,
      pollCount: 0,
      emptyPollCount: 0
    };
    
    this.initializeFds();
  }

  getModelName(type) {
    const names = {
      [IO_TYPES.BLOCKING]: '阻塞 I/O',
      [IO_TYPES.NON_BLOCKING]: '非阻塞 I/O',
      [IO_TYPES.MULTIPLEXING]: 'I/O 多路复用',
      [IO_TYPES.ASYNC]: '异步 I/O'
    };
    return names[type] || '未知模型';
  }

  getInitialThreadCount() {
    switch (this.type) {
      case IO_TYPES.BLOCKING:
        return this.config.connectionCount;
      case IO_TYPES.NON_BLOCKING:
        return 1;
      case IO_TYPES.MULTIPLEXING:
        return 1;
      case IO_TYPES.ASYNC:
        return 2;
      default:
        return 1;
    }
  }

  initializeFds() {
    const count = this.config.connectionCount;
    for (let i = 0; i < count; i++) {
      const fd = new FileDescriptor(i, {
        bufferSize: this.config.bufferSize,
        dataArrivalTime: this.config.dataArrivalTime + 
          (Math.random() * this.config.dataArrivalJitter * 2 - this.config.dataArrivalJitter),
        processingTime: this.config.processingTime + 
          (Math.random() * this.config.processingJitter * 2 - this.config.processingJitter),
        timeout: this.config.timeout
      });
      this.fds.push(fd);
    }
  }

  async simulateBlocking() {
    const results = [];
    
    for (const fd of this.fds) {
      fd.start();
      this.metrics.totalWaitTime += fd.dataArrivalTime;
      
      await this.delay(fd.dataArrivalTime);
      fd.markReady();
      
      fd.startProcessing();
      await this.delay(fd.processingTime);
      
      fd.complete();
      this.metrics.totalProcessingTime += fd.processingTime;
      this.metrics.totalBytesRead += fd.bytesRead;
      this.metrics.completedCount++;
      
      results.push(fd.getMetrics());
    }
    
    return results;
  }

  async simulateNonBlocking() {
    const results = [];
    const pendingFds = [...this.fds];
    
    for (const fd of pendingFds) {
      fd.start();
    }
    
    while (pendingFds.length > 0) {
      this.eventLoopTicks++;
      this.metrics.pollCount += pendingFds.length;
      
      const readyFds = [];
      
      for (let i = pendingFds.length - 1; i >= 0; i--) {
        const fd = pendingFds[i];
        fd.pollCount++;
        
        const elapsed = Date.now() - fd.startedAt;
        
        if (elapsed >= fd.dataArrivalTime) {
          fd.markReady();
          readyFds.push(fd);
          pendingFds.splice(i, 1);
        } else {
          fd.emptyPollCount++;
          this.metrics.emptyPollCount++;
          this.metrics.cpuSpins++;
        }
        
        if (elapsed > fd.timeout) {
          fd.markTimeout();
          this.metrics.timeoutCount++;
          pendingFds.splice(i, 1);
          results.push(fd.getMetrics());
        }
      }
      
      for (const fd of readyFds) {
        fd.startProcessing();
        await this.delay(fd.processingTime);
        fd.complete();
        
        this.metrics.totalProcessingTime += fd.processingTime;
        this.metrics.totalBytesRead += fd.bytesRead;
        this.metrics.completedCount++;
        
        results.push(fd.getMetrics());
      }
      
      await this.delay(1);
    }
    
    return results;
  }

  async simulateMultiplexing() {
    const results = [];
    
    for (const fd of this.fds) {
      fd.start();
    }
    
    const epollSet = new Set(this.fds);
    
    while (epollSet.size > 0) {
      this.eventLoopTicks++;
      this.metrics.pollCount++;
      
      const readyFds = [];
      
      for (const fd of epollSet) {
        const elapsed = Date.now() - fd.startedAt;
        
        if (elapsed >= fd.dataArrivalTime) {
          fd.markReady();
          this.readyQueue.enqueue(fd);
          readyFds.push(fd);
        }
        
        if (elapsed > fd.timeout) {
          fd.markTimeout();
          this.metrics.timeoutCount++;
          epollSet.delete(fd);
          results.push(fd.getMetrics());
        }
      }
      
      for (const fd of readyFds) {
        epollSet.delete(fd);
      }
      
      while (!this.readyQueue.isEmpty()) {
        const fd = this.readyQueue.dequeue();
        fd.startProcessing();
        await this.delay(fd.processingTime);
        fd.complete();
        
        this.metrics.totalProcessingTime += fd.processingTime;
        this.metrics.totalBytesRead += fd.bytesRead;
        this.metrics.completedCount++;
        
        this.completionQueue.add(fd, { bytesRead: fd.bytesRead });
        results.push(fd.getMetrics());
      }
      
      if (readyFds.length === 0) {
        this.metrics.cpuSpins++;
        await this.delay(5);
      }
    }
    
    return results;
  }

  async simulateAsync() {
    const results = [];
    const promises = [];
    
    for (const fd of this.fds) {
      fd.start();
      
      const promise = new Promise((resolve) => {
        setTimeout(() => {
          fd.markReady();
          this.readyQueue.enqueue(fd);
          
          setTimeout(() => {
            fd.startProcessing();
            setTimeout(() => {
              fd.complete();
              
              this.metrics.totalProcessingTime += fd.processingTime;
              this.metrics.totalBytesRead += fd.bytesRead;
              this.metrics.completedCount++;
              
              this.completionQueue.add(fd, { bytesRead: fd.bytesRead });
              
              const elapsed = Date.now() - fd.startedAt;
              this.metrics.totalWaitTime += fd.dataArrivalTime;
              
              resolve(fd.getMetrics());
            }, fd.processingTime);
          }, 0);
        }, fd.dataArrivalTime);
      });
      
      promises.push(promise);
    }
    
    while (promises.length > 0) {
      this.eventLoopTicks++;
      
      const completed = await Promise.race(promises.map((p, i) => p.then(r => ({ result: r, index: i }))));
      results.push(completed.result);
      promises.splice(completed.index, 1);
    }
    
    return results;
  }

  async run() {
    if (this.isRunning) {
      throw new Error('模拟已经在运行中');
    }
    
    this.isRunning = true;
    this.startedAt = Date.now();
    
    let results;
    
    switch (this.type) {
      case IO_TYPES.BLOCKING:
        results = await this.simulateBlocking();
        break;
      case IO_TYPES.NON_BLOCKING:
        results = await this.simulateNonBlocking();
        break;
      case IO_TYPES.MULTIPLEXING:
        results = await this.simulateMultiplexing();
        break;
      case IO_TYPES.ASYNC:
        results = await this.simulateAsync();
        break;
      default:
        throw new Error(`未知的 I/O 模型类型: ${this.type}`);
    }
    
    this.isRunning = false;
    this.stoppedAt = Date.now();
    
    return this.getReport(results);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getReport(fdResults) {
    const totalTime = this.stoppedAt - this.startedAt;
    const avgWaitTime = this.metrics.totalWaitTime / Math.max(1, this.metrics.completedCount);
    const avgProcessingTime = this.metrics.totalProcessingTime / Math.max(1, this.metrics.completedCount);
    
    const throughput = (this.metrics.totalBytesRead / 1024) / (totalTime / 1000);
    
    return {
      experimentId: this.id,
      modelType: this.type,
      modelName: this.name,
      config: this.config,
      metrics: {
        ...this.metrics,
        eventLoopTicks: this.eventLoopTicks,
        totalTime,
        avgWaitTime,
        avgProcessingTime,
        throughput: `${throughput.toFixed(2)} KB/s`,
        throughputBytes: this.metrics.totalBytesRead / (totalTime / 1000)
      },
      fdResults: fdResults.map(r => ({
        id: r.id,
        fdNum: r.fdNum,
        state: r.state,
        waitTime: r.waitTime,
        processingTime: r.processingTime,
        totalTime: r.totalTime,
        bytesRead: r.bytesRead,
        pollCount: r.pollCount,
        emptyPollCount: r.emptyPollCount
      })),
      summary: {
        totalConnections: this.config.connectionCount,
        completed: this.metrics.completedCount,
        timeout: this.metrics.timeoutCount,
        totalTime: `${totalTime}ms`,
        throughput: `${throughput.toFixed(2)} KB/s`
      }
    };
  }

  getCurrentState() {
    return {
      id: this.id,
      modelType: this.type,
      modelName: this.name,
      isRunning: this.isRunning,
      eventLoopTicks: this.eventLoopTicks,
      metrics: { ...this.metrics },
      readyQueueSize: this.readyQueue.size(),
      completionQueueSize: this.completionQueue.size(),
      fdStates: this.fds.map(fd => ({
        id: fd.id,
        fdNum: fd.fdNum,
        state: fd.state
      }))
    };
  }
}

module.exports = {
  IO_TYPES,
  FD_STATES,
  FileDescriptor,
  ReadyQueue,
  CompletionQueue,
  IOModelSimulator
};
