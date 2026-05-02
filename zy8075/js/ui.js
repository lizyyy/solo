class UIManager {
  constructor() {
    this.elements = {};
    this.draggedItem = null;
    this.dropTarget = null;
    this.callbacks = {};
  }

  init() {
    this.cacheElements();
    this.setupEventListeners();
    this.setupDragAndDrop();
  }

  cacheElements() {
    this.elements = {
      gameContainer: document.getElementById('game-container'),
      header: document.getElementById('header'),
      timeDisplay: document.getElementById('time-display'),
      dayDisplay: document.getElementById('day-display'),
      countdownDisplay: document.getElementById('countdown'),
      scoreDisplay: document.getElementById('score'),
      flightList: document.getElementById('flight-list'),
      padGrid: document.getElementById('pad-grid'),
      vehicleGrid: document.getElementById('vehicle-grid'),
      fluidInventory: document.getElementById('fluid-inventory'),
      eventLog: document.getElementById('event-log'),
      controlPanel: document.getElementById('control-panel'),
      modal: document.getElementById('modal'),
      modalTitle: document.getElementById('modal-title'),
      modalContent: document.getElementById('modal-content'),
      modalActions: document.getElementById('modal-actions')
    };
  }

  setupEventListeners() {
    document.getElementById('btn-start')?.addEventListener('click', () => this.emit('start'));
    document.getElementById('btn-pause')?.addEventListener('click', () => this.emit('pause'));
    document.getElementById('btn-resume')?.addEventListener('click', () => this.emit('resume'));
    document.getElementById('btn-restart')?.addEventListener('click', () => this.emit('restart'));
    document.getElementById('btn-save')?.addEventListener('click', () => this.emit('save'));
    document.getElementById('btn-export')?.addEventListener('click', () => this.emit('export'));
    document.getElementById('btn-next-level')?.addEventListener('click', () => this.emit('nextLevel'));
    document.getElementById('btn-menu')?.addEventListener('click', () => this.emit('menu'));
    document.getElementById('btn-speed-1x')?.addEventListener('click', () => this.setSpeed(1));
    document.getElementById('btn-speed-2x')?.addEventListener('click', () => this.setSpeed(2));
    document.getElementById('btn-speed-4x')?.addEventListener('click', () => this.setSpeed(4));
    document.getElementById('btn-speed-8x')?.addEventListener('click', () => this.setSpeed(8));
    document.getElementById('modal-close')?.addEventListener('click', () => this.closeModal());
  }

  setupDragAndDrop() {
    document.addEventListener('dragstart', (e) => this.handleDragStart(e));
    document.addEventListener('dragend', (e) => this.handleDragEnd(e));
    document.addEventListener('dragover', (e) => this.handleDragOver(e));
    document.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    document.addEventListener('drop', (e) => this.handleDrop(e));
  }

  handleDragStart(e) {
    const flightCard = e.target.closest('.flight-card');
    if (!flightCard) return;

    this.draggedItem = {
      type: 'flight',
      id: flightCard.dataset.flightId
    };

    flightCard.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }

  handleDragEnd(e) {
    const flightCard = e.target.closest('.flight-card');
    if (flightCard) {
      flightCard.classList.remove('dragging');
    }
    this.draggedItem = null;
    document.querySelectorAll('.drop-target').forEach(el => {
      el.classList.remove('drop-target');
    });
  }

  handleDragOver(e) {
    if (!this.draggedItem) return;

    const padCard = e.target.closest('.pad-card');
    if (padCard && padCard.dataset.padId) {
      e.preventDefault();
      padCard.classList.add('drop-target');
    }
  }

  handleDragLeave(e) {
    const padCard = e.target.closest('.pad-card');
    if (padCard) {
      padCard.classList.remove('drop-target');
    }
  }

  handleDrop(e) {
    e.preventDefault();

    const padCard = e.target.closest('.pad-card');
    if (!padCard || !this.draggedItem) return;

    padCard.classList.remove('drop-target');

    if (this.draggedItem.type === 'flight') {
      this.emit('assignFlight', {
        flightId: this.draggedItem.id,
        padId: padCard.dataset.padId
      });
    }
  }

  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data));
    }
  }

  updateTime(currentTime, day) {
    const hours = Math.floor(currentTime / 60);
    const minutes = currentTime % 60;
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    if (this.elements.timeDisplay) {
      this.elements.timeDisplay.textContent = timeStr;
    }
    if (this.elements.dayDisplay) {
      this.elements.dayDisplay.textContent = `第${day}天`;
    }
  }

  updateCountdown(remaining) {
    if (this.elements.countdownDisplay) {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      this.elements.countdownDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

      if (remaining < 300) {
        this.elements.countdownDisplay.classList.add('countdown-warning');
      } else {
        this.elements.countdownDisplay.classList.remove('countdown-warning');
      }
    }
  }

  updateScore(score) {
    if (this.elements.scoreDisplay) {
      this.elements.scoreDisplay.textContent = score;
    }
  }

  renderFlightList(flights) {
    if (!this.elements.flightList) return;

    this.elements.flightList.innerHTML = flights.map(flight => this.createFlightCard(flight)).join('');

    this.elements.flightList.querySelectorAll('.flight-card').forEach(card => {
      card.addEventListener('click', () => {
        this.emit('selectFlight', { flightId: card.dataset.flightId });
      });
    });
  }

  createFlightCard(flight) {
    const priorityStars = '★'.repeat(flight.priority) + '☆'.repeat(5 - flight.priority);
    const statusClass = `status-${flight.status}`;
    const specialClass = flight.specialEvent ? `special-${flight.specialEvent}` : '';

    const timeStr = this.formatTime(flight.departureTime);

    return `
      <div class="flight-card ${statusClass} ${specialClass}"
           data-flight-id="${flight.id}"
           draggable="${flight.status === 'scheduled' || flight.status === 'boarding' || flight.status === 'delayed'}">
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
          <span class="departure-time">${timeStr}</span>
          <span class="fluid-required">${flight.fluidRequired}L ${flight.fluidType}</span>
        </div>
        ${flight.specialEvent ? `<div class="special-badge">${this.getSpecialEventName(flight.specialEvent)}</div>` : ''}
      </div>
    `;
  }

  formatTime(minutes) {
    if (minutes >= 1440) {
      minutes -= 1440;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  getSpecialEventName(event) {
    const names = {
      'midnight_flight': '跨午夜',
      'return_flight': '返场',
      'vehicle_breakdown': '车辆故障',
      'shift_change': '换班'
    };
    return names[event] || event;
  }

  renderPads(pads, activeAssignments) {
    if (!this.elements.padGrid) return;

    this.elements.padGrid.innerHTML = pads.map(pad => {
      const assignment = activeAssignments.find(a => a.padId === pad.id && pad.status === 'busy');
      const flight = assignment ? this.findFlight(assignment.flightId) : null;

      return `
        <div class="pad-card ${pad.status === 'busy' ? 'busy' : ''} ${pad.status === 'offline' ? 'offline' : ''}"
             data-pad-id="${pad.id}">
          <div class="pad-header">
            <span class="pad-id">${pad.id}</span>
            <span class="pad-status">${this.getPadStatusName(pad.status)}</span>
          </div>
          <div class="pad-content">
            ${flight ? `
              <div class="pad-flight">
                <span class="flight-id">${flight.id}</span>
                <span class="flight-type">${flight.aircraftType}</span>
              </div>
              <div class="pad-progress">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${this.calculateProgress(flight)}%"></div>
                </div>
                <span class="progress-text">${this.calculateRemaining(flight)}分钟</span>
              </div>
            ` : `
              <div class="pad-empty">空闲</div>
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
    const names = {
      'available': '空闲',
      'busy': '作业中',
      'offline': '离线'
    };
    return names[status] || status;
  }

  calculateProgress(flight) {
    if (!flight.deicingStartTime || !flight.deicingEndTime) return 0;
    const total = flight.deicingEndTime - flight.deicingStartTime;
    const elapsed = flight.deicingEndTime - this.getCurrentTime();
    return Math.max(0, Math.min(100, (total - elapsed) / total * 100));
  }

  calculateRemaining(flight) {
    if (!flight.deicingEndTime) return 0;
    return Math.max(0, flight.deicingEndTime - this.getCurrentTime());
  }

  getCurrentTime() {
    return parseInt(this.elements.timeDisplay?.textContent?.replace(':', '') || '0') * 60 % 1440;
  }

  findFlight(flightId) {
    return window.gameState?.flights.find(f => f.id === flightId);
  }

  renderVehicles(vehicles) {
    if (!this.elements.vehicleGrid) return;

    this.elements.vehicleGrid.innerHTML = vehicles.map(vehicle => {
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
                <div class="fluid-fill" style="width: ${fluidPercent}%"></div>
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
      'off_duty': '换班中',
      'dispatching': '调度中'
    };
    return names[status] || status;
  }

  renderFluidInventory(inventory) {
    if (!this.elements.fluidInventory) return;

    this.elements.fluidInventory.innerHTML = Object.entries(inventory).map(([type, data]) => `
      <div class="fluid-item">
        <span class="fluid-type">${type}</span>
        <div class="fluid-bar-container">
          <div class="fluid-bar">
            <div class="fluid-fill" style="width: ${(data.available / data.total) * 100}%"></div>
          </div>
        </div>
        <span class="fluid-amount">${data.available}L</span>
      </div>
    `).join('');
  }

  addEventLog(entry) {
    if (!this.elements.eventLog) return;

    const timeStr = this.formatTime(entry.time);
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${entry.type || 'info'}`;
    logEntry.innerHTML = `
      <span class="log-time">[${timeStr}]</span>
      <span class="log-message">${entry.message}</span>
    `;

    this.elements.eventLog.insertBefore(logEntry, this.elements.eventLog.firstChild);

    while (this.elements.eventLog.children.length > 50) {
      this.elements.eventLog.removeChild(this.elements.eventLog.lastChild);
    }
  }

  clearEventLog() {
    if (this.elements.eventLog) {
      this.elements.eventLog.innerHTML = '';
    }
  }

  setSpeed(speed) {
    document.querySelectorAll('[id^="btn-speed"]').forEach(btn => {
      btn.classList.remove('active');
    });

    const speedBtn = document.getElementById(`btn-speed-${speed}x`);
    if (speedBtn) {
      speedBtn.classList.add('active');
    }

    this.emit('speedChange', { speed });
  }

  showModal(title, content, actions = []) {
    if (!this.elements.modal) return;

    this.elements.modalTitle.textContent = title;
    this.elements.modalContent.innerHTML = content;

    this.elements.modalActions.innerHTML = actions.map(action =>
      `<button class="btn ${action.class || ''}" data-action="${action.id}">${action.label}</button>`
    ).join('');

    actions.forEach(action => {
      const btn = this.elements.modalActions.querySelector(`[data-action="${action.id}"]`);
      if (btn) {
        btn.addEventListener('click', () => {
          this.emit(action.id, action.data);
          this.closeModal();
        });
      }
    });

    this.elements.modal.classList.add('show');
  }

  closeModal() {
    if (this.elements.modal) {
      this.elements.modal.classList.remove('show');
    }
  }

  showLevelSelect(levels, currentLevel) {
    const content = `
      <div class="level-select">
        ${levels.map(level => `
          <div class="level-item ${level.id === currentLevel ? 'current' : ''} ${level.unlocked ? '' : 'locked'}">
            <h3>${level.name}</h3>
            <p>${level.description}</p>
            <div class="level-info">
              <span>难度: ${'★'.repeat(level.difficulty)}</span>
              <span>时间: ${level.timeLimit}分钟</span>
            </div>
            ${level.unlocked ? '' : '<span class="locked-badge">未解锁</span>'}
          </div>
        `).join('')}
      </div>
    `;

    this.showModal('选择关卡', content, [
      { id: 'cancel', label: '取消', class: 'btn-secondary' }
    ]);
  }

  showGameOver(result) {
    const content = `
      <div class="game-over">
        <h2>${result.success ? '关卡完成!' : '任务失败'}</h2>
        <div class="result-stats">
          <div class="stat">
            <span class="stat-label">得分</span>
            <span class="stat-value">${result.score}</span>
          </div>
          <div class="stat">
            <span class="stat-label">成功航班</span>
            <span class="stat-value">${result.successfulFlights}/${result.totalFlights}</span>
          </div>
          <div class="stat">
            <span class="stat-label">成功率</span>
            <span class="stat-value">${result.successRate}</span>
          </div>
        </div>
        ${result.reason ? `<p class="result-reason">${result.reason}</p>` : ''}
      </div>
    `;

    const actions = [
      { id: 'restart', label: '重新开始', class: 'btn-primary' },
      { id: 'nextLevel', label: '下一关', class: 'btn-success' },
      { id: 'menu', label: '返回菜单', class: 'btn-secondary' }
    ];

    if (!result.success) {
      actions.splice(1, 1);
    }

    this.showModal('结算', content, actions);
  }

  showSettlementReport(report) {
    const content = `
      <div class="settlement-report">
        <h2>除冰作业结算报告</h2>
        <div class="report-header">
          <p><strong>报告编号:</strong> ${report.reportId}</p>
          <p><strong>关卡:</strong> ${report.levelId}</p>
          <p><strong>日期:</strong> ${report.gameDate}</p>
        </div>

        <div class="report-section">
          <h3>作业摘要</h3>
          <div class="summary-grid">
            <div class="summary-item">
              <span class="label">总航班数</span>
              <span class="value">${report.summary.totalFlights}</span>
            </div>
            <div class="summary-item">
              <span class="label">成功除冰</span>
              <span class="value">${report.summary.successfulDeicing}</span>
            </div>
            <div class="summary-item">
              <span class="label">延误航班</span>
              <span class="value">${report.summary.delayedFlights}</span>
            </div>
            <div class="summary-item">
              <span class="label">返航航班</span>
              <span class="value">${report.summary.divertedFlights}</span>
            </div>
            <div class="summary-item">
              <span class="label">准点率</span>
              <span class="value">${report.summary.onTimeRate}</span>
            </div>
            <div class="summary-item">
              <span class="label">总分</span>
              <span class="value">${report.summary.totalScore}</span>
            </div>
          </div>
        </div>

        <div class="report-section">
          <h3>除冰液使用</h3>
          <div class="fluid-usage">
            ${Object.entries(report.fluidUsage).map(([type, data]) => `
              <div class="fluid-usage-item">
                <span class="fluid-type">${type}</span>
                <div class="usage-bar">
                  <div class="usage-fill" style="width: ${data.percentage}"></div>
                </div>
                <span class="usage-value">${data.used}L (${data.percentage})</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="report-section">
          <h3>车辆利用率</h3>
          <div class="vehicle-utilization">
            ${Object.entries(report.vehicleUtilization).map(([id, data]) => `
              <div class="util-item">
                <span class="vehicle-id">${id}</span>
                <span>活跃: ${data.activeTime}分钟</span>
                <span>空闲: ${data.idleTime}分钟</span>
              </div>
            `).join('')}
          </div>
        </div>

        ${report.issues && report.issues.length > 0 ? `
          <div class="report-section">
            <h3>问题记录</h3>
            <div class="issues-list">
              ${report.issues.map(issue => `
                <div class="issue-item">
                  <strong>${issue.flight}:</strong> ${issue.issue}
                  <br><small>处理: ${issue.resolution}</small>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    this.showModal('结算报告', content, [
      { id: 'export', label: '导出JSON', class: 'btn-primary' },
      { id: 'close', label: '关闭', class: 'btn-secondary' }
    ]);
  }

  highlightFlight(flightId) {
    document.querySelectorAll('.flight-card').forEach(card => {
      card.classList.remove('highlight');
      if (card.dataset.flightId === flightId) {
        card.classList.add('highlight');
      }
    });
  }

  highlightPad(padId) {
    document.querySelectorAll('.pad-card').forEach(card => {
      card.classList.remove('highlight');
      if (card.dataset.padId === padId) {
        card.classList.add('highlight');
      }
    });
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  setControlState(state) {
    const startBtn = document.getElementById('btn-start');
    const pauseBtn = document.getElementById('btn-pause');
    const resumeBtn = document.getElementById('btn-resume');

    if (startBtn) startBtn.style.display = state === 'menu' ? 'inline-block' : 'none';
    if (pauseBtn) pauseBtn.style.display = state === 'playing' ? 'inline-block' : 'none';
    if (resumeBtn) resumeBtn.style.display = state === 'paused' ? 'inline-block' : 'none';
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UIManager };
}