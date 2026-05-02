class SignalingClient {
  constructor() {
    this.ws = null;
    this.roomCode = null;
    this.isCreator = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.autoReconnect = false;
    
    this.listeners = {
      open: [],
      close: [],
      error: [],
      message: [],
      roomCreated: [],
      roomJoined: [],
      userJoined: [],
      userLeft: [],
      signal: [],
      errorEvent: []
    };
  }

  get isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        Storage.addLog('info', `连接信令服务: ${wsUrl}`);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          Storage.addLog('success', '信令服务已连接');
          this.reconnectAttempts = 0;
          this.emit('open');
          resolve();
        };

        this.ws.onclose = (event) => {
          Storage.addLog('warning', `信令服务断开 (code: ${event.code})`);
          this.emit('close', event);
          
          if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * this.reconnectAttempts;
            Storage.addLog('info', `尝试重连... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connect(), delay);
          }
        };

        this.ws.onerror = (error) => {
          Storage.addLog('error', '信令服务错误');
          this.emit('error', error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (e) {
            Storage.addLog('error', `消息解析失败: ${e.message}`);
          }
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  disconnect() {
    this.autoReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  handleMessage(message) {
    const { type, payload } = message;
    Storage.addLog('info', `收到信令: ${type}`);

    switch (type) {
      case 'ROOM_CREATED':
        this.roomCode = payload.roomCode;
        this.isCreator = payload.isCreator;
        this.emit('roomCreated', payload);
        break;
      case 'ROOM_JOINED':
        this.roomCode = payload.roomCode;
        this.isCreator = payload.isCreator;
        this.emit('roomJoined', payload);
        break;
      case 'USER_JOINED':
        this.emit('userJoined', payload);
        break;
      case 'USER_LEFT':
        this.emit('userLeft', payload);
        break;
      case 'SIGNAL':
        this.emit('signal', payload);
        break;
      case 'ERROR':
        this.emit('errorEvent', payload);
        break;
    }

    this.emit('message', message);
  }

  send(type, payload = {}) {
    if (!this.isConnected) {
      Storage.addLog('error', '信令服务未连接');
      return false;
    }

    const message = { type, payload };
    this.ws.send(JSON.stringify(message));
    Storage.addLog('info', `发送信令: ${type}`);
    return true;
  }

  createRoom() {
    this.send('CREATE_ROOM');
  }

  joinRoom(roomCode) {
    this.send('JOIN_ROOM', { roomCode: roomCode.toUpperCase() });
  }

  leaveRoom() {
    if (this.roomCode) {
      this.send('LEAVE_ROOM');
      this.roomCode = null;
      this.isCreator = false;
    }
  }

  sendSignal(signal) {
    if (!this.roomCode) return false;
    return this.send('SIGNAL', {
      roomCode: this.roomCode,
      signal
    });
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }

  emit(event, ...args) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(...args);
        } catch (e) {
          console.error(`Listener error for ${event}:`, e);
        }
      });
    }
  }
}

window.SignalingClient = SignalingClient;
