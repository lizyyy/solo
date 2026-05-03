import SceneManager from './scene/SceneManager.js';
import LevelLoader from './level/LevelLoader.js';
import Vehicle from './vehicle/Vehicle.js';
import RulesEngine from './rules/RulesEngine.js';
import SimulationClock from './simulation/SimulationClock.js';
import SaveManager from './save/SaveManager.js';
import ScoringSystem from './scoring/ScoringSystem.js';
import UIController from './ui/UIController.js';

class ForkliftTrainingSimulator {
  constructor() {
    this.sceneManager = null;
    this.levelLoader = null;
    this.vehicle = null;
    this.rulesEngine = null;
    this.simulationClock = null;
    this.saveManager = null;
    this.scoringSystem = null;
    this.uiController = null;
    
    this.isInitialized = false;
    this.isPaused = true;
    this.speedMultiplier = 1.0;
    this.currentLevel = null;
    this.history = [];
  }

  async init() {
    try {
      this.sceneManager = new SceneManager();
      await this.sceneManager.init();
      
      this.levelLoader = new LevelLoader();
      this.simulationClock = new SimulationClock();
      this.saveManager = new SaveManager();
      this.scoringSystem = new ScoringSystem();
      this.rulesEngine = new RulesEngine(this.scoringSystem);
      this.uiController = new UIController(this);
      
      this.setupEventListeners();
      
      await this.loadLevel('/levels/level1.json');
      
      this.isInitialized = true;
      this.startSimulation();
      
      console.log('叉车演练台初始化完成');
    } catch (error) {
      console.error('初始化失败:', error);
      alert('系统初始化失败，请刷新页面重试');
    }
  }

  async loadLevel(levelPath) {
    try {
      this.currentLevel = await this.levelLoader.load(levelPath);
      
      this.sceneManager.clearLevel();
      this.sceneManager.buildLevel(this.currentLevel);
      
      if (this.vehicle) {
        this.vehicle.dispose();
      }
      
      this.vehicle = new Vehicle(
        this.currentLevel.vehicle.startPosition,
        this.currentLevel.vehicle.startRotation
      );
      this.sceneManager.addVehicle(this.vehicle);
      
      this.rulesEngine.setLevel(this.currentLevel);
      this.rulesEngine.setVehicle(this.vehicle);
      
      this.scoringSystem.reset();
      this.scoringSystem.setLevel(this.currentLevel);
      
      this.history = [];
      
      this.uiController.updateLevelInfo(this.currentLevel);
      
      console.log(`关卡加载完成: ${this.currentLevel.name}`);
    } catch (error) {
      console.error('关卡加载失败:', error);
      throw error;
    }
  }

  startSimulation() {
    this.isPaused = false;
    this.simulationClock.start();
    this.sceneManager.startAnimation(this.update.bind(this));
  }

  pauseSimulation() {
    this.isPaused = !this.isPaused;
    this.uiController.updatePauseButton(this.isPaused);
  }

  setSpeedMultiplier(multiplier) {
    this.speedMultiplier = multiplier;
    this.simulationClock.setSpeed(multiplier);
    this.uiController.updateSpeedDisplay(multiplier);
  }

  undoLastAction() {
    if (this.history.length === 0) {
      return;
    }
    
    const lastState = this.history.pop();
    this.vehicle.restoreState(lastState.vehicleState);
    this.simulationClock.setTime(lastState.simulationTime);
    this.scoringSystem.restoreState(lastState.scoringState);
    
    this.uiController.showNotification('已撤销上一步操作');
  }

  saveCurrentState() {
    const state = {
      vehicleState: this.vehicle.getState(),
      simulationTime: this.simulationClock.getElapsedTime(),
      scoringState: this.scoringSystem.getState(),
      timestamp: Date.now()
    };
    this.history.push(state);
  }

