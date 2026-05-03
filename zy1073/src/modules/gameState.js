/**
 * 游戏状态管理模块
 * 负责状态管理、撤销/重做、本地存储、关卡进度
 */

export class GameState {
  constructor() {
    this.currentLevel = null;
    this.placedStalls = [];
    this.availableStalls = [];
    this.history = [];
    this.historyIndex = -1;
    this.maxHistoryLength = 50;
    this.listeners = [];
    
    this.storageKeys = {
      highScores: 'marketGame_highScores',
      savedLayouts: 'marketGame_savedLayouts',
      gameSettings: 'marketGame_settings'
    };
  }

  /**
   * 初始化关卡
   * @param {Object} level - 解析后的关卡数据
   */
  initLevel(level) {
    this.currentLevel = level;
    this.placedStalls = [];
    this.availableStalls = JSON.parse(JSON.stringify(level.stalls));
    this.history = [];
    this.historyIndex = -1;
    
    this.saveState();
    this.notifyListeners('levelChange');
  }

  /**
   * 放置摊位
   * @param {Object} stall - 摊位数据
   * @param {Object} position - 放置位置 {x, y}
   * @returns {boolean} 是否成功放置
   */
  placeStall(stall, position) {
    const stallToPlace = this.availableStalls.find(s => s.id === stall.id);
    if (!stallToPlace) {
      return false;
    }

    const placedStall = {
      ...JSON.parse(JSON.stringify(stallToPlace)),
      position: { ...position },
      placedAt: Date.now()
    };

    this.placedStalls.push(placedStall);
    this.availableStalls = this.availableStalls.filter(s => s.id !== stall.id);
    
    this.saveState();
    this.notifyListeners('stallPlaced', { stall: placedStall });
    
    return true;
  }

  /**
   * 移除已放置的摊位
   * @param {string} stallId - 摊位ID
   * @returns {boolean} 是否成功移除
   */
  removeStall(stallId) {
    const stallIndex = this.placedStalls.findIndex(s => s.id === stallId);
    if (stallIndex === -1) {
      return false;
    }

    const removedStall = this.placedStalls[stallIndex];
    
    // 从已放置列表移除
    this.placedStalls.splice(stallIndex, 1);
    
    // 放回可用列表
    const originalStall = this.currentLevel.stalls.find(s => s.id === stallId);
    if (originalStall) {
      this.availableStalls.push(JSON.parse(JSON.stringify(originalStall)));
    }

    this.saveState();
    this.notifyListeners('stallRemoved', { stall: removedStall });
    
    return true;
  }

  /**
   * 移动摊位到新位置
   * @param {string} stallId - 摊位ID
   * @param {Object} newPosition - 新位置
   * @returns {boolean} 是否成功移动
   */
  moveStall(stallId, newPosition) {
    const stall = this.placedStalls.find(s => s.id === stallId);
    if (!stall) {
      return false;
    }

    const oldPosition = { ...stall.position };
    stall.position = { ...newPosition };

    this.saveState();
    this.notifyListeners('stallMoved', { 
      stall, 
      oldPosition, 
      newPosition 
    });

    return true;
  }

  /**
   * 撤销
   * @returns {boolean} 是否成功撤销
   */
  undo() {
    if (this.historyIndex <= 0) {
      return false;
    }

    this.historyIndex--;
    this.restoreState(this.history[this.historyIndex]);
    this.notifyListeners('undo');
    
    return true;
  }

  /**
   * 重做
   * @returns {boolean} 是否成功重做
   */
  redo() {
    if (this.historyIndex >= this.history.length - 1) {
      return false;
    }

    this.historyIndex++;
    this.restoreState(this.history[this.historyIndex]);
    this.notifyListeners('redo');
    
    return true;
  }

  /**
   * 是否可以撤销
   */
  canUndo() {
    return this.historyIndex > 0;
  }

