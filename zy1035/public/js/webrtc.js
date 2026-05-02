class WebRTCClient {
  constructor(signaling) {
    this.signaling = signaling;
    this.pc = null;
    this.dataChannel = null;
    this.isInitiator = false;
    
    this.listeners = {
      open: [],
      close: [],
      error: [],
      message: [],
      dataChannelOpen: [],
      dataChannelClose: [],
      connectionStateChange: []
    };

    this.setupSignalingListeners();
  }

  get isConnected() {
    return this.dataChannel && this.dataChannel.readyState === 'open';
  }

  get connectionState() {
    if (!this.pc) return 'new';
    return this.pc.iceConnectionState;
  }

  setupSignalingListeners() {
    this.signaling.on('signal', ({ signal }) => {
      this.handleSignal(signal);
    });

    this.signaling.on('userJoined', () => {
      if (this.signaling.isCreator) {
        this.isInitiator = true;
        this.createOffer();
      }
    });
  }

  async init(isInitiator) {
    this.isInitiator = isInitiator;
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendSignal({
          type: 'candidate',
          candidate: event.candidate
        });
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc.iceConnectionState;
      Storage.addLog('info', `ICE 连接状态: ${state}`);
      this.emit('connectionStateChange', state);

      if (state === 'connected' || state === 'completed') {
        Storage.addLog('success', 'WebRTC 连接已建立');
      } else if (state === 'disconnected') {
        Storage.addLog('warning', 'WebRTC 连接已断开');
      } else if (state === 'failed') {
        Storage.addLog('error', 'WebRTC 连接失败');
      }
    };

    this.pc.onicegatheringstatechange = () => {
      Storage.addLog('info', `ICE 收集状态: ${this.pc.iceGatheringState}`);
    };

    this.pc.onsignalingstatechange = () => {
      Storage.addLog('info', `信令状态: ${this.pc.signalingState}`);
    };

    if (isInitiator) {
      this.setupDataChannel(this.pc.createDataChannel('fileTransfer', {
        ordered: true
      }));
    } else {
      this.pc.ondatachannel = (event) => {
        Storage.addLog('info', '收到 DataChannel');
        this.setupDataChannel(event.channel);
      };
    }

    Storage.addLog('info', `WebRTC 初始化完成 (发起方: ${isInitiator})`);
  }

  setupDataChannel(channel) {
    this.dataChannel = channel;

    channel.onopen = () => {
      Storage.addLog('success', 'DataChannel 已打开');
      this.emit('dataChannelOpen');
      this.emit('open');
    };

    channel.onclose = () => {
      Storage.addLog('warning', 'DataChannel 已关闭');
      this.emit('dataChannelClose');
      this.emit('close');
    };

    channel.onerror = (error) => {
      Storage.addLog('error', `DataChannel 错误: ${error}`);
      this.emit('error', error);
    };

    channel.onmessage = (event) => {
      this.emit('message', event.data);
    };

    channel.bufferedAmountLowThreshold = 65536;
  }

  async createOffer() {
    try {
      Storage.addLog('info', '创建 Offer...');
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      
      this.signaling.sendSignal({
        type: 'offer',
        sdp: this.pc.localDescription
      });
      Storage.addLog('info', 'Offer 已发送');
    } catch (error) {
      Storage.addLog('error', `创建 Offer 失败: ${error.message}`);
    }
  }

  async handleSignal(signal) {
    try {
      if (signal.type === 'offer') {
        Storage.addLog('info', '收到 Offer');
        await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        
        Storage.addLog('info', '创建 Answer...');
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        
        this.signaling.sendSignal({
          type: 'answer',
          sdp: this.pc.localDescription
        });
        Storage.addLog('info', 'Answer 已发送');
      } else if (signal.type === 'answer') {
        Storage.addLog('info', '收到 Answer');
        await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'candidate' && signal.candidate) {
        Storage.addLog('info', '收到 ICE Candidate');
        await this.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (error) {
      Storage.addLog('error', `处理信号失败: ${error.message}`);
    }
  }

  send(data) {
    if (!this.isConnected) {
      Storage.addLog('error', 'DataChannel 未连接');
      return false;
    }

    try {
      this.dataChannel.send(data);
      return true;
    } catch (error) {
      Storage.addLog('error', `发送失败: ${error.message}`);
      return false;
    }
  }

  sendObject(obj) {
    return this.send(JSON.stringify(obj));
  }

  get bufferedAmount() {
    return this.dataChannel ? this.dataChannel.bufferedAmount : 0;
  }

  close() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    Storage.addLog('info', 'WebRTC 连接已关闭');
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

window.WebRTCClient = WebRTCClient;
