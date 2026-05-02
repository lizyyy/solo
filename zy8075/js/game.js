class DeicingGame {
  constructor() {
    this.ui = new UIManager();
    this.storage = new StorageManager();
    this.scheduler = null;
    this.rulesEngine = null;
    this.gameState = null;
    this.gameLoop = null;
    this.timeScale = 1;
    this.lastTickTime = 0;
    this.tickInterval = 1000;
    this.status = 'menu';
  }

  init() {
    this.ui.init();
    this.setupCallbacks();
    this.showMainMenu();
  }

  setupCallbacks() {
    this.ui.on('start', () => this.startGame());
    this.ui.on('pause', () => this.pauseGame());
    this.ui.on('resume', () => this.resumeGame());
    this.ui.on('restart', () => this.restartLevel());
    this.ui.on('save', () => this.saveGame());
    this.ui.on('export', () => this.exportReport());
    this.ui.on('nextLevel', () => this.loadNextLevel());
    this.ui.on('menu', () => this.showMainMenu());
    this.ui.on('speedChange', (data) => this.setSpeed(data.speed));
    this.ui.on('assignFlight', (data) => this.handleFlightAssignment(data));
    this.ui.on('selectFlight', (data) => this.handleFlightSelection(data));
    this.ui.on('close', () => this.ui.closeModal());
  }

  showMainMenu() {
    this.stopGameLoop();
    this.status = 'menu';

    const progress = this.storage.loadProgress();
    const levels = this.getLevelList(progress);

    const content = `
      <div class="menu-container">
        <h1>🛫 除冰调度模拟器</h1>
        <p class="subtitle">冬季机场机坪除冰作业调度</p>

        <div class="menu-buttons">
          <button class="btn btn-primary btn-large" id="menu-start">
            开始游戏
          </button>
          ${this.storage.hasSaveData() ? `
            <button class="btn btn-secondary btn-large" id="menu-continue">
              继续游戏
            </button>
          ` : ''}
        </div>

        <div class="level-select-container">
          <h2>选择关卡</h2>
          <div class="level-grid">
            ${levels.map(level => `
              <div class="level-card ${level.unlocked ? '' : 'locked'}"
                   data-level-id="${level.id}">
                <h3>${level.name}</h3>
                <p>${level.description}</p>
                <div class="level-meta">
                  <span class="difficulty">${'★'.repeat(level.difficulty)}</span>
                  ${level.highScore ? `<span class="high-score">最高分: ${level.highScore}</span>` : ''}
                </div>
                ${level.unlocked ? '' : '<span class="locked-overlay">🔒 未解锁</span>'}
              </div>
            `).join('')}
          </div>
        </div>

        <div class="menu-footer">
          <button class="btn btn-text" id="menu-clear">清除进度</button>
        </div>
      </div>
    `;

    document.getElementById('game-container').innerHTML = content;

    document.getElementById('menu-start')?.addEventListener('click', () => {
      this.startGame('level-01');
    });

    document.getElementById('menu-continue')?.addEventListener('click', () => {
      this.continueGame();
    });

    document.querySelectorAll('.level-card:not(.locked)').forEach(card => {
      card.addEventListener('click', () => {
        this.startGame(card.dataset.levelId);
      });
    });

    document.getElementById('menu-clear')?.addEventListener('click', () => {
      if (confirm('确定要清除所有进度吗？')) {
        this.storage.clearAllData();
        this.showMainMenu();
      }
    });
  }

  getLevelList(progress) {
    const { LEVELS, LEVEL_ORDER } = window;
    return LEVEL_ORDER.map(id => {
      const level = LEVELS[id];
      return {
        id: level.id,
        name: level.name,
        description: level.description,
        difficulty: level.difficulty,
        unlocked: progress.unlockedLevels.includes(id),
        highScore: progress.highScores[id] || 0
      };
    });
  }

  continueGame() {
    const result = this.storage.loadGame();
    if (result.success) {
      this.gameState = result.data;
      this.scheduler = new Scheduler(this.gameState);
      this.rulesEngine = new RulesEngine(this.gameState);
      this.setupSchedulerListeners();
      this.status = 'playing';
      this.renderGameUI();
      this.startGameLoop();
    } else {
      alert('无法加载存档');
      this.showMainMenu();
    }
  }

  startGame(levelId = 'level-01') {
    const { getLevel } = window;
    const levelData = getLevel(levelId);

    if (!levelData) {
      alert('关卡不存在');
      return;
    }

    this.gameState = this.createGameState(levelData);
    this.scheduler = new Scheduler(this.gameState);
    this.rulesEngine = new RulesEngine(this.gameState);
    this.setupSchedulerListeners();
    this.status = 'playing';
    this.timeScale = 1;

    this.renderGameUI();
    this.startGameLoop();

    this.addEventLog('info', `关卡 "${levelData.name}" 开始`);
  }

  createGameState(levelData) {
    const flights = levelData.flights.map(f => ({
      ...f,
      status: 'scheduled',
      actualDeparture: null,
      deicingStartTime: null,
      deicingEndTime: null,
      deicingCompleteTime: null,
      clearedTime: null,
      assignedPad: null,
      assignedVehicle: null,
      delayReason: null
    }));

    const vehicles = levelData.vehicles.map(v => ({
      ...v,
      status: 'available',
      currentPad: null,
      currentFlight: null,
      breakdownTime: null,
      repairEndTime: null,
      shiftChangeStart: null,
      shiftChangeEnd: null
    }));

    const pads = levelData.pads.map(p => ({
      ...p,
      status: 'available',
      currentFlight: null,
      currentVehicle: null,
      processStartTime: null,
      processEndTime: null
    }));

    return {
      levelId: levelData.id,
      level: levelData,
      currentTime: levelData.startTime,
      dayOfOperation: levelData.startDay,
      timeRemaining: levelData.timeLimit * 60,
      score: 0,
      status: 'playing',
      flights,
      vehicles,
      pads,
      fluidInventory: JSON.parse(JSON.stringify(levelData.fluidInventory)),
      assignments: [],
      eventLog: [],
      triggeredEvents: []
    };
  }

  setupSchedulerListeners() {
    this.scheduler.addListener((event, data) => {
      switch (event) {
        case 'assignment':
          this.addEventLog('info', `${data.flight.id} 开始除冰 (${data.pad.id})`);
          this.updateUI();
          break;
        case 'deicing_complete':
          this.addEventLog('success', `${data.flight.id} 除冰完成`);
          this.updateUI();
          break;
        case 'takeoff':
          this.addEventLog('success', `${data.flight.id} 起飞${data.delay > 0 ? ` (延误${data.delay}分钟)` : ''}`);
          this.updateUI();
          break;
        case 'vehicle_breakdown':
          this.addEventLog('warning', `${data.vehicle.id} 故障! 预计修复: ${data.repairTime}分钟`);
          this.updateUI();
          break;
        case 'vehicle_repaired':
          this.addEventLog('info', `${data.vehicle.id} 维修完成`);
          this.updateUI();
          break;
        case 'shift_change_start':
          this.addEventLog('warning', `${data.vehicle.id} 操作员换班中`);
          this.updateUI();
          break;
        case 'shift_change_complete':
          this.addEventLog('info', `${data.vehicle.id} 换班完成`);
          this.updateUI();
          break;
        case 'return_flight':
          this.addEventLog('warning', `${data.flight.id} 返场! 优先级提升`);
          this.updateUI();
          break;
        case 'time_advance':
          this.updateTimeDisplay();
          break;
      }
    });
  }

  renderGameUI() {
    const content = `
      <div id="header" class="game-header">
        <div class="header-left">
          <h1>🛫 除冰调度</h1>
        </div>
        <div class="header-center">
          <div class="time-info">
            <span class="label">时间</span>
            <span class="value" id="time-display">${this.formatTime(this.gameState.currentTime)}</span>
            <span class="day" id="day-display">第${this.gameState.dayOfOperation}天</span>
          </div>
          <div class="countdown-info">
            <span class="label">剩余</span>
            <span class="value" id="countdown">${this.formatCountdown(this.gameState.timeRemaining)}</span>
          </div>
        </div>
        <div class="header-right">
          <div class="score-info">
            <span class="label">得分</span>
            <span class="value" id="score">${this.gameState.score}</span>
          </div>
        </div>
      </div>

      <div id="main-content" class="game-main">
        <div id="left-panel" class="panel left-panel">
          <h2>📋 待处理航班</h2>
          <div id="flight-list" class="flight-list"></div>

          <div id="fluid-inventory" class="fluid-inventory">
            <h3>🧪 除冰液库存</h3>
            <div class="fluid-list"></div>
          </div>
        </div>

        <div id="center-panel" class="panel center-panel">
          <h2>🔧 除冰位</h2>
          <div id="pad-grid" class="pad-grid"></div>

          <h2>🚛 除冰车辆</h2>
          <div id="vehicle-grid" class="vehicle-grid"></div>
        </div>

        <div id="right-panel" class="panel right-panel">
          <h2>📜 事件日志</h2>
          <div id="event-log" class="event-log"></div>
        </div>
      </div>

      <div id="control-panel" class="control-panel">
        <div class="control-left">
          <button id="btn-start" class="btn btn-primary" style="display:none;">开始</button>
          <button id="btn-pause" class="btn btn-warning">暂停</button>
          <button id="btn-resume" class="btn btn-success" style="display:none;">继续</button>
          <button id="btn-restart" class="btn btn-secondary">重新开始</button>
        </div>
        <div class="control-center">
          <span class="speed-label">速度:</span>
          <button id="btn-speed-1x" class="btn btn-speed active">1x</button>
          <button id="btn-speed-2x" class="btn btn-speed">2x</button>
          <button id="btn-speed-4x" class="btn btn-speed">4x</button>
          <button id="btn-speed-8x" class="btn btn-speed">8x</button>
        </div>
        <div class="control-right">
          <button id="btn-save" class="btn btn-secondary">存档</button>
          <button id="btn-export" class="btn btn-secondary">导出报告</button>
          <button id="btn-menu" class="btn btn-text">菜单</button>
        </div>
      </div>

      <div id="modal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h2 id="modal-title"></h2>
            <button id="modal-close" class="modal-close">&times;</button>
          </div>
          <div id="modal-content" class="modal-body"></div>
          <div id="modal-actions" class="modal-footer"></div>
        </div>
      </div>
    `;

    document.getElementById('game-container').innerHTML = content;
    this.ui.init();
    this.setupEventListeners();
    this.updateUI();
  }

  setupEventListeners() {
    document.getElementById('btn-start')?.addEventListener('click', () => this.emit('start'));
    document.getElementById('btn-pause')?.addEventListener('click', () => this.pauseGame());
    document.getElementById('btn-resume')?.addEventListener('click', () => this.resumeGame());
    document.getElementById('btn-restart')?.addEventListener('click', () => this.restartLevel());
    document.getElementById('btn-save')?.addEventListener('click', () => this.saveGame());
    document.getElementById('btn-export')?.addEventListener('click', () => this.exportReport());
    document.getElementById('btn-menu')?.addEventListener('click', () => this.showMainMenu());
    document.getElementById('btn-speed-1x')?.addEventListener('click', () => this.setSpeed(1));
    document.getElementById('btn-speed-2x')?.addEventListener('click', () => this.setSpeed(2));
    document.getElementById('btn-speed-4x')?.addEventListener('click', () => this.setSpeed(4));
    document.getElementById('btn-speed-8x')?.addEventListener('click', () => this.setSpeed(8));
    document.getElementById('modal-close')?.addEventListener('click', () => this.ui.closeModal());
  }

  emit(event) {
    const handler = this[`handle${event.charAt(0).toUpperCase() + event.slice(1)}`];
    if (handler) {
      handler();
    }
  }

  startGameLoop() {
    this.lastTickTime = Date.now();
    this.tickInterval = 1000 / this.timeScale;

    const loop = () => {
      if (this.status !== 'playing') return;

      const now = Date.now();
      const elapsed = now - this.lastTickTime;

      if (elapsed >= this.tickInterval) {
        this.tick();
        this.lastTickTime = now;
      }

      this.gameLoop = requestAnimationFrame(loop);
    };

    this.gameLoop = requestAnimationFrame(loop);
  }

  stopGameLoop() {
    if (this.gameLoop) {
      cancelAnimationFrame(this.gameLoop);
      this.gameLoop = null;
    }
  }

  tick() {
    if (this.status !== 'playing') return;

    const deltaMinutes = 1 * this.timeScale;
    this.gameState.currentTime += deltaMinutes;
    this.gameState.timeRemaining -= deltaMinutes;

    while (this.gameState.currentTime >= 1440) {
      this.gameState.currentTime -= 1440;
      this.gameState.dayOfOperation++;
      this.addEventLog('info', `跨入第${this.gameState.dayOfOperation}天`);
    }

    this.processScheduledEvents();
    this.scheduler.advanceTime(deltaMinutes);
    this.checkAutoTakeoff();
    this.checkGameEnd();
    this.updateUI();
  }

  processScheduledEvents() {
    const events = this.gameState.level.events || [];

    events.forEach(event => {
      if (this.gameState.triggeredEvents.includes(event.type + event.time)) return;

      if (this.gameState.currentTime >= event.time) {
        this.gameState.triggeredEvents.push(event.type + event.time);
        this.triggerEvent(event);
      }
    });
  }

  triggerEvent(event) {
    switch (event.type) {
      case 'vehicle_breakdown':
        this.scheduler.handleVehicleBreakdown(event.vehicleId, event.repairTime);
        break;
      case 'shift_change':
        this.scheduler.handleShiftChange(event.vehicleId, event.shiftChangeTime);
        break;
      case 'return_flight':
        this.scheduler.handleReturnFlight(event.flightId);
        break;
      case 'fluid_shortage':
        this.addEventLog('warning', '除冰液库存不足，等待补给中...');
        setTimeout(() => {
          this.scheduler.addFluidSupply(event.effect.fluidType, event.effect.refillAmount);
          this.addEventLog('info', '除冰液补给完成');
        }, event.refillTime * 60 * 1000 / this.timeScale);
        break;
      case 'weather_change':
        this.addEventLog('warning', event.description);
        break;
      case 'flight_delay':
        const flight = this.gameState.flights.find(f => f.id === event.flightId);
        if (flight) {
          flight.status = 'delayed';
          flight.delayReason = event.reason;
        }
        break;
    }
  }

  checkAutoTakeoff() {
    this.gameState.flights.forEach(flight => {
      if (flight.status === 'cleared' && this.gameState.currentTime >= flight.departureTime) {
        this.scheduler.takeoffFlight(flight.id);
      }
    });
  }

  checkGameEnd() {
    if (this.gameState.timeRemaining <= 0) {
      this.endGame(false, '时间耗尽');
      return;
    }

    const allHandled = this.gameState.flights.every(f =>
      f.status === 'takeoff' || f.status === 'diverted' || f.status === 'cancelled'
    );

    if (allHandled) {
      const successfulCount = this.gameState.flights.filter(f => f.status === 'takeoff').length;
      const requiredCount = this.gameState.level.objectives?.requiredDeicing || this.gameState.flights.length;

      if (successfulCount >= requiredCount) {
        this.endGame(true, '所有航班处理完成');
      } else {
        this.endGame(false, `仅完成${successfulCount}/${requiredCount}架航班`);
      }
    }
  }

  endGame(success, reason) {
    this.status = 'ended';
    this.stopGameLoop();

    const report = this.storage.generateSettlementReport(this.gameState);

    if (success) {
      this.storage.completeLevel(this.gameState.levelId, report.summary.totalScore);
      const nextLevel = window.getNextLevel(this.gameState.levelId);
      if (nextLevel) {
        this.storage.unlockLevel(nextLevel.id);
      }
    }

    const result = {
      success,
      reason,
      score: report.summary.totalScore,
      successfulFlights: report.summary.successfulDeicing,
      totalFlights: report.summary.totalFlights,
      successRate: report.summary.onTimeRate,
      report
    };

    this.ui.showGameOver(result);
    this.addEventLog(success ? 'success' : 'error', `游戏结束: ${reason}`);
  }

  handleFlightAssignment(data) {
    const { flightId, padId } = data;

    if (!this.gameState) return;

    const flight = this.gameState.flights.find(f => f.id === flightId);
    if (!flight) return;

    if (flight.status !== 'scheduled' && flight.status !== 'boarding' && flight.status !== 'delayed') {
      this.ui.showNotification('该航班状态无法进行除冰分配', 'warning');
      return;
    }

    const availableVehicles = this.gameState.vehicles.filter(v =>
      v.status === 'available'
    );

    if (availableVehicles.length === 0) {
      this.ui.showNotification('没有可用的除冰车辆', 'warning');
      return;
    }

    const validation = this.rulesEngine.validateAssignment(flightId, padId, availableVehicles[0].id);

    if (!validation.valid) {
      this.ui.showNotification(validation.errors[0], 'error');
      return;
    }

    if (validation.warnings.length > 0 && !confirm(`警告: ${validation.warnings.join(', ')}\n是否继续?`)) {
      return;
    }

    const result = this.scheduler.assignFlightToPad(flightId, padId, availableVehicles[0].id);

    if (result.success) {
      this.ui.showNotification(`${flightId} 已分配到 ${padId}`, 'success');
    } else {
      this.ui.showNotification(result.error, 'error');
    }
  }

  handleFlightSelection(data) {
    const flight = this.gameState.flights.find(f => f.id === data.flightId);
    if (flight) {
      this.ui.highlightFlight(data.flightId);
    }
  }

  pauseGame() {
    if (this.status !== 'playing') return;
    this.status = 'paused';
    this.stopGameLoop();

    document.getElementById('btn-pause').style.display = 'none';
    document.getElementById('btn-resume').style.display = 'inline-block';

    this.addEventLog('info', '游戏暂停');
  }

  resumeGame() {
    if (this.status !== 'paused') return;
    this.status = 'playing';
    this.startGameLoop();

    document.getElementById('btn-pause').style.display = 'inline-block';
    document.getElementById('btn-resume').style.display = 'none';

    this.addEventLog('info', '游戏继续');
  }

  restartLevel() {
    if (confirm('确定要重新开始吗？')) {
      this.stopGameLoop();
      this.startGame(this.gameState.levelId);
    }
  }

  loadNextLevel() {
    const nextLevel = window.getNextLevel(this.gameState.levelId);
    if (nextLevel) {
      this.startGame(nextLevel.id);
    } else {
      this.showMainMenu();
    }
  }

  saveGame() {
    const result = this.storage.saveGame(this.gameState);
    if (result.success) {
      this.ui.showNotification('游戏已保存', 'success');
    } else {
      this.ui.showNotification('保存失败: ' + result.error, 'error');
    }
  }

  exportReport() {
    const report = this.storage.generateSettlementReport(this.gameState);
    this.storage.exportReportToJson(report);
    this.ui.showNotification('报告已导出', 'success');
  }

  setSpeed(speed) {
    this.timeScale = speed;
    this.tickInterval = 1000 / this.timeScale;

    document.querySelectorAll('.btn-speed').forEach(btn => {
      btn.classList.remove('active');
    });

    document.getElementById(`btn-speed-${speed}x`)?.classList.add('active');
  }

  updateUI() {
    if (!this.gameState) return;

    this.updateTimeDisplay();
    this.updateCountdown();
    this.updateScore();
    this.renderFlightList();
    this.renderPads();
    this.renderVehicles();
    this.renderFluidInventory();
  }

  updateTimeDisplay() {
    const timeDisplay = document.getElementById('time-display');
    const dayDisplay = document.getElementById('day-display');

    if (timeDisplay) {
      timeDisplay.textContent = this.formatTime(this.gameState.currentTime);
    }
    if (dayDisplay) {
      dayDisplay.textContent = `第${this.gameState.dayOfOperation}天`;
    }
  }

  updateCountdown() {
    const countdown = document.getElementById('countdown');
    if (countdown) {
      countdown.textContent = this.formatCountdown(this.gameState.timeRemaining);

      if (this.gameState.timeRemaining < 300) {
        countdown.classList.add('countdown-warning');
      } else {
        countdown.classList.remove('countdown-warning');
      }
    }
  }

  updateScore() {
    const scoreDisplay = document.getElementById('score');
    if (scoreDisplay) {
      const currentScore = this.rulesEngine.calculateScore();
      this.gameState.score = currentScore.total;
      scoreDisplay.textContent = this.gameState.score;
    }
  }

  formatTime(minutes) {
    if (minutes >= 1440) minutes -= 1440;
    if (minutes < 0) minutes += 1440;
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  formatCountdown(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  renderFlightList() {
    const container = document.getElementById('flight-list');
    if (!container) return;

    const flights = this.gameState.flights
      .filter(f => f.status !== 'takeoff' && f.status !== 'diverted')
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.departureTime - b.departureTime;
      });

    container.innerHTML = flights.map(flight => this.createFlightCard(flight)).join('');

    container.querySelectorAll('.flight-card').forEach(card => {
      card.addEventListener('click', () => {
        this.handleFlightSelection({ flightId: card.dataset.flightId });
      });
    });
  }

  createFlightCard(flight) {
    const priorityStars = '★'.repeat(flight.priority) + '☆'.repeat(5 - flight.priority);
    const statusClass = `status-${flight.status}`;
    const specialClass = flight.specialEvent ? `special-${flight.specialEvent}` : '';

    const timeToDeparture = this.rulesEngine.getTimeToDeparture(flight);
    const windowStatus = this.rulesEngine.checkDeicingWindow(flight);

    let windowClass = '';
    if (windowStatus.status === 'in_window') windowClass = 'window-ok';
    else if (windowStatus.status === 'too_early') windowClass = 'window-early';
    else if (windowStatus.status === 'window_closed') windowClass = 'window-closed';

    return `
      <div class="flight-card ${statusClass} ${specialClass} ${windowClass}"
           data-flight-id="${flight.id}"
           draggable="true">
        <div class="flight-header">
          <span class="flight-id">${flight.id}</span>
          <span class="flight-priority" title="优先级">${priorityStars}</span>
        </div>
        <div class="flight-info">
          <div class="flight-airline">${flight.airline}</div>
          <div class="flight-route">
            <span class="aircraft-type">${flight.aircraftType}</span>
            <span class="arrow">→</span>
            <span class="destination">${flight.destination}</span>
          </div>
        </div>
        <div class="flight-footer">
          <span class="departure-time">${this.formatTime(flight.departureTime)}</span>
          <span class="fluid-required">${flight.fluidRequired}L</span>
        </div>
        ${flight.specialEvent ? `<div class="special-badge">${this.getSpecialEventName(flight.specialEvent)}</div>` : ''}
        <div class="flight-status-badge">${this.getStatusName(flight.status)}</div>
      </div>
    `;
  }

  getSpecialEventName(event) {
    const names = {
      'midnight_flight': '🌙 跨午夜',
      'return_flight': '↩️ 返场',
      'vehicle_breakdown': '🔧 故障',
      'shift_change': '🔄 换班'
    };
    return names[event] || event;
  }

  getStatusName(status) {
    const names = {
      'scheduled': '待处理',
      'boarding': '登机中',
      'deicing': '除冰中',
      'deiced': '待起飞',
      'cleared': '放行',
      'takeoff': '已起飞',
      'delayed': '延误',
      'diverted': '返航',
      'cancelled': '取消'
    };
    return names[status] || status;
  }

  renderPads() {
    const container = document.getElementById('pad-grid');
    if (!container) return;

    container.innerHTML = this.gameState.pads.map(pad => {
      const busyFlight = pad.status === 'busy' ?
        this.gameState.flights.find(f => f.id === pad.currentFlight) : null;

      return `
        <div class="pad-card ${pad.status === 'busy' ? 'busy' : ''} ${pad.status === 'offline' ? 'offline' : ''}"
             data-pad-id="${pad.id}">
          <div class="pad-header">
            <span class="pad-id">${pad.id}</span>
            <span class="pad-status">${this.getPadStatusName(pad.status)}</span>
          </div>
          <div class="pad-content">
            ${busyFlight ? `
              <div class="pad-flight">
                <span class="flight-id">${busyFlight.id}</span>
                <span class="flight-type">${busyFlight.aircraftType}</span>
              </div>
              <div class="pad-progress">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${this.calculateProgress(pad, busyFlight)}%"></div>
                </div>
                <span class="progress-text">剩余${this.calculateRemaining(pad, busyFlight)}分钟</span>
              </div>
            ` : `
              <div class="pad-empty">空闲</div>
              <div class="pad-hint">拖拽航班到此处</div>
            `}
          </div>
          <div class="pad-footer">
            <span class="pad-fluid-type">${pad.fluidType || '混合'}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  getPadStatusName(status) {
    const names = { 'available': '空闲', 'busy': '作业中', 'offline': '离线' };
    return names[status] || status;
  }

  calculateProgress(pad, flight) {
    if (!flight.deicingStartTime || !flight.deicingEndTime) return 0;
    const total = flight.deicingEndTime - flight.deicingStartTime;
    const remaining = flight.deicingEndTime - this.gameState.currentTime;
    return Math.max(0, Math.min(100, (total - remaining) / total * 100));
  }

  calculateRemaining(pad, flight) {
    if (!flight.deicingEndTime) return 0;
    return Math.max(0, Math.ceil(flight.deicingEndTime - this.gameState.currentTime));
  }

  renderVehicles() {
    const container = document.getElementById('vehicle-grid');
    if (!container) return;

    container.innerHTML = this.gameState.vehicles.map(vehicle => {
      const statusClass = `vehicle-${vehicle.status}`;
      const fluidPercent = (vehicle.currentFluid / vehicle.capacity) * 100;

      return `
        <div class="vehicle-card ${statusClass}" data-vehicle-id="${vehicle.id}">
          <div class="vehicle-header">
            <span class="vehicle-id">${vehicle.id}</span>
            <span class="vehicle-status">${this.getVehicleStatusName(vehicle.status)}</span>
          </div>
          <div class="vehicle-info">
            <div class="vehicle-operator">${vehicle.operator}</div>
            <div class="vehicle-fluid">
              <div class="fluid-bar">
                <div class="fluid-fill ${fluidPercent < 20 ? 'critical' : ''}" style="width: ${fluidPercent}%"></div>
              </div>
              <span class="fluid-text">${vehicle.currentFluid}L</span>
            </div>
          </div>
          <div class="vehicle-footer">
            <span class="vehicle-type">${vehicle.fluidType}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  getVehicleStatusName(status) {
    const names = {
      'available': '可用',
      'busy': '作业中',
      'maintenance': '维修',
      'off_duty': '换班',
      'dispatching': '调度'
    };
    return names[status] || status;
  }

  renderFluidInventory() {
    const container = document.querySelector('#fluid-inventory .fluid-list');
    if (!container) return;

    container.innerHTML = Object.entries(this.gameState.fluidInventory).map(([type, data]) => {
      const percent = (data.available / data.total) * 100;
      return `
        <div class="fluid-item">
          <span class="fluid-type">${type}</span>
          <div class="fluid-bar-container">
            <div class="fluid-bar">
              <div class="fluid-fill" style="width: ${percent}%"></div>
            </div>
          </div>
          <span class="fluid-amount">${data.available}L</span>
        </div>
      `;
    }).join('');
  }

  addEventLog(type, message) {
    const entry = {
      time: this.gameState.currentTime,
      type,
      message
    };

    this.gameState.eventLog.push(entry);

    const container = document.getElementById('event-log');
    if (!container) return;

    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.innerHTML = `
      <span class="log-time">[${this.formatTime(entry.time)}]</span>
      <span class="log-message">${message}</span>
    `;

    container.insertBefore(logEntry, container.firstChild);

    while (container.children.length > 50) {
      container.removeChild(container.lastChild);
    }
  }
}

window.DeicingGame = DeicingGame;

const game = new DeicingGame();
document.addEventListener('DOMContentLoaded', () => {
  game.init();
});