class GameUI {
  constructor() {
    this.gameEngine = new GameEngine();
    this.gameLoopId = null;
    this.selectedEmergencyId = null;
    this.selectedVehicleId = null;
    this.personnelCount = 1;
    this.lastGameState = null;
    this.initCanvas();
    this.bindEvents();
    this.render();
  }

  initCanvas() {
    this.canvas = document.getElementById('gameMap');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
    this.scaleX = this.canvas.width / GameConfig.MAP_WIDTH;
    this.scaleY = this.canvas.height / GameConfig.MAP_HEIGHT;
    if (this.gameEngine.state !== 'idle') {
      this.render();
    }
  }

  bindEvents() {
    const startBtn = document.getElementById('startBtn');
    const startBtn2 = document.getElementById('startBtn2');
    const pauseBtn = document.getElementById('pauseBtn');
    const restartBtn = document.getElementById('restartBtn');
    const replayBtn = document.getElementById('replayBtn');
    const closeDispatchBtn = document.getElementById('closeDispatchBtn');
    const confirmDispatchBtn = document.getElementById('confirmDispatchBtn');
    const useHydrantCheckbox = document.getElementById('useHydrant');

    startBtn.addEventListener('click', () => this.startGame());
    startBtn2.addEventListener('click', () => this.startGame());
    pauseBtn.addEventListener('click', () => this.togglePause());
    restartBtn.addEventListener('click', () => this.restartGame());
    replayBtn.addEventListener('click', () => this.showReplay());
    closeDispatchBtn.addEventListener('click', () => this.closeDispatchPanel());
    confirmDispatchBtn.addEventListener('click', () => this.confirmDispatch());
    useHydrantCheckbox.addEventListener('change', () => this.updateDispatchButton());

    this.canvas.addEventListener('click', (e) => this.handleMapClick(e));
  }

  startGame() {
    this.gameEngine.start();
    this.lastGameState = this.gameEngine.getGameState();
    this.startGameLoop();
    this.hideOverlay();
    this.updateControlButtons();
  }

  togglePause() {
    if (this.gameEngine.state === 'playing') {
      this.gameEngine.pause();
    } else if (this.gameEngine.state === 'paused') {
      this.gameEngine.resume();
    }
    this.updateControlButtons();
  }

  restartGame() {
    this.closeDispatchPanel();
    this.gameEngine.restart();
    this.lastGameState = this.gameEngine.getGameState();
    this.startGameLoop();
    this.hideOverlay();
    this.updateControlButtons();
  }

  showReplay() {
    if (!this.lastGameState) return;
    
    const overlay = document.getElementById('overlay');
    const overlayTitle = document.getElementById('overlayTitle');
    const overlayMessage = document.getElementById('overlayMessage');
    const gameRules = document.getElementById('gameRules');
    const scoreBreakdown = document.getElementById('scoreBreakdown');
    const actionButtons = document.getElementById('actionButtons');

    overlayTitle.textContent = '失败回放';
    overlayMessage.textContent = '以下是本局游戏的详细记录:';
    gameRules.style.display = 'none';
    scoreBreakdown.style.display = 'block';

    this.renderScoreBreakdown(this.lastGameState, scoreBreakdown);

    actionButtons.innerHTML = `
      <button class="btn btn-primary" id="restartFromReplay">重新开始</button>
      <button class="btn" id="closeReplay">关闭</button>
    `;

    document.getElementById('restartFromReplay').addEventListener('click', () => {
      this.restartGame();
    });

    document.getElementById('closeReplay').addEventListener('click', () => {
      this.hideOverlay();
    });

    overlay.style.display = 'flex';
  }

  startGameLoop() {
    if (this.gameLoopId) {
      cancelAnimationFrame(this.gameLoopId);
    }

    const loop = () => {
      this.gameEngine.update();
      this.render();
      this.checkGameEnd();
      
      if (this.gameEngine.state !== 'finished') {
        this.gameLoopId = requestAnimationFrame(loop);
      }
    };

    this.gameLoopId = requestAnimationFrame(loop);
  }

  checkGameEnd() {
    const state = this.gameEngine.getGameState();
    if (state.state === 'finished' && !state.shown) {
      state.shown = true;
      this.lastGameState = state;
      this.showGameOver(state);
      this.updateControlButtons();
    }
  }

