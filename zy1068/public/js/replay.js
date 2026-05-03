const ReplayManager = {
  currentScript: null,
  isPlaying: false,
  currentIndex: 0,
  timers: [],
  speed: 1,

  eventHandlers: {
    started: [],
    paused: [],
    stopped: [],
    progress: [],
    completed: []
  },

  loadScript(scriptData) {
    try {
      const script = typeof scriptData === 'string' ? JSON.parse(scriptData) : scriptData;
      
      if (!script.name || !script.version || !script.messages) {
        throw new Error('Invalid script format: missing name, version, or messages');
      }

      this.currentScript = {
        ...script,
        loadedAt: Date.now()
      };

      Utils.showToast(`脚本已加载: ${script.name} (${script.messages.length} 条消息)`, 'success');
      
      document.getElementById('btnStartReplay').disabled = false;
      return true;
    } catch (e) {
      Utils.showToast(`脚本加载失败: ${e.message}`, 'error');
      return false;
    }
  },

  start() {
    if (!this.currentScript || this.currentScript.messages.length === 0) {
      Utils.showToast('没有可回放的脚本', 'warning');
      return;
    }

    if (this.isPlaying) {
      this.pause();
      return;
    }

    this.isPlaying = true;
    this.currentIndex = 0;
    
    document.getElementById('btnStartReplay').textContent = '暂停回放';
    document.getElementById('btnStopReplay').classList.remove('hidden');

    this.emit('started', { 
      scriptName: this.currentScript.name,
      totalMessages: this.currentScript.messages.length
    });

    this.playNext();
  },

  pause() {
    this.isPlaying = false;
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
    
    document.getElementById('btnStartReplay').textContent = '继续回放';
    
    this.emit('paused', { currentIndex: this.currentIndex });
  },

  stop() {
    this.isPlaying = false;
    this.currentIndex = 0;
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
    
    document.getElementById('btnStartReplay').textContent = '开始回放';
    document.getElementById('btnStartReplay').disabled = !this.currentScript;
    document.getElementById('btnStopReplay').classList.add('hidden');

    this.emit('stopped', {});
  },

  playNext() {
    if (!this.isPlaying || !this.currentScript) return;

    const messages = this.currentScript.messages;
    
    if (this.currentIndex >= messages.length) {
      this.complete();
      return;
    }

    const message = messages[this.currentIndex];
    const delay = this.calculateDelay(message, this.currentIndex);

    const timer = setTimeout(() => {
      this.sendMessage(message);
      this.currentIndex++;
      
      this.emit('progress', {
        current: this.currentIndex,
        total: messages.length,
        percent: Math.round((this.currentIndex / messages.length) * 100)
      });

      if (this.isPlaying) {
        this.playNext();
      }
    }, delay / this.speed);

    this.timers.push(timer);
  },

  calculateDelay(message, index) {
    if (message.delay !== undefined) {
      return message.delay;
    }

    if (this.currentScript.interval) {
      return this.currentScript.interval;
    }

    return 500;
  },

  sendMessage(message) {
    if (!webRTC.isConnected()) {
      Utils.showToast('DataChannel 未连接，无法发送消息', 'warning');
      return;
    }

    const type = message.type || 'text';
    const payload = message.payload || {};

    try {
      const envelope = MessageSender.send(type, payload);
      if (envelope) {
        console.log(`Replay sent: #${envelope.seq} ${type}`);
      }
    } catch (e) {
      console.error('Replay send error:', e);
    }
  },

  complete() {
    this.isPlaying = false;
    document.getElementById('btnStartReplay').textContent = '重新播放';
    document.getElementById('btnStopReplay').classList.add('hidden');

    Utils.showToast('回放完成', 'success');
    
    this.emit('completed', {
      messagesSent: this.currentScript.messages.length
    });
  },

  setSpeed(speed) {
    this.speed = Math.max(0.1, Math.min(10, speed));
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
  }
};

const SampleScripts = {
  basicCollaboration: {
    name: '基础协作场景',
    version: '1.0',
    description: '光标移动、批注和文档编辑的基本协作流程',
    interval: 800,
    messages: [
      { type: 'cursor', payload: { x: 100, y: 150, pageId: 'page-1' } },
      { delay: 300 },
      { type: 'cursor', payload: { x: 150, y: 180, pageId: 'page-1' } },
      { delay: 300 },
      { type: 'cursor', payload: { x: 200, y: 200, pageId: 'page-1' } },
      { type: 'annotation', payload: {
        type: 'comment',
        targetId: 'paragraph-1',
        text: '这里需要修改一下格式',
        author: 'User A'
      }},
      { delay: 1000 },
      { type: 'cursor', payload: { x: 300, y: 250, pageId: 'page-1' } },
      { type: 'patch', payload: {
        path: '/document/chapter-1',
        from: 'v1',
        to: 'v2',
        ops: [
          { type: 'retain', value: 10 },
          { type: 'insert', value: '新增内容' }
        ],
        author: 'User A'
      }},
      { delay: 500 },
      { type: 'stroke', payload: {
        strokeId: 'stroke-1',
        color: '#ef4444',
        width: 3,
        points: [
          { x: 100, y: 100, pressure: 0.8 },
          { x: 150, y: 120, pressure: 0.75 },
          { x: 200, y: 110, pressure: 0.8 },
          { x: 250, y: 130, pressure: 0.7 }
        ],
        tool: 'pen'
      }},
      { type: 'cursor', payload: { x: 400, y: 300, pageId: 'page-1' } }
    ]
  },

  highFrequencyCursor: {
    name: '高频光标移动',
    version: '1.0',
    description: '模拟实时协作中的高频光标更新',
    interval: 50,
    messages: []
  },

  burstMessages: {
    name: '突发消息流',
    version: '1.0',
    description: '模拟白板绘画时的突发消息',
    interval: 30,
    messages: []
  }
};

for (let i = 0; i < 50; i++) {
  SampleScripts.highFrequencyCursor.messages.push({
    type: 'cursor',
    payload: {
      x: 100 + Math.sin(i * 0.1) * 200,
      y: 200 + Math.cos(i * 0.1) * 100,
      pageId: 'page-1'
    }
  });
}

for (let i = 0; i < 100; i++) {
  const angle = (i / 100) * Math.PI * 2;
  const radius = 80;
  const centerX = 300;
  const centerY = 200;
  
  SampleScripts.burstMessages.messages.push({
    type: 'stroke',
    payload: {
      strokeId: `burst-circle-${i}`,
      color: '#3b82f6',
      width: 2,
      opacity: 0.8,
      points: [
        {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
          pressure: 0.5 + Math.random() * 0.5,
          time: i * 16
        }
      ],
      tool: 'pen'
    }
  });
}
