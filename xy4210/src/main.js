/**
 * 救援调度夜班 - 主入口文件
 * 整合所有模块，处理游戏主逻辑
 */

import {
  GameStatus,
  UnitStatus,
  EventStatus,
  EventType,
  DefaultGameConfig
} from './types/index.js';

import {
  createInitialState,
  createStateFromLevel,
  updateGameState,
  drawEventCard,
  createEvent,
  getActiveEvents
} from './state/gameState.js';

import {
  findPath
} from './pathfinding/pathfinder.js';

import {
  moveUnit,
  assignUnitToEvent,
  startUnitWork,
  cancelUnitTask
} from './units/unitManager.js';

import {
  canUnitHandleEvent
} from './rules/gameRules.js';

import {
  saveGame,
  loadGame,
  hasSave,
  getSaveInfo
} from './storage/saveManager.js';

import {
  createReplayHistory,
  recordReplayStep,
  ReplayController
} from './replay/replayManager.js';

import {
  renderMap,
  highlightPath
} from './ui/mapRenderer.js';

import {
  updateAllUI,
  showGameOverModal,
  hideGameOverModal,
  showReplayModal,
  hideReplayModal
} from './ui/uiManager.js';

import {
  TutorialLevel
} from './data/levels/tutorial.js';

/**
 * 游戏主类
 */
class Game {
  constructor() {
    this.gameState = null;
    this.replayHistory = null;
    this.selectedUnit = null;
    this.selectedEvent = null;
    this.currentPath = null;
    this.isGameOver = false;
    
    this.init();
  }

  /**
   * 初始化游戏
   */
  init() {
    // 检查是否有存档
    if (hasSave()) {
      const saveInfo = getSaveInfo();
      console.log('检测到存档:', saveInfo);
    }
    
    // 开始新游戏
    this.startNewGame();
    
    // 绑定事件
    this.bindEvents();
  }

