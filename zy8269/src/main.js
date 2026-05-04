import Game from './game/Game.js';
import Renderer from './renderer/Renderer.js';
import InteractiveController from './renderer/InteractiveController.js';
import sampleLevel from './levels/sample-level.js';

class MetroCrowdControlGame {
  constructor() {
    this.game = null;
    this.renderer = null;
    this.controller = null;
    this.isRunning = false;
    this.isPaused = false;
    
    this.init();
  }
  
  init() {
    this.canvas = document.getElementById('gameCanvas');
    this.resizeCanvas();
    
    this.renderer = new Renderer(this.canvas);
    this.controller = new InteractiveController(this.canvas, this.renderer);
    
    this.bindEvents();
    this.showStartScreen();
  }
  
  resizeCanvas() {
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
    
    if (this.renderer) {
      this.renderer.resize(this.canvas.width, this.canvas.height);
    }
  }
  
  bindEvents() {
    window.addEventListener('resize', () => this.resizeCanvas());
    
    document.getElementById('startBtn').addEventListener('click', () => this.startGame());
    document.getElementById('playBtn').addEventListener('click', () => this.startGame());
    document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
    document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
    document.getElementById('replayBtn').addEventListener('click', () => this.exportReplay());
    document.getElementById('playAgainBtn').addEventListener('click', () => this.restartGame());
    
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.setActiveTool(e.currentTarget.id));
    });
    
    this.controller.on('interact', (data) => this.handleInteraction(data));
    this.controller.on('select', (data) => this.handleSelect(data));
  }
  
  setActiveTool(toolId) {
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.getElementById(toolId).classList.add('active');
    
    if (this.controller) {
      const toolMap = {
        'toolSelect': 'select',
        'toolGate': 'gate',
        'toolEscalator': 'escalator',
        'toolBarrier': 'barrier'
      };
      this.controller.setActiveTool(toolMap[toolId]);
    }
  }
  
  showStartScreen() {
    document.getElementById('startOverlay').classList.remove('hidden');
    document.getElementById('gameOverOverlay').classList.add('hidden');
  }
  
  startGame() {
    this.game = new Game(sampleLevel);
    this.renderer.setGame(this.game);
    this.controller.setGame(this.game);
    
    document.getElementById('startOverlay').classList.add('hidden');
    document.getElementById('gameOverOverlay').classList.add('hidden');
    
    document.getElementById('startBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;
    document.getElementById('restartBtn').disabled = false;
    document.getElementById('replayBtn').disabled = false;
    
    this.isRunning = true;
    this.isPaused = false;
    
    this.game.start();
    this.gameLoop();
    
    this.addAlert('info', '游戏开始！早高峰即将来临，请做好准备。');
  }
  
  togglePause() {
    if (!this.isRunning) return;
    
    this.isPaused = !this.isPaused;
    const btn = document.getElementById('pauseBtn');
    btn.textContent = this.isPaused ? '继续' : '暂停';
    
    if (this.isPaused) {
      this.addAlert('warning', '游戏已暂停');
    } else {
      this.addAlert('info', '游戏继续');
      this.gameLoop();
    }
  }
  
  restartGame() {
    if (this.isRunning) {
      this.isRunning = false;
    }
    
    this.clearAlerts();
    this.startGame();
  }
  
  exportReplay() {
    if (this.game) {
      const replayData = this.game.getReplayData();
      this.downloadReplay(replayData);
    }
  }
  
  downloadReplay(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metro-replay-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.addAlert('info', '复盘数据已导出');
  }
  
  gameLoop() {
    if (!this.isRunning || this.isPaused) return;
    
    this.game.update();
    this.renderer.render();
    this.updateUI();
    
    if (this.game.isGameOver()) {
      this.endGame();
      return;
    }
    
    requestAnimationFrame(() => this.gameLoop());
  }
  
  endGame() {
    this.isRunning = false;
    
    const stats = this.game.getFinalStats();
    
    document.getElementById('gameOverTitle').textContent = 
      stats.incidents > 0 ? '💥 任务失败' : '✅ 任务完成';
    document.getElementById('finalScore').textContent = stats.score;
    document.getElementById('totalPassengers').textContent = stats.totalPassengers;
    document.getElementById('maxRisk').textContent = Math.round(stats.maxRisk * 100) + '%';
    document.getElementById('incidents').textContent = stats.incidents;
    
    document.getElementById('gameOverOverlay').classList.remove('hidden');
    
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('startBtn').disabled = false;
    
    this.addAlert(stats.incidents > 0 ? 'danger' : 'info', 
      stats.incidents > 0 ? '任务失败！发生了安全事件。' : '任务完成！所有乘客安全疏散。');
  }
  
  handleInteraction(data) {
    if (!this.game) return;
    
    switch (data.type) {
      case 'gate':
        this.game.toggleGate(data.id);
        break;
      case 'escalator':
        this.game.toggleEscalator(data.id);
        break;
      case 'barrier':
        this.game.toggleBarrier(data.id, data.position);
        break;
    }
  }
  
  handleSelect(data) {
    if (!this.game) return;
    
    const obj = this.game.getObjectAt(data.position);
    if (obj) {
      this.renderer.highlightObject(obj);
    }
  }
  
  updateUI() {
    const state = this.game.getState();
    
    document.getElementById('scoreDisplay').textContent = state.score;
    document.getElementById('timeDisplay').textContent = this.formatTime(state.currentTime);
    document.getElementById('passengerDisplay').textContent = state.currentPassengers;
    document.getElementById('riskDisplay').textContent = this.formatRisk(state.riskLevel);
    
    this.updateAreaStatus(state.areas);
    this.processAlerts(state.alerts);
  }
  
  updateAreaStatus(areas) {
    const container = document.getElementById('areaStatus');
    container.innerHTML = '';
    
    for (const [name, area] of Object.entries(areas)) {
      const card = document.createElement('div');
      card.className = 'info-card';
      
      const label = document.createElement('div');
      label.className = 'info-card-label';
      label.textContent = name;
      
      const value = document.createElement('div');
      value.className = 'info-card-value';
      value.style.color = this.getStatusColor(area.status);
      value.textContent = this.formatAreaStatus(area.status);
      
      card.appendChild(label);
      card.appendChild(value);
      container.appendChild(card);
    }
  }
  
  processAlerts(alerts) {
    alerts.forEach(alert => {
      if (!alert.shown) {
        this.addAlert(alert.type, alert.message);
        alert.shown = true;
      }
    });
  }
  
  addAlert(type, message) {
    const list = document.getElementById('alertList');
    const item = document.createElement('div');
    item.className = `alert-item ${type}`;
    
    const time = document.createElement('div');
    time.className = 'alert-time';
    time.textContent = this.formatTime(this.game ? this.game.getState().currentTime : 0);
    
    const msg = document.createElement('div');
    msg.className = 'alert-message';
    msg.textContent = message;
    
    item.appendChild(time);
    item.appendChild(msg);
    list.insertBefore(item, list.firstChild);
    
    while (list.children.length > 20) {
      list.removeChild(list.lastChild);
    }
  }
  
  clearAlerts() {
    document.getElementById('alertList').innerHTML = '';
  }
  
  formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
  
  formatRisk(level) {
    if (level < 0.3) return '正常';
    if (level < 0.6) return '警戒';
    if (level < 0.8) return '警告';
    return '危险';
  }
  
  formatAreaStatus(status) {
    switch (status) {
      case 'safe': return '正常';
      case 'warning': return '拥挤';
      case 'danger': return '危险';
      default: return status;
    }
  }
  
  getStatusColor(status) {
    switch (status) {
      case 'safe': return '#4ade80';
      case 'warning': return '#fbbf24';
      case 'danger': return '#ef4444';
      default: return '#aaa';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new MetroCrowdControlGame();
});
