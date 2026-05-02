const EventEmitter = require('events');
const WebSocket = require('ws');
const { createTelemetryMessage, validateTelemetryData, EventType, createEventMessage } = require('../protocols');

const ReceiverState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error'
};

class RealtimeReceiver extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.wsServer = null;
    this.clients = new Map();
    this.state = ReceiverState.DISCONNECTED;
    this.bufferSize = options.bufferSize || 1000;
    this.telemetryBuffer = [];
    this.stats = {
      totalReceived: 0,
      lastReceivedAt: null,
      errors: 0,
      clientCount: 0
    };
    this.validationEnabled = options.validation !== false;
  }

  startServer(httpServer, path = '/ws/realtime') {
    if (this.wsServer) {
      throw new Error('Server already started');
    }

    this.wsServer = new WebSocket.Server({ server: httpServer, path });
    this.state = ReceiverState.CONNECTED;

    this.wsServer.on('connection', (ws, req) => {
      const clientId = this._generateClientId();
      const clientInfo = {
        id: clientId,
        ws,
        ip: req.socket.remoteAddress,
        connectedAt: Date.now(),
        lastMessageAt: null
      };

      this.clients.set(clientId, clientInfo);
      this.stats.clientCount = this.clients.size;

      this.emit('clientConnected', { clientId, clientInfo });

      ws.on('message', (data) => {
        this._handleMessage(clientId, data);
      });

      ws.on('close', (code, reason) => {
        this.clients.delete(clientId);
        this.stats.clientCount = this.clients.size;
        this.emit('clientDisconnected', { clientId, code, reason });
      });

      ws.on('error', (error) => {
        this.emit('clientError', { clientId, error });
      });

      ws.send(JSON.stringify({
        type: 'info',
        message: 'Connected to realtime telemetry receiver',
        clientId
      }));
    });

    this.emit('serverStarted', { path });
    return this.wsServer;
  }

  stopServer() {
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = null;
    }
    this.clients.clear();
    this.state = ReceiverState.DISCONNECTED;
    this.stats.clientCount = 0;
    this.emit('serverStopped');
  }

  _handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString());
      const client = this.clients.get(clientId);
      
      if (client) {
        client.lastMessageAt = Date.now();
      }

      if (message.type === 'telemetry' || message.data) {
        this._handleTelemetry(message, clientId);
      } else if (message.type === 'control') {
        this._handleControl(message, clientId);
      } else if (message.type === 'event') {
        this._handleEvent(message, clientId);
      } else {
        this.emit('unknownMessage', { clientId, message });
      }
    } catch (e) {
      this.stats.errors++;
      this.emit('parseError', { clientId, error: e, data: data.toString() });
    }
  }

  _handleTelemetry(message, clientId) {
    const telemetryData = message.data || message;
    
    if (this.validationEnabled) {
      const validation = validateTelemetryData(telemetryData);
      
      if (!validation.valid) {
        this.emit('validationError', { 
          clientId, 
          errors: validation.errors, 
          data: telemetryData 
        });
        if (this.validationEnabled === 'strict') {
          return;
        }
      }
      
      if (validation.warnings.length > 0) {
        this.emit('validationWarning', {
          clientId,
          warnings: validation.warnings,
          data: telemetryData
        });
      }
    }

    const telemetryMsg = createTelemetryMessage({
      timestamp: telemetryData.timestamp || Date.now(),
      sequence: telemetryData.sequence || this.stats.totalReceived,
      data: telemetryData,
      latency: telemetryData.latency
    });

    this._addToBuffer(telemetryMsg);
    
    this.stats.totalReceived++;
    this.stats.lastReceivedAt = Date.now();

    this.emit('telemetry', telemetryMsg, clientId);
  }

  _handleControl(message, clientId) {
    this.emit('control', message, clientId);
  }

  _handleEvent(message, clientId) {
    this.emit('event', message, clientId);
  }

  _addToBuffer(telemetryMsg) {
    this.telemetryBuffer.push(telemetryMsg);
    
    if (this.telemetryBuffer.length > this.bufferSize) {
      const removed = this.telemetryBuffer.shift();
      this.emit('bufferOverflow', { removed, bufferSize: this.telemetryBuffer.length });
    }
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  broadcast(message) {
    const msgStr = JSON.stringify(message);
    let count = 0;
    
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(msgStr);
        count++;
      }
    });
    
    return count;
  }

  getBuffer() {
    return [...this.telemetryBuffer];
  }

  clearBuffer() {
    const oldBuffer = this.telemetryBuffer;
    this.telemetryBuffer = [];
    return oldBuffer;
  }

  getStats() {
    return {
      ...this.stats,
      state: this.state,
      bufferSize: this.telemetryBuffer.length,
      maxBufferSize: this.bufferSize
    };
  }

  _generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = {
  RealtimeReceiver,
  ReceiverState
};
