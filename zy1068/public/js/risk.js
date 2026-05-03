const RiskDetector = {
  risks: [],
  thresholds: {
    cursorExpiry: 5000,
    patchConflictWindow: 1000,
    messageQueueWarning: 20,
    messageQueueCritical: 50,
    latencyWarning: 200,
    latencyCritical: 500,
    lossRateWarning: 5,
    lossRateCritical: 15,
    outOfOrderWarning: 3,
    outOfOrderCritical: 10
  },

  lastCursorMessage: null,
  patchMessages: [],
  messageQueueSize: 0,
  reconnectCount: 0,

  eventHandlers: {
    riskAdded: [],
    riskCleared: [],
    risksChanged: []
  },

  init() {
    this.risks = [];
    this.lastCursorMessage = null;
    this.patchMessages = [];
    this.messageQueueSize = 0;
    this.reconnectCount = 0;
    this.updateUI();
  },

  addRisk(level, type, message, details = {}) {
    const risk = {
      id: Utils.generateId(),
      level,
      type,
      message,
      details,
      timestamp: Date.now(),
      acknowledged: false
    };

    this.risks.push(risk);
    this.emit('riskAdded', risk);
    this.emit('risksChanged', this.risks);
    this.updateUI();
    
    return risk;
  },

  clearRisk(type) {
    const index = this.risks.findIndex(r => r.type === type);
    if (index !== -1) {
      const removed = this.risks.splice(index, 1)[0];
      this.emit('riskCleared', removed);
      this.emit('risksChanged', this.risks);
      this.updateUI();
    }
  },

  clearAllRisks() {
    this.risks = [];
    this.emit('risksChanged', this.risks);
    this.updateUI();
  },

  checkSlowMessage(record, latency) {
    if (latency > this.thresholds.latencyCritical) {
      this.addRisk(
        'critical',
        'high_latency',
        `消息 #${record.seq} 延迟过高 (${latency}ms)，可能影响实时协作体验`,
        { seq: record.seq, latency }
      );
    } else if (latency > this.thresholds.latencyWarning) {
      this.addRisk(
        'warning',
        'slow_message',
        `消息 #${record.seq} 延迟较高 (${latency}ms)`,
        { seq: record.seq, latency }
      );
    }
  },

  checkLostMessage(record) {
    this.addRisk(
      'critical',
      'message_lost',
      `消息 #${record.seq} (${TimelineManager.getMessageTypeName(record.type)}) 丢失`,
      { seq: record.seq, type: record.type }
    );

    const totalMessages = TimelineManager.stats.total;
    const lostMessages = TimelineManager.stats.lost;
    const lossRate = totalMessages > 0 ? (lostMessages / totalMessages) * 100 : 0;

    if (lossRate > this.thresholds.lossRateCritical) {
      this.addRisk(
        'critical',
        'high_loss_rate',
        `丢包率过高 (${lossRate.toFixed(1)}%)，连接质量严重下降`,
        { lossRate }
      );
    } else if (lossRate > this.thresholds.lossRateWarning) {
      this.addRisk(
        'warning',
        'elevated_loss',
        `丢包率升高 (${lossRate.toFixed(1)}%)`,
        { lossRate }
      );
    }
  },

  checkOutOfOrder(record, actualSeq, expectedSeq) {
    const outOfOrderCount = TimelineManager.stats.outOfOrder;
    
    if (outOfOrderCount > this.thresholds.outOfOrderCritical) {
      this.addRisk(
        'critical',
        'severe_out_of_order',
        `严重消息乱序 (${outOfOrderCount} 条)，可能导致状态不一致`,
        { count: outOfOrderCount }
      );
    } else if (outOfOrderCount > this.thresholds.outOfOrderWarning) {
      this.addRisk(
        'warning',
        'out_of_order',
        `消息 #${actualSeq} 乱序到达，期望 #${expectedSeq}`,
        { actualSeq, expectedSeq }
      );
    }
  },

  checkDuplicate(record) {
    this.addRisk(
      'warning',
      'duplicate_message',
      `收到重复消息 #${record.seq}`,
      { seq: record.seq }
    );
  },

  checkCursorMessage(record) {
    if (record.type !== 'cursor') return;

    const now = Date.now();
    
    if (this.lastCursorMessage) {
      const timeSinceLastCursor = now - this.lastCursorMessage.receivedAt;
      if (timeSinceLastCursor > this.thresholds.cursorExpiry) {
        this.addRisk(
          'warning',
          'cursor_stale',
          `光标状态过期，上次更新在 ${(timeSinceLastCursor / 1000).toFixed(1)} 秒前`,
          { lastUpdate: this.lastCursorMessage.receivedAt }
        );
      } else {
        this.clearRisk('cursor_stale');
      }
    }

    this.lastCursorMessage = record;
  },

  checkPatchMessage(record) {
    if (record.type !== 'patch') return;

    const now = Date.now();
    const patch = record.payload;

    const recentPatches = this.patchMessages.filter(p => 
      p.path === patch.path && 
      now - p.timestamp < this.thresholds.patchConflictWindow
    );

    for (const recentPatch of recentPatches) {
      if (recentPatch.from === patch.from || recentPatch.to === patch.from) {
        this.addRisk(
          'critical',
          'patch_conflict',
          `文档路径 "${patch.path}" 存在潜在冲突 (版本 ${patch.from} -> ${patch.to})`,
          { 
            path: patch.path,
            currentFrom: patch.from,
            currentTo: patch.to,
            conflictingFrom: recentPatch.from,
            conflictingTo: recentPatch.to
          }
        );
      }
    }

    this.patchMessages.push({
      ...patch,
      timestamp: now,
      seq: record.seq
    });

    this.patchMessages = this.patchMessages.filter(p => 
      now - p.timestamp < this.thresholds.patchConflictWindow * 2
    );
  },

  updateMessageQueueSize(size) {
    this.messageQueueSize = size;
    
    if (size > this.thresholds.messageQueueCritical) {
      this.addRisk(
        'critical',
        'queue_overflow',
        `消息队列堆积严重 (${size} 条)，可能导致内存增长和延迟增加`,
        { queueSize: size }
      );
    } else if (size > this.thresholds.messageQueueWarning) {
      this.addRisk(
        'warning',
        'queue_building',
        `消息队列开始堆积 (${size} 条)`,
        { queueSize: size }
      );
    } else {
      this.clearRisk('queue_overflow');
      this.clearRisk('queue_building');
    }

    document.getElementById('statQueueSize').textContent = size;
  },

  recordReconnect() {
    this.reconnectCount++;
    document.getElementById('statReconnects').textContent = this.reconnectCount;
    
    if (this.reconnectCount >= 3) {
      this.addRisk(
        'warning',
        'frequent_reconnects',
        `连接不稳定，已重连 ${this.reconnectCount} 次`,
        { reconnectCount: this.reconnectCount }
      );
    }
  },

  checkMessage(record) {
    this.checkCursorMessage(record);
    this.checkPatchMessage(record);
  },

  updateUI() {
    const panel = document.getElementById('riskPanel');
    const list = document.getElementById('riskList');

    if (this.risks.length === 0) {
      panel.classList.add('hidden');
      return;
    }

    panel.classList.remove('hidden');

    list.innerHTML = this.risks.map(risk => `
      <div class="risk-item ${risk.level}">
        <span class="risk-icon">${risk.level === 'critical' ? '⚠️' : '⚡'}</span>
        <div>
          <div>${risk.message}</div>
          <div style="font-size: 11px; opacity: 0.7; margin-top: 2px;">
            ${Utils.formatTimeMs(risk.timestamp)}
          </div>
        </div>
      </div>
    `).join('');
  },

  on(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(handler);
    }
  },

  off(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
    }
  },

  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  },

  getRiskSummary() {
    const critical = this.risks.filter(r => r.level === 'critical').length;
    const warnings = this.risks.filter(r => r.level === 'warning').length;

    return {
      total: this.risks.length,
      critical,
      warnings,
      list: Utils.deepClone(this.risks)
    };
  }
};
