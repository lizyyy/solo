import { LogParser, PlaybackState, Exporter } from './core/index.js';

class App {
  constructor() {
    this.parser = new LogParser();
    this.playback = new PlaybackState();
    this.parserResult = null;
    this.userColors = {};
    this.init();
  }

  init() {
    this.bindEvents();
    this.updateUI();
    this.setStatus('就绪 - 请导入日志文件或加载示例数据');
  }

  bindEvents() {
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

    document.getElementById('loadSampleBtn').addEventListener('click', () => this.loadSampleData());
    document.getElementById('playBtn').addEventListener('click', () => this.togglePlay());
    document.getElementById('stepForwardBtn').addEventListener('click', () => this.stepForward());
    document.getElementById('stepBackBtn').addEventListener('click', () => this.stepBackward());
    document.getElementById('goBeginBtn').addEventListener('click', () => this.goToBeginning());
    document.getElementById('goEndBtn').addEventListener('click', () => this.goToEnd());
    document.getElementById('speedSelect').addEventListener('change', (e) => this.setSpeed(parseFloat(e.target.value)));

    document.getElementById('timeline').addEventListener('click', (e) => this.handleTimelineClick(e));

    document.getElementById('exportMarkdownBtn').addEventListener('click', () => this.exportMarkdown());
    document.getElementById('exportJSONBtn').addEventListener('click', () => this.exportJSON());

    this.playback.on('operationsLoaded', () => {
      this.updateUI();
      this.renderTimeline();
      this.renderUserSelector();
    });

    this.playback.on('operationApplied', () => {
      this.updateUI();
    });

    this.playback.on('operationReverted', () => {
      this.updateUI();
    });

    this.playback.on('conflictDetected', (data) => {
      this.renderConflicts();
      this.renderTimeline();
    });

    this.playback.on('playbackStarted', () => {
      const playBtn = document.getElementById('playBtn');
      playBtn.textContent = '⏸';
      playBtn.title = '暂停';
    });

    this.playback.on('playbackPaused', () => {
      const playBtn = document.getElementById('playBtn');
      playBtn.textContent = '▶';
      playBtn.title = '播放';
    });

    this.playback.on('playbackEnded', () => {
      const playBtn = document.getElementById('playBtn');
      playBtn.textContent = '▶';
      playBtn.title = '播放';
    });
  }

