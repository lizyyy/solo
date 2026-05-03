/**
 * 游戏主控制器
 * 负责整合所有模块，控制游戏流程
 */

import { OrderGenerator } from './modules/orderGenerator.js';
import { StationManager } from './modules/stationManager.js';
import { ScoreSystem } from './modules/scoreSystem.js';
import { LevelManager } from './modules/levelManager.js';
import { SaveSystem } from './modules/saveSystem.js';
import { UIRenderer } from './modules/uiRenderer.js';

export class GameController {
  constructor() {
    this.levelManager = new LevelManager();
    this.saveSystem = new SaveSystem();
    this.uiRenderer = new UIRenderer('app');
    
    this.currentLevel = null;
    this.orderGenerator = null;
    this.stationManager = null;
    this.scoreSystem = null;
    
    this.gameState = {
      orders: [],
      stations: [],
      score: 0,
      income: 0,
      waste: 0,
      isPaused: false,
      gameTime: 0,
      targetScore: 0
    };
    
    this.gameLoop = null;
    this.lastUpdateTime = 0;
    this.orderSpawnTimer = 0;
    
    this._init();
  }

  /**
   * 初始化游戏
   * @private
   */
  async _init() {
    // 加载关卡数据
    try {
      const response = await fetch('src/data/levels.json');
      const levelData = await response.json();
      this.levelManager.loadFromJSON(levelData);
    } catch (error) {
      console.error('加载关卡数据失败:', error);
      // 使用默认关卡
      this._loadDefaultLevels();
    }
    
    // 渲染开始菜单
    this._renderStartMenu();
    
    // 绑定键盘事件
    this._bindKeyboardEvents();
  }

  /**
   * 加载默认关卡
   * @private
   */
  _loadDefaultLevels() {
    const defaultLevels = {
      levels: [
        {
          id: 1,
          name: '新手入门',
          description: '熟悉基本操作，订单节奏较慢',
          difficulty: 'easy',
          targetScore: 300,
          gameDuration: 120,
          orderSpawnRate: 15,
          maxOrders: 4,
          availableStations: ['炒粉', '饮料'],
          stationCount: 2,
          availableDishes: ['炒粉', '可乐', '雪碧'],
          orderSteps: {
            '炒粉': ['备菜', '上锅', '火候处理', '装盒'],
            '可乐': ['备料', '装杯'],
            '雪碧': ['备料', '装杯']
          },
          stepDurations: {
            '备菜': 5,
            '上锅': 3,
            '火候处理': 8,
            '装盒': 3,
            '备料': 2,
            '装杯': 2
          },
          basePrices: {
            '炒粉': 15,
            '可乐': 8,
            '雪碧': 8
          },
          perfectWindow: 0.8,
          maxWaitTime: 60
        }
      ]
    };
    this.levelManager.loadFromJSON(defaultLevels);
  }

  /**
   * 渲染开始菜单
   * @private
   */
  _renderStartMenu() {
    this.uiRenderer.renderStartMenu(
      () => this._renderLevelSelect(),
      (data) => this._importLevels(data)
    );
  }

  /**
   * 导入关卡
   * @private
   * @param {string} jsonString JSON字符串
   */
  _importLevels(jsonString) {
    if (this.levelManager.importFromJSONString(jsonString)) {
      this.uiRenderer.showToast('关卡导入成功！', 'success');
      this._renderLevelSelect();
    } else {
      this.uiRenderer.showToast('关卡导入失败，请检查数据格式', 'error');
    }
  }

  /**
   * 渲染关卡选择界面
   * @private
   */
  _renderLevelSelect() {
    const levels = this.levelManager.getAllLevels();
    const saveData = this.saveSystem.getSave();
    
    this.uiRenderer.renderLevelSelect(
      levels,
      saveData,
      (levelId) => this._startGame(levelId),
      () => this._renderStartMenu(),
      () => this.levelManager.exportToJSONString()
    );
  }

  /**
   * 开始游戏
   * @private
   * @param {number} levelId 关卡ID
   */
  _startGame(levelId) {
    this.currentLevel = this.levelManager.getLevelById(levelId);
    if (!this.currentLevel) {
      this.uiRenderer.showToast('关卡不存在', 'error');
      return;
    }
    
    // 初始化游戏模块
    this.orderGenerator = new OrderGenerator(this.currentLevel);
    this.stationManager = new StationManager(this.currentLevel);
    this.scoreSystem = new ScoreSystem(this.currentLevel);
    
    // 重置游戏状态
    this.gameState = {
      orders: [],
      stations: this.stationManager.getStations(),
      score: 0,
      income: 0,
      waste: 0,
      isPaused: false,
      gameTime: 0,
      targetScore: this.currentLevel.targetScore
    };
    
    this.lastUpdateTime = Date.now();
    this.orderSpawnTimer = 0;
    
    // 渲染游戏界面
    this._renderGameScreen();
    
    // 启动游戏循环
    this._startGameLoop();
  }

