import { AnomalyType } from '../models/types.js';
import { SampleDataGenerator } from '../data/SampleDataGenerator.js';

export class UIManager {
  constructor(app) {
    this.app = app;
    this.elements = {};
    this.isPanelOpen = true;
  }

  init(container) {
    this.createMainLayout(container);
    this.bindEvents();
  }

  createMainLayout(container) {
    const appStyle = document.createElement('style');
    appStyle.textContent = this.getCSS();
    document.head.appendChild(appStyle);
    
    const mainLayout = document.createElement('div');
    mainLayout.className = 'main-layout';
    
    const canvasWrapper = document.createElement('div');
    canvasWrapper.className = 'canvas-wrapper';
    canvasWrapper.id = 'canvas-container';
    mainLayout.appendChild(canvasWrapper);
    
    const rightPanel = document.createElement('div');
    rightPanel.className = 'right-panel';
    rightPanel.id = 'right-panel';
    rightPanel.innerHTML = this.createRightPanelContent();
    mainLayout.appendChild(rightPanel);
    
    const timelineBar = document.createElement('div');
    timelineBar.className = 'timeline-bar';
    timelineBar.id = 'timeline-bar';
    timelineBar.innerHTML = this.createTimelineContent();
    mainLayout.appendChild(timelineBar);
    
    const panelToggle = document.createElement('div');
    panelToggle.className = 'panel-toggle';
    panelToggle.id = 'panel-toggle';
    panelToggle.innerHTML = '◀';
    mainLayout.appendChild(panelToggle);
    
    container.innerHTML = '';
    container.appendChild(mainLayout);
  }

  createRightPanelContent() {
    return `
      <div class="panel-header">
        <h2>消防演练复盘</h2>
      </div>
      
      <div class="panel-section">
        <h3>数据导入</h3>
        <div class="import-section">
          <button class="btn btn-primary" id="btn-load-sample">加载示例数据</button>
          <div class="file-upload">
            <input type="file" id="file-input" multiple accept=".csv,.json">
            <button class="btn btn-secondary" id="btn-import">导入CSV/JSON</button>
          </div>
        </div>
      </div>
      
      <div class="panel-section" id="analysis-section" style="display: none;">
        <h3>筛选条件</h3>
        
        <div class="filter-group">
          <label>楼层筛选</label>
          <select id="filter-floor">
            <option value="all">全部楼层</option>
          </select>
        </div>
        
        <div class="filter-group">
          <label>人群筛选</label>
          <select id="filter-group">
            <option value="all">全部人群</option>
          </select>
        </div>
        
        <div class="filter-group">
          <label>异常类型筛选</label>
          <select id="filter-anomaly">
            <option value="all">全部人员</option>
            <option value="has_anomaly">有异常</option>
            <option value="wrong_exit">走错出口</option>
            <option value="blocked_path">经过封闭通道</option>
            <option value="stay_too_long">异常停留</option>
            <option value="wrong_direction">方向错误</option>
          </select>
        </div>
        
        <button class="btn btn-secondary" id="btn-apply-filter">应用筛选</button>
        <button class="btn btn-secondary" id="btn-reset-filter">重置筛选</button>
      </div>
      
      <div class="panel-section" id="person-details" style="display: none;">
        <h3>人员详情</h3>
        <div id="person-info">
        </div>
      </div>
      
      <div class="panel-section" id="summary-section" style="display: none;">
        <h3>分析摘要</h3>
        <div id="summary-info">
        </div>
      </div>
      
      <div class="panel-section" id="export-section" style="display: none;">
        <h3>导出报告</h3>
        <button class="btn btn-success" id="btn-export-md">导出 Markdown</button>
        <button class="btn btn-success" id="btn-export-json">导出 JSON</button>
      </div>
    `;
  }

  createTimelineContent() {
    return `
      <div class="timeline-controls">
        <button class="timeline-btn" id="btn-stop" title="停止">⏹</button>
        <button class="timeline-btn" id="btn-step-back" title="后退">⏮</button>
        <button class="timeline-btn" id="btn-play" title="播放/暂停">▶</button>
        <button class="timeline-btn" id="btn-step-forward" title="前进">⏭</button>
        <button class="timeline-btn" id="btn-goto-end" title="到结尾">⏩</button>
      </div>
      
      <div class="timeline-slider">
        <span class="time-display" id="time-current">00:00</span>
        <input type="range" id="timeline-slider" min="0" max="100" value="0" step="0.1">
        <span class="time-display" id="time-total">00:00</span>
      </div>
      
      <div class="timeline-speed">
        <label>速度:</label>
        <select id="speed-select">
          <option value="0.25">0.25x</option>
          <option value="0.5">0.5x</option>
          <option value="1" selected>1x</option>
          <option value="2">2x</option>
          <option value="4">4x</option>
        </select>
        <label class="loop-label">
          <input type="checkbox" id="loop-checkbox"> 循环
        </label>
      </div>
    `;
  }

