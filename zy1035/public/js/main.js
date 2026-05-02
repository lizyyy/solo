class App {
  constructor() {
    this.signaling = new SignalingClient();
    this.webrtc = new WebRTCClient(this.signaling);
    this.fileTransfer = new FileTransfer(this.webrtc);
    this.ui = null;

    this.setupListeners();
  }

  async init() {
    this.ui = new UI(this);
    this.ui.renderLogs();
    
    try {
      await this.signaling.connect();
      this.ui.updateConnectionStatus(true, '信令服务已连接');
    } catch (e) {
      this.ui.updateConnectionStatus(false, '信令服务连接失败');
      this.ui.showToast('无法连接到信令服务', 'error');
    }
  }

  setupListeners() {
    this.signaling.on('open', () => {
      this.ui.updateConnectionStatus(true, '信令服务已连接');
    });

    this.signaling.on('close', () => {
      this.ui.updateConnectionStatus(false, '连接已断开');
      this.ui.updatePeerStatus(false);
      this.ui.hideRoomInfo();
    });

    this.signaling.on('roomCreated', (payload) => {
      Storage.addLog('success', `房间已创建: ${payload.roomCode}`);
      this.ui.showRoomInfo(payload.roomCode, false);
      this.ui.showToast(`房间 ${payload.roomCode} 已创建`, 'success');
    });

    this.signaling.on('roomJoined', (payload) => {
      Storage.addLog('success', `已加入房间: ${payload.roomCode}`);
      this.ui.showRoomInfo(payload.roomCode, payload.peerConnected);
      this.ui.showToast(`已加入房间 ${payload.roomCode}`, 'success');

      if (!this.webrtc.pc) {
        this.webrtc.init(false);
      }
    });

    this.signaling.on('userJoined', () => {
      Storage.addLog('success', '对方已加入房间');
      this.ui.updatePeerStatus(true);
      this.ui.showToast('对方已加入房间', 'success');

      if (!this.webrtc.pc && this.signaling.isCreator) {
        this.webrtc.init(true);
      }
    });

    this.signaling.on('userLeft', () => {
      Storage.addLog('warning', '对方已离开房间');
      this.ui.updatePeerStatus(false);
      this.ui.showToast('对方已离开房间', 'warning');
    });

    this.signaling.on('errorEvent', (payload) => {
      Storage.addLog('error', payload.message);
      this.ui.showToast(payload.message, 'error');
    });

    this.webrtc.on('open', () => {
      Storage.addLog('success', 'WebRTC DataChannel 已建立');
      this.ui.updatePeerStatus(true);
      this.ui.showToast('点对点连接已建立', 'success');
    });

    this.webrtc.on('close', () => {
      Storage.addLog('warning', 'WebRTC 连接已关闭');
      this.ui.updatePeerStatus(false);
      this.ui.showToast('点对点连接已断开', 'warning');
    });

    this.webrtc.on('connectionStateChange', (state) => {
      if (state === 'disconnected' || state === 'failed') {
        this.ui.updateConnectionStatus(false, '连接已断开');
        this.ui.showToast('连接已断开，可重新加入房间', 'warning');
      }
    });

    this.fileTransfer.on('sendStart', (item) => {
      this.ui.renderTransferQueue();
    });

    this.fileTransfer.on('sendProgress', (item) => {
      this.ui.renderTransferQueue();
    });

    this.fileTransfer.on('sendComplete', (item) => {
      this.ui.renderTransferQueue();
      this.ui.showToast(`已发送: ${item.name}`, 'success');
      this.ui.loadHistory();
    });

    this.fileTransfer.on('sendError', (item, error) => {
      this.ui.renderTransferQueue();
      this.ui.showToast(`发送失败: ${item.name}`, 'error');
      this.ui.loadHistory();
    });

    this.fileTransfer.on('receiveStart', (item) => {
      this.ui.renderReceiveQueue();
    });

    this.fileTransfer.on('receiveProgress', (item) => {
      this.ui.renderReceiveQueue();
    });

    this.fileTransfer.on('receiveComplete', (item) => {
      this.ui.renderReceiveQueue();
      this.ui.showToast(`已接收: ${item.name}`, 'success');
      this.ui.loadHistory();
    });

    this.fileTransfer.on('receiveError', (item, error) => {
      this.ui.renderReceiveQueue();
      this.ui.showToast(`接收失败: ${item.name}`, 'error');
      this.ui.loadHistory();
    });
  }

  createRoom() {
    if (!this.signaling.isConnected) {
      this.ui.showToast('请先连接到信令服务', 'error');
      return;
    }
    this.signaling.createRoom();
  }

  joinRoom(roomCode) {
    if (!this.signaling.isConnected) {
      this.ui.showToast('请先连接到信令服务', 'error');
      return;
    }
    if (!roomCode || roomCode.trim().length !== 6) {
      this.ui.showToast('请输入有效的6位房间码', 'error');
      return;
    }
    this.signaling.joinRoom(roomCode.trim());
  }

  leaveRoom() {
    this.webrtc.close();
    this.signaling.leaveRoom();
    this.ui.hideRoomInfo();
    this.ui.showToast('已离开房间', 'info');
  }
}

let app;
let ui;

document.addEventListener('DOMContentLoaded', async () => {
  app = new App();
  await app.init();
  ui = app.ui;
});