  update(deltaTime) {
    if (this.isPaused) {
      return;
    }
    
    const scaledDelta = deltaTime * this.speedMultiplier;
    
    this.simulationClock.update(scaledDelta);
    
    if (this.vehicle) {
      this.vehicle.update(scaledDelta);
    }
    
    const violations = this.rulesEngine.checkAll(this.simulationClock.getElapsedTime());
    
    if (violations.length > 0) {
      this.uiController.showViolations(violations);
      violations.forEach(v => {
        this.scoringSystem.addViolation(v);
      });
    }
    
    this.checkTaskCompletion();
    
    this.uiController.updateSimulationTime(this.simulationClock.getElapsedTime());
    this.uiController.updateScore(this.scoringSystem.getCurrentScore());
    
    if (this.vehicle.isMoving()) {
      this.saveCurrentState();
    }
  }

  checkTaskCompletion() {
    const tasks = this.currentLevel.tasks;
    let allCompleted = true;
    
    tasks.forEach(task => {
      if (!task.completed) {
        const taskStatus = this.rulesEngine.checkTask(task, this.vehicle);
        if (taskStatus.completed) {
          task.completed = true;
          this.scoringSystem.addTaskCompletion(task);
          this.uiController.showNotification(`任务完成: ${task.description}`);
        } else {
          allCompleted = false;
        }
      }
    });
    
    if (allCompleted && !this.scoringSystem.isCompleted()) {
      this.completeSimulation();
    }
  }

  completeSimulation() {
    this.isPaused = true;
    const finalScore = this.scoringSystem.calculateFinalScore();
    const result = {
      score: finalScore,
      elapsedTime: this.simulationClock.getElapsedTime(),
      violations: this.scoringSystem.getViolations(),
      completedTasks: this.currentLevel.tasks.filter(t => t.completed).length,
      totalTasks: this.currentLevel.tasks.length,
      timestamp: Date.now(),
      levelName: this.currentLevel.name
    };
    
    this.uiController.showResult(result);
    this.exportResult(result);
  }

  async saveProgress() {
    const saveData = {
      level: this.currentLevel,
      vehicleState: this.vehicle.getState(),
      simulationTime: this.simulationClock.getElapsedTime(),
      scoringState: this.scoringSystem.getState(),
      history: this.history,
      timestamp: Date.now()
    };
    
    try {
      await this.saveManager.save('current_progress', saveData);
      this.uiController.showNotification('进度已保存');
    } catch (error) {
      console.error('保存失败:', error);
      this.uiController.showNotification('保存失败', 'error');
    }
  }

  async loadProgress() {
    try {
      const saveData = await this.saveManager.load('current_progress');
      if (!saveData) {
        this.uiController.showNotification('没有找到保存的进度', 'warning');
        return;
      }
      
      this.currentLevel = saveData.level;
      this.vehicle.restoreState(saveData.vehicleState);
      this.simulationClock.setTime(saveData.simulationTime);
      this.scoringSystem.restoreState(saveData.scoringState);
      this.history = saveData.history;
      
      this.sceneManager.clearLevel();
      this.sceneManager.buildLevel(this.currentLevel);
      this.sceneManager.addVehicle(this.vehicle);
      
      this.rulesEngine.setLevel(this.currentLevel);
      this.rulesEngine.setVehicle(this.vehicle);
      
      this.uiController.updateLevelInfo(this.currentLevel);
      this.uiController.showNotification('进度已加载');
    } catch (error) {
      console.error('加载失败:', error);
      this.uiController.showNotification('加载失败', 'error');
    }
  }

  exportResult(result) {
    this.saveManager.exportJSON('training_result', result);
  }

  setupEventListeners() {
    window.addEventListener('resize', () => {
      this.sceneManager.onWindowResize();
    });
  }

  getVehicle() {
    return this.vehicle;
  }

  getCurrentLevel() {
    return this.currentLevel;
  }
}

const simulator = new ForkliftTrainingSimulator();
simulator.init();

export default simulator;
