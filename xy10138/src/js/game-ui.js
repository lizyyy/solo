class GameUI {
  constructor(engine) {
    this.engine = engine;
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.messageTimeout = null;
    this.replayInterval = null;
    this.init();
  }

  init() {
    this.engine.init();
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    document.getElementById('btn-start').addEventListener('click', () => {
      this.engine.start();
      this.updateUI();
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
      this.engine.pause();
      this.updateUI();
    });

    document.getElementById('btn-resume').addEventListener('click', () => {
      this.engine.resume();
      this.updateUI();
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
      this.engine.restart();
      this.updateUI();
    });

    document.getElementById('btn-replay').addEventListener('click', () => {
      this.startReplay();
    });

    document.querySelectorAll('.robot-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const robotId = parseInt(e.target.dataset.robot);
        this.engine.selectRobot(robotId);
        this.updateRobotSelection();
      });
    });

    document.getElementById('btn-up').addEventListener('click', () => this.move('UP'));
    document.getElementById('btn-down').addEventListener('click', () => this.move('DOWN'));
    document.getElementById('btn-left').addEventListener('click', () => this.move('LEFT'));
    document.getElementById('btn-right').addEventListener('click', () => this.move('RIGHT'));
    document.getElementById('btn-pickup').addEventListener('click', () => this.pickup());

    document.addEventListener('keydown', (e) => {
      const state = this.engine.getState();
      if (state.gameState !== GameConstants.GAME_STATE.PLAYING) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          this.move('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          this.move('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          this.move('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          this.move('RIGHT');
          break;
        case ' ':
          e.preventDefault();
          this.pickup();
          break;
      }
    });

    this.startGameLoop();
  }

  startGameLoop() {
    const loop = () => {
      this.render();
      this.updateUI();
      requestAnimationFrame(loop);
    };
    loop();
  }

  move(direction) {
    const result = this.engine.moveRobot(direction);
    if (!result.success) {
      this.showMessage(result.reason);
    }
  }

  pickup() {
    const result = this.engine.pickupCargo();
    if (result.success) {
      this.showMessage('成功拾取货物!');
    } else {
      this.showMessage(result.reason);
    }
  }

  startReplay() {
    if (this.replayInterval) {
      clearInterval(this.replayInterval);
    }

    const started = this.engine.startReplay();
    if (!started) {
      this.showMessage('无法开始回放');
      return;
    }

    this.showMessage('开始回放...');
    this.updateUI();

    this.replayInterval = setInterval(() => {
      const result = this.engine.replayNextStep();
      this.render();
      this.updateUI();

      if (result.done) {
        clearInterval(this.replayInterval);
        this.replayInterval = null;
        this.showMessage('回放完成');
      }
    }, 500);
  }

  showMessage(msg, duration = 1500) {
    const messageEl = document.getElementById('message');
    messageEl.textContent = msg;
    messageEl.classList.add('show');

    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }

    this.messageTimeout = setTimeout(() => {
      messageEl.classList.remove('show');
    }, duration);
  }

  updateUI() {
    const state = this.engine.getState();

    document.getElementById('time').textContent = `${state.timeRemaining}s`;
    document.getElementById('score').textContent = state.score;

    const stateNames = {
      [GameConstants.GAME_STATE.IDLE]: '准备开始',
      [GameConstants.GAME_STATE.PLAYING]: '游戏中',
      [GameConstants.GAME_STATE.PAUSED]: '已暂停',
      [GameConstants.GAME_STATE.ENDED]: '游戏结束',
      [GameConstants.GAME_STATE.REPLAYING]: '回放中',
    };
    document.getElementById('game-state').textContent = stateNames[state.gameState] || '未知';

    const btnStart = document.getElementById('btn-start');
    const btnPause = document.getElementById('btn-pause');
    const btnResume = document.getElementById('btn-resume');
    const btnReplay = document.getElementById('btn-replay');

    btnStart.disabled = state.gameState === GameConstants.GAME_STATE.PLAYING;
    btnPause.disabled = state.gameState !== GameConstants.GAME_STATE.PLAYING;
    btnResume.disabled = state.gameState !== GameConstants.GAME_STATE.PAUSED;
    btnReplay.disabled = state.gameState !== GameConstants.GAME_STATE.ENDED || 
                         this.engine.getMoveHistory().length === 0;

    const moveBtns = document.querySelectorAll('.move-btn, .robot-btn');
    const canMove = state.gameState === GameConstants.GAME_STATE.PLAYING;
    moveBtns.forEach(btn => {
      if (!btn.classList.contains('robot-btn')) {
        btn.disabled = !canMove;
      }
    });

    this.updateScoreDetails(state.scoreDetails);
    this.updateRobotSelection();

    if (state.gameState === GameConstants.GAME_STATE.ENDED) {
      const msg = state.allCargosPicked ? 
        `恭喜通关！最终得分: ${state.score}` : 
        `时间耗尽！最终得分: ${state.score}`;
      this.showMessage(msg, 5000);
    }
  }

  updateScoreDetails(details) {
    const container = document.getElementById('score-details');
    
    if (!details || details.length === 0) {
      container.innerHTML = '<p class="empty-text">游戏开始后显示计分明细</p>';
      return;
    }

    container.innerHTML = details.slice().reverse().map(item => {
      const className = item.amount > 0 ? 'positive' : 'negative';
      const sign = item.amount > 0 ? '+' : '';
      return `
        <div class="score-item ${className}">
          <span class="time">${item.time}s</span>
          <span>${item.reason}</span>
          <span>${sign}${item.amount}</span>
        </div>
      `;
    }).join('');
  }

  updateRobotSelection() {
    const state = this.engine.getState();
    document.querySelectorAll('.robot-btn').forEach(btn => {
      const robotId = parseInt(btn.dataset.robot);
      btn.classList.toggle('selected', state.selectedRobot === robotId);
    });
  }

  render() {
    const state = this.engine.getState();
    const ctx = this.ctx;
    const cellSize = GameConstants.CELL_SIZE;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < GameConstants.GRID_HEIGHT; y++) {
      for (let x = 0; x < GameConstants.GRID_WIDTH; x++) {
        ctx.fillStyle = GameConstants.COLORS.FLOOR;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        
        ctx.strokeStyle = '#BDC3C7';
        ctx.lineWidth = 1;
        ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }

    state.walls.forEach(wall => {
      ctx.fillStyle = GameConstants.COLORS.WALL;
      ctx.fillRect(
        wall.x * cellSize + 2,
        wall.y * cellSize + 2,
        cellSize - 4,
        cellSize - 4
      );
    });

    state.cargos.forEach(cargo => {
      const cx = cargo.x * cellSize + cellSize / 2;
      const cy = cargo.y * cellSize + cellSize / 2;
      const radius = cellSize * 0.3;

      ctx.beginPath();
      ctx.fillStyle = cargo.picked ? 
        GameConstants.COLORS.PICKED_CARGO : 
        GameConstants.COLORS.CARGO;
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      if (!cargo.picked) {
        ctx.strokeStyle = '#F39C12';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#2C3E50';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📦', cx, cy);
      }
    });

    state.robots.forEach(robot => {
      const rx = robot.x * cellSize + cellSize / 2;
      const ry = robot.y * cellSize + cellSize / 2;
      const radius = cellSize * 0.35;

      ctx.beginPath();
      ctx.fillStyle = robot.color;
      ctx.arc(rx, ry, radius, 0, Math.PI * 2);
      ctx.fill();

      if (state.selectedRobot === robot.id) {
        ctx.strokeStyle = '#2C3E50';
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      ctx.fillStyle = 'white';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(robot.id.toString(), rx, ry);

      if (robot.carrying) {
        ctx.fillStyle = '#F39C12';
        ctx.font = '14px Arial';
        ctx.fillText('📦', rx, ry - radius - 10);
      }
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameUI;
}