  showGameOver(state) {
    const overlay = document.getElementById('overlay');
    const overlayTitle = document.getElementById('overlayTitle');
    const overlayMessage = document.getElementById('overlayMessage');
    const gameRules = document.getElementById('gameRules');
    const scoreBreakdown = document.getElementById('scoreBreakdown');
    const actionButtons = document.getElementById('actionButtons');

    overlayTitle.textContent = '游戏结束';
    
    if (state.finishReason === 'time_up') {
      overlayMessage.textContent = `时间耗尽！最终得分: ${state.score}`;
    } else {
      overlayMessage.textContent = `失败次数过多！最终得分: ${state.score}`;
    }

    gameRules.style.display = 'none';
    scoreBreakdown.style.display = 'block';
    this.renderScoreBreakdown(state, scoreBreakdown);

    actionButtons.innerHTML = `
      <button class="btn btn-primary" id="playAgain">再玩一次</button>
      <button class="btn" id="viewReplay">查看回放</button>
    `;

    document.getElementById('playAgain').addEventListener('click', () => {
      this.restartGame();
    });

    document.getElementById('viewReplay').addEventListener('click', () => {
      this.showReplay();
    });

    overlay.style.display = 'flex';
  }

  renderScoreBreakdown(state, container) {
    let html = '<h3>计分明细</h3>';
    
    if (state.scoreBreakdown.length === 0) {
      html += '<p style="color: #aaa;">暂无记录</p>';
    } else {
      state.scoreBreakdown.forEach((item, index) => {
        const className = item.points >= 0 ? 'positive' : 'negative';
        const sign = item.points >= 0 ? '+' : '';
        html += `
          <div class="score-item ${className}">
            <span>${index + 1}. ${item.reason}</span>
            <span>${sign}${item.points}</span>
          </div>
        `;
      });
    }

    html += `
      <div style="margin-top: 15px; padding-top: 10px; border-top: 2px solid #4fc3f7;">
        <div class="score-item" style="font-weight: bold;">
          <span>总得分</span>
          <span style="color: #4fc3f7;">${state.score}</span>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  hideOverlay() {
    document.getElementById('overlay').style.display = 'none';
  }

  updateControlButtons() {
    const state = this.gameEngine.state;
    const pauseBtn = document.getElementById('pauseBtn');
    const restartBtn = document.getElementById('restartBtn');
    const replayBtn = document.getElementById('replayBtn');
    const startBtn2 = document.getElementById('startBtn2');
    const gameStateEl = document.getElementById('gameState');

    const stateLabels = {
      idle: '准备开始',
      playing: '游戏中',
      paused: '已暂停',
      finished: '游戏结束'
    };

    gameStateEl.textContent = stateLabels[state] || state;

    startBtn2.disabled = state === 'playing';
    pauseBtn.disabled = state === 'idle' || state === 'finished';
    pauseBtn.textContent = state === 'paused' ? '继续' : '暂停';
    restartBtn.disabled = state === 'idle';
    replayBtn.disabled = state !== 'finished' || !this.lastGameState;
  }

  handleMapClick(e) {
    if (this.gameEngine.state !== 'playing') return;

    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.scaleX;
    const y = (e.clientY - rect.top) / this.scaleY;

    const state = this.gameEngine.getGameState();
    let clickedEmergency = null;

    for (const emergency of state.emergencies) {
      const dist = Math.sqrt(
        Math.pow(x - emergency.x, 2) + Math.pow(y - emergency.y, 2)
      );
      if (dist < 25) {
        clickedEmergency = emergency;
        break;
      }
    }

    if (clickedEmergency) {
      this.openDispatchPanel(clickedEmergency);
    }
  }

  openDispatchPanel(emergency) {
    this.selectedEmergencyId = emergency.id;
    this.selectedVehicleId = null;
    this.personnelCount = 1;

    const panel = document.getElementById('dispatchPanel');
    const title = document.getElementById('dispatchEmergencyTitle');
    const details = document.getElementById('emergencyDetails');
    const vehicleList = document.getElementById('dispatchVehicleList');

    const typeConfig = GameConfig.EMERGENCY_TYPES[emergency.type];
    const state = this.gameEngine.getGameState();

    title.textContent = `调度车辆 - ${typeConfig.name}`;

    const timePercent = (emergency.timeRemaining / emergency.maxTime) * 100;

    details.innerHTML = `
      <div class="detail-row">
        <span>需要人员:</span>
        <span>${emergency.personnelArrived}/${emergency.targetPersonnel}</span>
      </div>
      <div class="detail-row">
        <span>需要水量:</span>
        <span>${emergency.waterProvided}/${emergency.targetWater} L</span>
      </div>
      <div class="detail-row">
        <span>剩余时间:</span>
        <span style="color: ${timePercent < 30 ? '#f44336' : '#4caf50'}">
          ${Math.ceil(emergency.timeRemaining)}秒
        </span>
      </div>
      <div class="detail-row">
        <span>已调度车辆:</span>
        <span>${emergency.dispatchedVehicles.length}</span>
      </div>
    `;

    const availableVehicles = state.vehicles.filter(v => v.status === 'available');
    
    if (availableVehicles.length === 0) {
      vehicleList.innerHTML = '<p style="color: #f44336;">没有可用车辆</p>';
    } else {
      vehicleList.innerHTML = availableVehicles.map(vehicle => {
        const vehicleConfig = GameConfig.VEHICLE_TYPES[vehicle.type];
        const station = state.stations.find(s => s.id === vehicle.stationId);
        const dist = Math.ceil(this.gameEngine.getDistance(
          { x: vehicle.x, y: vehicle.y },
          { x: emergency.x, y: emergency.y }
        ));
        
        const travelTime = Math.ceil(dist / vehicleConfig.speed);
        const canDispatch = station && station.personnel >= 1;
        
        return `
          <div class="dispatch-vehicle-item ${canDispatch ? '' : 'disabled'}"
               data-vehicle-id="${vehicle.id}"
               data-capacity="${vehicleConfig.capacity}">
            <div class="vehicle-name">
              ${vehicleConfig.icon} ${vehicleConfig.name} (${vehicle.id.toUpperCase()})
            </div>
            <div class="vehicle-meta">
              载容量: ${vehicleConfig.capacity}人 | 水量: ${vehicleConfig.waterCapacity}L
            </div>
            <div class="vehicle-meta">
              距离: ${dist}单位 | 预计: ${travelTime}秒
            </div>
            ${canDispatch ? `
              <div class="personnel-control">
                <label>派遣人数:</label>
                <input type="number" min="1" max="${Math.min(vehicleConfig.capacity, station.personnel)}" 
                       value="1" class="personnel-input"
                       data-vehicle-id="${vehicle.id}">
              </div>
            ` : '<div class="vehicle-meta" style="color: #f44336;">人员不足</div>'}
          </div>
        `;
      }).join('');

      vehicleList.querySelectorAll('.dispatch-vehicle-item:not(.disabled)').forEach(item => {
        item.addEventListener('click', () => {
          vehicleList.querySelectorAll('.dispatch-vehicle-item').forEach(i => {
            i.classList.remove('selected');
          });
          item.classList.add('selected');
          this.selectedVehicleId = item.dataset.vehicleId;
          
          const input = item.querySelector('.personnel-input');
          if (input) {
            this.personnelCount = parseInt(input.value) || 1;
          }
          this.updateDispatchButton();
        });

        const input = item.querySelector('.personnel-input');
        if (input) {
          input.addEventListener('click', (e) => e.stopPropagation());
          input.addEventListener('change', (e) => {
            const max = parseInt(input.max);
            let val = parseInt(e.target.value);
            val = Math.max(1, Math.min(max, val || 1));
            e.target.value = val;
            if (item.classList.contains('selected')) {
              this.personnelCount = val;
            }
          });
        }
      });
    }

    panel.style.display = 'block';
    this.updateDispatchButton();
  }

  closeDispatchPanel() {
    document.getElementById('dispatchPanel').style.display = 'none';
    this.selectedEmergencyId = null;
    this.selectedVehicleId = null;
  }

  updateDispatchButton() {
    const btn = document.getElementById('confirmDispatchBtn');
    if (!this.selectedVehicleId || !this.selectedEmergencyId) {
      btn.disabled = true;
      return;
    }

    const validation = this.gameEngine.validateDispatch(
      this.selectedVehicleId,
      this.selectedEmergencyId,
      this.personnelCount
    );

    btn.disabled = !validation.valid;
    btn.title = validation.reason || '';
  }

  confirmDispatch() {
    if (!this.selectedVehicleId || !this.selectedEmergencyId) return;

    const useHydrant = document.getElementById('useHydrant').checked;
    
    const result = this.gameEngine.dispatch(
      this.selectedVehicleId,
      this.selectedEmergencyId,
      this.personnelCount,
      useHydrant
    );

    if (result.success) {
      this.closeDispatchPanel();
    } else {
      alert(result.error);
    }
  }

  render() {
    const state = this.gameEngine.getGameState();
    
    this.updateStats(state);
    this.renderStations(state);
    this.renderVehicles(state);
    this.renderEmergencies(state);
    this.renderCanvas(state);
  }

  updateStats(state) {
    document.getElementById('score').textContent = state.score;
    
    const minutes = Math.floor(state.timeRemaining / 60);
    const seconds = Math.floor(state.timeRemaining % 60);
    document.getElementById('time').textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  renderStations(state) {
    const container = document.getElementById('stationList');
    container.innerHTML = state.stations.map(station => `
      <div class="station-item">
        <h3>🏭 ${station.name}</h3>
        <p>可用人员: ${station.personnel}</p>
      </div>
    `).join('');
  }

  renderVehicles(state) {
    const container = document.getElementById('availableVehicles');
    
    const availableVehicles = state.vehicles.filter(v => v.status === 'available');
    
    if (availableVehicles.length === 0) {
      container.innerHTML = '<p style="color: #aaa;">没有可用车辆</p>';
      return;
    }

    container.innerHTML = availableVehicles.map(vehicle => {
      const config = GameConfig.VEHICLE_TYPES[vehicle.type];
      const station = state.stations.find(s => s.id === vehicle.stationId);
      
      return `
        <div class="vehicle-item">
          <div class="vehicle-header">
            <span class="vehicle-name">${config.icon} ${config.name}</span>
            <span class="vehicle-status status-available">可用</span>
          </div>
          <div class="vehicle-details">
            ${config.name} | 容量: ${config.capacity}人 | 水量: ${config.waterCapacity}L
          </div>
        </div>
      `;
    }).join('');

    const busyVehicles = state.vehicles.filter(v => v.status !== 'available');
    if (busyVehicles.length > 0) {
      container.innerHTML += '<h4 style="margin-top: 15px; color: #aaa;">执行任务中</h4>';
      busyVehicles.forEach(vehicle => {
        const config = GameConfig.VEHICLE_TYPES[vehicle.type];
        const statusClass = `status-${vehicle.status}`;
        const statusLabels = {
          enroute: '前往',
          arrived: '已到达',
          returning: '返回'
        };
        
        container.innerHTML += `
          <div class="vehicle-item">
            <div class="vehicle-header">
              <span class="vehicle-name">${config.icon} ${config.name}</span>
              <span class="vehicle-status ${statusClass}">${statusLabels[vehicle.status]}</span>
            </div>
          </div>
        `;
      });
    }
  }

  renderEmergencies(state) {
    const activeContainer = document.getElementById('activeEmergencies');
    const completedContainer = document.getElementById('completedEmergencies');
    const failedContainer = document.getElementById('failedEmergencies');

    if (state.emergencies.length === 0) {
      activeContainer.innerHTML = '<p style="color: #aaa;">暂无警情</p>';
    } else {
      activeContainer.innerHTML = state.emergencies.map(emergency => {
        const config = GameConfig.EMERGENCY_TYPES[emergency.type];
        const timePercent = (emergency.timeRemaining / emergency.maxTime) * 100;
        const personnelPercent = (emergency.personnelArrived / emergency.targetPersonnel) * 100;
        const waterPercent = emergency.targetWater > 0 
          ? (emergency.waterProvided / emergency.targetWater) * 100 
          : 100;

        return `
          <div class="emergency-list-item">
            <div class="emergency-header">
              <span class="emergency-name">${config.icon} ${config.name}</span>
              <span class="emergency-time">${Math.ceil(emergency.timeRemaining)}秒</span>
            </div>
            <div class="emergency-progress">
              <div>人员: ${emergency.personnelArrived}/${emergency.targetPersonnel}</div>
              <div class="progress-bar">
                <div class="progress-fill progress-fill-personnel" style="width: ${Math.min(100, personnelPercent)}%"></div>
              </div>
              <div style="margin-top: 4px;">水量: ${emergency.waterProvided}/${emergency.targetWater}L</div>
              <div class="progress-bar">
                <div class="progress-fill progress-fill-water" style="width: ${Math.min(100, waterPercent)}%"></div>
              </div>
              <div style="margin-top: 4px;">时间</div>
              <div class="progress-bar">
                <div class="progress-fill progress-fill-time" style="width: ${timePercent}%"></div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    if (state.completedEmergencies.length === 0) {
      completedContainer.innerHTML = '<p style="color: #aaa;">暂无完成</p>';
    } else {
      completedContainer.innerHTML = state.completedEmergencies.slice(-5).reverse().map(e => {
        const config = GameConfig.EMERGENCY_TYPES[e.type];
        return `
          <div class="emergency-list-item">
            <div class="emergency-header">
              <span class="emergency-name">${config.icon} ${config.name}</span>
              <span style="color: #4caf50; font-size: 0.8rem;">完成</span>
            </div>
          </div>
        `;
      }).join('');
    }

    if (state.failedEmergencies.length === 0) {
      failedContainer.innerHTML = '<p style="color: #aaa;">暂无失败</p>';
    } else {
      failedContainer.innerHTML = state.failedEmergencies.slice(-5).reverse().map(e => {
        const config = GameConfig.EMERGENCY_TYPES[e.type];
        return `
          <div class="emergency-list-item">
            <div class="emergency-header">
              <span class="emergency-name">${config.icon} ${config.name}</span>
              <span style="color: #f44336; font-size: 0.8rem;">失败</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  renderCanvas(state) {
    const ctx = this.ctx;
    const scaleX = this.scaleX;
    const scaleY = this.scaleY;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < GameConfig.MAP_WIDTH; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x * scaleX, 0);
      ctx.lineTo(x * scaleX, this.canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < GameConfig.MAP_HEIGHT; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y * scaleY);
      ctx.lineTo(this.canvas.width, y * scaleY);
      ctx.stroke();
    }

    state.stations.forEach(station => {
      const x = station.x * scaleX;
      const y = station.y * scaleY;
      
      ctx.fillStyle = '#27ae60';
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏭', x, y);

      ctx.fillStyle = '#fff';
      ctx.font = '11px Arial';
      ctx.fillText(station.name, x, y + 30);
    });

    state.hydrants.forEach(hydrant => {
      const x = hydrant.x * scaleX;
      const y = hydrant.y * scaleY;

      ctx.fillStyle = '#3498db';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    state.emergencies.forEach(emergency => {
      const x = emergency.x * scaleX;
      const y = emergency.y * scaleY;
      const config = GameConfig.EMERGENCY_TYPES[emergency.type];
      const timePercent = emergency.timeRemaining / emergency.maxTime;

      const pulseSize = 25 + Math.sin(Date.now() / 200) * 3;
      
      ctx.fillStyle = `rgba(231, 76, 60, ${0.3 + (1 - timePercent) * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, pulseSize * scaleX, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = config.color;
      ctx.beginPath();
      ctx.arc(x, y, 18 * scaleX, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = `${18 * Math.min(scaleX, scaleY)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(config.icon, x, y);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(
        `${Math.ceil(emergency.timeRemaining)}s`,
        x,
        y + 30
      );
    });

    state.vehicles.forEach(vehicle => {
      const x = vehicle.x * scaleX;
      const y = vehicle.y * scaleY;
      const config = GameConfig.VEHICLE_TYPES[vehicle.type];

      if (vehicle.status === 'enroute' || vehicle.status === 'returning') {
        ctx.strokeStyle = `${config.color}80`;
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(vehicle.targetX * scaleX, vehicle.targetY * scaleY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = config.color;
      ctx.beginPath();
      ctx.arc(x, y, 12 * scaleX, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = `${14 * Math.min(scaleX, scaleY)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(config.icon, x, y);

      if (vehicle.status === 'arrived') {
        ctx.strokeStyle = '#4caf50';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 16 * scaleX, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new GameUI();
});
