const UI = {
  init() {
    this.setupConnectionButtons();
    this.setupWeaknetControls();
    this.setupMessageControls();
    this.setupReplayControls();
    this.setupExportControls();
    this.setupRiskControls();
  },

  setupConnectionButtons() {
    const btnCreateRoom = document.getElementById('btnCreateRoom');
    const btnJoinRoom = document.getElementById('btnJoinRoom');
    const btnCopyRoomCode = document.getElementById('btnCopyRoomCode');
    const btnLeaveRoom = document.getElementById('btnLeaveRoom');

    btnCreateRoom.addEventListener('click', () => {
      signaling.createRoom();
    });

    btnJoinRoom.addEventListener('click', () => {
      const roomCode = document.getElementById('roomCodeInput').value.trim();
      if (roomCode) {
        signaling.joinRoom(roomCode);
      } else {
        Utils.showToast('请输入房间码', 'warning');
      }
    });

    document.getElementById('roomCodeInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        btnJoinRoom.click();
      }
    });

    btnCopyRoomCode.addEventListener('click', () => {
      const roomCode = document.getElementById('currentRoomCode').textContent;
      Utils.copyToClipboard(roomCode).then(() => {
        Utils.showToast('房间码已复制', 'success');
      });
    });

    btnLeaveRoom.addEventListener('click', () => {
      signaling.leaveRoom();
      webRTC.close();
      this.updateRoomUI(null);
      this.updateDataChannelStatus(false);
    });
  },

  setupWeaknetControls() {
    const enabledSwitch = document.getElementById('weaknetEnabled');
    const profileSelect = document.getElementById('profileSelect');
    const controlsContainer = document.getElementById('weaknetControls');

    const sliders = [
      { id: 'latencySlider', valueId: 'latencyValue', configKey: 'latency' },
      { id: 'jitterSlider', valueId: 'jitterValue', configKey: 'jitter' },
      { id: 'lossSlider', valueId: 'lossValue', configKey: 'loss' },
      { id: 'reorderSlider', valueId: 'reorderValue', configKey: 'reorder' },
      { id: 'duplicateSlider', valueId: 'duplicateValue', configKey: 'duplicate' },
      { id: 'disconnectSlider', valueId: 'disconnectValue', configKey: 'disconnect' },
      { id: 'reconnectDelaySlider', valueId: 'reconnectDelayValue', configKey: 'reconnectDelay' }
    ];

    enabledSwitch.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      weakNet.setEnabled(enabled);
      if (enabled) {
        controlsContainer.classList.remove('disabled');
      } else {
        controlsContainer.classList.add('disabled');
      }
    });

    profileSelect.addEventListener('change', (e) => {
      const profileName = e.target.value;
      const profile = WEAKNET_PROFILES[profileName];
      
      if (profile && profileName !== 'custom') {
        weakNet.setConfig({
          latency: profile.latency,
          jitter: profile.jitter,
          loss: profile.loss,
          reorder: profile.reorder,
          duplicate: profile.duplicate,
          disconnect: profile.disconnect
        });

        this.updateSliderValues(profile);
      }
    });

    sliders.forEach(({ id, valueId, configKey }) => {
      const slider = document.getElementById(id);
      const valueDisplay = document.getElementById(valueId);

      slider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        valueDisplay.textContent = value;
        weakNet.setConfig({ [configKey]: value });
        document.getElementById('profileSelect').value = 'custom';
      });
    });

    const replayOnReconnect = document.getElementById('replayOnReconnect');
    replayOnReconnect.addEventListener('change', (e) => {
      weakNet.setConfig({ replayOnReconnect: e.target.checked });
    });
  },

  updateSliderValues(config) {
    const mappings = [
      { configKey: 'latency', sliderId: 'latencySlider', valueId: 'latencyValue' },
      { configKey: 'jitter', sliderId: 'jitterSlider', valueId: 'jitterValue' },
      { configKey: 'loss', sliderId: 'lossSlider', valueId: 'lossValue' },
      { configKey: 'reorder', sliderId: 'reorderSlider', valueId: 'reorderValue' },
      { configKey: 'duplicate', sliderId: 'duplicateSlider', valueId: 'duplicateValue' },
      { configKey: 'disconnect', sliderId: 'disconnectSlider', valueId: 'disconnectValue' },
      { configKey: 'reconnectDelay', sliderId: 'reconnectDelaySlider', valueId: 'reconnectDelayValue' }
    ];

    mappings.forEach(({ configKey, sliderId, valueId }) => {
      if (config[configKey] !== undefined) {
        const slider = document.getElementById(sliderId);
        const valueDisplay = document.getElementById(valueId);
        if (slider && valueDisplay) {
          slider.value = config[configKey];
          valueDisplay.textContent = config[configKey];
        }
      }
    });
  },

  setupMessageControls() {
    const btnSend = document.getElementById('btnSendMessage');

    btnSend.addEventListener('click', () => {
      if (!webRTC.isConnected()) {
        Utils.showToast('DataChannel 未连接', 'warning');
        return;
      }

      const message = MessageManager.getCurrentMessage();
      if (!message) {
        Utils.showToast('无法创建消息', 'error');
        return;
      }

      try {
        MessageSender.send(message.type, message.payload);
      } catch (e) {
        Utils.showToast(`发送失败: ${e.message}`, 'error');
      }
    });
  },

  setupReplayControls() {
    const scriptInput = document.getElementById('scriptFileInput');
    const btnStartReplay = document.getElementById('btnStartReplay');
    const btnStopReplay = document.getElementById('btnStopReplay');

    scriptInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const text = await Utils.readFileAsText(file);
          ReplayManager.loadScript(text);
        } catch (err) {
          Utils.showToast('脚本加载失败', 'error');
        }
      }
      scriptInput.value = '';
    });

    btnStartReplay.addEventListener('click', () => {
      ReplayManager.start();
    });

    btnStopReplay.addEventListener('click', () => {
      ReplayManager.stop();
    });
  },

  setupExportControls() {
    const btnSaveSession = document.getElementById('btnSaveSession');
    const btnLoadSession = document.getElementById('btnLoadSession');
    const btnExport = document.getElementById('btnExport');
    const sessionInput = document.getElementById('sessionFileInput');

    btnSaveSession.addEventListener('click', () => {
      ReportExporter.saveSession();
    });

    btnLoadSession.addEventListener('click', () => {
      sessionInput.click();
    });

    sessionInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await ReportExporter.loadSession(file);
      }
      sessionInput.value = '';
    });

    btnExport.addEventListener('click', () => {
      this.showExportMenu();
    });
  },

  showExportMenu() {
    const options = [
      { label: '导出 JSON', action: () => ReportExporter.exportJSON() },
      { label: '导出 Markdown', action: () => ReportExporter.exportMarkdown() },
      { label: '导出 HTML', action: () => ReportExporter.exportHTML() }
    ];

    const selection = prompt(
      '选择导出格式:\n1. JSON\n2. Markdown\n3. HTML\n\n请输入数字 (1-3):',
      '1'
    );

    const index = parseInt(selection) - 1;
    if (index >= 0 && index < options.length) {
      options[index].action();
    }
  },

  setupRiskControls() {
    const btnClearRisks = document.getElementById('btnClearRisks');
    btnClearRisks.addEventListener('click', () => {
      RiskDetector.clearAllRisks();
    });
  },

  updateSignalingStatus(connected) {
    const statusEl = document.getElementById('connectionStatus');
    if (connected) {
      statusEl.textContent = '信令已连接';
      statusEl.className = 'status-badge status-connected';
    } else {
      statusEl.textContent = '未连接';
      statusEl.className = 'status-badge status-disconnected';
    }
  },

  updateRoomUI(roomCode) {
    const roomInfo = document.getElementById('roomInfo');
    const roomCodeEl = document.getElementById('currentRoomCode');
    const btnCreateRoom = document.getElementById('btnCreateRoom');
    const btnJoinRoom = document.getElementById('btnJoinRoom');
    const roomCodeInput = document.getElementById('roomCodeInput');
    const btnSaveSession = document.getElementById('btnSaveSession');
    const btnExport = document.getElementById('btnExport');

    if (roomCode) {
      roomInfo.classList.remove('hidden');
      roomCodeEl.textContent = roomCode;
      btnCreateRoom.disabled = true;
      btnJoinRoom.disabled = true;
      roomCodeInput.disabled = true;
      btnSaveSession.disabled = false;
      btnExport.disabled = false;
    } else {
      roomInfo.classList.add('hidden');
      btnCreateRoom.disabled = false;
      btnJoinRoom.disabled = false;
      roomCodeInput.disabled = false;
    }
  },

  updateDataChannelStatus(connected) {
    const statusEl = document.getElementById('peerStatus');
    const btnSend = document.getElementById('btnSendMessage');

    if (connected) {
      statusEl.textContent = 'DataChannel 已连接';
      statusEl.className = 'status-badge status-connected';
      btnSend.disabled = false;
    } else {
      statusEl.textContent = 'DataChannel 未连接';
      statusEl.className = 'status-badge status-disconnected';
      btnSend.disabled = true;
    }
  },

  updateReplayControls(isPlaying) {
    const btnStart = document.getElementById('btnStartReplay');
    const btnStop = document.getElementById('btnStopReplay');

    if (isPlaying) {
      btnStart.textContent = '暂停回放';
      btnStop.classList.remove('hidden');
    } else {
      btnStart.textContent = ReplayManager.currentScript ? '继续回放' : '开始回放';
      btnStop.classList.add('hidden');
    }
  }
};

const MessageSender = {
  send(type, payload) {
    if (!webRTC.isConnected()) {
      throw new Error('DataChannel not connected');
    }

    const message = {
      type,
      payload
    };

    const originalSend = (msg) => {
      const envelope = webRTC.send(msg);
      if (envelope) {
        TimelineManager.addSentMessage(envelope);
      }
      return envelope;
    };

    if (weakNet.enabled) {
      weakNet.simulateOutgoing(message, originalSend);
      return null;
    } else {
      return originalSend(message);
    }
  }
};
