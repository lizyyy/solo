import { GameStateManager, GameStates } from './GameStateManager.js';
import { LevelManager } from './LevelManager.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { ViolationSystem, ViolationTypes } from '../systems/ViolationSystem.js';
import { ScoringSystem } from '../systems/ScoringSystem.js';
import { ReplaySystem } from '../systems/ReplaySystem.js';

export class GameEngine {
  constructor() {
    this.stateManager = new GameStateManager();
    this.levelManager = new LevelManager();
    this.scoringSystem = new ScoringSystem();
    this.replaySystem = new ReplaySystem();
    
    this.grid = null;
    this.player = null;
    this.boxes = [];
    this.elevators = [];
    
    this.movementSystem = null;
    this.violationSystem = null;
    
    this.onStateChangeCallback = null;
    this.onUpdateCallback = null;
    this.onGameOverCallback = null;
  }

  initialize(levels) {
    this.levelManager.registerLevels(levels);
    this.stateManager.setState(GameStates.MENU);
  }

  startLevel(levelIndex = 0) {
    if (!this.levelManager.setCurrentLevel(levelIndex)) {
      return false;
    }

    const levelData = this.levelManager.buildCurrentLevel();
    
    this.grid = levelData.grid;
    this.player = levelData.player;
    this.boxes = levelData.boxes;
    this.elevators = levelData.elevators;
    
    this.movementSystem = new MovementSystem(
      this.grid, 
      this.player, 
      this.boxes, 
      this.elevators
    );
    
    this.violationSystem = new ViolationSystem(
      this.grid, 
      this.boxes, 
      this.elevators
    );
    
    this.scoringSystem.initialize(this.boxes.length);
    this.replaySystem.clear();
    
    this.recordReplayState('init');
    this.stateManager.setState(GameStates.PLAYING);
    this.notifyUpdate();
    
    return true;
  }

  restartLevel() {
    return this.startLevel(this.levelManager.getCurrentLevelIndex());
  }

  nextLevel() {
    if (this.levelManager.nextLevel()) {
      return this.startLevel(this.levelManager.getCurrentLevelIndex());
    }
    return false;
  }

  hasNextLevel() {
    return this.levelManager.getCurrentLevelIndex() < this.levelManager.getLevelCount() - 1;
  }

  handleInput(dx, dy) {
    if (!this.stateManager.canMove()) return false;

    const result = this.movementSystem.movePlayer(dx, dy);
    
    if (result.success) {
      if (result.type === 'move') {
        this.scoringSystem.recordMove();
      } else if (result.type === 'push') {
        this.scoringSystem.recordPush();
      }

      const violations = this.violationSystem.checkAllViolations(this.player);
      violations.forEach(v => {
        this.violationSystem.recordViolation(v);
        this.scoringSystem.recordViolation(v);
      });

      this.checkBoxStorage();
      this.recordReplayState(result.type, violations);
      this.checkWinCondition();
      this.checkLoseCondition();
      this.notifyUpdate();
      
      return true;
    }
    
    return false;
  }

  checkBoxStorage() {
    this.boxes.forEach(box => {
      if (this.grid.isStorage(box.x, box.y) && !box.inStorage) {
        box.inStorage = true;
        this.scoringSystem.recordBoxDelivery();
      }
    });
  }

  checkWinCondition() {
    const allBoxesInStorage = this.boxes.every(box => box.inStorage);
    
    if (allBoxesInStorage) {
      this.scoringSystem.applyPerfectBonus();
      this.stateManager.setState(GameStates.WIN);
      this.recordReplayState('win');
      
      if (this.onGameOverCallback) {
        this.onGameOverCallback(true, this.getGameSummary());
      }
    }
  }

  checkLoseCondition() {
    if (this.violationSystem.hasGameOverViolation()) {
      this.stateManager.setState(GameStates.LOSE);
      this.recordReplayState('lose');
      
      if (this.onGameOverCallback) {
        this.onGameOverCallback(false, this.getGameSummary());
      }
    }
  }

  recordReplayState(actionType, violations = []) {
    const state = {
      actionType,
      moveType: actionType,
      player: { x: this.player.x, y: this.player.y },
      boxes: this.boxes.map(b => ({ 
        x: b.x, 
        y: b.y, 
        id: b.id, 
        inStorage: b.inStorage 
      })),
      boxesDelivered: this.boxes.filter(b => b.inStorage).length,
      totalBoxes: this.boxes.length,
      score: this.scoringSystem.getScore(),
      violations: violations
    };
    
    this.replaySystem.recordState(state);
  }

  getGameSummary() {
    const stats = this.scoringSystem.getStats();
    const replaySummary = this.replaySystem.generateSummary();
    const grade = this.scoringSystem.getGrade();
    const violationSummary = this.scoringSystem.getViolationSummary();
    
    return {
      score: stats.finalScore,
      grade,
      moves: stats.moves,
      pushes: stats.pushes,
      boxesDelivered: stats.boxesDelivered,
      totalBoxes: stats.totalBoxes,
      violations: stats.violations,
      violationSummary,
      totalPenalty: this.violationSystem.getTotalPenalty(),
      replaySummary,
      levelName: this.levelManager.getCurrentLevel()?.name || 'Unknown',
      levelIndex: this.levelManager.getCurrentLevelIndex(),
      isWin: this.stateManager.getState() === GameStates.WIN,
      isLose: this.stateManager.getState() === GameStates.LOSE,
      hasPerfectBonus: stats.hasPerfectBonus
    };
  }

  getCurrentLevel() {
    return this.levelManager.getCurrentLevel();
  }

  getCurrentLevelIndex() {
    return this.levelManager.getCurrentLevelIndex();
  }

  getLevelCount() {
    return this.levelManager.getLevelCount();
  }

  getState() {
    return this.stateManager.getState();
  }

  getScore() {
    return this.scoringSystem.getScore();
  }

  notifyUpdate() {
    if (this.onUpdateCallback) {
      this.onUpdateCallback({
        state: this.getState(),
        grid: this.grid,
        player: this.player,
        boxes: this.boxes,
        elevators: this.elevators,
        score: this.getScore(),
        levelName: this.getCurrentLevel()?.name,
        levelIndex: this.getCurrentLevelIndex()
      });
    }
  }

  onUpdate(callback) {
    this.onUpdateCallback = callback;
  }

  onGameOver(callback) {
    this.onGameOverCallback = callback;
  }

  onStateChange(callback) {
    this.stateManager.onStateChange(callback);
  }
}
