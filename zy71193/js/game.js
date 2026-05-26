import { GameState, GAME_DURATION_MINUTES } from './models.js';
import { Simulator } from './simulator.js';
import { Scene3D } from './scene3d.js';
import { UI } from './ui.js';
import { LEVELS } from './levels.js';

class Game {
  constructor() {
    this.state = null;
    this.simulator = null;
    this.scene3d = null;
    this.ui = null;
    this.speed = 1;
    this.lastTickTime = 0;
    this.animId = null;
    this._initStartScreen();
    this._bindGlobalEvents();
  }

  _initStartScreen() {
    const container = document.getElementById('level-buttons');
    container.innerHTML = LEVELS.map(l => `
      <button class="level-btn" data-level="${l.id}">
        <div class="level-num">${l.id}</div>
        <div class="level-title">${l.name.split(': ')[1] || l.name}</div>
      </button>
    `).join('');

    container.querySelectorAll('.level-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const levelId = parseInt(btn.dataset.level);
        this.startLevel(levelId);
      });
    });
  }

  _bindGlobalEvents() {
    document.getElementById('btn-pause').addEventListener('click', () => {
      this.togglePause();
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
      if (this.state?.levelConfig) {
        this.startLevel(this.state.levelConfig.id);
      }
    });

    document.getElementById('btn-speed').addEventListener('click', () => {
      this.cycleSpeed();
    });

    document.getElementById('btn-modal-restart').addEventListener('click', () => {
      this._hideModal();
      if (this.state?.levelConfig) {
        this.startLevel(this.state.levelConfig.id);
      }
    });

    document.getElementById('btn-modal-next').addEventListener('click', () => {
      this._hideModal();
      const nextId = this.state.levelConfig.id + 1;
      if (LEVELS.find(l => l.id === nextId)) {
        this.startLevel(nextId);
      } else {
        this._showStartScreen();
      }
    });
  }

  startLevel(levelId) {
    const config = LEVELS.find(l => l.id === levelId);
    if (!config) return;

    this._endHandled = false;

    if (this.scene3d) {
      this.scene3d.dispose();
      this.scene3d = null;
    }

    this.state = new GameState(config);
    this.simulator = new Simulator(this.state);

    const canvas = document.getElementById('scene3d');
    this.scene3d = new Scene3D(canvas, this.state);

    this.ui = new UI(this.state, this.simulator);

    this.speed = 1;
    document.getElementById('btn-speed').textContent = '⏩ 1x';
    document.getElementById('btn-pause').textContent = '⏸ 暂停';

    document.getElementById('level-name').textContent = config.name;

    this._hideStartScreen();
    this._hideModal();

    this.state.addEvent('info', `开始: ${config.name}`);

    this.lastTickTime = performance.now();
    if (this.animId) cancelAnimationFrame(this.animId);
    this._startLoop();
  }

  _startLoop() {
    const loop = (now) => {
      this.animId = requestAnimationFrame(loop);

      const dt = (now - this.lastTickTime) / 1000;
      this.lastTickTime = now;

      if (!this.state.paused && !this.state.finished) {
        const gameDt = dt * this.speed * 6;
        this.simulator.tick(gameDt);
      }

      this.ui.update();

      if (this.state.finished) {
        this._handleGameEnd();
      }
    };
    this.animId = requestAnimationFrame(loop);
  }

  togglePause() {
    if (!this.state) return;
    this.state.paused = !this.state.paused;
    const btn = document.getElementById('btn-pause');
    btn.textContent = this.state.paused ? '▶ 继续' : '⏸ 暂停';
  }

  cycleSpeed() {
    const speeds = [1, 2, 4, 8];
    const idx = speeds.indexOf(this.speed);
    this.speed = speeds[(idx + 1) % speeds.length];
    document.getElementById('btn-speed').textContent = `⏩ ${this.speed}x`;
  }

  _handleGameEnd() {
    if (this._endHandled) return;
    this._endHandled = true;

    const score = Math.round(this.state.score);
    const maxScore = this._calculateMaxScore();
    const { grade, color, percentage } = this._calculateGrade(score, maxScore);

    if (this.state.gameOver) {
      this._showModal('游戏失败', `
        <p><strong>失败原因:</strong></p>
        <p style="color: #f85149; margin: 12px 0;">${this.state.failureReason}</p>
        <p>最终得分: <strong style="color: #58a6ff;">${score}</strong></p>
        <p>评级: <strong style="color: ${color};">${grade}</strong></p>
      `);
    } else {
      this._showModal('关卡完成', `
        <p><strong>恭喜完成关卡!</strong></p>
        <p style="margin: 12px 0;">最终得分: <strong style="color: #58a6ff; font-size: 24px;">${score}</strong></p>
        <p>评级: <strong style="color: ${color}; font-size: 20px;">${grade}</strong></p>
        <p style="color: #8b949e; font-size: 12px; margin-top: 8px;">
          完成度: ${percentage.toFixed(1)}%
        </p>
      `, true);
    }

    this.ui._updateReport();
  }

  _calculateMaxScore() {
    let max = 0;
    max += 2 * 1440 * 3 * 0.7;
    max += this.state.tasks.length * 100;
    max += 4 * 50;
    return Math.max(1, max);
  }

  _calculateGrade(score, maxScore) {
    const percentage = Math.max(0, Math.min(100, (score / maxScore) * 100));
    let grade, color;
    if (percentage >= 70) { grade = 'S'; color = '#ffd700'; }
    else if (percentage >= 55) { grade = 'A'; color = '#3fb950'; }
    else if (percentage >= 40) { grade = 'B'; color = '#58a6ff'; }
    else if (percentage >= 25) { grade = 'C'; color = '#d29922'; }
    else { grade = 'D'; color = '#f85149'; }
    return { grade, color, percentage };
  }

  _showModal(title, body, showNext = false) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('btn-modal-next').classList.toggle('hidden', !showNext);
  }

  _hideModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    this._endHandled = false;
  }

  _showStartScreen() {
    document.getElementById('start-screen').classList.remove('hidden');
  }

  _hideStartScreen() {
    document.getElementById('start-screen').classList.add('hidden');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});