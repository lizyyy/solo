/**
 * UI 组件模块
 * 管理界面渲染和更新
 */

import { PRESS_STATUS } from './rhythmEngine.js';

const STATUS_COLORS = {
  [PRESS_STATUS.PERFECT]: '#4ade80',
  [PRESS_STATUS.GOOD]: '#60a5fa',
  [PRESS_STATUS.TOO_FAST]: '#f87171',
  [PRESS_STATUS.TOO_SLOW]: '#fbbf24',
  [PRESS_STATUS.MISSED]: '#94a3b8',
  [PRESS_STATUS.DOUBLE_TAP]: '#f472b6'
};

const STATUS_LABELS = {
  [PRESS_STATUS.PERFECT]: '完美',
  [PRESS_STATUS.GOOD]: '合格',
  [PRESS_STATUS.TOO_FAST]: '过快',
  [PRESS_STATUS.TOO_SLOW]: '过慢',
  [PRESS_STATUS.MISSED]: '漏拍',
  [PRESS_STATUS.DOUBLE_TAP]: '连击'
};

class UIComponents {
  constructor() {
    this.elements = {};
    this.cacheElements();
  }

  cacheElements() {
    this.elements = {
      mainScreen: document.getElementById('main-screen'),
      coachScreen: document.getElementById('coach-screen'),
      historyScreen: document.getElementById('history-screen'),
      resultScreen: document.getElementById('result-screen'),
      
      durationSelect: document.getElementById('duration-select'),
      customDuration: document.getElementById('custom-duration'),
      startButton: document.getElementById('start-button'),
      coachButton: document.getElementById('coach-button'),
      historyButton: document.getElementById('history-button'),
      
      countdownDisplay: document.getElementById('countdown-display'),
      
      timerDisplay: document.getElementById('timer-display'),
      bpmDisplay: document.getElementById('bpm-display'),
      streakDisplay: document.getElementById('streak-display'),
      feedbackText: document.getElementById('feedback-text'),
      progressBar: document.getElementById('progress-bar'),
      beatRing: document.getElementById('beat-ring'),
      beatRingInner: document.getElementById('beat-ring-inner'),
      scatterPlot: document.getElementById('scatter-plot'),
      
      pauseButton: document.getElementById('pause-button'),
      resumeButton: document.getElementById('resume-button'),
      resetButton: document.getElementById('reset-button'),
      
      resultOverall: document.getElementById('result-overall'),
      resultBPM: document.getElementById('result-bpm'),
      resultAccuracy: document.getElementById('result-accuracy'),
      resultStability: document.getElementById('result-stability'),
      resultStreak: document.getElementById('result-streak'),
      resultTotalPresses: document.getElementById('result-total-presses'),
      resultValidPresses: document.getElementById('result-valid-presses'),
      resultPerfect: document.getElementById('result-perfect'),
      resultTooFast: document.getElementById('result-too-fast'),
      resultTooSlow: document.getElementById('result-too-slow'),
      resultMissed: document.getElementById('result-missed'),
      resultDoubleTap: document.getElementById('result-double-tap'),
      resultSuggestions: document.getElementById('result-suggestions'),
      
      exportJSON: document.getElementById('export-json'),
      exportCSV: document.getElementById('export-csv'),
      trainAgain: document.getElementById('train-again'),
      
      configForm: document.getElementById('config-form'),
      configError: document.getElementById('config-error'),
      saveConfig: document.getElementById('save-config'),
      resetConfig: document.getElementById('reset-config'),
      backFromCoach: document.getElementById('back-from-coach'),
      
      historyList: document.getElementById('history-list'),
      historyStats: document.getElementById('history-stats'),
      exportHistoryJSON: document.getElementById('export-history-json'),
      exportHistoryCSV: document.getElementById('export-history-csv'),
      clearHistory: document.getElementById('clear-history'),
      backFromHistory: document.getElementById('back-from-history')
    };
  }

  showScreen(screenName) {
    const screens = ['main-screen', 'coach-screen', 'history-screen', 'result-screen'];
    screens.forEach(screen => {
      const el = document.getElementById(screen);
      if (el) {
        el.classList.toggle('hidden', screen !== screenName);
      }
    });
  }

