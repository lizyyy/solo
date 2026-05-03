/**
 * 关卡配置管理系统
 * 负责加载、管理关卡配置
 */

export class LevelManager {
  constructor() {
    this.levels = [];
    this.currentLevelId = null;
  }

  /**
   * 从JSON数据加载关卡
   * @param {Object} jsonData 关卡JSON数据
   */
  loadFromJSON(jsonData) {
    if (jsonData && jsonData.levels && Array.isArray(jsonData.levels)) {
      this.levels = jsonData.levels;
    }
  }

  /**
   * 验证关卡数据
   * @param {Object} levelData 关卡数据
   * @returns {boolean} 是否有效
   */
  validateLevel(levelData) {
    if (!levelData) return false;
    
    const requiredFields = [
      'id', 'name', 'description', 'difficulty', 
      'targetScore', 'gameDuration', 'orderSpawnRate',
      'maxOrders', 'availableStations', 'stationCount',
      'availableDishes', 'orderSteps', 'stepDurations',
      'basePrices', 'perfectWindow', 'maxWaitTime'
    ];
    
    for (const field of requiredFields) {
      if (!(field in levelData)) {
        console.warn(`关卡数据缺少必需字段: ${field}`);
        return false;
      }
    }
    
    // 验证订单步骤与可用菜品匹配
    for (const dish of levelData.availableDishes) {
      if (!(dish in levelData.orderSteps)) {
        console.warn(`菜品 ${dish} 缺少订单步骤定义`);
        return false;
      }
      
      // 验证每个步骤的时长定义
      for (const step of levelData.orderSteps[dish]) {
        if (!(step in levelData.stepDurations)) {
          console.warn(`步骤 ${step} 缺少时长定义`);
          return false;
        }
      }
    }
    
    // 验证价格定义
    for (const dish of levelData.availableDishes) {
      if (!(dish in levelData.basePrices)) {
        console.warn(`菜品 ${dish} 缺少价格定义`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * 获取所有关卡
   * @returns {Array} 关卡列表
   */
  getAllLevels() {
    return [...this.levels];
  }

  /**
   * 根据ID获取关卡
   * @param {number} levelId 关卡ID
   * @returns {Object|null} 关卡对象
   */
  getLevelById(levelId) {
    return this.levels.find(level => level.id === levelId) || null;
  }

  /**
   * 设置当前关卡
   * @param {number} levelId 关卡ID
   * @returns {boolean} 是否成功
   */
  setCurrentLevel(levelId) {
    const level = this.getLevelById(levelId);
    if (level) {
      this.currentLevelId = levelId;
      return true;
    }
    return false;
  }

  /**
   * 获取当前关卡
   * @returns {Object|null} 当前关卡对象
   */
  getCurrentLevel() {
    if (this.currentLevelId === null) {
      return null;
    }
    return this.getLevelById(this.currentLevelId);
  }

  /**
   * 添加新关卡
   * @param {Object} levelData 关卡数据
   * @returns {boolean} 是否成功
   */
  addLevel(levelData) {
    if (!this.validateLevel(levelData)) {
      return false;
    }
    
    // 检查ID是否已存在
    const existingLevel = this.getLevelById(levelData.id);
    if (existingLevel) {
      console.warn(`关卡ID ${levelData.id} 已存在`);
      return false;
    }
    
    this.levels.push(levelData);
    return true;
  }

  /**
   * 更新关卡
   * @param {number} levelId 关卡ID
   * @param {Object} updatedData 更新的数据
   * @returns {boolean} 是否成功
   */
  updateLevel(levelId, updatedData) {
    const index = this.levels.findIndex(level => level.id === levelId);
    if (index === -1) {
      return false;
    }
    
    // 合并数据并验证
    const mergedData = { ...this.levels[index], ...updatedData };
    if (!this.validateLevel(mergedData)) {
      return false;
    }
    
    this.levels[index] = mergedData;
    return true;
  }

  /**
   * 删除关卡
   * @param {number} levelId 关卡ID
   * @returns {boolean} 是否成功
   */
  deleteLevel(levelId) {
    const index = this.levels.findIndex(level => level.id === levelId);
    if (index === -1) {
      return false;
    }
    
    this.levels.splice(index, 1);
    
    // 如果删除的是当前关卡，重置当前关卡
    if (this.currentLevelId === levelId) {
      this.currentLevelId = null;
    }
    
    return true;
  }

  /**
   * 导出所有关卡为JSON
   * @returns {Object} JSON数据
   */
  exportToJSON() {
    return {
      levels: [...this.levels]
    };
  }

  /**
   * 导出所有关卡为JSON字符串
   * @param {boolean} pretty 格式化输出
   * @returns {string} JSON字符串
   */
  exportToJSONString(pretty = true) {
    const jsonData = this.exportToJSON();
    return pretty 
      ? JSON.stringify(jsonData, null, 2) 
      : JSON.stringify(jsonData);
  }

  /**
   * 从JSON字符串导入关卡
   * @param {string} jsonString JSON字符串
   * @returns {boolean} 是否成功
   */
  importFromJSONString(jsonString) {
    try {
      const jsonData = JSON.parse(jsonString);
      
      if (!jsonData.levels || !Array.isArray(jsonData.levels)) {
        console.warn('导入的数据格式不正确');
        return false;
      }
      
      // 验证每个关卡
      for (const level of jsonData.levels) {
        if (!this.validateLevel(level)) {
          console.warn(`关卡验证失败: ${level.name || level.id}`);
          return false;
        }
      }
      
      this.levels = jsonData.levels;
      return true;
    } catch (error) {
      console.error('解析JSON失败:', error);
      return false;
    }
  }
}