  async handleFileUpload(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    this.setStatus('正在解析日志文件...');

    try {
      const allOperations = [];
      
      for (const file of files) {
        const content = await this.readFile(file);
        const logs = JSON.parse(content);
        
        if (Array.isArray(logs)) {
          allOperations.push(...logs);
        } else if (logs.operations && Array.isArray(logs.operations)) {
          allOperations.push(...logs.operations);
        }
      }

      if (allOperations.length === 0) {
        throw new Error('未找到有效的操作数据');
      }

      this.parserResult = this.parser.parse(allOperations);
      
      if (this.parserResult === null) {
        throw new Error('日志解析失败');
      }

      this.assignUserColors();
      this.playback.loadOperations(this.parserResult.operations);
      
      this.renderStats();
      this.renderIsolationList();
      
      this.setStatus(`已加载 ${this.parserResult.stats.valid} 条有效操作，${this.parserResult.stats.invalid} 条无效操作被隔离`);

    } catch (error) {
      this.setStatus(`错误: ${error.message}`);
      console.error('文件上传错误:', error);
    }

    event.target.value = '';
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  loadSampleData() {
    this.setStatus('正在加载示例数据...');
    
    const sampleData = this.generateSampleData();
    this.parserResult = this.parser.parse(sampleData);
    
    this.assignUserColors();
    this.playback.loadOperations(this.parserResult.operations);
    
    this.renderStats();
    this.renderIsolationList();
    
    this.setStatus('示例数据已加载 - 包含正常操作、冲突场景和无效操作');
  }

  generateSampleData() {
    const baseTime = Date.now();
    const operations = [];

    operations.push({
      operationId: 'op-001',
      userId: 'user-a',
      timestamp: new Date(baseTime + 100).toISOString(),
      version: 0,
      type: 'INSERT',
      payload: { position: 0, text: 'Hello' }
    });

    operations.push({
      operationId: 'op-002',
      userId: 'user-b',
      timestamp: new Date(baseTime + 200).toISOString(),
      version: 0,
      type: 'INSERT',
      payload: { position: 0, text: 'Hi ' }
    });

    operations.push({
      operationId: 'op-003',
      userId: 'user-a',
      timestamp: new Date(baseTime + 300).toISOString(),
      version: 1,
      type: 'CURSOR_MOVE',
      payload: { position: 5 }
    });

    operations.push({
      operationId: 'op-004',
      userId: 'user-a',
      timestamp: new Date(baseTime + 400).toISOString(),
      version: 2,
      type: 'INSERT',
      payload: { position: 5, text: ' World' }
    });

    operations.push({
      operationId: 'op-005',
      userId: 'user-c',
      timestamp: new Date(baseTime + 500).toISOString(),
      version: 0,
      type: 'INSERT',
      payload: { position: 100, text: 'Invalid position' }
    });

    operations.push({
      operationId: 'op-001',
      userId: 'user-a',
      timestamp: new Date(baseTime + 600).toISOString(),
      version: 3,
      type: 'INSERT',
      payload: { position: 0, text: 'Duplicate ID' }
    });

    operations.push({
      operationId: 'op-006',
      userId: 'user-a',
      timestamp: new Date(baseTime + 700).toISOString(),
      version: 10,
      type: 'INSERT',
      payload: { position: 0, text: 'Version jump' }
    });

    operations.push({
      operationId: 'op-007',
      userId: 'user-b',
      timestamp: new Date(baseTime + 800).toISOString(),
      version: 1,
      type: 'RECONNECT',
      payload: { lastKnownVersion: 0, pendingOperations: [] }
    });

    operations.push({
      operationId: 'op-008',
      userId: 'user-a',
      timestamp: new Date(baseTime + 900).toISOString(),
      version: 11,
      type: 'UNDO',
      payload: {}
    });

    operations.push({
      operationId: 'op-009',
      userId: 'user-b',
      timestamp: new Date(baseTime + 1000).toISOString(),
      version: 2,
      type: 'DELETE',
      payload: { position: 0, length: 3, direction: 'forward' }
    });

    operations.push({
      userId: 'user-a',
      timestamp: new Date(baseTime + 1100).toISOString(),
      version: 12,
      type: 'INSERT',
      payload: { position: 0, text: 'Missing ID' }
    });

    operations.push({
      operationId: 'op-010',
      userId: 'user-c',
      timestamp: new Date(baseTime + 1200).toISOString(),
      version: 1,
      type: 'MERGE',
      payload: {
        baseVersion: 0,
        remoteOperations: [
          {
            operationId: 'remote-001',
            type: 'INSERT',
            payload: { position: 0, text: 'Merged ' }
          }
        ]
      }
    });

    return operations;
  }

  assignUserColors() {
    const users = this.playback.getUniqueUsers();
    users.forEach((userId, index) => {
      this.userColors[userId] = `user-color-${index % 6}`;
    });
  }

  togglePlay() {
    const state = this.playback.togglePlay();
    this.updatePlayButton(state.isPlaying);
  }

  stepForward() {
    this.playback.stepForward();
  }

  stepBackward() {
    this.playback.stepBackward();
  }

  goToBeginning() {
    this.playback.goToBeginning();
  }

  goToEnd() {
    this.playback.goToEnd();
  }

  setSpeed(speed) {
    this.playback.setPlaybackSpeed(speed);
  }

  handleTimelineClick(event) {
    const timeline = document.getElementById('timeline');
    const rect = timeline.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = x / rect.width;
    const index = Math.floor(percentage * this.playback.operations.length);
    this.playback.goToIndex(index);
  }

  updatePlayButton(isPlaying) {
    const playBtn = document.getElementById('playBtn');
    playBtn.textContent = isPlaying ? '⏸' : '▶';
    playBtn.title = isPlaying ? '暂停' : '播放';
  }

  updateUI() {
    const state = this.playback.getState();
    
    this.renderDocument(state);
    this.renderProgress(state);
    this.renderOperationDetails(state);
    this.renderConflicts();
    this.updateTimelineMarker(state);
  }

  renderDocument(state) {
    const docDisplay = document.getElementById('documentDisplay');
    const docLength = document.getElementById('docLength');
    
    if (state.document === '') {
      docDisplay.innerHTML = '<div class="empty-state">加载日志后显示文档内容</div>';
      docLength.textContent = '长度: 0';
      return;
    }

    docDisplay.innerHTML = '';
    
    const textNode = document.createTextNode(state.document);
    docDisplay.appendChild(textNode);
    docLength.textContent = `长度: ${state.document.length}`;

    this.renderCursors(state.cursors, docDisplay);
  }

  renderCursors(cursors, container) {
    Object.entries(cursors).forEach(([userId, position]) => {
      if (userId === this.playback.activeUserId || this.playback.activeUserId === null) {
        const cursor = document.createElement('span');
        cursor.className = `cursor-marker ${this.userColors[userId] || 'user-color-0'}`;
        cursor.title = `用户: ${userId}`;
        
        const textBefore = container.textContent.slice(0, position);
        const offset = this.calculateTextOffset(textBefore, container);
        
        cursor.style.left = `${offset}px`;
        cursor.style.top = '1rem';
        container.appendChild(cursor);
      }
    });
  }

  calculateTextOffset(text, container) {
    const temp = document.createElement('span');
    temp.style.visibility = 'hidden';
    temp.style.position = 'absolute';
    temp.style.whiteSpace = 'pre-wrap';
    temp.style.fontFamily = getComputedStyle(container).fontFamily;
    temp.style.fontSize = getComputedStyle(container).fontSize;
    temp.textContent = text;
    document.body.appendChild(temp);
    const width = temp.offsetWidth;
    document.body.removeChild(temp);
    return width;
  }

  renderProgress(state) {
    const progressText = document.getElementById('progressText');
    progressText.textContent = `进度: ${state.currentIndex + 1}/${state.totalOperations}`;
  }

  renderTimeline() {
    const timeline = document.getElementById('timeline');
    const track = timeline.querySelector('.timeline-track');
    
    const oldProgress = timeline.querySelector('.timeline-progress');
    if (oldProgress) oldProgress.remove();
    
    const oldMarkers = timeline.querySelectorAll('.timeline-marker');
    oldMarkers.forEach(m => m.remove());

    const progress = document.createElement('div');
    progress.className = 'timeline-progress';
    progress.style.width = '0%';
    timeline.insertBefore(progress, track.nextSibling);

    const state = this.playback.getState();
    const operations = this.playback.operations;
    const conflicts = this.playback.getAllConflicts();
    const conflictIndices = new Set(conflicts.map(c => c.index));

    operations.forEach((_, index) => {
      const marker = document.createElement('div');
      const percentage = (index / operations.length) * 100;
      marker.className = `timeline-marker ${conflictIndices.has(index) ? 'conflict' : 'normal'}`;
      marker.style.left = `${percentage}%`;
      marker.dataset.index = index;
      
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        this.playback.goToIndex(index);
      });
      
      timeline.appendChild(marker);
    });
  }

  updateTimelineMarker(state) {
    const timeline = document.getElementById('timeline');
    const progress = timeline.querySelector('.timeline-progress');
    if (progress) {
      const percentage = state.totalOperations > 0 
        ? ((state.currentIndex + 1) / state.totalOperations) * 100 
        : 0;
      progress.style.width = `${percentage}%`;
    }

    const markers = timeline.querySelectorAll('.timeline-marker');
    markers.forEach((marker, index) => {
      if (index === state.currentIndex) {
        marker.classList.add('current');
      } else {
        marker.classList.remove('current');
      }
    });
  }

  renderOperationDetails(state) {
    const container = document.getElementById('operationDetails');
    
    if (!state.currentOperation) {
      container.innerHTML = '<p class="empty-state">播放时显示操作详情</p>';
      return;
    }

    const op = state.currentOperation;
    const userColor = this.userColors[op.userId] || 'user-color-0';
    
    container.innerHTML = `
      <div class="operation-meta">
        <div class="meta-item">
          <span class="meta-label">操作ID</span>
          <span class="meta-value">${op.operationId}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">用户</span>
          <span class="meta-value">
            <span class="user-color ${userColor}" style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px;"></span>
            ${op.userId}
          </span>
        </div>
        <div class="meta-item">
          <span class="meta-label">操作类型</span>
          <span class="meta-value">${op.type}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">版本</span>
          <span class="meta-value">v${op.version}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">时间戳</span>
          <span class="meta-value">${op.timestamp}</span>
        </div>
      </div>
      <div>
        <strong>Payload:</strong>
        <pre>${JSON.stringify(op.payload, null, 2)}</pre>
      </div>
    `;
  }

  renderStats() {
    const container = document.getElementById('statsPanel');
    if (!this.parserResult) {
      container.innerHTML = '<p class="empty-state">加载日志后显示统计</p>';
      return;
    }

    const stats = this.parserResult.stats;
    container.innerHTML = `
      <div class="stat-item">
        <span class="stat-label">总操作数</span>
        <span class="stat-value">${stats.total}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">有效操作</span>
        <span class="stat-value" style="color: var(--success-color);">${stats.valid}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">无效操作</span>
        <span class="stat-value" style="color: var(--danger-color);">${stats.invalid}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">唯一用户</span>
        <span class="stat-value">${stats.uniqueUsers}</span>
      </div>
    `;
  }

  renderUserSelector() {
    const container = document.getElementById('userSelector');
    const users = this.playback.getUniqueUsers();

    if (users.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无用户数据</p>';
      return;
    }

    const allItem = document.createElement('div');
    allItem.className = `user-item ${this.playback.activeUserId === null ? 'active' : ''}`;
    allItem.innerHTML = `
      <span class="user-color" style="background: linear-gradient(135deg, #ef4444, #3b82f6, #22c55e);"></span>
      <span class="user-name">全部用户</span>
      <span class="user-op-count">${this.playback.operations.length} 操作</span>
    `;
    allItem.addEventListener('click', () => {
      this.playback.setActiveUserId(null);
      this.updateUserSelectorUI();
    });
    container.innerHTML = '';
    container.appendChild(allItem);

    users.forEach((userId) => {
      const userOps = this.playback.getOperationsByUser(userId);
      const userColor = this.userColors[userId] || 'user-color-0';
      
      const item = document.createElement('div');
      item.className = `user-item ${this.playback.activeUserId === userId ? 'active' : ''}`;
      item.innerHTML = `
        <span class="user-color ${userColor}"></span>
        <span class="user-name">${userId}</span>
        <span class="user-op-count">${userOps.length} 操作</span>
      `;
      item.addEventListener('click', () => {
        this.playback.setActiveUserId(userId);
        this.updateUserSelectorUI();
      });
      container.appendChild(item);
    });
  }

  updateUserSelectorUI() {
    const items = document.querySelectorAll('.user-item');
    items.forEach((item, index) => {
      if (index === 0 && this.playback.activeUserId === null) {
        item.classList.add('active');
      } else if (item.querySelector('.user-name')?.textContent === this.playback.activeUserId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  renderConflicts() {
    const container = document.getElementById('conflictsPanel');
    const conflicts = this.playback.getAllConflicts();

    if (conflicts.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无冲突</p>';
      return;
    }

    container.innerHTML = conflicts.map((conflict, index) => `
      <div class="conflict-item" data-index="${conflict.index}">
        <div class="conflict-type">${conflict.type}</div>
        <div class="conflict-msg">${conflict.message}</div>
      </div>
    `).join('');

    container.querySelectorAll('.conflict-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        this.playback.goToIndex(index);
      });
    });
  }

  renderIsolationList() {
    const container = document.getElementById('isolationPanel');
    
    if (!this.parserResult || this.parserResult.isolationList.length === 0) {
      container.innerHTML = '<p class="empty-state">无隔离项</p>';
      return;
    }

    const list = this.parserResult.isolationList;
    container.innerHTML = list.map((item, index) => `
      <div class="isolation-item">
        <div class="conflict-type">隔离项 ${index + 1}</div>
        <div class="conflict-msg">
          ${item.errors.map(e => `${e.type}: ${e.message}`).join('; ')}
        </div>
      </div>
    `).join('');
  }

  exportMarkdown() {
    if (!this.parserResult) {
      this.setStatus('请先加载日志数据');
      return;
    }

    const state = this.playback.getState();
    const content = Exporter.exportMarkdown(state, this.parserResult);
    Exporter.download(content, 'collab-review.md', 'text/markdown');
    this.setStatus('Markdown 复盘报告已导出');
  }

  exportJSON() {
    if (!this.parserResult) {
      this.setStatus('请先加载日志数据');
      return;
    }

    const state = this.playback.getState();
    const content = JSON.stringify(Exporter.exportJSON(state, this.parserResult), null, 2);
    Exporter.download(content, 'collab-result.json', 'application/json');
    this.setStatus('JSON 结果已导出');
  }

  setStatus(message) {
    const statusText = document.getElementById('statusText');
    statusText.textContent = message;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});
