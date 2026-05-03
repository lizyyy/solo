class SignalingClient {
  constructor() {
    this.ws = null;
    this.clientId = null;
    this.roomCode = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    
    this.eventHandlers = {
      connected: [],
      disconnected: [],
      roomCreated: [],
      roomJoined: [],
      peerJoined: [],
      peerLeft: [],
      offer: [],
      answer: [],
      candidate: [],
      error: []
    };
  }

  connect() {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      
      try {
        this.ws = new WebSocket(wsUrl);
      } catch (e) {
        reject(e);
        return;
      }

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
          if (message.type === 'connected') {
            this.clientId = message.clientId;
            this.emit('connected', { clientId: message.clientId });
            resolve();
          }
        } catch (e) {
          console.error('Signaling message parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.emit('disconnected', {});
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        this.emit('error', error);
        reject(error);
      };
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.clientId = null;
    this.roomCode = null;
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => {
      if (!this.isConnected) {
        console.log(`Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect().catch(() => {
          this.attemptReconnect();
        });
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  handleMessage(message) {
    switch (message.type) {
      case 'room-created':
        this.roomCode = message.roomCode;
        this.emit('roomCreated', { roomCode: message.roomCode });
        break;
      case 'room-joined':
        this.roomCode = message.roomCode;
        this.emit('roomJoined', { roomCode: message.roomCode, peers: message.peers });
        break;
      case 'peer-joined':
        this.emit('peerJoined', { peerId: message.peerId });
        break;
      case 'peer-left':
        this.emit('peerLeft', { peerId: message.peerId });
        break;
      case 'offer':
        this.emit('offer', { from: message.from, offer: message.offer });
        break;
      case 'answer':
        this.emit('answer', { from: message.from, answer: message.answer });
        break;
      case 'candidate':
        this.emit('candidate', { from: message.from, candidate: message.candidate });
        break;
      case 'error':
        this.emit('error', { error: message.error });
        break;
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  createRoom() {
    this.send({ type: 'create-room' });
  }

  joinRoom(roomCode) {
    this.send({ type: 'join-room', roomCode: roomCode.toUpperCase() });
  }

  leaveRoom() {
    this.send({ type: 'leave-room' });
    this.roomCode = null;
  }

  sendOffer(offer, targetPeerId) {
    this.send({ type: 'offer', offer, target: targetPeerId });
  }

  sendAnswer(answer, targetPeerId) {
    this.send({ type: 'answer', answer, target: targetPeerId });
  }

  sendCandidate(candidate, targetPeerId) {
    this.send({ type: 'candidate', candidate, target: targetPeerId });
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

const signaling = new SignalingClient();
