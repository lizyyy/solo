const TransferStatus = {
  PENDING: 'pending',
  TRANSFERRING: 'transferring',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  ERROR: 'error',
  VERIFYING: 'verifying'
};

class FileTransfer {
  constructor(webrtc) {
    this.webrtc = webrtc;
    
    this.sendQueue = [];
    this.receiveQueue = [];
    this.activeTransfer = null;
    
    this.chunkSize = Utils.CHUNK_SIZE;
    this.isPaused = false;
    this.isCancelled = false;

    this.listeners = {
      sendStart: [],
      sendProgress: [],
      sendComplete: [],
      sendError: [],
      receiveStart: [],
      receiveProgress: [],
      receiveComplete: [],
      receiveError: [],
      statusChange: []
    };

    this.setupMessageHandler();
  }

  setupMessageHandler() {
    this.webrtc.on('message', (data) => {
      this.handleMessage(data);
    });
  }

  handleMessage(data) {
    if (typeof data === 'string') {
      try {
        const message = JSON.parse(data);
        this.handleControlMessage(message);
      } catch (e) {
        Storage.addLog('warning', `无法解析文本消息`);
      }
    } else if (data instanceof ArrayBuffer) {
      this.handleDataChunk(data);
    } else if (data instanceof Blob) {
      this.handleBlobData(data);
    }
  }

  async handleControlMessage(message) {
    const { type, payload } = message;

    switch (type) {
      case 'FILE_OFFER':
        await this.handleFileOffer(payload);
        break;
      case 'FILE_ACCEPT':
        this.handleFileAccept(payload);
        break;
      case 'FILE_PAUSE':
        this.handleRemotePause();
        break;
      case 'FILE_RESUME':
        this.handleRemoteResume();
        break;
      case 'FILE_CANCEL':
        this.handleRemoteCancel();
        break;
      case 'CHUNK_ACK':
        this.handleChunkAck(payload);
        break;
      case 'FILE_COMPLETE':
        await this.handleFileComplete(payload);
        break;
      case 'HASH_RESULT':
        this.handleHashResult(payload);
        break;
    }
  }

  async addToSendQueue(files) {
    for (const file of files) {
      const transferItem = {
        id: Utils.generateId(),
        type: 'send',
        file: file,
        name: file.name,
        size: file.size,
        status: TransferStatus.PENDING,
        progress: 0,
        sentChunks: 0,
        totalChunks: Math.ceil(file.size / this.chunkSize),
        bytesSent: 0,
        bytesPerSecond: 0,
        startTime: null,
        lastUpdateTime: null,
        lastBytesSent: 0,
        historyId: null,
        fileHash: null
      };
      this.sendQueue.push(transferItem);
      Storage.addLog('info', `文件加入发送队列: ${file.name}`);
    }
    return this.sendQueue;
  }

  async startSend(transferItemId) {
    const item = this.sendQueue.find(i => i.id === transferItemId);
    if (!item) return;

    if (item.status === TransferStatus.TRANSFERRING) return;

    this.isPaused = false;
    this.isCancelled = false;

    item.status = TransferStatus.TRANSFERRING;
    item.progress = 0;
    item.bytesSent = 0;
    item.sentChunks = 0;
    item.startTime = Date.now();
    item.lastUpdateTime = Date.now();
    item.lastBytesSent = 0;

    Storage.addLog('info', `开始发送文件: ${item.name}`);

    item.historyId = Storage.addHistory({
      type: 'send',
      name: item.name,
      size: item.size,
      status: TransferStatus.TRANSFERRING
    }).id;

    this.emit('sendStart', item);

    Storage.addLog('info', `计算文件 SHA-256: ${item.name}`);
    item.fileHash = await Utils.calculateSHA256(item.file);
    Storage.addLog('info', `文件 SHA-256: ${item.fileHash}`);

    this.webrtc.sendObject({
      type: 'FILE_OFFER',
      payload: {
        transferId: item.id,
        name: item.name,
        size: item.size,
        totalChunks: item.totalChunks,
        chunkSize: this.chunkSize
      }
    });
  }

