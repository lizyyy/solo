class WebSocketHandler {
  constructor(wss) {
    this.wss = wss;
    this.clients = new Map();
    
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);
      
      console.log(`WebSocket 客户端连接: ${clientId}`);
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(clientId, data);
        } catch (err) {
          console.error('WebSocket 消息解析错误:', err);
        }
      });
      
      ws.on('close', () => {
        console.log(`WebSocket 客户端断开: ${clientId}`);
        this.clients.delete(clientId);
      });
      
      ws.on('error', (err) => {
        console.error(`WebSocket 错误 (${clientId}):`, err);
        this.clients.delete(clientId);
      });
      
      this.sendToClient(clientId, {
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString()
      });
    });
  }

  generateClientId() {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  handleMessage(clientId, data) {
    console.log(`收到来自 ${clientId} 的消息:`, data.type);
    
    switch (data.type) {
      case 'subscribe':
        this.handleSubscribe(clientId, data.experimentId);
        break;
      case 'unsubscribe':
        this.handleUnsubscribe(clientId, data.experimentId);
        break;
      case 'ping':
        this.sendToClient(clientId, {
          type: 'pong',
          timestamp: new Date().toISOString()
        });
        break;
      default:
        console.log(`未知消息类型: ${data.type}`);
    }
  }

  handleSubscribe(clientId, experimentId) {
    const ws = this.clients.get(clientId);
    if (!ws) return;

    if (!ws.subscriptions) {
      ws.subscriptions = new Set();
    }
    ws.subscriptions.add(experimentId);

    console.log(`客户端 ${clientId} 订阅实验 ${experimentId}`);
    
    this.sendToClient(clientId, {
      type: 'subscribed',
      experimentId,
      timestamp: new Date().toISOString()
    });
  }

  handleUnsubscribe(clientId, experimentId) {
    const ws = this.clients.get(clientId);
    if (!ws || !ws.subscriptions) return;

    ws.subscriptions.delete(experimentId);

    console.log(`客户端 ${clientId} 取消订阅实验 ${experimentId}`);
    
    this.sendToClient(clientId, {
      type: 'unsubscribed',
      experimentId,
      timestamp: new Date().toISOString()
    });
  }

  sendToClient(clientId, message) {
    const ws = this.clients.get(clientId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }

  broadcast(message) {
    const messageStr = JSON.stringify(message);
    
    this.clients.forEach((ws, clientId) => {
      if (ws.readyState === 1) {
        if (message.experimentId && ws.subscriptions) {
          if (ws.subscriptions.has(message.experimentId)) {
            ws.send(messageStr);
          }
        } else {
          ws.send(messageStr);
        }
      }
    });
  }

  broadcastToExperiment(experimentId, message) {
    const messageStr = JSON.stringify({
      ...message,
      experimentId
    });
    
    this.clients.forEach((ws) => {
      if (ws.readyState === 1 && ws.subscriptions && ws.subscriptions.has(experimentId)) {
        ws.send(messageStr);
      }
    });
  }

  getConnectedClients() {
    return this.clients.size;
  }
}

module.exports = WebSocketHandler;
