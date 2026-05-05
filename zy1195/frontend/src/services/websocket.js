class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = {};
    this.subscriptions = new Set();
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket 已连接');
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (err) {
          console.error('WebSocket 消息解析错误:', err);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket 已断开', event.code, event.reason);
        this.emit('disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket 错误:', error);
        this.emit('error', error);
      };
    } catch (err) {
      console.error('WebSocket 连接失败:', err);
      this.attemptReconnect();
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('已达到最大重连次数，放弃重连');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})，等待 ${delay}ms`);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  handleMessage(data) {
    const { type } = data;

    switch (type) {
      case 'connected':
        this.emit('connected', data);
        break;
      case 'event':
        this.emit('event', data);
        if (data.experimentId && this.subscriptions.has(data.experimentId)) {
          this.emit(`experiment:${data.experimentId}:event`, data);
        }
        break;
      case 'packet':
        this.emit('packet', data);
        if (data.experimentId && this.subscriptions.has(data.experimentId)) {
          this.emit(`experiment:${data.experimentId}:packet`, data);
        }
        break;
      case 'connection':
        this.emit('connection', data);
        break;
      case 'disconnection':
        this.emit('disconnection', data);
        break;
      case 'experiment_finished':
        this.emit('experiment:finished', data);
        if (data.experimentId && this.subscriptions.has(data.experimentId)) {
          this.emit(`experiment:${data.experimentId}:finished`, data);
        }
        break;
      default:
        this.emit(type, data);
    }
  }

  subscribe(experimentId) {
    this.subscriptions.add(experimentId);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        experimentId
      }));
    }
  }

  unsubscribe(experimentId) {
    this.subscriptions.delete(experimentId);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        experimentId
      }));
    }
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    
    if (callback) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    } else {
      delete this.listeners[event];
    }
  }

  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`WebSocket 事件处理错误 (${event}):`, err);
      }
    });
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

const wsService = new WebSocketService();

export default wsService;
