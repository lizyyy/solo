import { levelLoader } from './levelLoader.js';
import { stateMachine } from './stateMachine.js';
import { rulesEngine } from './rulesEngine.js';
import { saveManager } from './saveManager.js';
import { leaderboard } from './leaderboard.js';
import { ui } from './ui.js';
import { debounce } from './utils.js';

class Game {
  constructor() {
    this.currentLevel = null;
    this.currentLevelId = 'level-1';
    this.isInitialized = false;
  }

  async init() {
    ui.init();
    this.bindUIEvents();
    this.isInitialized = true;
    
    try {
      await this.loadLevel(this.currentLevelId);
    } catch (error) {
      console.error('初始关卡加载失败:', error);
      ui.showMessage('关卡加载失败，请重试', 'error');
    }
  }

  bindUIEvents() {
    ui.on('startGame', () => {
      console.log('游戏开始');
    });
    
    ui.on('undo', () => this.undo());
    ui.on('redo', () => this.redo());
    ui.on('save', () => this.saveGame());
    ui.on('load', () => this.showLoadDialog());
    ui.on('restart', () => this.restartLevel());
    ui.on('showLevels', () => this.showLevelsDialog());
    
    ui.on('submit', () => this.submitSolution());
    ui.on('clear', () => this.clearSchedule());
    ui.on('showLeaderboard', () => this.showLeaderboard());
    
    ui.on('dropTask', (data) => this.handleDropTask(data));
    ui.on('removeTask', (data) => this.handleRemoveTask(data));
    
    ui.on('selectLevel', (levelId) => this.loadLevel(levelId));
    ui.on('nextLevel', () => this.nextLevel());
    
    ui.on('loadSave', (saveId) => this.loadSave(saveId));
    ui.on('deleteSave', (saveId) => this.deleteSave(saveId));
    
    stateMachine.on('scheduleTask', () => this.onStateChange());
    stateMachine.on('unscheduleTask', () => this.onStateChange());
    stateMachine.on('moveTask', () => this.onStateChange());
    stateMachine.on('clearAll', () => this.onStateChange());
    stateMachine.on('undo', () => this.onStateChange());
    stateMachine.on('redo', () => this.onStateChange());
  }

  async loadLevel(levelId) {
    try {
      const level = await levelLoader.loadLevel(levelId);
      this.currentLevel = level;
      this.currentLevelId = levelId;
      
      stateMachine.init(level);
      this.renderGame();
      
      ui.showMessage(`已加载关卡: ${level.name}`, 'success');
    } catch (error) {
      console.error('加载关卡失败:', error);
      ui.showMessage(error.message || '加载关卡失败', 'error');
    }
  }

  renderGame() {
    const state = stateMachine.getState();
    
    ui.updateHeader(state, this.currentLevel);
    ui.renderTaskList(state.tasks);
    ui.renderSchedulerGrid(state);
    
    this.updateRulesEngine();
  }

  updateRulesEngine = debounce(() => {
    const state = stateMachine.getState();
    rulesEngine.setState(state);
    
    const validation = rulesEngine.validateScheduling();
    const batteryCheck = rulesEngine.checkBatteryStatus();
    const coverageCheck = rulesEngine.checkCoverage();
    
    ui.updateStatusPanel(validation, batteryCheck, coverageCheck);
    ui.updatePriorityList(state.tasks);
    ui.updateCoverageStatus(state.tasks);
    ui.updateConflicts(validation.conflicts);
    
    const score = rulesEngine.calculateScore();
    stateMachine.setScore(score.total);
    ui.updateHeader(stateMachine.getState(), this.currentLevel);
  }, 200);

  onStateChange() {
    this.renderGame();
  }

  handleDropTask(data) {
    const { task, channel, slot } = data;
    
    try {
      const existingTask = stateMachine.getTaskAt(channel, slot);
      
      if (existingTask) {
        if (task.scheduled) {
          stateMachine.moveTask(task.id, channel, slot);
        } else {
          ui.showMessage('该位置已有任务', 'warning');
        }
      } else {
        if (task.scheduled) {
          stateMachine.moveTask(task.id, channel, slot);
        } else {
          stateMachine.scheduleTask(task.id, channel, slot);
        }
      }
    } catch (error) {
      console.error('调度任务失败:', error);
      ui.showMessage(error.message, 'error');
    }
  }

