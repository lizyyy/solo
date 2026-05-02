/**
 * 主入口文件
 * 协调所有模块，处理应用逻辑
 */

import stateMachine, { STATES, TRANSITIONS } from './stateMachine.js';
import rhythmEngine, { PRESS_STATUS } from './rhythmEngine.js';
import inputHandler from './inputHandler.js';
import audioPlayer from './audioPlayer.js';
import coachConfig from './coachConfig.js';
import storageManager from './storageManager.js';
import exporter from './exporter.js';
import uiComponents from './uiComponents.js';

class CPRTrainer {
  constructor() {
    this.currentRecord = null;
    this.trainingDuration = 60000;
    this.remainingTime = 0;
    this.startTime = 0;
    this.pauseTime = 0;
    this.animationFrameId = null;
    this.metronomeTimer = null;
    
    this.setupEventListeners();
    this.setupSubscriptions();
    this.init();
  }

  init() {
    uiComponents.showScreen('main-screen');
    uiComponents.renderCoachConfig({
      targetBPMLow: coachConfig.get('targetBPMLow'),
      targetBPMHigh: coachConfig.get('targetBPMHigh'),
      errorToleranceMs: coachConfig.get('errorToleranceMs'),
      enableMetronome: coachConfig.get('enableMetronome'),
      enableMouseClick: coachConfig.get('enableMouseClick'),
      metronomeVolume: coachConfig.get('metronomeVolume'),
      historyLimit: coachConfig.get('historyLimit')
    });
  }

