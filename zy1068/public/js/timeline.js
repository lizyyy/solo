const TimelineManager = {
  messages: [],
  lastReceivedSeq: 0,
  expectedSeq: 1,
  outOfOrderMessages: [],

  stats: {
    total: 0,
    success: 0,
    slow: 0,
    lost: 0,
    outOfOrder: 0,
    duplicate: 0,
    replayed: 0
  },

  latencyStats: {
    values: [],
    avg: 0,
    max: 0,
    min: Infinity
  },

  SLOW_THRESHOLD: 200,

  init() {
    this.messages = [];
    this.stats = {
      total: 0,
      success: 0,
      slow: 0,
      lost: 0,
      outOfOrder: 0,
      duplicate: 0,
      replayed: 0
    };
    this.latencyStats = {
      values: [],
      avg: 0,
      max: 0,
      min: Infinity
    };
    this.lastReceivedSeq = 0;
    this.expectedSeq = 1;
    this.outOfOrderMessages = [];
    this.render();
  },

  addSentMessage(envelope) {
    const record = {
      id: envelope.id,
      seq: envelope.seq,
      type: envelope.type,
      payload: envelope.payload,
      sentAt: envelope.timestamp,
      receivedAt: null,
      direction: 'sent',
      status: 'pending',
      statusTags: [],
      isReplayed: false
    };

    this.messages.push(record);
    this.stats.total++;
    this.updateStats();
    this.render();
    return record;
  },

  addReceivedMessage(envelope) {
    const receiveTime = Date.now();
    let record = this.messages.find(m => m.id === envelope.id);
    
    if (record) {
      record.receivedAt = receiveTime;
      record.direction = 'both';
    } else {
      record = {
        id: envelope.id,
        seq: envelope.seq,
        type: envelope.type,
        payload: envelope.payload,
        sentAt: envelope.timestamp,
        receivedAt: receiveTime,
        direction: 'received',
        status: 'success',
        statusTags: [],
        isReplayed: false
      };
      this.messages.push(record);
      this.stats.total++;
    }

    const latency = receiveTime - envelope.timestamp;
    this.recordLatency(latency);

    record.status = 'success';
    this.checkOrdering(record, envelope.seq);

    if (latency > this.SLOW_THRESHOLD) {
      record.status = 'slow';
      record.statusTags.push('slow');
      this.stats.slow++;
      RiskDetector.checkSlowMessage(record, latency);
    }

    this.stats.success++;
    this.updateStats();
    this.render();
    return record;
  },

  checkOrdering(record, seq) {
    if (seq === this.expectedSeq) {
      this.expectedSeq++;
      this.processOutOfOrderQueue();
    } else if (seq > this.expectedSeq) {
      this.outOfOrderMessages.push({ seq, record });
      this.outOfOrderMessages.sort((a, b) => a.seq - b.seq);
      
      record.status = 'outoforder';
      record.statusTags.push('outoforder');
      this.stats.outOfOrder++;
      RiskDetector.checkOutOfOrder(record, seq, this.expectedSeq);
    } else {
      const existingRecord = this.messages.find(m => m.seq === seq && m.id !== record.id);
      if (existingRecord) {
        record.status = 'duplicate';
        record.statusTags.push('duplicate');
        this.stats.duplicate++;
        RiskDetector.checkDuplicate(record);
      }
    }

    this.lastReceivedSeq = Math.max(this.lastReceivedSeq, seq);
  },

  processOutOfOrderQueue() {
    while (this.outOfOrderMessages.length > 0) {
      const first = this.outOfOrderMessages[0];
      if (first.seq === this.expectedSeq) {
        const record = first.record;
        record.status = record.statusTags.includes('slow') ? 'slow' : 'success';
        this.stats.outOfOrder--;
        this.outOfOrderMessages.shift();
        this.expectedSeq++;
      } else {
        break;
      }
    }
  },

  recordLatency(latency) {
    this.latencyStats.values.push(latency);
    this.latencyStats.max = Math.max(this.latencyStats.max, latency);
    this.latencyStats.min = Math.min(this.latencyStats.min, latency);
    
    const sum = this.latencyStats.values.reduce((a, b) => a + b, 0);
    this.latencyStats.avg = Math.round(sum / this.latencyStats.values.length);
  },

  markLost(messageId) {
    const record = this.messages.find(m => m.id === messageId);
    if (record) {
      record.status = 'lost';
      record.statusTags.push('lost');
      this.stats.lost++;
      this.stats.success--;
      this.updateStats();
      this.render();
      RiskDetector.checkLostMessage(record);
    }
  },

  markReplayed(messageId) {
    const record = this.messages.find(m => m.id === messageId);
    if (record) {
      record.isReplayed = true;
      record.statusTags.push('replayed');
      this.stats.replayed++;
      this.updateStats();
      this.render();
    }
  },

  updateStats() {
    document.getElementById('statTotal').textContent = `总计: ${this.stats.total}`;
    document.getElementById('statSuccess').textContent = `成功: ${this.stats.success}`;
    document.getElementById('statSlow').textContent = `慢包: ${this.stats.slow}`;
    document.getElementById('statLost').textContent = `丢包: ${this.stats.lost}`;
    document.getElementById('statOoo').textContent = `乱序: ${this.stats.outOfOrder}`;
    document.getElementById('statDup').textContent = `重复: ${this.stats.duplicate}`;

    document.getElementById('statSent').textContent = this.messages.filter(m => m.direction === 'sent' || m.direction === 'both').length;
    document.getElementById('statReceived').textContent = this.messages.filter(m => m.direction === 'received' || m.direction === 'both').length;
    document.getElementById('statAvgLatency').textContent = `${this.latencyStats.avg}ms`;
    document.getElementById('statMaxLatency').textContent = `${this.latencyStats.max}ms`;
  },

  render() {
    const container = document.getElementById('timeline');
    
    if (this.messages.length === 0) {
      container.innerHTML = `
        <div class="timeline-empty">
          <p>暂无消息记录</p>
          <p>连接后发送消息将显示在这里</p>
        </div>
      `;
      return;
    }

    const html = this.messages.map(msg => this.renderItem(msg)).join('');
    container.innerHTML = html;
    
    container.scrollTop = container.scrollHeight;
  },

  renderItem(msg) {
    const statusClass = `status-${msg.status}`;
    const sentTime = Utils.formatTimeMs(msg.sentAt);
    const receivedTime = msg.receivedAt ? Utils.formatTimeMs(msg.receivedAt) : '-';
    const latency = msg.receivedAt ? `${msg.receivedAt - msg.sentAt}ms` : '-';
    const statusTags = msg.statusTags.map(tag => 
      `<span class="status-tag ${tag}">${this.getStatusTagName(tag)}</span>`
    ).join('');

    const directionIcon = msg.direction === 'sent' ? '↑' : msg.direction === 'received' ? '↓' : '↔';
    const payloadSummary = Utils.getPayloadSummary(msg.type, msg.payload);

    return `
      <div class="timeline-item ${statusClass}">
        <div class="timeline-content">
          <div class="timeline-header-row">
            <span class="timeline-seq">#${msg.seq} ${directionIcon}</span>
            <span class="timeline-type">${this.getMessageTypeName(msg.type)}</span>
          </div>
          <div class="timeline-meta">
            发送: ${sentTime} | 接收: ${receivedTime} | 延迟: ${latency}
          </div>
          <div class="timeline-status">
            ${statusTags}
          </div>
          <div class="timeline-payload">${this.escapeHtml(payloadSummary)}</div>
        </div>
      </div>
    `;
  },

  getMessageTypeName(type) {
    const types = {
      cursor: '光标位置',
      annotation: '批注',
      stroke: '白板笔画',
      patch: '文档 Patch',
      text: '文本消息'
    };
    return types[type] || type;
  },

  getStatusTagName(tag) {
    const names = {
      slow: '慢包',
      lost: '丢包',
      outoforder: '乱序',
      duplicate: '重复',
      replayed: '重放'
    };
    return names[tag] || tag;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  getSessionData() {
    return {
      messages: Utils.deepClone(this.messages),
      stats: Utils.deepClone(this.stats),
      latencyStats: Utils.deepClone(this.latencyStats),
      weaknetConfig: Utils.deepClone(weakNet.config),
      weaknetEnabled: weakNet.enabled,
      exportedAt: Date.now()
    };
  },

  loadSessionData(data) {
    if (data.messages) {
      this.messages = data.messages;
    }
    if (data.stats) {
      this.stats = data.stats;
    }
    if (data.latencyStats) {
      this.latencyStats = data.latencyStats;
    }
    this.updateStats();
    this.render();
  }
};
