/**
 * 游戏主逻辑模块
 * 协调所有游戏系统，管理游戏状态和流程
 */

import { Patient, PatientState, TriageLevel } from './patient.js';
import { Scheduler } from './scheduler.js';
import { ResourceManager, ActionManager, ActionDefinitions } from './actions.js';
import { ScoreManager, ReplayManager } from './scoring.js';
import { LevelValidator, validateLevel } from './validator.js';
import { storageManager } from './storage.js';
import { ReportGenerator } from './reporter.js';
import { GameUI } from './ui.js';

class Game {
  constructor() {
    this.state = 'idle';
    this.currentLevel = null;
    this.levels = {};
    this.patients = new Map();
    
    this.scheduler = null;
    this.resourceManager = null;
    this.actionManager = null;
    this.scoreManager = null;
    this.replayManager = null;
    this.reportGenerator = null;
    this.ui = null;

    this.init();
  }

  async init() {
    this.ui = new GameUI(this);
    this.scoreManager = new ScoreManager();
    this.replayManager = new ReplayManager();
    this.reportGenerator = new ReportGenerator();

    await this.loadBuiltInLevels();
    this.loadCustomLevels();
    this.checkSavedGame();

    window.game = this;
  }

  async loadBuiltInLevels() {
    try {
      const levelFiles = ['level1.json', 'level2.json', 'level3.json'];
      
      for (const filename of levelFiles) {
        try {
          const response = await fetch(`/levels/${filename}`);
          if (response.ok) {
            const levelData = await response.json();
            const validation = validateLevel(levelData);
            if (validation.valid) {
              this.levels[levelData.id] = levelData;
            } else {
              console.error(`关卡 ${filename} 验证失败:`, validation.errors);
            }
          }
        } catch (error) {
          console.error(`加载关卡 ${filename} 失败:`, error);
        }
      }
    } catch (error) {
      console.error('加载内置关卡失败:', error);
    }
  }

  loadCustomLevels() {
    const customLevels = storageManager.getCustomLevels();
    customLevels.forEach(level => {
      const validation = validateLevel(level);
      if (validation.valid) {
        this.levels[level.id] = level;
      }
    });
  }

  checkSavedGame() {
    if (storageManager.hasSavedGame()) {
      this.ui.showSavedGameDialog();
    }
  }

  getAvailableLevels() {
    return Object.values(this.levels);
  }

  selectLevel(levelId) {
    if (!this.levels[levelId]) {
      return { success: false, message: '关卡不存在' };
    }
    this.currentLevel = this.levels[levelId];
    return { success: true, level: this.currentLevel };
  }

  async importLevel(levelData) {
    const validation = validateLevel(levelData);
    
    if (!validation.valid) {
      this.ui.showValidationErrors(validation.errors);
      return { success: false, validation: validation };
    }

    if (this.levels[levelData.id]) {
      const result = await this.confirmOverwrite(levelData.id);
      if (!result) {
        return { success: false, message: '用户取消覆盖' };
      }
    }

    this.levels[levelData.id] = levelData;
    storageManager.saveCustomLevel(levelData);

    return { success: true, message: '关卡导入成功' };
  }

  async confirmOverwrite(levelId) {
    return new Promise((resolve) => {
      const confirmed = confirm(`关卡 "${levelId}" 已存在，是否覆盖？`);
      resolve(confirmed);
    });
  }

  startGame(levelId = null) {
    if (levelId) {
      const result = this.selectLevel(levelId);
      if (!result.success) {
        this.ui.showNotification('请先选择一个关卡', 'error');
        return;
      }
    }

    if (!this.currentLevel) {
      const levels = this.getAvailableLevels();
      if (levels.length > 0) {
        this.selectLevel(levels[0].id);
      } else {
        this.ui.showNotification('没有可用的关卡', 'error');
        return;
      }
    }

    this.resetGame();
    this.initGameSystems();
    this.setupEventListeners();
    this.schedulePatientArrivals();

    this.state = 'playing';
    this.replayManager.startRecording();
    this.scheduler.start();

    this.ui.closeAllModals();
    this.ui.showNotification('游戏开始！', 'info');
  }

  resetGame() {
    this.patients.clear();
    this.scoreManager.reset();
    this.replayManager.reset();
  }

  initGameSystems() {
    const level = this.currentLevel;

    this.scheduler = new Scheduler({
      duration: level.duration,
      tickRate: 1000,
      gameSpeed: 1
    });

    this.resourceManager = new ResourceManager({
      resources: level.resources
    });

    this.actionManager = new ActionManager(this.resourceManager);
  }