  async handleFileOffer(payload) {
    const { transferId, name, size, totalChunks, chunkSize } = payload;
    
    Storage.addLog('info', `收到文件传输请求: ${name} (${Utils.formatSize(size)})`);

    const receiveItem = {
      id: transferId,
      type: 'receive',
      name: name,
      size: size,
      totalChunks: totalChunks,
      chunkSize: chunkSize,
      status: TransferStatus.PENDING,
      progress: 0,
      receivedChunks: 0,
      bytesReceived: 0,
      chunks: {},
      bytesPerSecond: 0,
      startTime: null,
      lastUpdateTime: null,
      lastBytesReceived: 0,
      historyId: null,
      expectedHash: null
    };

    this.receiveQueue.push(receiveItem);
    this.activeTransfer = receiveItem;

    receiveItem.historyId = Storage.addHistory({
      type: 'receive',
      name: name,
      size: size,
      status: TransferStatus.PENDING
    }).id;

    this.webrtc.sendObject({
      type: 'FILE_ACCEPT',
      payload: {
        transferId: transferId,
        accepted: true
      }
    });

    receiveItem.status = TransferStatus.TRANSFERRING;
    receiveItem.startTime = Date.now();
    receiveItem.lastUpdateTime = Date.now();
    
    this.emit('receiveStart', receiveItem);
  }

  handleFileAccept(payload) {
    const { transferId, accepted } = payload;
    const item = this.sendQueue.find(i => i.id === transferId);
    
    if (!item) return;

    if (accepted) {
      Storage.addLog('info', `对方接受了文件，开始传输: ${item.name}`);
      this.activeTransfer = item;
      this.sendChunks(item);
    } else {
      Storage.addLog('warning', `对方拒绝了文件: ${item.name}`);
      item.status = TransferStatus.CANCELLED;
      this.emit('sendError', item, '对方拒绝接收');
    }
  }

  async sendChunks(item) {
    if (!item || item.status !== TransferStatus.TRANSFERRING) return;

    const file = item.file;
    
    while (item.sentChunks < item.totalChunks && 
           item.status === TransferStatus.TRANSFERRING &&
           !this.isPaused && !this.isCancelled) {
      
      while (this.webrtc.bufferedAmount > 1024 * 1024) {
        await Utils.delay(10);
        if (this.isPaused || this.isCancelled || item.status !== TransferStatus.TRANSFERRING) {
          return;
        }
      }

      const start = item.sentChunks * this.chunkSize;
      const end = Math.min(start + this.chunkSize, file.size);
      
      const chunk = file.slice(start, end);
      const arrayBuffer = await chunk.arrayBuffer();
      
      const chunkData = new Uint8Array(4 + 4 + arrayBuffer.byteLength);
      const transferIdBytes = new TextEncoder().encode(item.id.slice(0, 8));
      
      const chunkIndexBytes = new Uint32Array([item.sentChunks]);
      chunkData.set(new Uint8Array(chunkIndexBytes.buffer), 0);
      
      const chunkSizeBytes = new Uint32Array([arrayBuffer.byteLength]);
      chunkData.set(new Uint8Array(chunkSizeBytes.buffer), 4);
      
      chunkData.set(new Uint8Array(arrayBuffer), 8);
      
      this.webrtc.send(chunkData.buffer);
      
      item.sentChunks++;
      item.bytesSent = end;
      item.progress = (item.bytesSent / item.size) * 100;

      const now = Date.now();
      const timeDiff = (now - item.lastUpdateTime) / 1000;
      
      if (timeDiff >= 0.5) {
        const bytesDiff = item.bytesSent - item.lastBytesSent;
        item.bytesPerSecond = bytesDiff / timeDiff;
        item.lastUpdateTime = now;
        item.lastBytesSent = item.bytesSent;
      }

      this.emit('sendProgress', item);
      Storage.updateHistory(item.historyId, {
        progress: item.progress,
        status: item.status,
        bytesSent: item.bytesSent
      });

      await Utils.delay(0);
    }

    if (item.sentChunks >= item.totalChunks && !this.isPaused && !this.isCancelled) {
      this.webrtc.sendObject({
        type: 'FILE_COMPLETE',
        payload: {
          transferId: item.id,
          hash: item.fileHash
        }
      });
      
      item.status = TransferStatus.VERIFYING;
      this.emit('sendProgress', item);
      Storage.addLog('info', `文件发送完成，等待哈希验证: ${item.name}`);
    }
  }

