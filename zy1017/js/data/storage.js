const Storage = {
    STORAGE_KEY: 'subway_station_game_save',
    
    getSaveData() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.error('Failed to load save data:', e);
        }
        
        return this.getDefaultSaveData();
    },
    
    getDefaultSaveData() {
        return {
            version: 1,
            levels: {},
            totalScore: 0,
            unlockedLevel: 0
        };
    },
    
    saveData(data) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Failed to save data:', e);
            return false;
        }
    },
    
    getLevelProgress(levelIndex) {
        const data = this.getSaveData();
        return data.levels[levelIndex] || null;
    },
    
    saveLevelProgress(levelIndex, score, stars, time) {
        const data = this.getSaveData();
        
        const existing = data.levels[levelIndex];
        if (!existing || score > existing.score) {
            data.levels[levelIndex] = {
                completed: true,
                score,
                stars,
                bestTime: existing ? Math.min(existing.bestTime || Infinity, time) : time,
                lastPlayed: Date.now()
            };
            
            if (levelIndex + 1 > data.unlockedLevel) {
                data.unlockedLevel = levelIndex + 1;
            }
            
            data.totalScore = Object.values(data.levels).reduce((sum, level) => sum + (level.score || 0), 0);
            
            this.saveData(data);
            return true;
        }
        
        return false;
    },
    
    isLevelUnlocked(levelIndex) {
        const data = this.getSaveData();
        return levelIndex <= data.unlockedLevel;
    },
    
    isLevelCompleted(levelIndex) {
        const progress = this.getLevelProgress(levelIndex);
        return progress && progress.completed;
    },
    
    getLevelStars(levelIndex) {
        const progress = this.getLevelProgress(levelIndex);
        return progress ? progress.stars : 0;
    },
    
    getTotalScore() {
        const data = this.getSaveData();
        return data.totalScore;
    },
    
    resetAllProgress() {
        const defaultData = this.getDefaultSaveData();
        return this.saveData(defaultData);
    },
    
    exportSaveData() {
        const data = this.getSaveData();
        return JSON.stringify(data, null, 2);
    },
    
    importSaveData(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            
            if (!data.version || !data.levels) {
                return { success: false, error: '无效的存档格式' };
            }
            
            return this.saveData(data) 
                ? { success: true }
                : { success: false, error: '保存失败' };
        } catch (e) {
            return { success: false, error: 'JSON 解析失败: ' + e.message };
        }
    }
};

if (typeof module !== 'undefined') {
    module.exports = Storage;
}