  handleRemoveTask(data) {
    const { taskId } = data;
    
    try {
      stateMachine.unscheduleTask(taskId);
    } catch (error) {
      console.error('移除任务失败:', error);
      ui.showMessage(error.message, 'error');
    }
  }

  undo() {
    const result = stateMachine.undo();
    if (!result) {
      ui.showMessage('无法撤销', 'warning');
    }
  }

  redo() {
    const result = stateMachine.redo();
    if (!result) {
      ui.showMessage('无法重做', 'warning');
    }
  }

  clearSchedule() {
    try {
      stateMachine.clearAll();
      ui.showMessage('已清空调度', 'info');
    } catch (error) {
      console.error('清空失败:', error);
      ui.showMessage(error.message, 'error');
    }
  }

  restartLevel() {
    this.loadLevel(this.currentLevelId);
  }

  nextLevel() {
    const levelIds = levelLoader.getAvailableLevels();
    const currentIndex = levelIds.indexOf(this.currentLevelId);
    
    if (currentIndex < levelIds.length - 1) {
      const nextLevelId = levelIds[currentIndex + 1];
      ui.hideModal('report');
      this.loadLevel(nextLevelId);
    } else {
      ui.showMessage('已是最后一关！', 'info');
    }
  }

  saveGame() {
    const state = stateMachine.getState();
    const result = saveManager.saveGame(state, this.currentLevelId, {
      levelName: this.currentLevel?.name
    });
    
    if (result.success) {
      ui.showSaveSuccess();
    } else {
      ui.showMessage(result.error || '保存失败', 'error');
    }
  }

  showLoadDialog() {
    const saves = saveManager.getAllSaves();
    ui.renderSaveList(saves);
  }

  async loadSave(saveId) {
    const result = saveManager.loadGame(saveId);
    
    if (result.success) {
      try {
        await levelLoader.loadLevel(result.save.levelId);
        this.currentLevelId = result.save.levelId;
        this.currentLevel = levelLoader.getCurrentLevel();
        
        const state = result.save.state;
        
        state.tasks.forEach(task => {
          if (task.scheduled) {
            try {
              stateMachine.scheduleTask(task.id, task.scheduled.channel, task.scheduled.slot);
            } catch (e) {
              console.log('任务调度跳过:', task.id);
            }
          }
        });
        
        this.renderGame();
        
        if (result.warning) {
          ui.showMessage(result.warning, 'warning');
        } else {
          ui.showMessage('存档已加载', 'success');
        }
      } catch (error) {
        console.error('加载存档失败:', error);
        ui.showMessage('加载存档时关卡数据无效', 'error');
      }
    } else {
      ui.showMessage(result.error, 'error');
    }
  }

  deleteSave(saveId) {
    const result = saveManager.deleteSave(saveId);
    
    if (result.success) {
      const saves = saveManager.getAllSaves();
      ui.renderSaveList(saves);
      ui.showMessage('存档已删除', 'info');
    } else {
      ui.showMessage(result.error, 'error');
    }
  }

  async showLevelsDialog() {
    const levelIds = levelLoader.getAvailableLevels();
    const levels = [];
    
    for (const id of levelIds) {
      try {
        const info = await levelLoader.getLevelInfo(id);
        levels.push(info);
      } catch (error) {
        console.error(`获取关卡信息失败 [${id}]:`, error);
      }
    }
    
    ui.renderLevelsList(levels, this.currentLevelId);
  }

  showLeaderboard() {
    const levelScores = leaderboard.getLevelScores(this.currentLevelId);
    const overallRanking = leaderboard.getOverallRanking();
    ui.renderLeaderboard(levelScores, overallRanking, this.currentLevelId);
  }

  submitSolution() {
    const state = stateMachine.getState();
    rulesEngine.setState(state);
    
    const report = rulesEngine.generateReport();
    const level = levelLoader.getCurrentLevel();
    
    ui.renderReport(report, level);
    stateMachine.complete();
    
    const result = leaderboard.addScore(
      this.currentLevelId,
      report.score,
      '玩家',
      {
        scheduledTasks: report.stats.scheduledTasks,
        conflicts: report.validation.conflicts.length
      }
    );
    
    if (result.isNewHighScore) {
      ui.showMessage('🎉 新纪录！', 'success');
    }
  }
}

const game = new Game();

document.addEventListener('DOMContentLoaded', () => {
  game.init();
});

export default game;
