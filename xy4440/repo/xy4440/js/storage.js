/**
 * 本地存储模块
 */

(function() {
    const STORAGE_KEYS = window.constants.STORAGE_KEYS;

// 存储管理器类
class StorageManager {
    constructor() {
        this.available = this.checkAvailability();
    }
    
    // 检查localStorage是否可用
    checkAvailability() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, testKey);
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            console.warn('localStorage 不可用，数据将不会被持久化保存');
            return false;
        }
    }
    
    // 保存数据
    save(key, data) {
        if (!this.available) return false;
        
        try {
            const jsonString = JSON.stringify(data);
            localStorage.setItem(key, jsonString);
            return true;
        } catch (e) {
            console.error('保存数据失败:', e);
            return false;
        }
    }
    
    // 加载数据
    load(key) {
        if (!this.available) return null;
        
        try {
            const jsonString = localStorage.getItem(key);
            if (jsonString === null) return null;
            return JSON.parse(jsonString);
        } catch (e) {
            console.error('加载数据失败:', e);
            return null;
        }
    }
    
    // 删除数据
    remove(key) {
        if (!this.available) return false;
        
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('删除数据失败:', e);
            return false;
        }
    }
    
    // 清空所有数据
    clear() {
        if (!this.available) return false;
        
        try {
            localStorage.clear();
            return true;
        } catch (e) {
            console.error('清空数据失败:', e);
            return false;
        }
    }
    
    // 保存关卡
    saveLevel(levelData) {
        const levels = this.load(STORAGE_KEYS.LEVELS) || [];
        
        // 检查是否已存在
        const existingIndex = levels.findIndex(l => l.id === levelData.id);
        if (existingIndex > -1) {
            levels[existingIndex] = levelData;
        } else {
            levels.push(levelData);
        }
        
        return this.save(STORAGE_KEYS.LEVELS, levels);
    }
    
    // 加载所有关卡
    loadAllLevels() {
        return this.load(STORAGE_KEYS.LEVELS) || [];
    }
    
    // 保存游戏进度
    saveGame(gameState, slotName = 'default') {
        const savedGames = this.load(STORAGE_KEYS.SAVED_GAMES) || {};
        
        savedGames[slotName] = {
            ...gameState,
            savedAt: new Date().toISOString()
        };
        
        return this.save(STORAGE_KEYS.SAVED_GAMES, savedGames);
    }
    
    // 加载游戏进度
    loadGame(slotName = 'default') {
        const savedGames = this.load(STORAGE_KEYS.SAVED_GAMES) || {};
        return savedGames[slotName] || null;
    }
    
    // 获取所有保存的游戏
    getAllSavedGames() {
        return this.load(STORAGE_KEYS.SAVED_GAMES) || {};
    }
    
    // 保存回放数据
    saveReplay(replayData) {
        const replays = this.load(STORAGE_KEYS.REPLAYS) || [];
        
        const replayWithMeta = {
            ...replayData,
            id: replayData.id || `replay_${Date.now()}`,
            createdAt: new Date().toISOString()
        };
        
        replays.push(replayWithMeta);
        
        // 限制回放数量
        if (replays.length > 20) {
            replays.shift();
        }
        
        return this.save(STORAGE_KEYS.REPLAYS, replays);
    }
    
    // 加载所有回放
    loadAllReplays() {
        return this.load(STORAGE_KEYS.REPLAYS) || [];
    }
    
    // 保存分数
    saveScore(scoreData) {
        const scores = this.load(STORAGE_KEYS.SCORES) || [];
        
        const scoreWithMeta = {
            ...scoreData,
            id: scoreData.id || `score_${Date.now()}`,
            createdAt: new Date().toISOString()
        };
        
        scores.push(scoreWithMeta);
        
        // 按分数排序
        scores.sort((a, b) => b.score - a.score);
        
        // 限制分数数量
        if (scores.length > 100) {
            scores.splice(100);
        }
        
        return this.save(STORAGE_KEYS.SCORES, scores);
    }
    
    // 加载所有分数
    loadAllScores() {
        return this.load(STORAGE_KEYS.SCORES) || [];
    }
    
    // 保存设置
    saveSettings(settings) {
        return this.save(STORAGE_KEYS.SETTINGS, settings);
    }
    
    // 加载设置
    loadSettings() {
        return this.load(STORAGE_KEYS.SETTINGS) || {
            soundEnabled: true,
            musicEnabled: true,
            difficulty: 'normal',
            language: 'zh-CN'
        };
    }
    
    // 导出数据为JSON字符串
    exportData(keys) {
        const data = {};
        
        for (const key of keys) {
            const value = this.load(key);
            if (value !== null) {
                data[key] = value;
            }
        }
        
        return JSON.stringify(data, null, 2);
    }
    
    // 从JSON字符串导入数据
    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            for (const key in data) {
                if (data.hasOwnProperty(key)) {
                    this.save(key, data[key]);
                }
            }
            
            return true;
        } catch (e) {
            console.error('导入数据失败:', e);
            return false;
        }
    }
}

// 导出模块
window.storage = {
    StorageManager
};
})();