  /**
   * 渲染游戏界面
   * @private
   */
  _renderGameScreen() {
    this.uiRenderer.renderGameScreen(
      this.gameState,
      this.currentLevel,
      () => this._togglePause(),
      () => this._restartGame(),
      (orderId) => this._assignOrder(orderId),
      (stationId) => this._completeStep(stationId)
    );
    
    // 绑定暂停菜单中的按钮
    if (this.gameState.isPaused) {
      setTimeout(() => {
        const resumeBtn = document.getElementById('resumeGameBtn');
        const restartBtn = document.getElementById('restartFromPauseBtn');
        const backBtn = document.getElementById('backFromPauseBtn');
        
        if (resumeBtn) resumeBtn.addEventListener('click', () => this._togglePause());
        if (restartBtn) restartBtn.addEventListener('click', () => this._restartGame());
        if (backBtn) backBtn.addEventListener('click', () => {
          this._stopGameLoop();
          this._renderLevelSelect();
        });
      }, 0);
    }
    
    // 绑定返回按钮
    const backToLevelBtn = document.getElementById('backToLevelBtn');
    if (backToLevelBtn) {
      backToLevelBtn.addEventListener('click', () => {
        this._stopGameLoop();
        this._renderLevelSelect();
      });
    }
  }

  /**
   * 启动游戏循环
   * @private
   */
  _startGameLoop() {
    this._stopGameLoop();
    
    const gameLoop = () => {
      if (!this.gameState.isPaused) {
        this._updateGame();
      }
      this.gameLoop = requestAnimationFrame(gameLoop);
    };
    
    this.gameLoop = requestAnimationFrame(gameLoop);
  }

  /**
   * 停止游戏循环
   * @private
   */
  _stopGameLoop() {
    if (this.gameLoop) {
      cancelAnimationFrame(this.gameLoop);
      this.gameLoop = null;
    }
  }

  /**
   * 更新游戏状态
   * @private
   */
  _updateGame() {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000; // 转换为秒
    this.lastUpdateTime = now;
    
    // 更新游戏时间
    this.gameState.gameTime += deltaTime;
    
    // 检查游戏是否结束
    if (this.gameState.gameTime >= this.currentLevel.gameDuration) {
      this._endGame();
      return;
    }
    
    // 生成新订单
    this.orderSpawnTimer += deltaTime;
    if (this.orderSpawnTimer >= this.currentLevel.orderSpawnRate) {
      this.orderSpawnTimer = 0;
      if (this.orderGenerator.canGenerateOrder(this.gameState.orders.length)) {
        const newOrder = this.orderGenerator.generateOrder();
        this.gameState.orders.push(newOrder);
      }
    }
    
    // 更新工位进度
    const busyStations = this.stationManager.getBusyStations();
    busyStations.forEach(station => {
      this.stationManager.updateStationProgress(station.id);
    });
    
    // 更新订单等待时间和满意度
    this.gameState.orders.forEach(order => {
      if (order.status === 'pending') {
        const waitTime = (now - order.createdAt) / 1000;
        order.waitTime = waitTime;
        
        // 等待时间过长降低满意度
        if (waitTime > this.currentLevel.maxWaitTime * 0.5) {
          order.satisfaction = Math.max(0, order.satisfaction - (deltaTime * 0.5));
        }
        
        // 等待时间过长取消订单
        if (waitTime > this.currentLevel.maxWaitTime) {
          order.status = 'canceled';
          this.scoreSystem.processCanceledOrder(order);
        }
      }
    });
    
    // 移除已完成或取消的订单
    this.gameState.orders = this.gameState.orders.filter(order => {
      return order.status === 'pending' || order.status === 'in_progress';
    });
    
    // 更新游戏状态数据
    this.gameState.stations = this.stationManager.getStations();
    this.gameState.score = this.scoreSystem.getCurrentScore();
    this.gameState.income = this.scoreSystem.getTotalIncome();
    this.gameState.waste = this.scoreSystem.getTotalWaste();
    
    // 重新渲染
    this._renderGameScreen();
  }

  /**
   * 切换暂停状态
   * @private
   */
  _togglePause() {
    this.gameState.isPaused = !this.gameState.isPaused;
    if (this.gameState.isPaused) {
      this.lastUpdateTime = Date.now();
    }
    this._renderGameScreen();
  }

  /**
   * 重新开始游戏
   * @private
   */
  _restartGame() {
    if (this.currentLevel) {
      this._startGame(this.currentLevel.id);
    }
  }

  /**
   * 分配订单到工位
   * @private
   * @param {string} orderId 订单ID
   */
  _assignOrder(orderId) {
    const order = this.gameState.orders.find(o => o.id === orderId);
    if (!order || order.status !== 'pending') {
      this.uiRenderer.showToast('订单不可用', 'error');
      return;
    }
    
    // 确定需要的工位类型
    const dish = order.dish;
    let stationType = null;
    
    // 简单映射：根据菜品确定工位类型
    if (dish === '炒粉') stationType = '炒粉';
    else if (dish === '煎饼') stationType = '煎饼';
    else if (dish === '可乐' || dish === '雪碧' || dish === '奶茶') stationType = '饮料';
    else if (dish === '烤串' || dish === '烤鸡翅') stationType = '烧烤';
    else stationType = this.currentLevel.availableStations[0];
    
    const availableStation = this.stationManager.getAvailableStation(stationType);
    
    if (!availableStation) {
      this.uiRenderer.showToast(`没有可用的${stationType}工位`, 'error');
      return;
    }
    
    this.stationManager.assignOrderToStation(availableStation.id, order);
    this.uiRenderer.showToast(`订单已分配到${stationType}工位`, 'success');
  }

