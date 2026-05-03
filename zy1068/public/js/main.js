document.addEventListener('DOMContentLoaded', async () => {
  console.log('WebRTC 弱网协作预演台启动中...');

  try {
    TimelineManager.init();
    MessageManager.init();
    RiskDetector.init();
    UI.init();

    console.log('连接信令服务器...');
    await signaling.connect();
    UI.updateSignalingStatus(true);
    console.log('信令服务器已连接');

    setupEventHandlers();

    console.log('✅ WebRTC 弱网协作预演台已就绪');
    Utils.showToast('系统已就绪，创建或加入房间开始测试', 'success');

  } catch (error) {
    console.error('初始化失败:', error);
    Utils.showToast('初始化失败: ' + error.message, 'error');
  }
});

function setupEventHandlers() {
  signaling.on('connected', (data) => {
    console.log('Signaling connected, clientId:', data.clientId);
    UI.updateSignalingStatus(true);
  });

  signaling.on('disconnected', () => {
    console.log('Signaling disconnected');
    UI.updateSignalingStatus(false);
    UI.updateDataChannelStatus(false);
  });

  signaling.on('roomCreated', (data) => {
    console.log('Room created:', data.roomCode);
    UI.updateRoomUI(data.roomCode);
    Utils.showToast(`房间已创建: ${data.roomCode}`, 'success');
    startWebRTCAsInitiator();
  });

  signaling.on('roomJoined', (data) => {
    console.log('Room joined:', data.roomCode, 'peers:', data.peers);
    UI.updateRoomUI(data.roomCode);
    Utils.showToast('已加入房间', 'success');
    
    if (data.peers && data.peers.length > 0) {
      webRTC.remotePeerId = data.peers[0];
    }
  });

  signaling.on('peerJoined', async (data) => {
    console.log('Peer joined:', data.peerId);
    webRTC.remotePeerId = data.peerId;
    Utils.showToast('对端已加入', 'success');
    startWebRTCAsInitiator();
  });

  signaling.on('peerLeft', (data) => {
    console.log('Peer left:', data.peerId);
    UI.updateDataChannelStatus(false);
    Utils.showToast('对端已离开', 'warning');
  });

  signaling.on('offer', async (data) => {
    console.log('Received offer from:', data.from);
    webRTC.remotePeerId = data.from;
    
    try {
      const answer = await webRTC.handleOffer(data.offer);
      signaling.sendAnswer(answer, data.from);
      console.log('Sent answer');
    } catch (error) {
      console.error('Failed to handle offer:', error);
      Utils.showToast('处理 Offer 失败: ' + error.message, 'error');
    }
  });

  signaling.on('answer', async (data) => {
    console.log('Received answer from:', data.from);
    try {
      await webRTC.handleAnswer(data.answer);
      console.log('Answer handled');
    } catch (error) {
      console.error('Failed to handle answer:', error);
      Utils.showToast('处理 Answer 失败: ' + error.message, 'error');
    }
  });

  signaling.on('candidate', async (data) => {
    console.log('Received candidate from:', data.from);
    try {
      await webRTC.handleCandidate(data.candidate);
    } catch (error) {
      console.error('Failed to handle candidate:', error);
    }
  });

  signaling.on('error', (data) => {
    console.error('Signaling error:', data.error);
    Utils.showToast('错误: ' + data.error, 'error');
  });

  webRTC.on('dataChannelOpen', () => {
    console.log('DataChannel opened!');
    UI.updateDataChannelStatus(true);
    Utils.showToast('DataChannel 已连接', 'success');
  });

  webRTC.on('dataChannelClose', () => {
    console.log('DataChannel closed');
    UI.updateDataChannelStatus(false);
    Utils.showToast('DataChannel 已断开', 'warning');
  });

  webRTC.on('message', (message) => {
    if (weakNet.enabled) {
      weakNet.simulateIncoming(message, (msg) => {
        handleIncomingMessage(msg);
      });
    } else {
      handleIncomingMessage(message);
    }
  });

  weakNet.on('disconnected', (data) => {
    console.log('WeakNet simulated disconnect');
    Utils.showToast('模拟断线', 'warning');
    RiskDetector.recordReconnect();
  });

  weakNet.on('reconnected', (data) => {
    console.log('WeakNet simulated reconnect, messages replayed:', data.messagesReplayed);
    Utils.showToast(`模拟重连 (重放 ${data.messagesReplayed} 条消息)`, 'success');
  });

  weakNet.on('messageLost', (data) => {
    console.log('Message lost:', data.message);
    if (data.message.id) {
      TimelineManager.markLost(data.message.id);
    }
  });

  weakNet.on('messageDelayed', (data) => {
    console.log('Message delayed by:', data.delay, 'ms');
  });

  ReplayManager.on('started', (data) => {
    console.log('Replay started:', data.scriptName, data.totalMessages, 'messages');
    UI.updateReplayControls(true);
    Utils.showToast(`开始回放: ${data.scriptName}`, 'success');
  });

  ReplayManager.on('progress', (data) => {
    console.log('Replay progress:', data.percent, '%');
  });

  ReplayManager.on('completed', (data) => {
    console.log('Replay completed:', data.messagesSent, 'messages sent');
    UI.updateReplayControls(false);
  });

  ReplayManager.on('stopped', () => {
    console.log('Replay stopped');
    UI.updateReplayControls(false);
  });
}

async function startWebRTCAsInitiator() {
  try {
    console.log('Creating offer as initiator...');
    const offer = await webRTC.createOffer();
    signaling.sendOffer(offer, webRTC.remotePeerId);
    console.log('Offer sent');
  } catch (error) {
    console.error('Failed to create offer:', error);
    Utils.showToast('创建 Offer 失败: ' + error.message, 'error');
  }
}

function handleIncomingMessage(message) {
  console.log('Received message:', message.type, '#', message.seq);
  
  const record = TimelineManager.addReceivedMessage(message);
  
  if (record) {
    RiskDetector.checkMessage(record);
  }
}
