import { STORAGE_KEYS, MAX_SAVES } from './constants.js';
import { deepClone, validateSaveData, formatTime, generateId } from './utils.js';

class SaveManager {
  constructor() {
    this.storage = window.localStorage;
  }

  saveGame(state, levelId, metadata = {}) {
    try {
      const saves = this.getAllSaves();
      
      const saveData = {
        id: generateId(),
        version: STORAGE_KEYS.SAVE_VERSION,
        timestamp: Date.now(),
        levelId: levelId,
        state: deepClone(state),
        metadata: {
          ...metadata,
          savedAt: formatTime(Date.now())
        }
      };
      
      saves.unshift(saveData);
      
      if (saves.length > MAX_SAVES) {
        saves.splice(MAX_SAVES);
      }
      
      this.storage.setItem(STORAGE_KEYS.GAME_SAVES, JSON.stringify(saves));
      
      return { success: true, save: saveData };
    } catch (error) {
      console.error('保存游戏失败:', error);
      return { success: false, error: error.message };
    }
  }

  loadGame(saveId) {
    try {
      const saves = this.getAllSaves();
      const save = saves.find(s => s.id === saveId);
      
      if (!save) {
        return { success: false, error: '存档不存在' };
      }
      
      const validation = validateSaveData(save);
      if (!validation.valid) {
        const recovered = this.attemptRecovery(save);
        if (recovered) {
          return { 
            success: true, 
            save: recovered, 
            warning: '存档已损坏，已尝试恢复部分数据' 
          };
        }
        return { success: false, error: validation.error };
      }
      
      return { success: true, save: deepClone(save) };
    } catch (error) {
      console.error('读取存档失败:', error);
      return { success: false, error: error.message };
    }
  }

  getAllSaves() {
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.GAME_SAVES);
      if (!raw) return [];
      
      const saves = JSON.parse(raw);
      if (!Array.isArray(saves)) return [];
      
      return saves.filter(save => {
        const validation = validateSaveData(save);
        return validation.valid || this.canBeRecovered(save);
      });
    } catch (error) {
      console.error('读取存档列表失败:', error);
      return [];
    }
  }

  deleteSave(saveId) {
    try {
      const saves = this.getAllSaves();
      const index = saves.findIndex(s => s.id === saveId);
      
      if (index === -1) {
        return { success: false, error: '存档不存在' };
      }
      
      saves.splice(index, 1);
      this.storage.setItem(STORAGE_KEYS.GAME_SAVES, JSON.stringify(saves));
      
      return { success: true };
    } catch (error) {
      console.error('删除存档失败:', error);
      return { success: false, error: error.message };
    }
  }

  clearAllSaves() {
    try {
      this.storage.removeItem(STORAGE_KEYS.GAME_SAVES);
      return { success: true };
    } catch (error) {
      console.error('清除存档失败:', error);
      return { success: false, error: error.message };
    }
  }

  canBeRecovered(save) {
    if (!save || typeof save !== 'object') return false;
    
    return save.levelId && save.state;
  }

  attemptRecovery(save) {
    if (!this.canBeRecovered(save)) return null;
    
    try {
      const recovered = {
        id: save.id || generateId(),
        version: save.version || STORAGE_KEYS.SAVE_VERSION,
        timestamp: save.timestamp || Date.now(),
        levelId: save.levelId,
        state: save.state,
        metadata: {
          ...save.metadata,
          recovered: true,
          savedAt: formatTime(save.timestamp || Date.now())
        }
      };
      
      return recovered;
    } catch (error) {
      console.error('存档恢复失败:', error);
      return null;
    }
  }

  saveCurrentState(state) {
    try {
      this.storage.setItem(
        STORAGE_KEYS.CURRENT_STATE,
        JSON.stringify({
          state: deepClone(state),
          timestamp: Date.now()
        })
      );
      return { success: true };
    } catch (error) {
      console.error('保存当前状态失败:', error);
      return { success: false, error: error.message };
    }
  }

  loadCurrentState() {
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.CURRENT_STATE);
      if (!raw) return { success: false, error: '没有保存的状态' };
      
      const data = JSON.parse(raw);
      return { success: true, data };
    } catch (error) {
      console.error('读取当前状态失败:', error);
      return { success: false, error: error.message };
    }
  }

  clearCurrentState() {
    try {
      this.storage.removeItem(STORAGE_KEYS.CURRENT_STATE);
      return { success: true };
    } catch (error) {
      console.error('清除当前状态失败:', error);
      return { success: false, error: error.message };
    }
  }

  getStorageInfo() {
    let usedBytes = 0;
    let saveCount = 0;
    
    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith('emergency_scheduler_')) {
          const value = this.storage.getItem(key);
          if (value) {
            usedBytes += new Blob([key + value]).size;
            if (key === STORAGE_KEYS.GAME_SAVES) {
              try {
                const saves = JSON.parse(value);
                saveCount = saves.length;
              } catch {
                // 忽略解析错误
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('获取存储信息失败:', error);
    }
    
    return {
      usedBytes,
      usedKB: Math.round(usedBytes / 1024),
      saveCount
    };
  }

  exportSave(saveId) {
    const saves = this.getAllSaves();
    const save = saves.find(s => s.id === saveId);
    
    if (!save) {
      return { success: false, error: '存档不存在' };
    }
    
    return {
      success: true,
      data: JSON.stringify(save, null, 2),
      filename: `save-${save.id}.json`
    };
  }

  importSave(jsonData) {
    try {
      const save = JSON.parse(jsonData);
      
      const validation = validateSaveData(save);
      if (!validation.valid) {
        const recovered = this.attemptRecovery(save);
        if (!recovered) {
          return { success: false, error: validation.error };
        }
        return this.saveGame(recovered.state, recovered.levelId, recovered.metadata);
      }
      
      return this.saveGame(save.state, save.levelId, save.metadata);
    } catch (error) {
      return { success: false, error: 'JSON格式错误: ' + error.message };
    }
  }
}

export const saveManager = new SaveManager();
export default SaveManager;