  bindEvents() {
    document.getElementById('btn-load-sample')?.addEventListener('click', () => {
      this.loadSampleData();
    });
    
    document.getElementById('btn-import')?.addEventListener('click', () => {
      document.getElementById('file-input')?.click();
    });
    
    document.getElementById('file-input')?.addEventListener('change', (e) => {
      this.importFiles(e.target.files);
    });
    
    document.getElementById('btn-apply-filter')?.addEventListener('click', () => {
      this.applyFilters();
    });
    
    document.getElementById('btn-reset-filter')?.addEventListener('click', () => {
      this.resetFilters();
    });
    
    document.getElementById('btn-play')?.addEventListener('click', () => {
      this.togglePlay();
    });
    
    document.getElementById('btn-stop')?.addEventListener('click', () => {
      this.app.timeline?.stop();
      this.updatePlayButton(false);
    });
    
    document.getElementById('btn-step-back')?.addEventListener('click', () => {
      this.app.timeline?.stepBackward(5);
    });
    
    document.getElementById('btn-step-forward')?.addEventListener('click', () => {
      this.app.timeline?.stepForward(5);
    });
    
    document.getElementById('btn-goto-end')?.addEventListener('click', () => {
      this.app.timeline?.goToEnd();
    });
    
    document.getElementById('timeline-slider')?.addEventListener('input', (e) => {
      const progress = parseFloat(e.target.value) / 100;
      this.app.timeline?.setProgress(progress);
    });
    
    document.getElementById('speed-select')?.addEventListener('change', (e) => {
      const speed = parseFloat(e.target.value);
      this.app.timeline?.setSpeed(speed);
    });
    
    document.getElementById('loop-checkbox')?.addEventListener('change', (e) => {
      this.app.timeline?.setLoop(e.target.checked);
    });
    
    document.getElementById('btn-export-md')?.addEventListener('click', () => {
      this.app.exportMarkdownReport();
    });
    
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      this.app.exportJSONReport();
    });
    
    document.getElementById('panel-toggle')?.addEventListener('click', () => {
      this.togglePanel();
    });
  }

  async loadSampleData() {
    try {
      const generator = new SampleDataGenerator();
      this.app.simulationData = generator.generate();
      
      await this.app.initializeScene();
      this.app.runAnalysis();
      
      this.showAnalysisSections();
      this.updateUIWithData();
      
      this.showNotification('示例数据加载成功！');
    } catch (error) {
      console.error('加载示例数据失败:', error);
      this.showNotification('加载失败: ' + error.message, 'error');
    }
  }

  async importFiles(files) {
    if (!files || files.length === 0) return;
    
    try {
      this.app.simulationData = await this.app.dataLoader.loadFromFiles(Array.from(files));
      
      await this.app.initializeScene();
      this.app.runAnalysis();
      
      this.showAnalysisSections();
      this.updateUIWithData();
      
      this.showNotification('数据导入成功！共 ' + files.length + ' 个文件');
    } catch (error) {
      console.error('导入数据失败:', error);
      this.showNotification('导入失败: ' + error.message, 'error');
    }
  }

  showAnalysisSections() {
    document.getElementById('analysis-section').style.display = 'block';
    document.getElementById('summary-section').style.display = 'block';
    document.getElementById('export-section').style.display = 'block';
  }

  updateUIWithData() {
    if (!this.app.simulationData) return;
    
    const floors = Array.from(this.app.simulationData.floors.values());
    const floorSelect = document.getElementById('filter-floor');
    floorSelect.innerHTML = '<option value="all">全部楼层</option>';
    for (const floor of floors) {
      floorSelect.innerHTML += `<option value="${floor.level}">${floor.name}</option>`;
    }
    
    if (this.app.analysisEngine) {
      const groups = this.app.analysisEngine.getAllGroups();
      const groupSelect = document.getElementById('filter-group');
      groupSelect.innerHTML = '<option value="all">全部人群</option>';
      for (const group of groups) {
        groupSelect.innerHTML += `<option value="${group}">${group}</option>`;
      }
    }
    
    if (this.app.timeline && this.app.simulationData.metadata) {
      const { startTime, endTime } = this.app.simulationData.metadata;
      this.app.timeline.setTimeRange(startTime, endTime);
      document.getElementById('time-total').textContent = this.formatTime(endTime);
      this.updateTimeDisplay(startTime);
    }
    
    this.updateSummary();
  }

  updateSummary() {
    if (!this.app.analysisEngine) return;
    
    const summary = this.app.analysisEngine.getSummary();
    const summaryDiv = document.getElementById('summary-info');
    
    summaryDiv.innerHTML = `
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">总人数</span>
          <span class="summary-value">${summary.totalPersons}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">有异常</span>
          <span class="summary-value anomaly">${summary.personsWithAnomalies} (${(summary.anomalyRatio * 100).toFixed(1)}%)</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">到达出口</span>
          <span class="summary-value success">${summary.reachedExitCount} (${(summary.reachedExitRatio * 100).toFixed(1)}%)</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">最近出口</span>
          <span class="summary-value">${summary.reachedNearestExitCount} (${(summary.reachedNearestExitRatio * 100).toFixed(1)}%)</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">封闭通道</span>
          <span class="summary-value warning">${summary.usedBlockedPathCount} 人</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">拥堵事件</span>
          <span class="summary-value warning">${summary.congestionEvents} 次</span>
        </div>
      </div>
    `;
  }

  updatePersonDetails(person) {
    if (!person) {
      document.getElementById('person-details').style.display = 'none';
      return;
    }
    
    document.getElementById('person-details').style.display = 'block';
    
    const analysis = person.analysis;
    const detailsDiv = document.getElementById('person-info');
    
    let anomaliesHtml = '';
    if (analysis && analysis.anomalies.length > 0) {
      anomaliesHtml = '<div class="anomaly-list"><h4>异常记录</h4>';
      for (const anomaly of analysis.anomalies) {
        const typeName = this.getAnomalyTypeName(anomaly.type);
        anomaliesHtml += `<div class="anomaly-item">
          <span class="anomaly-time">[${this.formatTime(anomaly.time)}]</span>
          <span class="anomaly-type">${typeName}</span>
          <p class="anomaly-desc">${anomaly.description}</p>
        </div>`;
      }
      anomaliesHtml += '</div>';
    }
    
    let observationsHtml = '';
    if (person.observations.length > 0) {
      observationsHtml = '<div class="observation-list"><h4>观察员备注</h4>';
      for (const obs of person.observations) {
        observationsHtml += `<div class="observation-item">
          <span class="observation-time">[${this.formatTime(obs.time)}]</span>
          <span class="observation-observer">${obs.observer}</span>
          <p class="observation-note">${obs.note}</p>
        </div>`;
      }
      observationsHtml += '</div>';
    }
    
    detailsDiv.innerHTML = `
      <div class="person-header">
        <span class="person-name">${person.name}</span>
        <span class="person-group">${person.group}</span>
      </div>
      ${analysis ? `
      <div class="person-stats">
        <div class="stat-row">
          <span>实际用时:</span>
          <span>${this.formatDuration(analysis.actualTime)}</span>
        </div>
        <div class="stat-row">
          <span>实际距离:</span>
          <span>${analysis.actualDistance.toFixed(2)} 米</span>
        </div>
        <div class="stat-row">
          <span>最优距离:</span>
          <span>${analysis.optimalDistance.toFixed(2)} 米</span>
        </div>
        <div class="stat-row">
          <span>绕行距离:</span>
          <span class="${analysis.detourDistance > 0 ? 'warning' : ''}">
            +${analysis.detourDistance.toFixed(2)} 米 (${(analysis.detourRatio * 100).toFixed(1)}%)
          </span>
        </div>
        ${analysis.reachedExit ? `
        <div class="stat-row">
          <span>到达出口:</span>
          <span class="${analysis.reachedNearestExit ? 'success' : 'warning'}">
            ${analysis.reachedExit.id} ${analysis.reachedNearestExit ? '(最近)' : '(非最近)'}
          </span>
        </div>` : `
        <div class="stat-row">
          <span>状态:</span>
          <span class="warning">未到达出口</span>
        </div>`}
      </div>
      ` : ''}
      ${anomaliesHtml}
      ${observationsHtml}
    `;
  }

  applyFilters() {
    const floorValue = document.getElementById('filter-floor')?.value;
    const groupValue = document.getElementById('filter-group')?.value;
    const anomalyValue = document.getElementById('filter-anomaly')?.value;
    
    this.app.applyFilters({
      floor: floorValue,
      group: groupValue,
      anomalyType: anomalyValue
    });
  }

  resetFilters() {
    document.getElementById('filter-floor').value = 'all';
    document.getElementById('filter-group').value = 'all';
    document.getElementById('filter-anomaly').value = 'all';
    
    this.app.resetFilters();
  }

  togglePlay() {
    if (!this.app.timeline) return;
    
    this.app.timeline.toggle();
    const isPlaying = this.app.timeline.isPlaying;
    this.updatePlayButton(isPlaying);
  }

  updatePlayButton(isPlaying) {
    const btn = document.getElementById('btn-play');
    if (btn) {
      btn.textContent = isPlaying ? '⏸' : '▶';
      btn.title = isPlaying ? '暂停' : '播放';
    }
  }

  updateTimeDisplay(time) {
    const currentEl = document.getElementById('time-current');
    const slider = document.getElementById('timeline-slider');
    
    if (currentEl) {
      currentEl.textContent = this.formatTime(time);
    }
    
    if (slider && this.app.timeline) {
      const progress = this.app.timeline.getProgress();
      slider.value = (progress * 100).toString();
    }
  }

  togglePanel() {
    this.isPanelOpen = !this.isPanelOpen;
    const panel = document.getElementById('right-panel');
    const toggle = document.getElementById('panel-toggle');
    const canvas = document.querySelector('.canvas-wrapper');
    
    if (this.isPanelOpen) {
      panel.style.right = '0';
      canvas.style.marginRight = '320px';
      toggle.textContent = '◀';
      toggle.style.right = '320px';
    } else {
      panel.style.right = '-320px';
      canvas.style.marginRight = '0';
      toggle.textContent = '▶';
      toggle.style.right = '0';
    }
  }

  showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      background: ${type === 'error' ? '#e74c3c' : '#27ae60'};
      color: white;
      border-radius: 4px;
      z-index: 10000;
      animation: slideDown 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0) {
      return `${mins} 分 ${secs} 秒`;
    }
    return `${secs} 秒`;
  }

  getAnomalyTypeName(type) {
    const names = {
      [AnomalyType.WRONG_EXIT]: '走错出口',
      [AnomalyType.BLOCKED_PATH]: '经过封闭通道',
      [AnomalyType.STAY_TOO_LONG]: '异常停留',
      [AnomalyType.WRONG_DIRECTION]: '方向错误',
      [AnomalyType.CONGESTION]: '通道拥堵'
    };
    return names[type] || type;
  }

  getCSS() {
    return `
      .main-layout {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        position: relative;
      }
      
      .canvas-wrapper {
        flex: 1;
        position: relative;
        margin-right: 320px;
        transition: margin-right 0.3s ease;
      }
      
      .right-panel {
        position: absolute;
        top: 0;
        right: 0;
        width: 320px;
        height: calc(100% - 80px);
        background: rgba(30, 30, 50, 0.95);
        border-left: 1px solid #444;
        overflow-y: auto;
        z-index: 100;
        transition: right 0.3s ease;
      }
      
      .panel-toggle {
        position: absolute;
        top: 50%;
        right: 320px;
        transform: translateY(-50%);
        width: 24px;
        height: 80px;
        background: rgba(50, 50, 80, 0.95);
        border: 1px solid #444;
        border-right: none;
        border-radius: 8px 0 0 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #aaa;
        font-size: 14px;
        z-index: 101;
        transition: right 0.3s ease;
      }
      
      .panel-toggle:hover {
        background: rgba(70, 70, 100, 0.95);
        color: #fff;
      }
      
      .timeline-bar {
        height: 80px;
        background: rgba(30, 30, 50, 0.95);
        border-top: 1px solid #444;
        display: flex;
        align-items: center;
        padding: 0 20px;
        gap: 20px;
        z-index: 100;
      }
      
      .panel-header {
        padding: 16px;
        background: rgba(40, 40, 70, 0.9);
        border-bottom: 1px solid #444;
      }
      
      .panel-header h2 {
        margin: 0;
        font-size: 18px;
        color: #fff;
      }
      
      .panel-section {
        padding: 16px;
        border-bottom: 1px solid #333;
      }
      
      .panel-section h3 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .import-section {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      
      .file-upload {
        position: relative;
      }
      
      .file-upload input[type="file"] {
        position: absolute;
        opacity: 0;
        width: 100%;
        height: 100%;
        cursor: pointer;
      }
      
      .btn {
        padding: 10px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
      }
      
      .btn-primary {
        background: #3498db;
        color: white;
      }
      
      .btn-primary:hover {
        background: #2980b9;
      }
      
      .btn-secondary {
        background: #555;
        color: white;
      }
      
      .btn-secondary:hover {
        background: #666;
      }
      
      .btn-success {
        background: #27ae60;
        color: white;
      }
      
      .btn-success:hover {
        background: #219a52;
      }
      
      .filter-group {
        margin-bottom: 12px;
      }
      
      .filter-group label {
        display: block;
        margin-bottom: 4px;
        color: #aaa;
        font-size: 12px;
      }
      
      .filter-group select {
        width: 100%;
        padding: 8px 12px;
        background: #333;
        border: 1px solid #444;
        border-radius: 4px;
        color: #fff;
        font-size: 13px;
      }
      
      .timeline-controls {
        display: flex;
        gap: 8px;
      }
      
      .timeline-btn {
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 50%;
        background: #444;
        color: #fff;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      
      .timeline-btn:hover {
        background: #555;
      }
      
      .timeline-btn:active {
        background: #3498db;
      }
      
      .timeline-slider {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .timeline-slider input[type="range"] {
        flex: 1;
        height: 6px;
        border-radius: 3px;
        background: #444;
        outline: none;
        -webkit-appearance: none;
      }
      
      .timeline-slider input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #3498db;
        cursor: pointer;
      }
      
      .time-display {
        color: #aaa;
        font-family: monospace;
        font-size: 14px;
        min-width: 45px;
      }
      
      .timeline-speed {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #aaa;
        font-size: 13px;
      }
      
      .timeline-speed select {
        padding: 6px 10px;
        background: #333;
        border: 1px solid #444;
        border-radius: 4px;
        color: #fff;
        font-size: 13px;
      }
      
      .loop-label {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
      }
      
      .summary-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      
      .summary-item {
        display: flex;
        flex-direction: column;
        padding: 10px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
      }
      
      .summary-label {
        font-size: 11px;
        color: #888;
        margin-bottom: 4px;
      }
      
      .summary-value {
        font-size: 16px;
        font-weight: 600;
        color: #fff;
      }
      
      .summary-value.success { color: #27ae60; }
      .summary-value.warning { color: #f39c12; }
      .summary-value.anomaly { color: #e74c3c; }
      
      .person-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      
      .person-name {
        font-size: 18px;
        font-weight: 600;
        color: #fff;
      }
      
      .person-group {
        font-size: 12px;
        color: #888;
        background: rgba(255, 255, 255, 0.1);
        padding: 4px 8px;
        border-radius: 4px;
      }
      
      .person-stats {
        background: rgba(255, 255, 255, 0.03);
        border-radius: 4px;
        padding: 12px;
      }
      
      .stat-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 13px;
        color: #aaa;
      }
      
      .stat-row:last-child {
        margin-bottom: 0;
      }
      
      .stat-row .success { color: #27ae60; }
      .stat-row .warning { color: #f39c12; }
      
      .anomaly-list, .observation-list {
        margin-top: 16px;
      }
      
      .anomaly-list h4, .observation-list h4 {
        font-size: 13px;
        color: #888;
        margin-bottom: 8px;
      }
      
      .anomaly-item, .observation-item {
        background: rgba(255, 255, 255, 0.03);
        border-radius: 4px;
        padding: 10px;
        margin-bottom: 8px;
      }
      
      .anomaly-time, .observation-time {
        font-family: monospace;
        color: #3498db;
        font-size: 12px;
      }
      
      .anomaly-type {
        color: #e74c3c;
        font-size: 12px;
        margin-left: 8px;
      }
      
      .observation-observer {
        color: #f39c12;
        font-size: 12px;
        margin-left: 8px;
      }
      
      .anomaly-desc, .observation-note {
        margin: 6px 0 0 0;
        font-size: 12px;
        color: #aaa;
        line-height: 1.5;
      }
      
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
      
      ::-webkit-scrollbar {
        width: 6px;
      }
      
      ::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
      }
      
      ::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    `;
  }
}

export default UIManager;