  setupEventListeners() {
    this.scheduler.addTickListener((currentTime, deltaTime) => {
      this.onTick(currentTime, deltaTime);
    });

    this.scheduler.addEventListener('timeUp', () => {
      this.endGame();
    });

    this.resourceManager.addResourceListener(() => {
      this.ui.renderResourceStatus();
    });

    this.actionManager.addActionListener((event, data) => {
      this.onActionEvent(event, data);
    });
  }

  schedulePatientArrivals() {
    const level = this.currentLevel;
    
    level.patients.forEach(patientData => {
      this.scheduler.scheduleEvent(patientData.arrivalTime, 'patient_arrival', {
        patientData: patientData
      });
    });

    this.scheduler.addEventListener('patient_arrival', (data) => {
      this.addPatient(data.patientData);
    });
  }

  addPatient(patientData) {
    const patient = new Patient(patientData);
    
    patient.addUpdateListener(() => {
      this.autoSave();
    });

    this.patients.set(patient.id, patient);
    this.replayManager.recordPatientArrival(patient);

    this.ui.showNotification(`新患者到达: ${patient.chiefComplaint}`, 'warning');
    this.ui.render();
  }

  getPatient(patientId) {
    return this.patients.get(patientId);
  }

  onTick(currentTime, deltaTime) {
    for (const patient of this.patients.values()) {
      patient.updateWaitTime(deltaTime);
    }

    this.actionManager.update(deltaTime);
    this.ui.render();
    this.autoSave();
  }

  onActionEvent(event, data) {
    if (event === 'complete') {
      const action = data.action;
      const patient = this.getPatient(action.patientId);
      
      if (patient) {
        patient.completeAction(action.actionType, data.successful);
        
        const actionDef = ActionDefinitions[action.actionType];
        this.replayManager.recordActionComplete(patient, action.actionType, data.successful);
        this.scoreManager.evaluateAction(patient, action.actionType, data.successful, actionDef);
      }
    }
  }

  performTriage(patientId, triageLevel) {
    const patient = this.getPatient(patientId);
    if (!patient) {
      return { success: false, message: '患者不存在' };
    }

    const result = patient.triage(triageLevel);
    
    if (result.success) {
      const wasCorrect = triageLevel === patient.correctTriage;
      this.replayManager.recordTriage(patient, triageLevel, wasCorrect);
      this.scoreManager.evaluateTriage(patient, triageLevel);

      if (wasCorrect) {
        this.ui.showNotification(`分诊正确: ${patient.id} → ${triageLevel}`, 'success');
      } else {
        this.ui.showNotification(`分诊错误: ${patient.id}`, 'error');
      }
    }

    this.ui.render();
    return result;
  }

  canPerformAction(patient, actionType) {
    if (!patient) {
      return { success: false, message: '患者不存在' };
    }

    return this.actionManager.canPerformAction(patient, actionType);
  }

  performAction(patientId, actionType) {
    const patient = this.getPatient(patientId);
    if (!patient) {
      return { success: false, message: '患者不存在' };
    }

    const canPerform = this.canPerformAction(patient, actionType);
    if (!canPerform.success) {
      this.ui.showNotification(canPerform.message, 'error');
      return canPerform;
    }

    const result = this.actionManager.startAction(patient, actionType);
    
    if (result.success) {
      const actionDef = ActionDefinitions[actionType];
      this.replayManager.recordActionStart(patient, actionType, actionDef?.requiredResources || []);
      this.ui.showNotification(`开始: ${actionDef?.name || actionType}`, 'info');
    }

    this.ui.render();
    return result;
  }

  getPatientQueues() {
    const queues = {
      pending: [],
      red: [],
      yellow: [],
      green: [],
      observation: []
    };

    for (const patient of this.patients.values()) {
      if (patient.state === PatientState.DISCHARGED || 
          patient.state === PatientState.DECEASED) {
        continue;
      }

      if (patient.state === PatientState.PENDING) {
        queues.pending.push(patient);
      } else if (patient.currentTriage) {
        const queueMap = {
          [TriageLevel.RED]: 'red',
          [TriageLevel.YELLOW]: 'yellow',
          [TriageLevel.GREEN]: 'green',
          [TriageLevel.OBSERVATION]: 'observation'
        };
        const queueKey = queueMap[patient.currentTriage];
        if (queueKey && queues[queueKey]) {
          queues[queueKey].push(patient);
        }
      }
    }

    return queues;
  }

  getPatientCounts() {
    let pending = 0;
    let active = 0;
    let completed = 0;

    for (const patient of this.patients.values()) {
      if (patient.state === PatientState.PENDING) {
        pending++;
      } else if (patient.state === PatientState.DISCHARGED || 
                 patient.state === PatientState.DECEASED) {
        completed++;
      } else {
        active++;
      }
    }

    return { pending, active, completed };
  }