  handleDataChunk(arrayBuffer) {
    if (!this.activeTransfer || this.activeTransfer.type !== 'receive') return;
    
    const item = this.activeTransfer;
    if (item.status !== TransferStatus.TRANSFERRING) return;

    const dataView = new DataView(arrayBuffer);
    const chunkIndex = dataView.getUint32(0, true);
    const chunkSize = dataView.getUint32(4, true);
    
    const chunkData = arrayBuffer.slice(8, 8 + chunkSize);
    item.chunks[chunkIndex] = chunkData;
    item.receivedChunks++;
    item.bytesReceived += chunkSize;
    item.progress = (item.bytesReceived / item.size) * 100;

    const now = Date.now();
    const timeDiff = (now - item.lastUpdateTime) / 1000;
    
    if (timeDiff >= 0.5) {
      const bytesDiff = item.bytesReceived - item.lastBytesReceived;
      item.bytesPerSecond = bytesDiff / timeDiff;
      item.lastUpdateTime = now;
      item.lastBytesReceived = item.bytesReceived;
    }

    this.webrtc.sendObject({
      type: 'CHUNK_ACK',
      payload: {
        chunkIndex: chunkIndex
      }
    });

    this.emit('receiveProgress', item);
    Storage.updateHistory(item.historyId, {
      progress: item.progress,
      status: item.status,
      bytesReceived: item.bytesReceived
    });
  }

  handleChunkAck(payload) {
  }

  async handleBlobData(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    this.handleDataChunk(arrayBuffer);
  }

  async handleFileComplete(payload) {
    const { transferId, hash } = payload;
    const item = this.receiveQueue.find(i => i.id === transferId);
    
    if (!item) return;

    item.expectedHash = hash;
    item.status = TransferStatus.VERIFYING;
    this.emit('receiveProgress', item);
    Storage.addLog('info', `开始验证文件: ${item.name}, 期望哈希: ${hash}`);

    const chunks = [];
    for (let i = 0; i < item.totalChunks; i++) {
      if (item.chunks[i]) {
        chunks.push(item.chunks[i]);
      }
    }

    const fileData = Utils.concatArrayBuffers(...chunks);
    item.fileData = fileData;
    item.blob = new Blob([fileData]);

    const actualHash = await Utils.calculateSHA256(fileData);
    Storage.addLog('info', `实际文件哈希: ${actualHash}`);

    const hashMatch = actualHash === hash;
    item.actualHash = actualHash;

    if (hashMatch) {
      item.status = TransferStatus.COMPLETED;
      Storage.addLog('success', `文件验证通过: ${item.name}`);
      
      Storage.updateHistory(item.historyId, {
        status: item.status,
        hashMatch: true,
        expectedHash: hash,
        actualHash: actualHash,
        completedAt: Date.now()
      });

      this.emit('receiveComplete', item);

      const settings = Storage.getSettings();
      if (settings.autoDownload) {
        Utils.triggerDownload(item.blob, item.name);
      }
    } else {
      item.status = TransferStatus.ERROR;
      Storage.addLog('error', `文件验证失败: ${item.name}`);
      
      Storage.updateHistory(item.historyId, {
        status: item.status,
        hashMatch: false,
        expectedHash: hash,
        actualHash: actualHash,
        completedAt: Date.now()
      });

      this.emit('receiveError', item, '文件校验失败');
    }

    this.webrtc.sendObject({
      type: 'HASH_RESULT',
      payload: {
        transferId: item.id,
        match: hashMatch,
        actualHash: actualHash
      }
    });
  }

  handleHashResult(payload) {
    const { transferId, match, actualHash } = payload;
    const item = this.sendQueue.find(i => i.id === transferId);
    
    if (!item) return;

    item.actualHash = actualHash;
    
    if (match) {
      item.status = TransferStatus.COMPLETED;
      Storage.addLog('success', `文件发送并验证成功: ${item.name}`);
      Storage.updateHistory(item.historyId, {
        status: item.status,
        hashMatch: true,
        expectedHash: item.fileHash,
        actualHash: actualHash,
        completedAt: Date.now()
      });
      this.emit('sendComplete', item);
    } else {
      item.status = TransferStatus.ERROR;
      Storage.addLog('error', `文件发送后校验失败: ${item.name}`);
      Storage.updateHistory(item.historyId, {
        status: item.status,
        hashMatch: false,
        expectedHash: item.fileHash,
        actualHash: actualHash,
        completedAt: Date.now()
      });
      this.emit('sendError', item, '文件校验失败');
    }
  }