  setupEventListeners() {
    document.getElementById('start-button').addEventListener('click', () => {
      audioPlayer.init();
      this.startConfiguration();
    });

    document.getElementById('coach-button').addEventListener('click', () => {
      this.enterCoachMode();
    });

    document.getElementById('history-button').addEventListener('click', () => {
      this.enterHistoryMode();
    });

    document.getElementById('pause-button').addEventListener('click', () => {
      this.pauseTraining();
    });

    document.getElementById('resume-button').addEventListener('click', () => {
      this.resumeTraining();
    });

    document.getElementById('reset-button').addEventListener('click', () => {
      this.resetTraining();
    });

    document.getElementById('export-json').addEventListener('click', () => {
      if (this.currentRecord) {
        exporter.exportToJSON(this.currentRecord);
      }
    });

    document.getElementById('export-csv').addEventListener('click', () => {
      if (this.currentRecord) {
        exporter.exportToCSV(this.currentRecord);
      }
    });

    document.getElementById('train-again').addEventListener('click', () => {
      this.resetToIdle();
    });

    document.getElementById('save-config').addEventListener('click', () => {
      this.saveCoachConfig();
    });

    document.getElementById('reset-config').addEventListener('click', () => {
      coachConfig.reset();
      uiComponents.renderCoachConfig({
        targetBPMLow: coachConfig.get('targetBPMLow'),
        targetBPMHigh: coachConfig.get('targetBPMHigh'),
        errorToleranceMs: coachConfig.get('errorToleranceMs'),
        enableMetronome: coachConfig.get('enableMetronome'),
        enableMouseClick: coachConfig.get('enableMouseClick'),
        metronomeVolume: coachConfig.get('metronomeVolume'),
        historyLimit: coachConfig.get('historyLimit')
      });
      uiComponents.hideConfigError();
    });

    document.getElementById('back-from-coach').addEventListener('click', () => {
      this.exitCoachMode();
    });

    document.getElementById('export-history-json').addEventListener('click', () => {
      exporter.exportHistoryToJSON(storageManager.getHistory());
    });

    document.getElementById('export-history-csv').addEventListener('click', () => {
      exporter.exportHistoryToCSV(storageManager.getHistory());
    });

    document.getElementById('clear-history').addEventListener('click', () => {
      if (confirm('确定要清除所有训练记录吗？此操作不可撤销。')) {
        storageManager.clearAll();
        this.refreshHistory();
      }
    });

    document.getElementById('back-from-history').addEventListener('click', () => {
      this.exitHistoryMode();
    });

    document.getElementById('duration-select').addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        document.getElementById('custom-duration-group').classList.remove('hidden');
      } else {
        document.getElementById('custom-duration-group').classList.add('hidden');
      }
    });

    document.getElementById('history-list').addEventListener('click', (e) => {
      const target = e.target;
      if (target.classList.contains('delete-record')) {
        const id = target.dataset.id;
        if (confirm('确定要删除这条记录吗？')) {
          storageManager.deleteRecord(id);
          this.refreshHistory();
        }
      } else if (target.classList.contains('export-json-single')) {
        const id = target.dataset.id;
        const record = storageManager.getById(id);
        if (record) exporter.exportToJSON(record);
      } else if (target.classList.contains('export-csv-single')) {
        const id = target.dataset.id;
        const record = storageManager.getById(id);
        if (record) exporter.exportToCSV(record);
      }
    });
  }

  setupSubscriptions() {
    stateMachine.subscribe(({ transition, fromState, toState }) => {
      this.handleStateChange(fromState, toState);
    });

    inputHandler.subscribe((event) => {
      if (event.type === 'press' && stateMachine.isTraining()) {
        this.handlePress(event.time);
      } else if (event.type === 'blur' && stateMachine.isTraining()) {
        this.pauseTraining();
      }
    });

    rhythmEngine.subscribe(({ type, data }) => {
      if (type === 'press') {
        audioPlayer.playPressFeedback(data.status);
        uiComponents.showFeedback(data.status, 
          data.deviation ? `偏差: ${Math.round(data.deviation)}ms` : ''
        );
      } else if (type === 'missed') {
        audioPlayer.playPressFeedback('missed');
        uiComponents.showFeedback(PRESS_STATUS.MISSED);
      }
    });

    coachConfig.subscribe((config) => {
      audioPlayer.setVolume(config.metronomeVolume);
    });
  }

  handleStateChange(fromState, toState) {
    switch (toState) {
      case STATES.IDLE:
        uiComponents.showScreen('main-screen');
        inputHandler.disable();
        this.stopMetronome();
        break;
      case STATES.COUNTDOWN:
        uiComponents.showScreen('main-screen');
        document.getElementById('setup-section').classList.add('hidden');
        document.getElementById('countdown-section').classList.remove('hidden');
        document.getElementById('training-section').classList.add('hidden');
        break;
      case STATES.TRAINING:
        document.getElementById('countdown-section').classList.add('hidden');
        document.getElementById('training-section').classList.remove('hidden');
        inputHandler.enable();
        uiComponents.setPausedState(false);
        this.startMetronome();
        break;
      case STATES.PAUSED:
        inputHandler.disable();
        uiComponents.setPausedState(true);
        this.stopMetronome();
        break;
      case STATES.FINISHED:
        inputHandler.disable();
        this.stopMetronome();
        this.finishTraining();
        break;
      case STATES.COACH_MODE:
        uiComponents.showScreen('coach-screen');
        break;
      case STATES.HISTORY:
        uiComponents.showScreen('history-screen');
        this.refreshHistory();
        break;
    }
  }

  startConfiguration() {
    const durationSelect = document.getElementById('duration-select');
    let durationSec;

    if (durationSelect.value === 'custom') {
      const customInput = document.getElementById('custom-duration');
      const value = parseInt(customInput.value, 10);
      
      if (isNaN(value) || value < 10 || value > 600) {
        alert('自定义时长必须在10-600秒之间');
        return;
      }
      durationSec = value;
    } else {
      durationSec = parseInt(durationSelect.value, 10);
    }

    this.trainingDuration = durationSec * 1000;
    stateMachine.transition(TRANSITIONS.START_CONFIGURATION);
    this.startCountdown();
  }

  startCountdown() {
    stateMachine.transition(TRANSITIONS.START_COUNTDOWN);
    let count = 3;

    const countdown = () => {
      uiComponents.updateCountdown(count);
      audioPlayer.playCountdownBeep(count);
      
      if (count > 0) {
        count--;
        setTimeout(countdown, 1000);
      } else {
        setTimeout(() => {
          this.startTraining();
        }, 500);
      }
    };

    countdown();
  }

  startTraining() {
    stateMachine.transition(TRANSITIONS.START_TRAINING);
    this.startTime = performance.now();
    this.remainingTime = this.trainingDuration;
    rhythmEngine.start(this.startTime);
    
    this.animationLoop();
  }

  animationLoop() {
    if (!stateMachine.isTraining()) return;

    const now = performance.now();
    const elapsed = now - this.startTime;
    this.remainingTime = Math.max(0, this.trainingDuration - elapsed);

    uiComponents.updateTimer(this.remainingTime, this.trainingDuration);
    
    const validPresses = rhythmEngine.getPresses().filter(p => 
      p.status !== PRESS_STATUS.MISSED && p.status !== PRESS_STATUS.DOUBLE_TAP
    );
    if (validPresses.length >= 2) {
      const firstPress = validPresses[0];
      const lastPress = validPresses[validPresses.length - 1];
      const timeSpan = lastPress.time - firstPress.time;
      if (timeSpan > 0) {
        const bpm = ((validPresses.length - 1) / timeSpan) * 60000;
        uiComponents.updateBPM(bpm);
      }
    }

    uiComponents.updateStreak(rhythmEngine.currentStreak);

    const targetInterval = coachConfig.getTargetIntervalMs();
    const beatProgress = (elapsed % targetInterval) / targetInterval;
    uiComponents.updateBeatRing(beatProgress);

    uiComponents.updateScatterPlot(
      rhythmEngine.getRecentPresses(10),
      targetInterval
    );

    rhythmEngine.checkMissed(now);

    if (this.remainingTime <= 0) {
      stateMachine.transition(TRANSITIONS.FINISH);
      return;
    }

    this.animationFrameId = requestAnimationFrame(() => this.animationLoop());
  }

  handlePress(time) {
    const result = rhythmEngine.press(time);
    
    const targetInterval = coachConfig.getTargetIntervalMs();
    uiComponents.updateScatterPlot(
      rhythmEngine.getRecentPresses(10),
      targetInterval
    );
  }

  startMetronome() {
    if (!coachConfig.get('enableMetronome')) return;

    const interval = coachConfig.getTargetIntervalMs();
    const tick = () => {
      if (stateMachine.isTraining()) {
        audioPlayer.playMetronomeBeat();
        this.metronomeTimer = setTimeout(tick, interval);
      }
    };
    tick();
  }

  stopMetronome() {
    if (this.metronomeTimer) {
      clearTimeout(this.metronomeTimer);
      this.metronomeTimer = null;
    }
  }

  pauseTraining() {
    if (!stateMachine.isTraining()) return;
    
    this.pauseTime = performance.now();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    stateMachine.transition(TRANSITIONS.PAUSE);
  }

  resumeTraining() {
    if (!stateMachine.isPaused()) return;
    
    const pauseDuration = performance.now() - this.pauseTime;
    this.startTime += pauseDuration;
    
    stateMachine.transition(TRANSITIONS.RESUME);
    this.animationLoop();
  }

  resetTraining() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    stateMachine.transition(TRANSITIONS.RESET);
    this.resetUI();
  }

  resetToIdle() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    stateMachine.transition(TRANSITIONS.RESET);
    this.resetUI();
  }

  resetUI() {
    document.getElementById('setup-section').classList.remove('hidden');
    document.getElementById('countdown-section').classList.add('hidden');
    document.getElementById('training-section').classList.add('hidden');
    uiComponents.updateTimer(this.trainingDuration, this.trainingDuration);
    uiComponents.updateBPM(null);
    uiComponents.updateStreak(0);
  }

  finishTraining() {
    const score = rhythmEngine.calculateScore(this.trainingDuration);
    
    this.currentRecord = storageManager.addRecord(score, {
      durationMs: this.trainingDuration
    });

    audioPlayer.playFinishSound();
    
    uiComponents.renderResult(score);
    uiComponents.showScreen('result-screen');
  }

  enterCoachMode() {
    stateMachine.transition(TRANSITIONS.ENTER_COACH_MODE);
  }

  exitCoachMode() {
    stateMachine.transition(TRANSITIONS.EXIT_COACH_MODE);
  }

  saveCoachConfig() {
    const newConfig = {
      targetBPMLow: parseInt(document.getElementById('config-bpm-low').value, 10),
      targetBPMHigh: parseInt(document.getElementById('config-bpm-high').value, 10),
      errorToleranceMs: parseInt(document.getElementById('config-tolerance').value, 10),
      enableMetronome: document.getElementById('config-metronome').checked,
      enableMouseClick: document.getElementById('config-mouse').checked,
      metronomeVolume: parseFloat(document.getElementById('config-volume').value),
      historyLimit: parseInt(document.getElementById('config-history-limit').value, 10)
    };

    try {
      coachConfig.update(newConfig);
      uiComponents.hideConfigError();
      alert('配置已保存');
    } catch (e) {
      uiComponents.showConfigError(e.message);
    }
  }

  enterHistoryMode() {
    stateMachine.transition(TRANSITIONS.ENTER_HISTORY);
  }

  exitHistoryMode() {
    stateMachine.transition(TRANSITIONS.EXIT_HISTORY);
  }

  refreshHistory() {
    const history = storageManager.getHistory();
    const stats = storageManager.getStatistics();
    uiComponents.renderHistory(history, stats);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.cprTrainer = new CPRTrainer();
});
