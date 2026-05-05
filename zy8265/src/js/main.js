import { GameEngine } from './core/GameEngine.js';
import { defaultLevels } from './levels/defaultLevels.js';
import { GameStates } from './core/GameStateManager.js';

class MuseumGame {
  constructor() {
    this.engine = new GameEngine();
    this.gameContainer = document.getElementById('game-container');
    this.gridContainer = document.getElementById('grid-container');
    this.scoreDisplay = document.getElementById('score-value');
    this.levelNameDisplay = document.getElementById('level-name');
    this.levelDescDisplay = document.getElementById('level-desc');
    this.modal = document.getElementById('game-over-modal');
    this.restartBtn = document.getElementById('restart-btn');
    this.modalRestartBtn = document.getElementById('modal-restart-btn');
    this.modalNextLevelBtn = document.getElementById('modal-next-level-btn');
    this.modalNewGameBtn = document.getElementById('modal-new-game-btn');
    
    this.initialize();
  }

  initialize() {
    this.engine.initialize(defaultLevels);
    
    this.engine.onUpdate((state) => {
      this.render(state);
    });
    
    this.engine.onGameOver((isWin, summary) => {
      this.showGameOver(summary);
    });
    
    this.setupEventListeners();
    
    this.startNewGame();
  }

  startNewGame() {
    this.engine.startLevel(0);
  }

  setupEventListeners() {
    document.addEventListener('keydown', (e) => {
      let dx = 0, dy = 0;
      
      switch(e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          dy = -1;
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          dy = 1;
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          dx = -1;
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          dx = 1;
          break;
        case 'r':
        case 'R':
          this.engine.restartLevel();
          return;
        default:
          return;
      }
      
      e.preventDefault();
      this.engine.handleInput(dx, dy);
    });
    
    this.restartBtn.addEventListener('click', () => {
      this.engine.restartLevel();
    });
    
    this.modalRestartBtn.addEventListener('click', () => {
      this.hideModal();
      this.engine.restartLevel();
    });
    
    this.modalNextLevelBtn.addEventListener('click', () => {
      this.hideModal();
      if (this.engine.hasNextLevel()) {
        this.engine.nextLevel();
      } else {
        this.startNewGame();
      }
    });
    
    this.modalNewGameBtn.addEventListener('click', () => {
      this.hideModal();
      this.startNewGame();
    });
  }

  render(state) {
    this.scoreDisplay.textContent = state.score;
    
    if (state.levelName) {
      this.levelNameDisplay.textContent = state.levelName;
    }
    if (state.levelIndex !== undefined) {
      const currentLevel = this.engine.getCurrentLevel();
      this.levelDescDisplay.textContent = currentLevel?.description || `关卡 ${state.levelIndex + 1}`;
    }
    
    this.renderGrid(state);
  }