  pause(transferId) {
    const item = this.sendQueue.find(i => i.id === transferId);
    if (item) {
      item.status = TransferStatus.PAUSED;
      this.isPaused = true;
      Storage.addLog('info', `暂停发送: ${item.name}`);
      this.webrtc.sendObject({
        type: 'FILE_PAUSE',
        payload: { transferId }
      });
      this.emit('sendProgress', item);
    }
  }

  resume(transferId) {
    const item = this.sendQueue.find(i => i.id === transferId);
    if (item && item.status === TransferStatus.PAUSED) {
      item.status = TransferStatus.TRANSFERRING;
      this.isPaused = false;
      Storage.addLog('info', `恢复发送: ${item.name}`);
      this.webrtc.sendObject({
        type: 'FILE_RESUME',
        payload: { transferId }
      });
      this.emit('sendProgress', item);
      this.sendChunks(item);
    }
  }

  cancel(transferId) {
    const sendItem = this.sendQueue.find(i => i.id === transferId);
    if (sendItem) {
      sendItem.status = TransferStatus.CANCELLED;
      this.isCancelled = true;
      Storage.addLog('info', `取消发送: ${sendItem.name}`);
      this.webrtc.sendObject({
        type: 'FILE_CANCEL',
        payload: { transferId }
      });
      Storage.updateHistory(sendItem.historyId, {
        status: sendItem.status
      });
      this.emit('sendError', sendItem, '用户取消');
    }

    const receiveItem = this.receiveQueue.find(i => i.id === transferId);
    if (receiveItem) {
      receiveItem.status = TransferStatus.CANCELLED;
      Storage.addLog('info', `取消接收: ${receiveItem.name}`);
      Storage.updateHistory(receiveItem.historyId, {
        status: receiveItem.status
      });
      this.emit('receiveError', receiveItem, '用户取消');
    }
  }

  handleRemotePause() {
    if (this.activeTransfer && this.activeTransfer.type === 'send') {
      this.activeTransfer.status = TransferStatus.PAUSED;
      this.isPaused = true;
      Storage.addLog('info', '对方暂停了传输');
      this.emit('sendProgress', this.activeTransfer);
    }
  }

  handleRemoteResume() {
    if (this.activeTransfer && this.activeTransfer.type === 'send') {
      this.activeTransfer.status = TransferStatus.TRANSFERRING;
      this.isPaused = false;
      Storage.addLog('info', '对方恢复了传输');
      this.emit('sendProgress', this.activeTransfer);
      this.sendChunks(this.activeTransfer);
    }
  }

  handleRemoteCancel() {
    if (this.activeTransfer) {
      this.activeTransfer.status = TransferStatus.CANCELLED;
      Storage.addLog('info', '对方取消了传输');
      Storage.updateHistory(this.activeTransfer.historyId, {
        status: TransferStatus.CANCELLED
      });
      
      if (this.activeTransfer.type === 'send') {
        this.emit('sendError', this.activeTransfer, '对方取消');
      } else {
        this.emit('receiveError', this.activeTransfer, '对方取消');
      }
    }
  }

  downloadReceived(transferId) {
    const item = this.receiveQueue.find(i => i.id === transferId);
    if (item && item.status === TransferStatus.COMPLETED && item.blob) {
      Utils.triggerDownload(item.blob, item.name);
    }
  }

  clearCompleted() {
    this.sendQueue = this.sendQueue.filter(item => 
      item.status === TransferStatus.TRANSFERRING || 
      item.status === TransferStatus.PAUSED
    );
    this.receiveQueue = this.receiveQueue.filter(item => 
      item.status === TransferStatus.TRANSFERRING
    );
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

window.FileTransfer = FileTransfer;
window.TransferStatus = TransferStatus;