  updateTimer(remainingMs, totalMs) {
    const seconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    this.elements.timerDisplay.textContent = 
      `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    const progress = ((totalMs - remainingMs) / totalMs) * 100;
    this.elements.progressBar.style.width = `${progress}%`;
  }

  updateBPM(currentBPM) {
    this.elements.bpmDisplay.textContent = currentBPM ? Math.round(currentBPM) : '--';
  }

  updateStreak(streak) {
    this.elements.streakDisplay.textContent = streak;
  }

  showFeedback(status, details = '') {
    const label = STATUS_LABELS[status] || status;
    this.elements.feedbackText.textContent = label + (details ? ` (${details})` : '');
    this.elements.feedbackText.style.color = STATUS_COLORS[status] || '#fff';
    
    this.elements.feedbackText.classList.remove('animate-feedback');
    void this.elements.feedbackText.offsetWidth;
    this.elements.feedbackText.classList.add('animate-feedback');
  }

  updateBeatRing(progress, isOnBeat = false) {
    const rotation = (progress % 1) * 360;
    this.elements.beatRingInner.style.transform = `rotate(${rotation}deg)`;
    
    if (isOnBeat) {
      this.elements.beatRing.classList.add('beat-pulse');
      setTimeout(() => {
        this.elements.beatRing.classList.remove('beat-pulse');
      }, 100);
    }
  }

  updateScatterPlot(presses, targetIntervalMs) {
    const svg = this.elements.scatterPlot;
    const width = svg.clientWidth || 300;
    const height = svg.clientHeight || 80;
    const padding = 10;
    
    const recentPresses = presses.slice(-10);
    const points = recentPresses.map((press, index) => {
      if (press.status === PRESS_STATUS.MISSED || !press.intervalSinceLast) {
        return null;
      }
      
      const deviation = press.intervalSinceLast - targetIntervalMs;
      const maxDeviation = 300;
      const normalizedDeviation = Math.max(-1, Math.min(1, deviation / maxDeviation));
      
      const x = padding + (index / Math.max(recentPresses.length - 1, 1)) * (width - 2 * padding);
      const y = (height / 2) - normalizedDeviation * (height / 2 - padding);
      
      return { x, y, status: press.status };
    }).filter(Boolean);

    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const midLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    midLine.setAttribute('x1', padding);
    midLine.setAttribute('y1', height / 2);
    midLine.setAttribute('x2', width - padding);
    midLine.setAttribute('y2', height / 2);
    midLine.setAttribute('stroke', '#4a5568');
    midLine.setAttribute('stroke-width', '1');
    midLine.setAttribute('stroke-dasharray', '4,4');
    svg.appendChild(midLine);

    points.forEach((point, i) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', point.x);
      circle.setAttribute('cy', point.y);
      circle.setAttribute('r', '5');
      circle.setAttribute('fill', STATUS_COLORS[point.status] || '#fff');
      circle.setAttribute('opacity', 0.3 + (i / points.length) * 0.7);
      svg.appendChild(circle);
    });
  }

  renderResult(score) {
    this.elements.resultOverall.textContent = score.overallScore;
    this.elements.resultBPM.textContent = score.averageBPM || '--';
    this.elements.resultAccuracy.textContent = score.accuracy + '%';
    this.elements.resultStability.textContent = score.stability + '%';
    this.elements.resultStreak.textContent = score.longestStreak;
    this.elements.resultTotalPresses.textContent = score.totalPresses;
    this.elements.resultValidPresses.textContent = score.validPresses;
    this.elements.resultPerfect.textContent = score.perfectCount;
    this.elements.resultTooFast.textContent = score.tooFastCount;
    this.elements.resultTooSlow.textContent = score.tooSlowCount;
    this.elements.resultMissed.textContent = score.missedCount;
    this.elements.resultDoubleTap.textContent = score.doubleTapCount;

    this.elements.resultSuggestions.innerHTML = score.suggestions
      .map(s => `<li>${s}</li>`)
      .join('');
  }

  renderHistory(history, stats) {
    this.elements.historyStats.innerHTML = `
      <div class="stat-item">
        <span class="stat-value">${stats.totalSessions}</span>
        <span class="stat-label">总训练次数</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${stats.averageScore}</span>
        <span class="stat-label">平均得分</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${stats.bestScore}</span>
        <span class="stat-label">最高分</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${stats.averageBPM || '--'}</span>
        <span class="stat-label">平均BPM</span>
      </div>
    `;

    if (history.length === 0) {
      this.elements.historyList.innerHTML = '<p class="no-history">暂无训练记录</p>';
      return;
    }

    this.elements.historyList.innerHTML = history.map(record => `
      <div class="history-item" data-id="${record.id}">
        <div class="history-header">
          <span class="history-time">${new Date(record.timestamp).toLocaleString('zh-CN')}</span>
          <span class="history-score">${record.score.overallScore}分</span>
        </div>
        <div class="history-details">
          <span>BPM: ${record.score.averageBPM || '--'}</span>
          <span>准确率: ${record.score.accuracy}%</span>
          <span>按压: ${record.score.totalPresses}次</span>
        </div>
        <div class="history-actions">
          <button class="btn-small export-json-single" data-id="${record.id}">导出JSON</button>
          <button class="btn-small export-csv-single" data-id="${record.id}">导出CSV</button>
          <button class="btn-small delete-record" data-id="${record.id}">删除</button>
        </div>
      </div>
    `).join('');
  }

  renderCoachConfig(config) {
    document.getElementById('config-bpm-low').value = config.targetBPMLow;
    document.getElementById('config-bpm-high').value = config.targetBPMHigh;
    document.getElementById('config-tolerance').value = config.errorToleranceMs;
    document.getElementById('config-metronome').checked = config.enableMetronome;
    document.getElementById('config-mouse').checked = config.enableMouseClick;
    document.getElementById('config-volume').value = config.metronomeVolume;
    document.getElementById('config-history-limit').value = config.historyLimit;
  }

  showConfigError(message) {
    this.elements.configError.textContent = message;
    this.elements.configError.classList.remove('hidden');
  }

  hideConfigError() {
    this.elements.configError.classList.add('hidden');
  }

  updateCountdown(count) {
    this.elements.countdownDisplay.textContent = count > 0 ? count : '开始!';
  }

  setPausedState(isPaused) {
    if (isPaused) {
      document.getElementById('pause-controls').classList.remove('hidden');
      document.getElementById('training-controls').classList.add('hidden');
    } else {
      document.getElementById('pause-controls').classList.add('hidden');
      document.getElementById('training-controls').classList.remove('hidden');
    }
  }
}

export default new UIComponents();