  renderGrid(state) {
    const { grid, player, boxes, elevators } = state;
    
    if (!grid) return;
    
    this.gridContainer.innerHTML = '';
    this.gridContainer.style.gridTemplateColumns = `repeat(${grid.width}, 50px)`;
    this.gridContainer.style.gridTemplateRows = `repeat(${grid.height}, 50px)`;
    
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.x = x;
        cell.dataset.y = y;
        
        const cellData = grid.getCell(x, y);
        
        if (cellData.wall) {
          cell.classList.add('cell-wall');
        } else if (cellData.elevator) {
          cell.classList.add('cell-elevator');
        } else if (cellData.storage) {
          cell.classList.add('cell-storage');
        } else if (cellData.humidity) {
          cell.classList.add('cell-humidity');
        } else if (cellData.patrolPath) {
          cell.classList.add('cell-patrol');
        } else {
          cell.classList.add('cell-floor');
        }
        
        this.gridContainer.appendChild(cell);
      }
    }
    
    if (boxes) {
      boxes.forEach(box => {
        const boxEl = document.createElement('div');
        boxEl.className = 'entity';
        
        if (box.inStorage) {
          boxEl.classList.add('entity-box-stored');
          const cell = this.gridContainer.querySelector(`[data-x="${box.x}"][data-y="${box.y}"]`);
          if (cell) {
            cell.classList.add('box-stored');
          }
        } else {
          boxEl.classList.add('entity-box');
        }
        
        boxEl.textContent = '📦';
        
        if (box.weight > 1) {
          const weightBadge = document.createElement('span');
          weightBadge.className = 'box-weight';
          weightBadge.textContent = box.weight;
          boxEl.appendChild(weightBadge);
        }
        
        this.positionEntity(boxEl, box.x, box.y);
        this.gridContainer.appendChild(boxEl);
      });
    }
    
    if (elevators) {
      elevators.forEach(elevator => {
        const elevatorEl = document.createElement('div');
        elevatorEl.className = 'entity entity-box';
        elevatorEl.style.background = 'linear-gradient(135deg, #FFC107 0%, #FF9800 100%)';
        elevatorEl.style.border = '2px solid #FFE082';
        elevatorEl.textContent = '🛗';
        
        const capacityBadge = document.createElement('span');
        capacityBadge.className = 'box-weight';
        capacityBadge.textContent = `${elevator.currentCapacity}/${elevator.maxCapacity}`;
        capacityBadge.style.background = elevator.isOverweight() ? '#f44336' : '#4CAF50';
        elevatorEl.appendChild(capacityBadge);
        
        this.positionEntity(elevatorEl, elevator.x, elevator.y);
        this.gridContainer.appendChild(elevatorEl);
      });
    }
    
    if (player) {
      const playerEl = document.createElement('div');
      playerEl.className = 'entity entity-player';
      playerEl.textContent = '🧑';
      
      this.positionEntity(playerEl, player.x, player.y);
      this.gridContainer.appendChild(playerEl);
    }
  }

  positionEntity(entityEl, x, y) {
    entityEl.style.gridColumn = x + 1;
    entityEl.style.gridRow = y + 1;
    entityEl.style.position = 'relative';
    entityEl.style.left = '5px';
    entityEl.style.top = '5px';
  }

  showGameOver(summary) {
    this.modal.classList.add('active');
    
    if (summary.isWin) {
      this.modal.classList.add('modal-win');
      this.modal.classList.remove('modal-lose');
      document.getElementById('modal-title').textContent = '🎉 关卡完成！';
    } else {
      this.modal.classList.add('modal-lose');
      this.modal.classList.remove('modal-win');
      document.getElementById('modal-title').textContent = '💥 任务失败！';
    }
    
    const gradeBadge = document.getElementById('grade-badge');
    gradeBadge.textContent = summary.grade.grade;
    gradeBadge.style.background = summary.grade.color;
    gradeBadge.style.boxShadow = `0 0 30px ${summary.grade.color}`;
    document.getElementById('grade-label').textContent = summary.grade.label;
    
    document.getElementById('summary-score').textContent = summary.score;
    document.getElementById('summary-moves').textContent = summary.moves;
    document.getElementById('summary-pushes').textContent = summary.pushes;
    document.getElementById('summary-boxes').textContent = `${summary.boxesDelivered}/${summary.totalBoxes}`;
    
    const violationsList = document.getElementById('violations-list');
    violationsList.innerHTML = '';
    
    if (summary.violations.length === 0) {
      violationsList.innerHTML = '<div class="no-violations">✅ 无违规记录，完美通关！</div>';
    } else {
      summary.violations.forEach(violation => {
        const item = document.createElement('div');
        item.className = 'violation-item';
        item.innerHTML = `
          <strong>${this.getViolationTypeLabel(violation.type)}</strong>
          <span style="color: #ff6666; float: right;">-${violation.penalty}分</span>
          <br>
          <span style="font-size: 0.8rem; opacity: 0.7;">${violation.message}</span>
        `;
        violationsList.appendChild(item);
      });
    }
    
    if (this.engine.hasNextLevel() && summary.isWin) {
      this.modalNextLevelBtn.style.display = 'inline-block';
    } else {
      this.modalNextLevelBtn.style.display = 'none';
    }
  }

  getViolationTypeLabel(type) {
    const labels = {
      humidity: '💧 湿度区域',
      patrol: '🚨 巡检路线',
      box_stuck: '⚠️ 箱子卡住',
      elevator_overload: '🛗 电梯超载'
    };
    return labels[type] || type;
  }

  hideModal() {
    this.modal.classList.remove('active');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new MuseumGame();
});
