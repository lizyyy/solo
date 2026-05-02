/**
 * 存储模块
 * 负责方案保存和最佳方案记录
 */

const STORAGE_KEY = 'smoke_evacuation_saves';
const BEST_KEY = 'smoke_evacuation_best';

export class StorageManager {
    constructor() {
        this.saves = this._loadSavesFromStorage();
        this.best = this._loadBestFromStorage();
    }

    _loadSavesFromStorage() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Failed to load saves:', e);
            return {};
        }
    }

    _loadBestFromStorage() {
        try {
            const data = localStorage.getItem(BEST_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Failed to load best:', e);
            return {};
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.saves));
            localStorage.setItem(BEST_KEY, JSON.stringify(this.best));
            return true;
        } catch (e) {
            console.error('Failed to save to storage:', e);
            return false;
        }
    }

    saveLevel(levelId, placedItems, name = null) {
        const saveId = name || `save_${Date.now()}`;
        
        if (!this.saves[levelId]) {
            this.saves[levelId] = [];
        }
        
        const saveData = {
            id: saveId,
            levelId,
            name: name || `方案 ${this.saves[levelId].length + 1}`,
            placedItems: JSON.parse(JSON.stringify(placedItems)),
            createdAt: new Date().toISOString(),
            timestamp: Date.now()
        };
        
        this.saves[levelId].push(saveData);
        this.saveToStorage();
        
        return saveData;
    }

    loadLevel(levelId, saveId) {
        const levelSaves = this.saves[levelId];
        if (!levelSaves) return null;
        
        return levelSaves.find(save => save.id === saveId) || null;
    }

    getLevelSaves(levelId) {
        return this.saves[levelId] || [];
    }

    deleteSave(levelId, saveId) {
        const levelSaves = this.saves[levelId];
        if (!levelSaves) return false;
        
        const index = levelSaves.findIndex(save => save.id === saveId);
        if (index === -1) return false;
        
        levelSaves.splice(index, 1);
        this.saveToStorage();
        return true;
    }

    saveBest(levelId, placedItems, result) {
        const currentBest = this.best[levelId];
        
        const shouldSave = !currentBest || 
            result.score > currentBest.score ||
            (result.score === currentBest.score && result.grade > currentBest.grade);
        
        if (shouldSave) {
            this.best[levelId] = {
                levelId,
                placedItems: JSON.parse(JSON.stringify(placedItems)),
                score: result.score,
                grade: result.grade,
                issues: result.issues,
                createdAt: new Date().toISOString(),
                timestamp: Date.now()
            };
            this.saveToStorage();
            return true;
        }
        
        return false;
    }

    loadBest(levelId) {
        return this.best[levelId] || null;
    }

    hasBest(levelId) {
        return !!this.best[levelId];
    }

    exportAllData() {
        return {
            saves: this.saves,
            best: this.best,
            exportedAt: new Date().toISOString()
        };
    }

    importAllData(data) {
        try {
            if (data.saves) {
                this.saves = data.saves;
            }
            if (data.best) {
                this.best = data.best;
            }
            this.saveToStorage();
            return true;
        } catch (e) {
            console.error('Failed to import data:', e);
            return false;
        }
    }

    clearAll() {
        this.saves = {};
        this.best = {};
        this.saveToStorage();
    }

    clearLevelData(levelId) {
        delete this.saves[levelId];
        delete this.best[levelId];
        this.saveToStorage();
    }

    getStorageStats() {
        let totalSaves = 0;
        const levelCounts = {};
        
        Object.keys(this.saves).forEach(levelId => {
            const count = this.saves[levelId].length;
            totalSaves += count;
            levelCounts[levelId] = count;
        });
        
        return {
            totalSaves,
            bestSaves: Object.keys(this.best).length,
            levelCounts
        };
    }
}

export const storageManager = new StorageManager();
