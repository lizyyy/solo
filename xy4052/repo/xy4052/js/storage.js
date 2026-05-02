/**
 * 本地存档系统模块
 * 管理玩家进度、最高分、关卡结果和自定义关卡的本地存储
 */

const StorageKeys = {
  PLAYER_PROFILE: 'emergency_triage_player_profile',
  HIGH_SCORES: 'emergency_triage_high_scores',
  LEVEL_RESULTS: 'emergency_triage_level_results',
  CUSTOM_LEVELS: 'emergency_triage_custom_levels',
  SAVED_GAME: 'emergency_triage_saved_game',
  SETTINGS: 'emergency_triage_settings'
};

class StorageManager {
  constructor() {
    this.isAvailable = this.checkAvailability();
    this.listeners = [];
  }

  checkAvailability() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      console.warn('localStorage 不可用:', e);
      return false;
    }
  }

  addStorageListener(callback) {
    this.listeners.push(callback);
  }

  notifyChange(key, action, data) {
    this.listeners.forEach(callback => {
      try {
        callback(key, action, data);
      } catch (error) {
        console.error('Storage listener error:', error);
      }
    });
  }

  save(key, data) {
    if (!this.isAvailable) {
      return { success: false, message: '本地存储不可用' };
    }

    try {
      const jsonData = JSON.stringify(data);
      localStorage.setItem(key, jsonData);
      this.notifyChange(key, 'save', data);
      return { success: true, message: '保存成功' };
    } catch (error) {
      console.error('保存数据失败:', error);
      return { success: false, message: '保存失败: ' + error.message };
    }
  }

  load(key, defaultValue = null) {
    if (!this.isAvailable) {
      return { success: false, data: defaultValue, message: '本地存储不可用' };
    }

    try {
      const jsonData = localStorage.getItem(key);
      if (jsonData === null) {
        return { success: true, data: defaultValue, message: '数据不存在' };
      }
      const data = JSON.parse(jsonData);
      return { success: true, data: data, message: '加载成功' };
    } catch (error) {
      console.error('加载数据失败:', error);
      return { success: false, data: defaultValue, message: '加载失败: ' + error.message };
    }
  }

  remove(key) {
    if (!this.isAvailable) {
      return { success: false, message: '本地存储不可用' };
    }

    try {
      localStorage.removeItem(key);
      this.notifyChange(key, 'remove', null);
      return { success: true, message: '删除成功' };
    } catch (error) {
      console.error('删除数据失败:', error);
      return { success: false, message: '删除失败: ' + error.message };
    }
  }

  clear() {
    if (!this.isAvailable) {
      return { success: false, message: '本地存储不可用' };
    }

    try {
      localStorage.clear();
      this.notifyChange(null, 'clear', null);
      return { success: true, message: '清空成功' };
    } catch (error) {
      console.error('清空数据失败:', error);
      return { success: false, message: '清空失败: ' + error.message };
    }
  }

  getPlayerProfile() {
    const result = this.load(StorageKeys.PLAYER_PROFILE, {
      name: '新手护士',
      level: 1,
      experience: 0,
      totalGamesPlayed: 0,
      totalScore: 0,
      bestRating: null
    });
    return result.data;
  }

  savePlayerProfile(profile) {
    return this.save(StorageKeys.PLAYER_PROFILE, profile);
  }

  updatePlayerProfile(updates) {
    const profile = this.getPlayerProfile();
    const updatedProfile = { ...profile, ...updates };
    return this.savePlayerProfile(updatedProfile);
  }

  getHighScores() {
    const result = this.load(StorageKeys.HIGH_SCORES, {});
    return result.data;
  }

  saveHighScore(levelId, score, rating) {
    const highScores = this.getHighScores();
    const currentScore = highScores[levelId];

    if (!currentScore || score > currentScore.score) {
      highScores[levelId] = {
        score: score,
        rating: rating,
        date: new Date().toISOString(),
        levelId: levelId
      };
      const result = this.save(StorageKeys.HIGH_SCORES, highScores);
      return { ...result, isNewHighScore: true };
    }

    return { success: true, isNewHighScore: false, message: '不是最高分' };
  }

  getLevelResults(levelId) {
    const allResults = this.load(StorageKeys.LEVEL_RESULTS, {}).data;
    return allResults[levelId] || [];
  }

  saveLevelResult(levelId, result) {
    const allResults = this.load(StorageKeys.LEVEL_RESULTS, {}).data;
    if (!allResults[levelId]) {
      allResults[levelId] = [];
    }

    const resultWithDate = {
      ...result,
      date: new Date().toISOString(),
      levelId: levelId
    };

    allResults[levelId].push(resultWithDate);

    if (allResults[levelId].length > 10) {
      allResults[levelId] = allResults[levelId].slice(-10);
    }

    return this.save(StorageKeys.LEVEL_RESULTS, allResults);
  }

  getCustomLevels() {
    const result = this.load(StorageKeys.CUSTOM_LEVELS, []);
    return result.data;
  }

  saveCustomLevel(levelData) {
    const customLevels = this.getCustomLevels();
    const existingIndex = customLevels.findIndex(l => l.id === levelData.id);

    if (existingIndex !== -1) {
      customLevels[existingIndex] = {
        ...levelData,
        lastModified: new Date().toISOString()
      };
    } else {
      customLevels.push({
        ...levelData,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      });
    }

    return this.save(StorageKeys.CUSTOM_LEVELS, customLevels);
  }

  deleteCustomLevel(levelId) {
    const customLevels = this.getCustomLevels();
    const index = customLevels.findIndex(l => l.id === levelId);

    if (index === -1) {
      return { success: false, message: '关卡不存在' };
    }

    customLevels.splice(index, 1);
    return this.save(StorageKeys.CUSTOM_LEVELS, customLevels);
  }

  saveGameState(gameState) {
    const stateToSave = {
      ...gameState,
      savedAt: new Date().toISOString(),
      version: 1
    };
    return this.save(StorageKeys.SAVED_GAME, stateToSave);
  }

  loadGameState() {
    const result = this.load(StorageKeys.SAVED_GAME, null);
    return result.data;
  }

  hasSavedGame() {
    if (!this.isAvailable) return false;
    const savedGame = localStorage.getItem(StorageKeys.SAVED_GAME);
    return savedGame !== null;
  }

  clearSavedGame() {
    return this.remove(StorageKeys.SAVED_GAME);
  }

  getSettings() {
    const result = this.load(StorageKeys.SETTINGS, {
      soundEnabled: true,
      musicEnabled: true,
      gameSpeed: 1,
      difficulty: 'normal'
    });
    return result.data;
  }

  saveSettings(settings) {
    return this.save(StorageKeys.SETTINGS, settings);
  }

  updateSettings(updates) {
    const settings = this.getSettings();
    const updatedSettings = { ...settings, ...updates };
    return this.saveSettings(updatedSettings);
  }

  exportAllData() {
    const data = {
      playerProfile: this.getPlayerProfile(),
      highScores: this.getHighScores(),
      levelResults: this.load(StorageKeys.LEVEL_RESULTS, {}).data,
      customLevels: this.getCustomLevels(),
      settings: this.getSettings(),
      exportedAt: new Date().toISOString()
    };
    return data;
  }

  importAllData(data) {
    try {
      if (data.playerProfile) {
        this.savePlayerProfile(data.playerProfile);
      }
      if (data.highScores) {
        this.save(StorageKeys.HIGH_SCORES, data.highScores);
      }
      if (data.levelResults) {
        this.save(StorageKeys.LEVEL_RESULTS, data.levelResults);
      }
      if (data.customLevels) {
        this.save(StorageKeys.CUSTOM_LEVELS, data.customLevels);
      }
      if (data.settings) {
        this.saveSettings(data.settings);
      }
      return { success: true, message: '导入成功' };
    } catch (error) {
      return { success: false, message: '导入失败: ' + error.message };
    }
  }

  getStorageUsage() {
    if (!this.isAvailable) {
      return { used: 0, quota: null, available: null };
    }

    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      totalSize += key.length + value.length;
    }

    return {
      used: totalSize,
      usedKB: (totalSize / 1024).toFixed(2),
      quota: null,
      available: null
    };
  }
}

const storageManager = new StorageManager();

export {
  StorageKeys,
  StorageManager,
  storageManager
};