  getResourceStatus() {
    return this.resourceManager?.getResourceStatus() || {};
  }

  getScore() {
    return this.scoreManager?.getScore() || 0;
  }

  getScoreDetails() {
    return this.scoreManager?.getScoreDetails() || [];
  }

  getFormattedTime() {
    return this.scheduler?.getFormattedCurrentTime() || '00:00';
  }

  togglePause() {
    if (!this.scheduler) return;

    if (this.state === 'playing') {
      this.scheduler.pause();
      this.state = 'paused';
      this.ui.showNotification('游戏已暂停', 'info');
    } else if (this.state === 'paused') {
      this.scheduler.resume();
      this.state = 'playing';
      this.ui.showNotification('游戏继续', 'info');
    }
  }

  endGame() {
    if (this.state === 'ended') return;

    this.state = 'ended';
    this.scheduler.stop();
    this.replayManager.stopRecording();

    const scoreData = this.scoreManager.toJSON();
    const replayData = this.replayManager.toJSON();
    const patientData = Array.from(this.patients.values()).map(p => p.toJSON());
    const errorAnalysis = this.replayManager.getErrorAnalysis();

    const results = {
      score: scoreData.score,
      rating: scoreData.rating,
      scoreData: scoreData,
      replayData: replayData,
      patientData: patientData,
      errorAnalysis: errorAnalysis,
      level: this.currentLevel
    };

    storageManager.saveLevelResult(this.currentLevel.id, {
      score: scoreData.score,
      rating: scoreData.rating,
      timestamp: Date.now()
    });

    storageManager.saveHighScore(
      this.currentLevel.id,
      scoreData.score,
      scoreData.rating
    );

    storageManager.clearSavedGame();

    this.reportGenerator.setLevelInfo(this.currentLevel);
    this.reportGenerator.setScoreData(scoreData);
    this.reportGenerator.setReplayData(replayData);
    this.reportGenerator.setPatientData(patientData);

    this.ui.showGameOverModal(results);
  }

  restartGame() {
    this.scheduler?.stop();
    this.startGame();
  }

  autoSave() {
    if (this.state !== 'playing') return;

    const gameState = {
      state: this.state,
      currentLevelId: this.currentLevel?.id,
      schedulerState: this.scheduler?.toJSON(),
      patients: Array.from(this.patients.values()).map(p => p.toJSON()),
      score: this.scoreManager?.getScore(),
      scoreDetails: this.scoreManager?.getScoreDetails(),
      replayEvents: this.replayManager?.getEvents()
    };

    storageManager.saveGameState(gameState);
  }

  restoreGame(savedState) {
    if (!savedState.currentLevelId || !this.levels[savedState.currentLevelId]) {
      return { success: false, message: '无法恢复：关卡不存在' };
    }

    this.currentLevel = this.levels[savedState.currentLevelId];
    this.resetGame();
    this.initGameSystems();

    if (savedState.schedulerState) {
      this.scheduler.fromJSON(savedState.schedulerState);
    }

    if (savedState.patients) {
      savedState.patients.forEach(patientData => {
        const patient = new Patient(patientData);
        patient.state = patientData.state;
        patient.currentTriage = patientData.currentTriage;
        patient.waitTime = patientData.waitTime;
        patient.familyStress = patientData.familyStress;
        patient.completedActions = patientData.completedActions || [];
        patient.currentAction = patientData.currentAction;
        patient.hasDeteriorated = patientData.hasDeteriorated;
        patient.triageErrors = patientData.triageErrors || [];
        patient.actionErrors = patientData.actionErrors || [];
        patient.isolationPerformed = patientData.isolationPerformed;

        this.patients.set(patient.id, patient);
      });
    }

    if (savedState.scoreDetails) {
      savedState.scoreDetails.forEach(detail => {
        this.scoreManager.addPoints(detail.points, detail.reason, detail.details);
      });
    }

    this.setupEventListeners();
    this.state = savedState.state;

    this.ui.closeAllModals();
    this.ui.render();
    this.ui.showNotification('游戏已恢复', 'success');

    return { success: true };
  }

  exportReport() {
    this.reportGenerator.downloadReport();
    this.ui.showNotification('报告已下载', 'success');
  }

  getReport() {
    return this.reportGenerator.generateReport();
  }
}

let gameInstance = null;

function getGame() {
  if (!gameInstance) {
    gameInstance = new Game();
  }
  return gameInstance;
}

const game = getGame();

export { Game, game, getGame };
