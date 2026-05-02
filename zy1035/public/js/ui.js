class UI {
  constructor(app) {
    this.app = app;
    this.selectedFiles = [];
    this.setupEventListeners();
    this.loadHistory();
  }

  setupEventListeners() {
    const dropZone = document.getElementById('fileDropZone');
    const fileInput = document.getElementById('fileInput');
    const selectFilesBtn = document.getElementById('selectFilesBtn');

    dropZone.addEventListener('click', () => fileInput.click());
    selectFilesBtn.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) {
        this.handleFilesSelect(e.dataTransfer.files);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFilesSelect(e.target.files);
      }
      fileInput.value = '';
    });

    document.getElementById('createRoomBtn').addEventListener('click', () => {
      this.app.createRoom();
    });

    document.getElementById('joinRoomBtn').addEventListener('click', () => {
      const roomCode = document.getElementById('roomCodeInput').value.trim();
      if (roomCode) {
        this.app.joinRoom(roomCode);
      }
    });

    document.getElementById('roomCodeInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const roomCode = e.target.value.trim();
        if (roomCode) {
          this.app.joinRoom(roomCode);
        }
      }
    });

    document.getElementById('copyRoomCode').addEventListener('click', () => {
      const roomCode = document.getElementById('displayRoomCode').textContent;
      navigator.clipboard.writeText(roomCode);
      this.showToast('房间码已复制', 'success');
    });

    document.getElementById('leaveRoomBtn').addEventListener('click', () => {
      this.app.leaveRoom();
    });

    document.getElementById('sendAllBtn').addEventListener('click', () => {
      this.sendAllFiles();
    });

    document.getElementById('clearFilesBtn').addEventListener('click', () => {
      this.clearSelectedFiles();
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    document.getElementById('clearLogsBtn').addEventListener('click', () => {
      Storage.clearLogs();
      this.renderLogs();
      this.showToast('日志已清空', 'success');
    });

    document.getElementById('clearHistoryBtn').addEventListener('click', () => {
      Storage.clearHistory();
      this.loadHistory();
      this.showToast('历史记录已清空', 'success');
    });
  }

  handleFilesSelect(files) {
    for (const file of files) {
      const exists = this.selectedFiles.some(f => 
        f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
      );
      if (!exists) {
        this.selectedFiles.push(file);
      }
    }
    this.renderSelectedFiles();
  }

  renderSelectedFiles() {
    const container = document.getElementById('selectedFileList');
    const selectedFilesDiv = document.getElementById('selectedFiles');
    const countSpan = document.getElementById('selectedFileCount');

    if (this.selectedFiles.length === 0) {
      selectedFilesDiv.style.display = 'none';
      return;
    }

    selectedFilesDiv.style.display = 'block';
    countSpan.textContent = `${this.selectedFiles.length} 个文件 (${Utils.formatSize(this.selectedFiles.reduce((sum, f) => sum + f.size, 0))})`;

    container.innerHTML = this.selectedFiles.map((file, index) => `
      <div class="file-item" data-index="${index}">
        <div class="file-header">
          <div class="file-info">
            <div class="file-name">${this.escapeHtml(file.name)}</div>
            <div class="file-meta">${Utils.formatSize(file.size)}</div>
          </div>
          <div class="file-actions">
            <button class="btn btn-primary btn-small" onclick="ui.sendSingleFile(${index})">发送</button>
            <button class="btn btn-secondary btn-small" onclick="ui.removeSelectedFile(${index})">移除</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  removeSelectedFile(index) {
    this.selectedFiles.splice(index, 1);
    this.renderSelectedFiles();
  }

  clearSelectedFiles() {
    this.selectedFiles = [];
    this.renderSelectedFiles();
  }

  async sendSingleFile(index) {
    if (!this.app.webrtc.isConnected) {
      this.showToast('请先连接对方', 'error');
      return;
    }

    const file = this.selectedFiles[index];
    const queue = await this.app.fileTransfer.addToSendQueue([file]);
    const item = queue[queue.length - 1];
    
    this.selectedFiles.splice(index, 1);
    this.renderSelectedFiles();
    this.renderTransferQueue();
    
    await this.app.fileTransfer.startSend(item.id);
  }

  async sendAllFiles() {
    if (!this.app.webrtc.isConnected) {
      this.showToast('请先连接对方', 'error');
      return;
    }

    if (this.selectedFiles.length === 0) {
      this.showToast('请先选择文件', 'error');
      return;
    }

    const queue = await this.app.fileTransfer.addToSendQueue(this.selectedFiles);
    this.selectedFiles = [];
    this.renderSelectedFiles();
    this.renderTransferQueue();

    for (const item of queue) {
      if (this.app.webrtc.isConnected) {
        await this.app.fileTransfer.startSend(item.id);
      }
    }
  }

  renderTransferQueue() {
    const queue = this.app.fileTransfer.sendQueue;
    const container = document.getElementById('transferList');
    const queueDiv = document.getElementById('transferQueue');

    if (queue.length === 0) {
      queueDiv.style.display = 'none';
      return;
    }

    queueDiv.style.display = 'block';

    container.innerHTML = queue.map(item => {
      const remaining = item.bytesPerSecond > 0 
        ? (item.size - item.bytesSent) / item.bytesPerSecond 
        : 0;

      let actionButtons = '';
      if (item.status === TransferStatus.TRANSFERRING) {
        actionButtons = `
          <button class="btn btn-secondary btn-small" onclick="ui.pauseTransfer('${item.id}')">暂停</button>
          <button class="btn btn-danger btn-small" onclick="ui.cancelTransfer('${item.id}')">取消</button>
        `;
      } else if (item.status === TransferStatus.PAUSED) {
        actionButtons = `
          <button class="btn btn-primary btn-small" onclick="ui.resumeTransfer('${item.id}')">继续</button>
          <button class="btn btn-danger btn-small" onclick="ui.cancelTransfer('${item.id}')">取消</button>
        `;
      } else if (item.status === TransferStatus.COMPLETED) {
        actionButtons = `<span class="status-badge completed">✓ 已完成</span>`;
      } else if (item.status === TransferStatus.CANCELLED) {
        actionButtons = `<span class="status-badge cancelled">已取消</span>`;
      } else if (item.status === TransferStatus.ERROR) {
        actionButtons = `<span class="status-badge error">✗ 失败</span>`;
      } else if (item.status === TransferStatus.VERIFYING) {
        actionButtons = `<span class="status-badge verifying">校验中...</span>`;
      }

      let progressClass = '';
      if (item.status === TransferStatus.COMPLETED) progressClass = 'success';
      if (item.status === TransferStatus.ERROR) progressClass = 'error';

      const hashSection = (item.status === TransferStatus.COMPLETED || item.status === TransferStatus.ERROR) && item.fileHash
        ? `<div class="hash-verify">
             <span class="hash-label">SHA-256:</span>${item.fileHash.substring(0, 32)}...
           </div>`
        : '';

      return `
        <div class="transfer-item" data-id="${item.id}">
          <div class="transfer-header">
            <div class="transfer-info">
              <div class="file-name">${this.escapeHtml(item.name)}</div>
              <div class="file-meta">${Utils.formatSize(item.size)}</div>
            </div>
            <div class="file-actions">${actionButtons}</div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${progressClass}" style="width: ${item.progress}%"></div>
          </div>
          <div class="progress-stats">
            <span>${Utils.formatSize(item.bytesSent)} / ${Utils.formatSize(item.size)} (${item.progress.toFixed(1)}%)</span>
            <div class="transfer-stats">
              <span>${Utils.formatSpeed(item.bytesPerSecond)}</span>
              <span>剩余: ${Utils.formatTime(remaining)}</span>
            </div>
          </div>
          ${hashSection}
        </div>
      `;
    }).join('');
  }

  renderReceiveQueue() {
    const queue = this.app.fileTransfer.receiveQueue;
    const container = document.getElementById('receiveList');
    const emptyDiv = document.getElementById('receiveEmpty');

    if (queue.length === 0) {
      container.style.display = 'none';
      emptyDiv.style.display = 'block';
      return;
    }

    emptyDiv.style.display = 'none';
    container.style.display = 'block';

    container.innerHTML = queue.map(item => {
      const remaining = item.bytesPerSecond > 0 
        ? (item.size - item.bytesReceived) / item.bytesPerSecond 
        : 0;

      let actionButtons = '';
      if (item.status === TransferStatus.TRANSFERRING) {
        actionButtons = `<span class="status-badge transferring">接收中...</span>`;
      } else if (item.status === TransferStatus.VERIFYING) {
        actionButtons = `<span class="status-badge verifying">校验中...</span>`;
      } else if (item.status === TransferStatus.COMPLETED) {
        actionButtons = `<button class="btn btn-primary btn-small" onclick="ui.downloadReceive('${item.id}')">下载</button>`;
      } else if (item.status === TransferStatus.ERROR) {
        actionButtons = `<span class="status-badge error">校验失败</span>`;
      } else if (item.status === TransferStatus.CANCELLED) {
        actionButtons = `<span class="status-badge cancelled">已取消</span>`;
      }

      let progressClass = '';
      if (item.status === TransferStatus.COMPLETED) progressClass = 'success';
      if (item.status === TransferStatus.ERROR) progressClass = 'error';

      let verifyResult = '';
      if (item.status === TransferStatus.COMPLETED) {
        verifyResult = `<div class="verify-result success">✓ SHA-256 校验通过</div>`;
      } else if (item.status === TransferStatus.ERROR) {
        verifyResult = `<div class="verify-result error">✗ SHA-256 校验失败</div>`;
      }

      const hashSection = (item.expectedHash || item.actualHash)
        ? `<div class="hash-verify">
             <div><span class="hash-label">期望:</span>${item.expectedHash || '-'}</div>
             <div><span class="hash-label">实际:</span>${item.actualHash || '-'}</div>
           </div>`
        : '';

      return `
        <div class="receive-item" data-id="${item.id}">
          <div class="receive-header">
            <div class="receive-info">
              <div class="file-name">${this.escapeHtml(item.name)}</div>
              <div class="file-meta">${Utils.formatSize(item.size)}</div>
            </div>
            <div class="file-actions">${actionButtons}</div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${progressClass}" style="width: ${item.progress}%"></div>
          </div>
          <div class="progress-stats">
            <span>${Utils.formatSize(item.bytesReceived)} / ${Utils.formatSize(item.size)} (${item.progress.toFixed(1)}%)</span>
            <div class="transfer-stats">
              <span>${Utils.formatSpeed(item.bytesPerSecond)}</span>
              <span>剩余: ${Utils.formatTime(remaining)}</span>
            </div>
          </div>
          ${verifyResult}
          ${hashSection}
        </div>
      `;
    }).join('');
  }

  renderLogs() {
    const logs = Storage.getLogs();
    const container = document.getElementById('logsContainer');

    if (logs.length === 0) {
      container.innerHTML = '<div class="log-entry info"><span class="time">--:--:--</span>暂无日志</div>';
      return;
    }

    container.innerHTML = logs.map(log => {
      const time = new Date(log.timestamp);
      const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;
      
      return `<div class="log-entry ${log.level}"><span class="time">${timeStr}</span>${this.escapeHtml(log.message)}</div>`;
    }).join('');

    container.scrollTop = container.scrollHeight;
  }

  loadHistory() {
    const history = Storage.getHistory();
    const container = document.getElementById('historyList');
    const emptyDiv = document.getElementById('historyEmpty');

    if (history.length === 0) {
      emptyDiv.style.display = 'block';
      container.style.display = 'none';
      return;
    }

    emptyDiv.style.display = 'none';
    container.style.display = 'block';

    container.innerHTML = history.map(item => {
      const typeIcon = item.type === 'send' ? '📤' : '📥';
      const statusBadge = this.getStatusBadge(item.status);
      const verifyIcon = item.hashMatch === true ? '✓' : (item.hashMatch === false ? '✗' : '');
      const verifyClass = item.hashMatch === true ? 'success' : (item.hashMatch === false ? 'error' : '');

      const hashSection = item.expectedHash
        ? `<div class="hash-verify">
             <span class="hash-label">SHA-256:</span>${item.expectedHash.substring(0, 40)}...
           </div>`
        : '';

      return `
        <div class="history-item">
          <div class="history-header">
            <div class="history-info">
              <div class="file-name">${typeIcon} ${this.escapeHtml(item.name)}</div>
              <div class="file-meta">${Utils.formatSize(item.size)} | ${Utils.formatTimeMs(item.createdAt)}</div>
            </div>
            <div class="file-actions">
              ${statusBadge}
              ${verifyIcon ? `<span class="verify-result ${verifyClass}">${verifyIcon}</span>` : ''}
            </div>
          </div>
          ${hashSection}
        </div>
      `;
    }).join('');
  }

  getStatusBadge(status) {
    const statusMap = {
      [TransferStatus.PENDING]: '<span class="status-badge pending">等待中</span>',
      [TransferStatus.TRANSFERRING]: '<span class="status-badge transferring">传输中</span>',
      [TransferStatus.PAUSED]: '<span class="status-badge paused">已暂停</span>',
      [TransferStatus.COMPLETED]: '<span class="status-badge completed">已完成</span>',
      [TransferStatus.CANCELLED]: '<span class="status-badge cancelled">已取消</span>',
      [TransferStatus.ERROR]: '<span class="status-badge error">失败</span>',
      [TransferStatus.VERIFYING]: '<span class="status-badge verifying">校验中</span>'
    };
    return statusMap[status] || '';
  }

  updateConnectionStatus(connected, message) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');

    dot.className = 'status-dot';
    if (connected) {
      dot.classList.add('connected');
    } else if (message && message.includes('断开')) {
      dot.classList.add('disconnected');
    } else {
      dot.classList.add('connecting');
    }
    text.textContent = message || '未连接';
  }

  showRoomInfo(roomCode, peerConnected) {
    document.getElementById('roomControls').style.display = 'none';
    document.getElementById('roomInfo').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('displayRoomCode').textContent = roomCode;
    this.updatePeerStatus(peerConnected);
  }

  hideRoomInfo() {
    document.getElementById('roomControls').style.display = 'block';
    document.getElementById('roomInfo').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    this.updateConnectionStatus(false, '未连接');
  }

  updatePeerStatus(connected) {
    const dot = document.getElementById('peerDot');
    const text = document.getElementById('peerStatusText');

    dot.className = 'peer-dot';
    if (connected) {
      dot.classList.add('connected');
      text.textContent = '对方已连接';
    } else {
      text.textContent = '等待对方加入...';
    }
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    const tabMap = {
      'send': 'sendTab',
      'receive': 'receiveTab',
      'logs': 'logsTab',
      'history': 'historyTab'
    };

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === tabMap[tabName]);
    });

    if (tabName === 'logs') {
      this.renderLogs();
    } else if (tabName === 'history') {
      this.loadHistory();
    }
  }

  pauseTransfer(transferId) {
    this.app.fileTransfer.pause(transferId);
  }

  resumeTransfer(transferId) {
    this.app.fileTransfer.resume(transferId);
  }

  cancelTransfer(transferId) {
    this.app.fileTransfer.cancel(transferId);
  }

  downloadReceive(transferId) {
    this.app.fileTransfer.downloadReceived(transferId);
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.UI = UI;
