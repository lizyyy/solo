/**
 * 本地存档系统
 * 负责保存和读取游戏进度、最高分、已解锁关卡等
 */

export class SaveSystem {
  constructor() {
    this.storageKey = 'night_market_game_save';
  }

  /**
   * 初始化存档
   * @returns {Object} 初始存档数据
   */
  initSave() {
    const defaultSave = {
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      highScores: {}, // { levelId: score }
      unlockedLevels: [1], // 默认解锁第一关
      totalPlayTime: 0,
      gamesPlayed: 0
    };
    
    this.save(defaultSave);
    return defaultSave;
  }

  /**
   * 保存数据到localStorage
   * @param {Object} saveData 存档数据
   * @returns {boolean} 是否成功
   */
  save(saveData) {
    try {
      saveData.updatedAt = Date.now();
      localStorage.setItem(this.storageKey, JSON.stringify(saveData));
      return true;
    } catch (error) {
      console.error('保存游戏失败:', error);
      return false;
    }
  }

  /**
   * 从localStorage读取存档
   * @returns {Object|null} 存档数据或null
   */
  load() {
    try {
      const savedData = localStorage.getItem(this.storageKey);
      if (savedData) {
        return JSON.parse(savedData);
      }
    } catch (error) {
      console.error('读取存档失败:', error);
    }
    
    return null;
  }

  /**
   * 获取存档（如果不存在则初始化）
   * @returns {Object} 存档数据
   */
  getSave() {
    const saved = this.load();
    if (saved) {
      return saved;
    }
    return this.initSave();
  }

  /**
   * 更新关卡最高分
   * @param {number} levelId 关卡ID
   * @param {number} score 得分
   * @returns {boolean} 是否是新的最高分
   */
  updateHighScore(levelId, score) {
    const saveData = this.getSave();
    
    if (!saveData.highScores[levelId] || score > saveData.highScores[levelId]) {
      saveData.highScores[levelId] = score;
      this.save(saveData);
      return true;
    }
    
    return false;
  }

  /**
   * 获取关卡最高分
   * @param {number} levelId 关卡ID
   * @returns {number} 最高分（0表示未记录）
   */
  getHighScore(levelId) {
    const saveData = this.getSave();
    return saveData.highScores[levelId] || 0;
  }

  /**
   * 解锁关卡
   * @param {number} levelId 关卡ID
   * @returns {boolean} 是否成功解锁
   */
  unlockLevel(levelId) {
    const saveData = this.getSave();
    
    if (!saveData.unlockedLevels.includes(levelId)) {
      saveData.unlockedLevels.push(levelId);
      this.save(saveData);
      return true;
    }
    
    return false;
  }

  /**
   * 检查关卡是否已解锁
   * @param {number} levelId 关卡ID
   * @returns {boolean} 是否已解锁
   */
  isLevelUnlocked(levelId) {
    const saveData = this.getSave();
    return saveData.unlockedLevels.includes(levelId);
  }

  /**
   * 获取所有已解锁的关卡
   * @returns {Array} 已解锁关卡ID列表
   */
  getUnlockedLevels() {
    const saveData = this.getSave();
    return [...saveData.unlockedLevels];
  }

  /**
   * 更新游戏统计
   * @param {number} playTime 游戏时长（秒）
   */
  updateGameStats(playTime) {
    const saveData = this.getSave();
    saveData.totalPlayTime += playTime;
    saveData.gamesPlayed += 1;
    this.save(saveData);
  }

  /**
   * 获取游戏统计
   * @returns {Object} 游戏统计数据
   */
  getGameStats() {
    const saveData = this.getSave();
    return {
      totalPlayTime: saveData.totalPlayTime,
      gamesPlayed: saveData.gamesPlayed
    };
  }

  /**
   * 清除所有存档
   * @returns {boolean} 是否成功
   */
  clearSave() {
    try {
      localStorage.removeItem(this.storageKey);
      return true;
    } catch (error) {
      console.error('清除存档失败:', error);
      return false;
    }
  }

  /**
   * 导出存档数据
   * @param {boolean} pretty 格式化输出
   * @returns {string} JSON字符串
   */
  exportSave(pretty = true) {
    const saveData = this.getSave();
    return pretty 
      ? JSON.stringify(saveData, null, 2) 
      : JSON.stringify(saveData);
  }

  /**
   * 导入存档数据
   * @param {string} jsonString JSON字符串
   * @returns {boolean} 是否成功
   */
  importSave(jsonString) {
    try {
      const saveData = JSON.parse(jsonString);
      
      // 验证基本字段
      if (!saveData.version || !saveData.unlockedLevels || !saveData.highScores) {
        console.warn('导入的存档格式不正确');
        return false;
      }
      
      return this.save(saveData);
    } catch (error) {
      console.error('解析存档JSON失败:', error);
      return false;
    }
  }
}