  /**
   * 开始新游戏
   */
  startNewGame() {
    // 使用教程关卡
    this.gameState = createStateFromLevel(TutorialLevel);
    this.replayHistory = createReplayHistory();
    this.selectedUnit = null;
    this.selectedEvent = null;
    this.currentPath = null;
    this.isGameOver = false;
    
    // 添加初始日志
    this.gameState.log.push({
      type: 'turn',
      message: '游戏开始！欢迎来到救援调度夜班。',
      turn: this.gameState.turn
    });
    
    // 记录初始状态到回放历史
    this.replayHistory = recordReplayStep(
      this.replayHistory,
      this.gameState,
      '游戏开始'
    );
    
    // 渲染UI
    this.render();
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 地图点击
    const mapContainer = document.getElementById('game-map');
    
    // 抽取事件按钮
    const drawEventBtn = document.getElementById('draw-event-btn');
    if (drawEventBtn) {
      drawEventBtn.addEventListener('click', () => this.handleDrawEvent());
    }
    
    // 下一回合按钮
    const nextTurnBtn = document.getElementById('next-turn-btn');
    if (nextTurnBtn) {
      nextTurnBtn.addEventListener('click', () => this.handleNextTurn());
    }
    
    // 保存按钮
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSave());
    }
    
    // 加载按钮
    const loadBtn = document.getElementById('load-btn');
    if (loadBtn) {
      loadBtn.addEventListener('click', () => this.handleLoad());
    }
    
    // 回放按钮
    const replayBtn = document.getElementById('replay-btn');
    if (replayBtn) {
      replayBtn.addEventListener('click', () => this.handleReplay());
    }
    
    // 重新开始按钮
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.handleRestart());
    }
  }

  /**
   * 处理抽取事件
   */
  handleDrawEvent() {
    if (this.isGameOver) return;
    
    // 从牌堆抽取事件
    const card = drawEventCard(this.gameState);
    
    if (!card) {
      return;
    }
    
    // 随机选择一个位置（避开建筑和已有事件）
    const position = this.getRandomEventPosition();
    
    if (!position) {
      this.gameState.log.push({
        type: 'warning',
        message: '没有可用的位置生成新事件',
        turn: this.gameState.turn
      });
      this.render();
      return;
    }
    
    // 创建事件
    const event = createEvent(card, position, this.gameState.config);
    
    // 添加到游戏状态
    this.gameState.events.push(event);
    
    // 标记地图位置
    const cell = this.gameState.map[position.y][position.x];
    cell.eventId = event.id;
    
    // 添加日志
    this.gameState.log.push({
      type: 'event',
      message: `新事件: ${event.description} 在位置 (${position.x}, ${position.y})`,
      turn: this.gameState.turn
    });
    
    // 记录到回放历史
    this.replayHistory = recordReplayStep(
      this.replayHistory,
      this.gameState,
      `抽取事件: ${event.description}`
    );
    
    this.render();
  }

  /**
   * 获取随机事件位置
   * @returns {Object|null} 位置对象
   */
  getRandomEventPosition() {
    const { map, config, events } = this.gameState;
    const availablePositions = [];
    
    for (let y = 0; y < config.mapHeight; y++) {
      for (let x = 0; x < config.mapWidth; x++) {
        const cell = map[y][x];
        
        // 检查是否是道路且没有事件且没有被堵塞
        if (
          cell.type !== 'building' && 
          !cell.isBlocked && 
          !cell.eventId
        ) {
          // 检查是否已有事件在这个位置
          const hasEvent = events.some(e => 
            e.position.x === x && 
            e.position.y === y && 
            e.status === EventStatus.ACTIVE
          );
          
          if (!hasEvent) {
            availablePositions.push({ x, y });
          }
        }
      }
    }
    
    if (availablePositions.length === 0) {
      return null;
    }
    
    // 随机选择一个位置
    const randomIndex = Math.floor(Math.random() * availablePositions.length);
    return availablePositions[randomIndex];
  }

  /**
   * 处理下一回合
   */
  handleNextTurn() {
    if (this.isGameOver) return;
    
    // 自动抽取事件（每回合自动抽取）
    const drawsPerTurn = this.gameState.config.eventDrawsPerTurn;
    for (let i = 0; i < drawsPerTurn; i++) {
      const card = drawEventCard(this.gameState);
      if (card) {
        const position = this.getRandomEventPosition();
        if (position) {
          const event = createEvent(card, position, this.gameState.config);
          this.gameState.events.push(event);
          
          const cell = this.gameState.map[position.y][position.x];
          cell.eventId = event.id;
          
          this.gameState.log.push({
            type: 'event',
            message: `新事件: ${event.description} 在位置 (${position.x}, ${position.y})`,
            turn: this.gameState.turn
          });
        }
      }
    }
    
    // 更新游戏状态
    this.gameState = updateGameState(this.gameState);
    
    // 添加回合日志
    this.gameState.log.push({
      type: 'turn',
      message: `--- 第 ${this.gameState.turn} 回合 ---`,
      turn: this.gameState.turn
    });
    
    // 记录到回放历史
    this.replayHistory = recordReplayStep(
      this.replayHistory,
      this.gameState,
      `进入第 ${this.gameState.turn} 回合`
    );
    
    // 检查游戏结束
    if (this.gameState.status !== GameStatus.PLAYING) {
      this.isGameOver = true;
      this.render();
      
      // 显示游戏结束模态框
      showGameOverModal(this.gameState, () => {
        this.startNewGame();
      });
      return;
    }
    
    this.render();
  }

  /**
   * 处理保存
   */
  handleSave() {
    const success = saveGame(this.gameState, this.replayHistory);
    
    if (success) {
      this.gameState.log.push({
        type: 'action',
        message: '游戏已保存',
        turn: this.gameState.turn
      });
      alert('游戏保存成功！');
    } else {
      alert('保存失败，请检查浏览器存储权限。');
    }
    
    this.render();
  }

  /**
   * 处理加载
   */
  handleLoad() {
    const saveData = loadGame();
    
    if (!saveData) {
      alert('没有找到存档！');
      return;
    }
    
    if (confirm('确定要加载存档吗？当前游戏进度将丢失。')) {
      this.gameState = saveData.gameState;
      this.replayHistory = saveData.replayHistory || [];
      this.selectedUnit = null;
      this.selectedEvent = null;
      this.currentPath = null;
      this.isGameOver = this.gameState.status !== GameStatus.PLAYING;
      
      this.gameState.log.push({
        type: 'action',
        message: '已加载存档',
        turn: this.gameState.turn
      });
      
      this.render();
    }
  }

  /**
   * 处理回放
   */
  handleReplay() {
    if (this.replayHistory.length === 0) {
      alert('没有回放数据！');
      return;
    }
    
    // 创建回放控制器
    const replayController = new ReplayController(this.replayHistory);
    
    // 显示回放模态框
    showReplayModal(replayController, () => {
      // 关闭回调
    });
  }

  /**
   * 处理重新开始
   */
  handleRestart() {
    if (confirm('确定要重新开始吗？当前游戏进度将丢失。')) {
      this.startNewGame();
    }
  }

  /**
   * 处理单元格点击
   * @param {Object} position - 点击位置
   * @param {Object} unit - 位置上的单位（如果有）
   * @param {Object} event - 位置上的事件（如果有）
   */
  handleCellClick(position, unit, event) {
    if (this.isGameOver) return;
    
    // 如果点击了单位，选中它
    if (unit) {
      this.selectUnit(unit);
      return;
    }
    
    // 如果有选中的单位，尝试移动
    if (this.selectedUnit) {
      this.tryMoveSelectedUnit(position);
      return;
    }
    
    // 如果点击了事件，选中它
    if (event) {
      this.selectEvent(event);
      return;
    }
  }

  /**
   * 选中单位
   * @param {Object} unit - 单位对象
   */
  selectUnit(unit) {
    if (this.selectedUnit && this.selectedUnit.id === unit.id) {
      // 取消选中
      this.selectedUnit = null;
      this.gameState.selectedUnitId = null;
      this.currentPath = null;
    } else {
      // 选中新单位
      this.selectedUnit = unit;
      this.gameState.selectedUnitId = unit.id;
      this.selectedEvent = null;
      
      // 如果有选中的事件，检查是否可以派遣
      if (this.selectedEvent) {
        this.tryAssignUnitToEvent(unit, this.selectedEvent);
        return;
      }
    }
    
    this.render();
  }

  /**
   * 选中事件
   * @param {Object} event - 事件对象
   */
  selectEvent(event) {
    if (this.selectedEvent && this.selectedEvent.id === event.id) {
      // 取消选中
      this.selectedEvent = null;
    } else {
      // 选中新事件
      this.selectedEvent = event;
      
      // 如果有选中的单位，检查是否可以派遣
      if (this.selectedUnit) {
        this.tryAssignUnitToEvent(this.selectedUnit, event);
        return;
      }
    }
    
    this.render();
  }

  /**
   * 尝试移动选中的单位
   * @param {Object} targetPos - 目标位置
   */
  tryMoveSelectedUnit(targetPos) {
    if (!this.selectedUnit) return;
    
    // 检查单位是否待命
    if (this.selectedUnit.status !== UnitStatus.IDLE) {
      this.gameState.log.push({
        type: 'warning',
        message: '该单位正在忙碌中，无法移动',
        turn: this.gameState.turn
      });
      this.render();
      return;
    }
    
    // 检查是否有事件在目标位置
    const eventAtTarget = this.gameState.events.find(e => 
      e.position.x === targetPos.x && 
      e.position.y === targetPos.y &&
      e.status === EventStatus.ACTIVE
    );
    
    if (eventAtTarget && canUnitHandleEvent(this.selectedUnit.type, eventAtTarget.type)) {
      // 如果目标位置有事件且单位可以处理，直接派遣
      this.tryAssignUnitToEvent(this.selectedUnit, eventAtTarget);
      return;
    }
    
    // 计算路径
    const path = findPath(
      this.selectedUnit.position,
      targetPos,
      this.gameState.map,
      this.gameState.config.mapWidth,
      this.gameState.config.mapHeight
    );
    
    if (!path || path.length === 0) {
      this.gameState.log.push({
        type: 'warning',
        message: `无法到达位置 (${targetPos.x}, ${targetPos.y})`,
        turn: this.gameState.turn
      });
      this.render();
      return;
    }
    
    // 更新游戏状态
    this.gameState = moveUnit(this.gameState, this.selectedUnit.id, targetPos);
    
    // 记录到回放历史
    this.replayHistory = recordReplayStep(
      this.replayHistory,
      this.gameState,
      `移动单位到 (${targetPos.x}, ${targetPos.y})`
    );
    
    // 清除选中
    this.selectedUnit = null;
    this.gameState.selectedUnitId = null;
    
    this.render();
  }

  /**
   * 尝试派遣单位处理事件
   * @param {Object} unit - 单位
   * @param {Object} event - 事件
   */
  tryAssignUnitToEvent(unit, event) {
    // 检查单位是否可以处理此事件
    if (!canUnitHandleEvent(unit.type, event.type)) {
      this.gameState.log.push({
        type: 'warning',
        message: '该单位无法处理此类型事件',
        turn: this.gameState.turn
      });
      this.render();
      return;
    }
    
    // 检查单位是否待命
    if (unit.status !== UnitStatus.IDLE) {
      this.gameState.log.push({
        type: 'warning',
        message: '该单位正在忙碌中',
        turn: this.gameState.turn
      });
      this.render();
      return;
    }
    
    // 检查事件是否已被分配
    if (event.assignedUnitId) {
      this.gameState.log.push({
        type: 'warning',
        message: '该事件已分配给其他单位',
        turn: this.gameState.turn
      });
      this.render();
      return;
    }
    
    // 检查是否已经在事件位置
    if (
      unit.position.x === event.position.x &&
      unit.position.y === event.position.y
    ) {
      // 直接开始工作
      this.gameState = startUnitWork(this.gameState, unit.id);
      
      this.gameState.log.push({
        type: 'action',
        message: `单位开始处理事件: ${event.description}`,
        turn: this.gameState.turn
      });
    } else {
      // 派遣单位前往事件位置
      this.gameState = assignUnitToEvent(this.gameState, unit.id, event.id);
      
      this.gameState.log.push({
        type: 'action',
        message: `派遣单位处理事件: ${event.description}`,
        turn: this.gameState.turn
      });
    }
    
    // 记录到回放历史
    this.replayHistory = recordReplayStep(
      this.replayHistory,
      this.gameState,
      `派遣单位处理事件: ${event.description}`
    );
    
    // 清除选中
    this.selectedUnit = null;
    this.selectedEvent = null;
    this.gameState.selectedUnitId = null;
    
    this.render();
  }

  /**
   * 渲染游戏
   */
  render() {
    // 渲染地图
    const mapContainer = document.getElementById('game-map');
    if (mapContainer) {
      renderMap(
        mapContainer,
        this.gameState,
        (position, unit, event) => this.handleCellClick(position, unit, event)
      );
    }
    
    // 更新所有UI
    updateAllUI(this.gameState, {
      onUnitClick: (unit) => this.selectUnit(unit),
      onEventClick: (event) => this.selectEvent(event)
    });
  }
}

// 启动游戏
document.addEventListener('DOMContentLoaded', () => {
  new Game();
});