  /**
   * 是否可以重做
   */
  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }

  /**
   * 保存当前状态到历史
   */
  saveState() {
    const state = {
      placedStalls: JSON.parse(JSON.stringify(this.placedStalls)),
      availableStalls: JSON.parse(JSON.stringify(this.availableStalls)),
      timestamp: Date.now()
    };

    // 移除未来的历史（因为做了新操作）
    this.history = this.history.slice(0, this.historyIndex + 1);
    
    // 添加新状态
    this.history.push(state);
    this.historyIndex = this.history.length - 1;

    // 限制历史长度
    if (this.history.length > this.maxHistoryLength) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  /**
   * 恢复到指定状态
   */
  restoreState(state) {
    this.placedStalls = state.placedStalls;
    this.availableStalls = state.availableStalls;
  }

  /**
   * 重开关卡
   */
  restartLevel() {
    if (this.currentLevel) {
      this.initLevel(this.currentLevel);
      this.notifyListeners('restart');
    }
  }

  /**
   * 保存当前布局
   * @param {string} name - 布局名称
   */
  saveLayout(name) {
    const layout = {
      id: `layout_${Date.now()}`,
      name,
      levelId: this.currentLevel?.id,
      placedStalls: this.placedStalls,
      timestamp: Date.now()
    };

    const layouts = this.getSavedLayouts();
    layouts.push(layout);
    
    try {
      localStorage.setItem(this.storageKeys.savedLayouts, JSON.stringify(layouts));
      this.notifyListeners('layoutSaved', { layout });
      return layout;
    } catch (e) {
      console.error('保存布局失败:', e);
      return null;
    }
  }

  /**
   * 加载布局
   * @param {string} layoutId - 布局ID
   */
  loadLayout(layoutId) {
    const layouts = this.getSavedLayouts();
    const layout = layouts.find(l => l.id === layoutId);
    
    if (!layout) {
      return null;
    }

    if (this.currentLevel && layout.levelId !== this.currentLevel.id) {
      console.warn('布局所属关卡与当前关卡不匹配');
    }

    this.placedStalls = layout.placedStalls;
    
    // 重新计算可用摊位
    this.availableStalls = this.currentLevel.stalls.filter(
      s => !this.placedStalls.find(ps => ps.id === s.id)
    ).map(s => JSON.parse(JSON.stringify(s)));

    this.saveState();
    this.notifyListeners('layoutLoaded', { layout });
    
    return layout;
  }

  /**
   * 获取所有保存的布局
   */
  getSavedLayouts() {
    try {
      const data = localStorage.getItem(this.storageKeys.savedLayouts);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * 删除保存的布局
   */
  deleteLayout(layoutId) {
    const layouts = this.getSavedLayouts();
    const filtered = layouts.filter(l => l.id !== layoutId);
    
    try {
      localStorage.setItem(this.storageKeys.savedLayouts, JSON.stringify(filtered));
      this.notifyListeners('layoutDeleted', { layoutId });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 保存最高分
   * @param {string} levelId - 关卡ID
   * @param {number} score - 分数
   * @param {Object} details - 详细信息
   */
  saveHighScore(levelId, score, details = {}) {
    const highScores = this.getHighScores();
    const current = highScores[levelId];
    
    if (!current || score > current.score) {
      highScores[levelId] = {
        score,
        timestamp: Date.now(),
        details,
        placedStalls: this.placedStalls
      };
      
      try {
        localStorage.setItem(this.storageKeys.highScores, JSON.stringify(highScores));
        this.notifyListeners('newHighScore', { levelId, score });
        return true;
      } catch (e) {
        console.error('保存最高分失败:', e);
      }
    }
    
    return false;
  }

  /**
   * 获取最高分
   */
  getHighScores() {
    try {
      const data = localStorage.getItem(this.storageKeys.highScores);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  /**
   * 获取指定关卡的最高分
   */
  getHighScore(levelId) {
    return this.getHighScores()[levelId] || null;
  }

  /**
   * 添加监听器
   */
  addListener(callback) {
    this.listeners.push(callback);
    return () => this.removeListener(callback);
  }

  /**
   * 移除监听器
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  /**
   * 通知监听器
   */
  notifyListeners(event, data = {}) {
    this.listeners.forEach(callback => {
      try {
        callback(event, {
          ...data,
          placedStalls: this.placedStalls,
          availableStalls: this.availableStalls,
          currentLevel: this.currentLevel
        });
      } catch (e) {
        console.error('监听器执行失败:', e);
      }
    });
  }

  /**
   * 获取当前游戏状态快照
   */
  getStateSnapshot() {
    return {
      currentLevel: this.currentLevel ? {
        id: this.currentLevel.id,
        name: this.currentLevel.name
      } : null,
      placedStalls: this.placedStalls.length,
      availableStalls: this.availableStalls.length,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      timestamp: Date.now()
    };
  }
}

export const gameState = new GameState();
