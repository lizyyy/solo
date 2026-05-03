/**
 * 成绩存储模块
 * 负责管理历史成绩的存储、检索、删除和统计分析
 */

// 本地存储键名
const STORAGE_KEY = 'triageGameHistory';

// 最大存储记录数
const MAX_RECORDS = 50;

export const scoreStorage = {
  /**
   * 初始化存储模块
   */
  init() {
    // 确保存储结构存在
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    }
  },

  /**
   * 保存游戏成绩
   * @param {Object} gameSummary - 游戏摘要信息
   * @returns {boolean} 是否保存成功
   */
  saveScore(gameSummary) {
    try {
      // 获取现有记录
      let records = this.getAllRecords();
      
      // 添加新记录
      const newRecord = {
        ...gameSummary,
        id: this._generateRecordId(),
        savedAt: new Date().toISOString()
      };
      
      records.unshift(newRecord);
      
      // 限制记录数量
      if (records.length > MAX_RECORDS) {
        records = records.slice(0, MAX_RECORDS);
      }
      
      // 保存到本地存储
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      
      return true;
    } catch (error) {
      console.error('保存成绩失败:', error);
      return false;
    }
  },

  /**
   * 获取所有历史记录
   * @returns {Array<Object>} 历史记录数组
   */
  getAllRecords() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('获取历史记录失败:', error);
      return [];
    }
  },

  /**
   * 根据ID获取单条记录
   * @param {string} recordId - 记录ID
   * @returns {Object|null} 记录对象，如果不存在则返回null
   */
  getRecordById(recordId) {
    const records = this.getAllRecords();
    return records.find(record => record.id === recordId) || null;
  },

  /**
   * 根据关卡ID获取记录
   * @param {string} levelId - 关卡ID
   * @returns {Array<Object>} 该关卡的所有记录
   */
  getRecordsByLevel(levelId) {
    const records = this.getAllRecords();
    return records.filter(record => record.levelId === levelId);
  },

  /**
   * 删除单条记录
   * @param {string} recordId - 记录ID
   * @returns {boolean} 是否删除成功
   */
  deleteRecord(recordId) {
    try {
      let records = this.getAllRecords();
      const initialLength = records.length;
      
      records = records.filter(record => record.id !== recordId);
      
      if (records.length < initialLength) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('删除记录失败:', error);
      return false;
    }
  },

  /**
   * 清空所有记录
   * @returns {boolean} 是否清空成功
   */
  clearAllRecords() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return true;
    } catch (error) {
      console.error('清空记录失败:', error);
      return false;
    }
  },

  /**
   * 获取统计信息
   * @returns {Object} 统计信息对象
   */
  getStatistics() {
    const records = this.getAllRecords();
    
    if (records.length === 0) {
      return {
        totalGames: 0,
        totalScore: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: Infinity,
        averageAccuracy: 0,
        bestAccuracy: 0,
        totalPatients: 0,
        correctPatients: 0,
        incorrectPatients: 0,
        levelsPlayed: [],
        recentPerformance: []
      };
    }
    
    const totalScore = records.reduce((sum, record) => sum + record.score, 0);
    const averageScore = Math.round(totalScore / records.length);
    const highestScore = Math.max(...records.map(r => r.score));
    const lowestScore = Math.min(...records.map(r => r.score));
    
    const totalAccuracy = records.reduce((sum, record) => sum + record.accuracy, 0);
    const averageAccuracy = Math.round(totalAccuracy / records.length);
    const bestAccuracy = Math.max(...records.map(r => r.accuracy));
    
    const totalPatients = records.reduce((sum, record) => sum + record.totalProcessed, 0);
    const correctPatients = records.reduce((sum, record) => sum + record.correctCount, 0);
    const incorrectPatients = records.reduce((sum, record) => sum + record.incorrectCount, 0);
    
    // 获取玩过的关卡列表
    const levelSet = new Set(records.map(r => r.levelId));
    const levelsPlayed = Array.from(levelSet).map(levelId => {
      const levelRecords = records.filter(r => r.levelId === levelId);
      const levelName = levelRecords.length > 0 ? levelRecords[0].levelName : levelId;
      return {
        levelId,
        levelName,
        playCount: levelRecords.length,
        bestScore: Math.max(...levelRecords.map(r => r.score)),
        averageScore: Math.round(levelRecords.reduce((s, r) => s + r.score, 0) / levelRecords.length)
      };
    });
    
    // 获取最近5次的表现
    const recentPerformance = records.slice(0, 5).map(record => ({
      date: new Date(record.playedAt).toLocaleDateString('zh-CN'),
      score: record.score,
      accuracy: record.accuracy,
      level: record.levelName
    }));
    
    return {
      totalGames: records.length,
      totalScore,
      averageScore,
      highestScore,
      lowestScore,
      averageAccuracy,
      bestAccuracy,
      totalPatients,
      correctPatients,
      incorrectPatients,
      levelsPlayed,
      recentPerformance
    };
  },

  /**
   * 获取指定关卡的最佳成绩
   * @param {string} levelId - 关卡ID
   * @returns {Object|null} 最佳成绩记录，如果没有则返回null
   */
  getBestScoreForLevel(levelId) {
    const levelRecords = this.getRecordsByLevel(levelId);
    
    if (levelRecords.length === 0) {
      return null;
    }
    
    // 按分数排序，取最高的
    const sorted = [...levelRecords].sort((a, b) => {
      // 首先比较分数
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // 分数相同则比较准确率
      if (b.accuracy !== a.accuracy) {
        return b.accuracy - a.accuracy;
      }
      // 准确率相同则比较用时（用时短的更好）
      return a.timeUsed - b.timeUsed;
    });
    
    return sorted[0];
  },

  /**
   * 获取最近的游戏记录
   * @param {number} count - 获取的记录数量
   * @returns {Array<Object>} 最近的记录数组
   */
  getRecentRecords(count = 10) {
    const records = this.getAllRecords();
    return records.slice(0, Math.min(count, records.length));
  },

  /**
   * 导出所有记录为JSON格式
   * @returns {string} JSON字符串
   */
  exportToJSON() {
    const records = this.getAllRecords();
    return JSON.stringify(records, null, 2);
  },

  /**
   * 从JSON导入记录
   * @param {string} jsonString - JSON字符串
   * @param {boolean} merge - 是否与现有记录合并
   * @returns {boolean} 是否导入成功
   */
  importFromJSON(jsonString, merge = false) {
    try {
      const importedRecords = JSON.parse(jsonString);
      
      if (!Array.isArray(importedRecords)) {
        throw new Error('导入的数据格式不正确');
      }
      
      // 验证每条记录的基本结构
      const validRecords = importedRecords.filter(record => 
        record.levelId && 
        record.score !== undefined && 
        record.playedAt
      );
      
      if (merge) {
        const existingRecords = this.getAllRecords();
        const mergedRecords = [...validRecords, ...existingRecords];
        
        // 去重（根据ID）
        const uniqueRecords = [];
        const seenIds = new Set();
        
        for (const record of mergedRecords) {
          if (!seenIds.has(record.id)) {
            seenIds.add(record.id);
            uniqueRecords.push(record);
          }
        }
        
        // 按时间排序
        uniqueRecords.sort((a, b) => 
          new Date(b.playedAt) - new Date(a.playedAt)
        );
        
        // 限制数量
        const finalRecords = uniqueRecords.slice(0, MAX_RECORDS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalRecords));
      } else {
        // 限制数量并保存
        const finalRecords = validRecords.slice(0, MAX_RECORDS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalRecords));
      }
      
      return true;
    } catch (error) {
      console.error('导入记录失败:', error);
      return false;
    }
  },

  /**
   * 生成唯一的记录ID
   * @private
   * @returns {string} 唯一ID
   */
  _generateRecordId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  },

  /**
   * 检查本地存储是否可用
   * @returns {boolean} 是否可用
   */
  isStorageAvailable() {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * 获取存储使用情况
   * @returns {Object} 存储使用情况
   */
  getStorageUsage() {
    try {
      const records = this.getAllRecords();
      const jsonString = JSON.stringify(records);
      const sizeInBytes = new Blob([jsonString]).size;
      const sizeInKB = Math.round(sizeInBytes / 1024 * 100) / 100;
      
      // 估算localStorage的总容量（通常为5MB）
      const estimatedTotal = 5 * 1024; // 5MB in KB
      const usagePercent = Math.round((sizeInKB / estimatedTotal) * 100);
      
      return {
        recordCount: records.length,
        sizeInBytes,
        sizeInKB,
        estimatedTotalKB: estimatedTotal,
        usagePercent
      };
    } catch (error) {
      console.error('获取存储使用情况失败:', error);
      return {
        recordCount: 0,
        sizeInBytes: 0,
        sizeInKB: 0,
        estimatedTotalKB: 0,
        usagePercent: 0
      };
    }
  }
};

export default scoreStorage;