  /**
   * 完成工位步骤
   * @private
   * @param {string} stationId 工位ID
   */
  _completeStep(stationId) {
    const stations = this.stationManager.getStations();
    const station = stations.find(s => s.id === stationId);
    
    if (!station) {
      return;
    }
    
    if (station.status === 'burned') {
      // 处理糊掉的订单
      const order = station.currentOrder;
      if (order) {
        this.scoreSystem.processBurnedOrder(order);
        this.stationManager.cancelOrder(order.id);
        this.uiRenderer.showToast('订单糊了，已丢弃', 'error');
      }
      return;
    }
    
    if (station.status === 'completed') {
      const order = this.stationManager.completeCurrentStep(stationId);
      
      if (order) {
        if (order.status === 'completed') {
          // 订单完成
          this.scoreSystem.processCompletedOrder(order);
          this.uiRenderer.showToast(`订单完成！${order.isPerfect ? '完美！' : ''}`, 'success');
          
          // 从订单队列移除
          this.gameState.orders = this.gameState.orders.filter(o => o.id !== order.id);
        } else {
          this.uiRenderer.showToast('步骤完成，继续下一步', 'info');
        }
      }
    }
  }

  /**
   * 结束游戏
   * @private
   */
  _endGame() {
    this._stopGameLoop();
    
    const summary = this.scoreSystem.calculateSummary();
    const levelInfo = this.currentLevel;
    
    // 更新存档
    const levelId = this.currentLevel.id;
    this.saveSystem.updateHighScore(levelId, summary.finalScore);
    this.saveSystem.updateGameStats(this.gameState.gameTime);
    
    // 如果通关，解锁下一关
    if (summary.isPassed) {
      const nextLevelId = levelId + 1;
      this.saveSystem.unlockLevel(nextLevelId);
    }
    
    // 渲染结算页面
    this._renderSummary(summary, levelInfo);
  }

  /**
   * 渲染结算页面
   * @private
   * @param {Object} summary 结算数据
   * @param {Object} levelInfo 关卡信息
   */
  _renderSummary(summary, levelInfo) {
    this.uiRenderer.renderSummary(
      summary,
      levelInfo,
      () => this._restartGame(),
      () => this._renderLevelSelect(),
      (format) => this._exportReport(summary, levelInfo, format)
    );
  }

  /**
   * 导出报告
   * @private
   * @param {Object} summary 结算数据
   * @param {Object} levelInfo 关卡信息
   * @param {string} format 格式 (json/markdown)
   */
  _exportReport(summary, levelInfo, format) {
    let content = '';
    let filename = '';
    let mimeType = '';
    
    if (format === 'json') {
      content = JSON.stringify(summary, null, 2);
      filename = `game_report_${Date.now()}.json`;
      mimeType = 'application/json';
    } else if (format === 'markdown') {
      content = this.scoreSystem.generateMarkdownReport(summary, levelInfo);
      filename = `game_report_${Date.now()}.md`;
      mimeType = 'text/markdown';
    }
    
    // 创建下载
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.uiRenderer.showToast(`报告已导出: ${filename}`, 'success');
  }

  /**
   * 绑定键盘事件
   * @private
   */
  _bindKeyboardEvents() {
    document.addEventListener('keydown', (e) => {
      // 空格 - 暂停/继续
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.currentLevel && !this._isInMenu()) {
          this._togglePause();
        }
      }
      
      // R - 重开
      if (e.code === 'KeyR') {
        e.preventDefault();
        if (this.currentLevel && !this._isInMenu()) {
          this._restartGame();
        }
      }
      
      // 数字键 1-9 - 快速选择工位
      if (e.code >= 'Digit1' && e.code <= 'Digit9') {
        e.preventDefault();
        const stationIndex = parseInt(e.key) - 1;
        const stations = this.stationManager ? this.stationManager.getStations() : [];
        
        if (stations[stationIndex]) {
          const station = stations[stationIndex];
          if (station.status === 'completed' || station.status === 'burned') {
            this._completeStep(station.id);
          }
        }
      }
      
      // Enter - 完成第一个待处理的工位
      if (e.code === 'Enter') {
        e.preventDefault();
        if (this.stationManager) {
          const stationsNeedingAction = this.stationManager.getStationsNeedingAction();
          if (stationsNeedingAction.length > 0) {
            this._completeStep(stationsNeedingAction[0].id);
          }
        }
      }
    });
  }

  /**
   * 检查是否在菜单界面
   * @private
   * @returns {boolean} 是否在菜单
   */
  _isInMenu() {
    // 简单检查：如果没有当前关卡，认为在菜单
    return !this.currentLevel;
  }
}
