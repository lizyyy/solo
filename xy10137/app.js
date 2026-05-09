class GameUI {
  constructor() {
    this.game = new ColdChainGame();
    this.selectedVehicleId = null;
    this.selectedCrateId = null;
    this.animationId = null;
    this.replayAnimationId = null;
    this.replayCurrentFrame = 0;
    this.replayFrames = [];
    this.isGameOverShown = false;

    this.initUI();
    this.bindEvents();
    this.initGame();
  }

  initGame() {
    this.game.init();
    this.render();
  }

  initUI() {
    this.gameStateEl = document.getElementById('game-state');
    this.gameTimeEl = document.getElementById('game-time');
    this.gameScoreEl = document.getElementById('game-score');
    this.vehiclesListEl = document.getElementById('vehicles-list');
    this.cratesListEl = document.getElementById('crates-list');
    this.selectedVehicleEl = document.getElementById('selected-vehicle');
    this.selectedCrateEl = document.getElementById('selected-crate');
    this.btnStart = document.getElementById('btn-start');
    this.btnPause = document.getElementById('btn-pause');
    this.btnResume = document.getElementById('btn-resume');
    this.btnRestart = document.getElementById('btn-restart');
    this.btnRules = document.getElementById('btn-rules');
    this.btnScoreDetails = document.getElementById('btn-score-details');
    this.btnReplay = document.getElementById('btn-replay');
    this.btnAssign = document.getElementById('btn-assign');
    this.btnClearSelection = document.getElementById('btn-clear-selection');
    this.rulesModal = document.getElementById('rules-modal');
    this.scoreModal = document.getElementById('score-modal');
    this.replayModal = document.getElementById('replay-modal');
    this.gameResultModal = document.getElementById('game-result-modal');
    this.scoreDetailsListEl = document.getElementById('score-details-list');
    this.replayAreaEl = document.getElementById('replay-area');
    this.replayTimeDisplayEl = document.getElementById('replay-time-display');
    this.btnPlayReplay = document.getElementById('btn-play-replay');
    this.btnStopReplay = document.getElementById('btn-stop-replay');
    this.resultTitleEl = document.getElementById('result-title');
    this.resultContentEl = document.getElementById('result-content');
  }

  bindEvents() {
    this.btnStart.addEventListener('click', () => this.startGame());
    this.btnPause.addEventListener('click', () => this.pauseGame());
    this.btnResume.addEventListener('click', () => this.resumeGame());
    this.btnRestart.addEventListener('click', () => this.restartGame());
    this.btnRules.addEventListener('click', () => this.showModal(this.rulesModal));
    this.btnScoreDetails.addEventListener('click', () => this.showScoreDetails());
    this.btnReplay.addEventListener('click', () => this.showReplay());
    this.btnAssign.addEventListener('click', () => this.assignVehicle());
    this.btnClearSelection.addEventListener('click', () => this.clearSelection());
    this.btnPlayReplay.addEventListener('click', () => this.playReplay());
    this.btnStopReplay.addEventListener('click', () => this.stopReplay());
    document.getElementById('btn-restart-result').addEventListener('click', () => {
      this.hideModal(this.gameResultModal);
      this.restartGame();
    });
    document.getElementById('btn-close-result').addEventListener('click', () => {
      this.hideModal(this.gameResultModal);
    });
    document.getElementById('btn-close-rules').addEventListener('click', () => {
      this.hideModal(this.rulesModal);
    });
    document.getElementById('btn-close-score').addEventListener('click', () => {
      this.hideModal(this.scoreModal);
    });
    document.getElementById('btn-close-replay').addEventListener('click', () => {
      this.stopReplay();
      this.hideModal(this.replayModal);
    });
    this.rulesModal.addEventListener('click', (e) => {
      if (e.target === this.rulesModal) {
        this.hideModal(this.rulesModal);
      }
    });
    this.scoreModal.addEventListener('click', (e) => {
      if (e.target === this.scoreModal) {
        this.hideModal(this.scoreModal);
      }
    });
    this.replayModal.addEventListener('click', (e) => {
      if (e.target === this.replayModal) {
        this.stopReplay();
        this.hideModal(this.replayModal);
      }
    });
  }

  startGame() {
    if (this.game.start()) {
      this.gameLoop();
      this.render();
    }
  }

  pauseGame() {
    if (this.game.pause()) {
      this.stopGameLoop();
      this.render();
    }
  }

  resumeGame() {
    if (this.game.resume()) {
      this.gameLoop();
      this.render();
    }
  }

  restartGame() {
    this.stopGameLoop();
    this.selectedVehicleId = null;
    this.selectedCrateId = null;
    this.isGameOverShown = false;
    this.game.restart();
    this.gameLoop();
    this.render();
  }

  gameLoop() {
    const loop = () => {
      if (this.game.isRunning()) {
        this.game.update(Date.now());
        this.render();

        if (this.game.isGameOver() && !this.isGameOverShown) {
          this.stopGameLoop();
          this.isGameOverShown = true;
          this.showGameResult();
          this.render();
          return;
        }

        this.animationId = requestAnimationFrame(loop);
      }
    };
    this.animationId = requestAnimationFrame(loop);
  }

  stopGameLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  selectVehicle(vehicleId) {
    if (!this.game.isRunning()) return;

    const vehicle = this.game.vehicles.find(v => v.id === vehicleId);
    if (!vehicle || vehicle.assignedCrateId !== null) {
      return;
    }

    this.selectedVehicleId = vehicleId;
    this.render();
  }

  selectCrate(crateId) {
    if (!this.game.isRunning()) return;

    const crate = this.game.crates.find(c => c.id === crateId);
    if (!crate || crate.delivered) {
      return;
    }

    this.selectedCrateId = crateId;
    this.render();
  }

  assignVehicle() {
    if (this.selectedVehicleId === null || this.selectedCrateId === null) {
      return;
    }

    if (this.game.assignVehicleToCrate(this.selectedVehicleId, this.selectedCrateId)) {
      this.selectedVehicleId = null;
      this.selectedCrateId = null;
      this.render();
    }
  }

  clearSelection() {
    this.selectedVehicleId = null;
    this.selectedCrateId = null;
    this.render();
  }

  render() {
    this.renderGameInfo();
    this.renderControlButtons();
    this.renderVehicles();
    this.renderCrates();
    this.renderSelection();
  }

  renderGameInfo() {
    const state = this.game.getState();
    const stateMap = {
      'idle': '待开始',
      'playing': '进行中',
      'paused': '已暂停',
      'won': '胜利',
      'lost': '失败'
    };
    this.gameStateEl.textContent = stateMap[state.state] || state.state;
    this.gameTimeEl.textContent = state.elapsedTime.toFixed(1) + 's';
    this.gameScoreEl.textContent = state.score;
  }

  renderControlButtons() {
    const isIdle = this.game.state === GameState.IDLE;
    const isPlaying = this.game.isRunning();
    const isPaused = this.game.state === GameState.PAUSED;
    const isGameOver = this.game.isGameOver();
    const hasScore = this.game.scoreDetails.length > 0;

    this.btnStart.disabled = !isIdle;
    this.btnPause.disabled = !isPlaying;
    this.btnResume.disabled = !isPaused;
    this.btnRestart.disabled = isIdle;
    this.btnScoreDetails.disabled = !hasScore;
    this.btnReplay.disabled = !this.game.isLost();
  }

  renderVehicles() {
    const vehicles = this.game.vehicles;
    this.vehiclesListEl.innerHTML = '';

    for (const vehicle of vehicles) {
      const card = document.createElement('div');
      card.className = 'vehicle-card';
      
      const isSelected = vehicle.id === this.selectedVehicleId;
      const isDelivering = vehicle.assignedCrateId !== null;

      if (isSelected) card.classList.add('selected');
      if (isDelivering) card.classList.add('delivering');
      if (isDelivering && !isSelected) card.classList.add('disabled');

      const status = isDelivering ? '配送中' : '空闲';
      const statusClass = isDelivering ? 'status-delivering' : 'status-idle';

      const assignedCrate = isDelivering 
        ? this.game.crates.find(c => c.id === vehicle.assignedCrateId) 
        : null;

      card.innerHTML = `
        <div class="vehicle-header">
          <span class="vehicle-name">${vehicle.name}</span>
          <span class="vehicle-status ${statusClass}">${status}</span>
        </div>
        <div class="vehicle-stats">
          <div class="stat-row">
            <span class="stat-label">制冷能力:</span>
            <span class="stat-value">${(vehicle.coolingPower * 100).toFixed(1)}%</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">配送速度:</span>
            <span class="stat-value">${(vehicle.speed * 100).toFixed(0)}%</span>
          </div>
          ${assignedCrate ? `
          <div class="stat-row">
            <span class="stat-label">当前配送:</span>
            <span class="stat-value">${assignedCrate.name}</span>
          </div>
          ` : ''}
        </div>
      `;

      card.addEventListener('click', () => this.selectVehicle(vehicle.id));
      this.vehiclesListEl.appendChild(card);
    }
  }

  renderCrates() {
    const crates = this.game.crates;
    this.cratesListEl.innerHTML = '';

    for (const crate of crates) {
      const card = document.createElement('div');
      card.className = 'crate-card';

      const isSelected = crate.id === this.selectedCrateId;
      const isDelivering = crate.vehicleId !== null;
      const isDelivered = crate.delivered;

      if (isSelected) card.classList.add('selected');
      if (isDelivering) card.classList.add('delivering');
      if (isDelivered) card.classList.add('delivered');

      const tempClass = this._getTemperatureClass(crate.temperature);
      const timeProgress = Math.min(100, (crate.deliveryTime / crate.maxDeliveryTime) * 100);
      const deliveryProgress = Math.min(100, crate.deliveryProgress);

      let status = '等待中';
      let statusClass = 'status-idle';
      if (isDelivered) {
        status = '已送达';
        statusClass = 'status-delivered';
      } else if (isDelivering) {
        status = '配送中';
        statusClass = 'status-delivering';
      }

      card.innerHTML = `
        <div class="crate-header">
          <span class="crate-name">${crate.name}</span>
          <span class="crate-status ${statusClass}">${status}</span>
        </div>
        <div class="crate-stats">
          <div class="stat-row">
            <span class="stat-label">当前温度:</span>
            <span class="stat-value ${tempClass}">${crate.temperature.toFixed(1)}°C</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">已等待/配送:</span>
            <span class="stat-value">${crate.deliveryTime.toFixed(1)}s / ${crate.maxDeliveryTime}s</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">时间进度:</span>
            <span class="stat-value">${timeProgress.toFixed(0)}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${timeProgress}%; background: linear-gradient(90deg, ${timeProgress < 50 ? '#4CAF50' : timeProgress < 80 ? '#FF9800' : '#F44336'}, ${timeProgress < 50 ? '#8BC34A' : timeProgress < 80 ? '#FFB74D' : '#EF5350'})"></div>
          </div>
          ${isDelivering || isDelivered ? `
          <div class="stat-row">
            <span class="stat-label">配送进度:</span>
            <span class="stat-value">${deliveryProgress.toFixed(0)}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${deliveryProgress}%"></div>
          </div>
          ` : ''}
        </div>
        <div class="crate-destination">
          <span class="label">目的地:</span>
          <span>${crate.destination}</span>
        </div>
      `;

      if (!isDelivered) {
        card.addEventListener('click', () => this.selectCrate(crate.id));
      }

      this.cratesListEl.appendChild(card);
    }
  }

  renderSelection() {
    if (this.selectedVehicleId !== null) {
      const vehicle = this.game.vehicles.find(v => v.id === this.selectedVehicleId);
      this.selectedVehicleEl.textContent = vehicle ? vehicle.name : '无';
    } else {
      this.selectedVehicleEl.textContent = '无';
    }

    if (this.selectedCrateId !== null) {
      const crate = this.game.crates.find(c => c.id === this.selectedCrateId);
      this.selectedCrateEl.textContent = crate ? crate.name : '无';
    } else {
      this.selectedCrateEl.textContent = '无';
    }

    const canAssign = this.selectedVehicleId !== null && this.selectedCrateId !== null && this.game.isRunning();
    this.btnAssign.disabled = !canAssign;

    const canClear = this.selectedVehicleId !== null || this.selectedCrateId !== null;
    this.btnClearSelection.disabled = !canClear;
  }

  _getTemperatureClass(temperature) {
    if (temperature < 4) return 'cold';
    if (temperature < 7) return 'cool';
    if (temperature < 10) return 'moderate';
    return 'hot';
  }

  showModal(modal) {
    modal.classList.add('show');
  }

  hideModal(modal) {
    modal.classList.remove('show');
  }

  showScoreDetails() {
    const details = this.game.scoreDetails;
    this.scoreDetailsListEl.innerHTML = '';

    if (details.length === 0) {
      this.scoreDetailsListEl.innerHTML = '<p>暂无计分明细</p>';
    } else {
      for (const detail of details) {
        const item = document.createElement('div');
        item.className = 'score-item';
        item.innerHTML = `
          <div class="score-item-header">
            <span class="score-item-crate">${detail.crate}</span>
            <span class="score-item-total">+${detail.score}</span>
          </div>
          <ul class="score-item-details">
            ${detail.details.map(d => `<li>${d}</li>`).join('')}
          </ul>
          <div style="margin-top: 8px; font-size: 0.8rem; color: #999;">
            时间: ${detail.timestamp.toFixed(1)}s
          </div>
        `;
        this.scoreDetailsListEl.appendChild(item);
      }
    }

    this.showModal(this.scoreModal);
  }

  showReplay() {
    if (!this.game.isLost()) {
      return;
    }

    this.replayFrames = this.game.getReplayData();
    this.replayCurrentFrame = 0;
    this.replayAreaEl.innerHTML = '<p>点击"播放"按钮开始回放</p>';
    this.replayTimeDisplayEl.textContent = '0.0s';
    this.btnPlayReplay.disabled = false;
    this.btnStopReplay.disabled = true;

    this.showModal(this.replayModal);
  }

  playReplay() {
    if (this.replayFrames.length === 0) {
      return;
    }

    this.btnPlayReplay.disabled = true;
    this.btnStopReplay.disabled = false;

    const replayLoop = () => {
      if (this.replayCurrentFrame < this.replayFrames.length) {
        const frame = this.replayFrames[this.replayCurrentFrame];
        this.renderReplayFrame(frame);
        this.replayCurrentFrame++;
        this.replayAnimationId = setTimeout(() => {
          replayLoop();
        }, 50);
      } else {
        this.stopReplay();
      }
    };

    replayLoop();
  }

  stopReplay() {
    if (this.replayAnimationId) {
      clearTimeout(this.replayAnimationId);
      this.replayAnimationId = null;
    }
    this.btnPlayReplay.disabled = false;
    this.btnStopReplay.disabled = true;
  }

  renderReplayFrame(frame) {
    this.replayTimeDisplayEl.textContent = frame.elapsedTime.toFixed(1) + 's';
    
    let html = `
      <div class="result-summary" style="padding: 10px; margin-bottom: 15px;">
        <div class="result-stats">
          <div class="result-stat">
            <div class="label">时间</div>
            <div class="value">${frame.elapsedTime.toFixed(1)}s</div>
          </div>
          <div class="result-stat">
            <div class="label">得分</div>
            <div class="value">${frame.score}</div>
          </div>
          <div class="result-stat">
            <div class="label">状态</div>
            <div class="value">${this._getStateText(frame.state)}</div>
          </div>
        </div>
      </div>
      <div class="replay-crates">
    `;

    for (const crate of frame.crates) {
      const tempClass = this._getTemperatureClass(crate.temperature);
      const timeProgress = Math.min(100, (crate.deliveryTime / crate.maxDeliveryTime) * 100);
      const deliveryProgress = Math.min(100, crate.deliveryProgress);

      html += `
        <div class="crate-card ${crate.delivered ? 'delivered' : crate.vehicleId !== null ? 'delivering' : ''}">
          <div class="crate-header">
            <span class="crate-name">${crate.name}</span>
            <span class="crate-status ${crate.delivered ? 'status-delivered' : crate.vehicleId !== null ? 'status-delivering' : 'status-idle'}">
              ${crate.delivered ? '已送达' : crate.vehicleId !== null ? '配送中' : '等待中'}
            </span>
          </div>
          <div class="crate-stats">
            <div class="stat-row">
              <span class="stat-label">温度:</span>
              <span class="stat-value ${tempClass}">${crate.temperature.toFixed(1)}°C</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">时间:</span>
              <span class="stat-value">${crate.deliveryTime.toFixed(1)}s / ${crate.maxDeliveryTime}s</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${timeProgress}%; background: linear-gradient(90deg, ${timeProgress < 50 ? '#4CAF50' : timeProgress < 80 ? '#FF9800' : '#F44336'}, ${timeProgress < 50 ? '#8BC34A' : timeProgress < 80 ? '#FFB74D' : '#EF5350'})"></div>
            </div>
            ${crate.vehicleId !== null || crate.delivered ? `
            <div class="stat-row">
              <span class="stat-label">配送:</span>
              <span class="stat-value">${deliveryProgress.toFixed(0)}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${deliveryProgress}%"></div>
            </div>
            ` : ''}
          </div>
          <div class="crate-destination">
            <span class="label">目的地:</span>
            <span>${crate.destination}</span>
          </div>
        </div>
      `;
    }

    html += '</div>';
    this.replayAreaEl.innerHTML = html;
  }

  _getStateText(state) {
    const map = {
      'idle': '待开始',
      'playing': '进行中',
      'paused': '已暂停',
      'won': '胜利',
      'lost': '失败'
    };
    return map[state] || state;
  }

  showGameResult() {
    const state = this.game.getState();
    const isWon = this.game.isWon();
    const isLost = this.game.isLost();

    if (isWon) {
      this.resultTitleEl.textContent = '🎉 游戏胜利！';
      this.resultTitleEl.style.color = '#4CAF50';
    } else if (isLost) {
      this.resultTitleEl.textContent = '😔 游戏失败';
      this.resultTitleEl.style.color = '#F44336';
    }

    const deliveredCount = state.crates.filter(c => c.delivered).length;
    const totalCrates = state.crates.length;

    let content = `
      <div class="result-summary">
        <div class="score">${state.score}</div>
        <div class="message">
          ${isWon 
            ? '恭喜你成功配送了所有冷链箱！' 
            : '很遗憾，有冷链箱的温度和时间同时超标了。'}
        </div>
      </div>
      <div class="result-stats">
        <div class="result-stat">
          <div class="label">游戏时间</div>
          <div class="value">${state.elapsedTime.toFixed(1)}s</div>
        </div>
        <div class="result-stat">
          <div class="label">完成配送</div>
          <div class="value">${deliveredCount}/${totalCrates}</div>
        </div>
        <div class="result-stat">
          <div class="label">总得分</div>
          <div class="value">${state.score}</div>
        </div>
      </div>
    `;

    if (state.scoreDetails.length > 0) {
      content += '<h3 style="margin-top: 20px;">计分明细</h3>';
      for (const detail of state.scoreDetails) {
        content += `
          <div class="score-item">
            <div class="score-item-header">
              <span class="score-item-crate">${detail.crate}</span>
              <span class="score-item-total">+${detail.score}</span>
            </div>
            <ul class="score-item-details">
              ${detail.details.map(d => `<li>${d}</li>`).join('')}
            </ul>
          </div>
        `;
      }
    }

    if (state.eventLog.length > 0) {
      content += '<h3 style="margin-top: 20px;">事件日志</h3><ul style="margin-left: 20px; line-height: 1.8;">';
      for (const event of state.eventLog) {
        content += `<li>${event.timestamp.toFixed(1)}s - ${event.message}</li>`;
      }
      content += '</ul>';
    }

    this.resultContentEl.innerHTML = content;
    this.showModal(this.gameResultModal);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new GameUI();
});
