class WeakNetSimulator {
  constructor() {
    this.enabled = false;
    this.config = {
      latency: 0,
      jitter: 0,
      loss: 0,
      reorder: 0,
      duplicate: 0,
      disconnect: 0,
      reconnectDelay: 1000,
      replayOnReconnect: true
    };

    this.pendingMessages = [];
    this.messageQueue = [];
    this.outgoingMessages = new Map();
    this.isSimulatedDisconnect = false;
    this.reconnectTimer = null;
    this.processTimer = null;

    this.eventHandlers = {
      messageLost: [],
      messageDelayed: [],
      messageDuplicated: [],
      messageReordered: [],
      disconnected: [],
      reconnected: []
    };
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.flushPending();
    }
  }

  setConfig(config) {
    this.config = { ...this.config, ...config };
  }

  applyProfile(profileName) {
    const profile = WEAKNET_PROFILES[profileName];
    if (profile) {
      this.setConfig({
        latency: profile.latency,
        jitter: profile.jitter,
        loss: profile.loss,
        reorder: profile.reorder,
        duplicate: profile.disconnect,
        disconnect: profile.disconnect
      });
    }
  }

  async simulateOutgoing(message, originalSend) {
    if (!this.enabled) {
      return originalSend(message);
    }

    if (this.isSimulatedDisconnect) {
      this.messageQueue.push({ message, originalSend, isOutgoing: true });
      return;
    }

    const envelope = Utils.deepClone(message);

    if (Math.random() * 100 < this.config.loss) {
      this.emit('messageLost', { message: envelope, direction: 'outgoing' });
      return;
    }

    if (Math.random() * 100 < this.config.duplicate) {
      setTimeout(() => {
        if (!this.isSimulatedDisconnect) {
          this.emit('messageDuplicated', { message: envelope });
          originalSend(Utils.deepClone(envelope));
        }
      }, this.getRandomDelay() + 20);
    }

    const delay = this.getRandomDelay();
    const shouldReorder = Math.random() * 100 < this.config.reorder;

    const sendAction = () => {
      if (!this.isSimulatedDisconnect) {
        if (delay > 100) {
          this.emit('messageDelayed', { message: envelope, delay });
        }
        originalSend(envelope);
      } else {
        this.messageQueue.push({ message: envelope, originalSend, isOutgoing: true });
      }
    };

    if (shouldReorder) {
      this.pendingMessages.push({
        message: envelope,
        originalSend,
        delay,
        sendTime: Date.now() + delay + Utils.randomInt(50, 150)
      });
      this.emit('messageReordered', { message: envelope });
    } else {
      setTimeout(sendAction, delay);
    }

    this.checkDisconnectTrigger();
    this.processPendingMessages();
  }

  async simulateIncoming(message, onReceive) {
    if (!this.enabled) {
      return onReceive(message);
    }

    if (this.isSimulatedDisconnect) {
      this.messageQueue.push({ message, onReceive, isOutgoing: false });
      return;
    }

    const envelope = Utils.deepClone(message);

    if (Math.random() * 100 < this.config.loss) {
      this.emit('messageLost', { message: envelope, direction: 'incoming' });
      return;
    }

    if (Math.random() * 100 < this.config.duplicate) {
      setTimeout(() => {
        if (!this.isSimulatedDisconnect) {
          this.emit('messageDuplicated', { message: envelope, direction: 'incoming' });
          onReceive(Utils.deepClone(envelope));
        }
      }, this.getRandomDelay() + 20);
    }

    const delay = this.getRandomDelay();
    const shouldReorder = Math.random() * 100 < this.config.reorder;

    const receiveAction = () => {
      if (!this.isSimulatedDisconnect) {
        if (delay > 100) {
          this.emit('messageDelayed', { message: envelope, delay, direction: 'incoming' });
        }
        onReceive(envelope);
      } else {
        this.messageQueue.push({ message: envelope, onReceive, isOutgoing: false });
      }
    };

    if (shouldReorder) {
      this.pendingMessages.push({
        message: envelope,
        onReceive,
        delay,
        sendTime: Date.now() + delay + Utils.randomInt(50, 150)
      });
      this.emit('messageReordered', { message: envelope, direction: 'incoming' });
    } else {
      setTimeout(receiveAction, delay);
    }

    this.processPendingMessages();
  }

  getRandomDelay() {
    const baseLatency = this.config.latency;
    const jitter = this.config.jitter;
    
    if (jitter === 0) {
      return baseLatency;
    }

    const jitterOffset = Utils.gaussianRandom(0, jitter / 3);
    return Math.max(0, Math.round(baseLatency + jitterOffset));
  }

  checkDisconnectTrigger() {
    if (this.isSimulatedDisconnect) return;
    
    if (Math.random() * 100 < this.config.disconnect) {
      this.simulateDisconnect();
    }
  }

  simulateDisconnect() {
    if (this.isSimulatedDisconnect) return;
    
    this.isSimulatedDisconnect = true;
    this.emit('disconnected', { reason: 'simulated' });
    
    const reconnectDelay = this.config.reconnectDelay + Utils.randomInt(-200, 500);
    
    this.reconnectTimer = setTimeout(() => {
      this.simulateReconnect();
    }, Math.max(500, reconnectDelay));
  }

  simulateReconnect() {
    if (!this.isSimulatedDisconnect) return;
    
    this.isSimulatedDisconnect = false;
    
    if (this.config.replayOnReconnect) {
      const queued = [...this.messageQueue];
      this.messageQueue = [];
      
      queued.forEach(item => {
        if (item.isOutgoing) {
          setTimeout(() => item.originalSend(item.message), this.getRandomDelay());
        } else {
          setTimeout(() => item.onReceive(item.message), this.getRandomDelay());
        }
      });
    }
    
    this.emit('reconnected', { 
      messagesReplayed: this.config.replayOnReconnect ? this.messageQueue.length : 0 
    });
  }

  processPendingMessages() {
    if (this.processTimer) return;
    
    this.processTimer = setInterval(() => {
      const now = Date.now();
      const toProcess = [];
      
      this.pendingMessages = this.pendingMessages.filter(item => {
        if (item.sendTime <= now) {
          toProcess.push(item);
          return false;
        }
        return true;
      });
      
      toProcess.sort((a, b) => b.sendTime - a.sendTime);
      
      toProcess.forEach(item => {
        if (item.originalSend) {
          item.originalSend(item.message);
        } else if (item.onReceive) {
          item.onReceive(item.message);
        }
      });
      
      if (this.pendingMessages.length === 0) {
        clearInterval(this.processTimer);
        this.processTimer = null;
      }
    }, 50);
  }

  flushPending() {
    const toProcess = [...this.pendingMessages, ...this.messageQueue];
    this.pendingMessages = [];
    this.messageQueue = [];
    
    toProcess.forEach(item => {
      if (item.originalSend) {
        item.originalSend(item.message);
      } else if (item.onReceive) {
        item.onReceive(item.message);
      }
    });
  }

  reset() {
    this.enabled = false;
    this.pendingMessages = [];
    this.messageQueue = [];
    this.isSimulatedDisconnect = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.processTimer) {
      clearInterval(this.processTimer);
      this.processTimer = null;
    }
  }

  on(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(handler);
    }
  }

  off(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
    }
  }

  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  }
}

const weakNet = new WeakNetSimulator();
