class WebRTCClient {
  constructor() {
    this.peerConnection = null;
    this.dataChannel = null;
    this.remotePeerId = null;
    this.isInitiator = false;
    this.messageSequence = 0;
    this.iceCandidates = [];
    
    this.eventHandlers = {
      connected: [],
      disconnected: [],
      message: [],
      dataChannelOpen: [],
      dataChannelClose: [],
      error: []
    };

    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
  }

  async createOffer() {
    this.isInitiator = true;
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);
    this.setupPeerConnectionListeners();
    
    this.dataChannel = this.peerConnection.createDataChannel('collab-channel', {
      ordered: true,
      maxRetransmits: 3
    });
    this.setupDataChannelListeners();
    
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    
    return offer;
  }

  async handleOffer(offer) {
    this.isInitiator = false;
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);
    this.setupPeerConnectionListeners();
    
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannelListeners();
    };
    
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    return answer;
  }

  async handleAnswer(answer) {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    
    for (const candidate of this.iceCandidates) {
      signaling.sendCandidate(candidate, this.remotePeerId);
    }
    this.iceCandidates = [];
  }

  async handleCandidate(candidate) {
    if (this.peerConnection && this.peerConnection.remoteDescription) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  setupPeerConnectionListeners() {
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        if (this.peerConnection.remoteDescription) {
          signaling.sendCandidate(event.candidate, this.remotePeerId);
        } else {
          this.iceCandidates.push(event.candidate);
        }
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      console.log('ICE Connection State:', state);
      
      if (state === 'connected' || state === 'completed') {
        this.emit('connected', {});
      } else if (state === 'disconnected') {
        this.emit('disconnected', {});
      } else if (state === 'failed') {
        this.emit('error', { error: 'ICE connection failed' });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection State:', this.peerConnection.connectionState);
    };
  }

  setupDataChannelListeners() {
    this.dataChannel.onopen = () => {
      console.log('DataChannel opened');
      this.emit('dataChannelOpen', {});
    };

    this.dataChannel.onclose = () => {
      console.log('DataChannel closed');
      this.emit('dataChannelClose', {});
    };

    this.dataChannel.onerror = (error) => {
      console.error('DataChannel error:', error);
      this.emit('error', { error });
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.emit('message', message);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };
  }

  send(message) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      const envelope = {
        id: Utils.generateId(),
        seq: ++this.messageSequence,
        timestamp: Date.now(),
        ...message
      };
      this.dataChannel.send(JSON.stringify(envelope));
      return envelope;
    } else {
      throw new Error('DataChannel not open');
    }
  }

  isConnected() {
    return this.dataChannel && this.dataChannel.readyState === 'open';
  }

  close() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.remotePeerId = null;
    this.isInitiator = false;
    this.iceCandidates = [];
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

const webRTC = new WebRTCClient();
