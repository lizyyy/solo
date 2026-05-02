/**
 * 本地存储系统
 * 管理关卡数据、游戏进度的本地存储和加载
 */

const STORAGE_KEYS = {
    LEVELS: 'narrow_water_levels',
    GAME_STATE: 'narrow_water_game_state',
    SETTINGS: 'narrow_water_settings'
};

class Storage {
    constructor() {
        this.supported = typeof Storage !== 'undefined';
    }

    isSupported() {
        return this.supported;
    }

    saveLevels(levels) {
        if (!this.supported) return false;
        
        try {
            const data = levels.map(level => level.toJSON());
            localStorage.setItem(STORAGE_KEYS.LEVELS, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('保存关卡失败:', e);
            return false;
        }
    }

    loadLevels() {
        if (!this.supported) return [];
        
        try {
            const data = localStorage.getItem(STORAGE_KEYS.LEVELS);
            if (!data) return [];
            
            const levelData = JSON.parse(data);
            return levelData.map(ld => Level.fromJSON(ld));
        } catch (e) {
            console.error('加载关卡失败:', e);
            return [];
        }
    }

    saveLevel(level) {
        if (!this.supported) return false;
        
        const levels = this.loadLevels();
        const existingIndex = levels.findIndex(l => l.id === level.id);
        
        if (existingIndex >= 0) {
            levels[existingIndex] = level;
        } else {
            levels.push(level);
        }
        
        return this.saveLevels(levels);
    }

    deleteLevel(levelId) {
        if (!this.supported) return false;
        
        const levels = this.loadLevels();
        const filtered = levels.filter(l => l.id !== levelId);
        
        return this.saveLevels(filtered);
    }

    getLevelById(levelId) {
        const levels = this.loadLevels();
        return levels.find(l => l.id === levelId) || null;
    }

    getLevelNames() {
        const levels = this.loadLevels();
        return levels.map(l => ({ id: l.id, name: l.name }));
    }

    saveGameState(engine, level) {
        if (!this.supported) return false;
        
        try {
            const state = {
                timestamp: new Date().toISOString(),
                levelId: level.id,
                levelName: level.name,
                engineState: engine.toJSON(),
                turn: engine.turn,
                penaltyPoints: engine.penaltyPoints,
                incidents: engine.incidents,
                selectedShipId: engine.selectedShipId
            };
            
            localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(state));
            return true;
        } catch (e) {
            console.error('保存游戏状态失败:', e);
            return false;
        }
    }

    loadGameState() {
        if (!this.supported) return null;
        
        try {
            const data = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
            if (!data) return null;
            
            return JSON.parse(data);
        } catch (e) {
            console.error('加载游戏状态失败:', e);
            return null;
        }
    }

    clearGameState() {
        if (!this.supported) return false;
        
        try {
            localStorage.removeItem(STORAGE_KEYS.GAME_STATE);
            return true;
        } catch (e) {
            console.error('清除游戏状态失败:', e);
            return false;
        }
    }

    saveSettings(settings) {
        if (!this.supported) return false;
        
        try {
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
            return true;
        } catch (e) {
            console.error('保存设置失败:', e);
            return false;
        }
    }

    loadSettings() {
        if (!this.supported) return {};
        
        try {
            const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
            if (!data) return {};
            
            return JSON.parse(data);
        } catch (e) {
            console.error('加载设置失败:', e);
            return {};
        }
    }

    exportLevel(level) {
        return JSON.stringify(level.toJSON(), null, 2);
    }

    importLevel(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            return Level.fromJSON(data);
        } catch (e) {
            console.error('导入关卡失败:', e);
            return null;
        }
    }

    exportToFile(level, filename = 'level.json') {
        const jsonString = this.exportLevel(level);
        this.downloadFile(jsonString, filename, 'application/json');
    }

    importFromFile(file, callback) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const level = this.importLevel(e.target.result);
                callback(null, level);
            } catch (err) {
                callback(err, null);
            }
        };
        
        reader.onerror = (e) => {
            callback(e, null);
        };
        
        reader.readAsText(file);
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    clearAll() {
        if (!this.supported) return false;
        
        try {
            localStorage.removeItem(STORAGE_KEYS.LEVELS);
            localStorage.removeItem(STORAGE_KEYS.GAME_STATE);
            localStorage.removeItem(STORAGE_KEYS.SETTINGS);
            return true;
        } catch (e) {
            console.error('清除数据失败:', e);
            return false;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Storage, STORAGE_KEYS };
}
