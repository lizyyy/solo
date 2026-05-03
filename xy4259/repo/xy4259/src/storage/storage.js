// 状态存储模块 - 本地战绩保存和关卡存储

import { Level, Point, MapElement, ElementType } from '../models/level.js';

const STORAGE_KEYS = {
    LEVELS: 'drone_rescue_levels',
    HISTORY: 'drone_rescue_history',
    SETTINGS: 'drone_rescue_settings',
    CURRENT_GAME: 'drone_rescue_current_game'
};

export class StorageManager {
    constructor() {
        this.storage = window.localStorage;
    }
    
    saveLevel(level) {
        const levels = this.getLevels();
        const existingIndex = levels.findIndex(l => l.id === level.id);
        
        const levelData = {
            id: level.id || this.generateId(),
            name: level.name,
            createdAt: new Date().toISOString(),
            levelData: level.toJSON()
        };
        
        if (existingIndex >= 0) {
            levels[existingIndex] = levelData;
        } else {
            levels.push(levelData);
        }
        
        this.save(STORAGE_KEYS.LEVELS, levels);
        return levelData.id;
    }
    
    getLevels() {
        return this.load(STORAGE_KEYS.LEVELS, []);
    }
    
    getLevel(levelId) {
        const levels = this.getLevels();
        const levelData = levels.find(l => l.id === levelId);
        
        if (levelData) {
            return Level.fromJSON(levelData.levelData);
        }
        
        return null;
    }
    
    deleteLevel(levelId) {
        const levels = this.getLevels();
        const filtered = levels.filter(l => l.id !== levelId);
        this.save(STORAGE_KEYS.LEVELS, filtered);
    }
    
    saveGameHistory(gameResult) {
        const history = this.getGameHistory();
        
        const historyEntry = {
            id: this.generateId(),
            levelId: gameResult.levelId,
            levelName: gameResult.levelName,
            score: gameResult.score,
            grade: gameResult.grade,
            success: gameResult.success,
            remainingBattery: gameResult.remainingBattery,
            totalDistance: gameResult.totalDistance,
            rescuePointsVisited: gameResult.rescuePointsVisited,
            totalRescuePoints: gameResult.totalRescuePoints,
            playedAt: new Date().toISOString(),
            replayData: gameResult.replayData
        };
        
        history.unshift(historyEntry);
        
        const maxHistory = 100;
        if (history.length > maxHistory) {
            history.splice(maxHistory);
        }
        
        this.save(STORAGE_KEYS.HISTORY, history);
        return historyEntry.id;
    }
    
    getGameHistory() {
        return this.load(STORAGE_KEYS.HISTORY, []);
    }
    
    getGameHistoryByLevel(levelId) {
        const history = this.getGameHistory();
        return history.filter(h => h.levelId === levelId);
    }
    
    getBestScoreForLevel(levelId) {
        const history = this.getGameHistoryByLevel(levelId);
        if (history.length === 0) return null;
        
        const successfulGames = history.filter(h => h.success);
        if (successfulGames.length === 0) return null;
        
        return successfulGames.reduce((best, current) => {
            return current.score > best.score ? current : best;
        });
    }
    
    deleteGameHistory(historyId) {
        const history = this.getGameHistory();
        const filtered = history.filter(h => h.id !== historyId);
        this.save(STORAGE_KEYS.HISTORY, filtered);
    }
    
    clearAllHistory() {
        this.save(STORAGE_KEYS.HISTORY, []);
    }
    
    saveCurrentGameState(gameState) {
        this.save(STORAGE_KEYS.CURRENT_GAME, {
            ...gameState,
            savedAt: new Date().toISOString()
        });
    }
    
    getCurrentGameState() {
        return this.load(STORAGE_KEYS.CURRENT_GAME, null);
    }
    
    clearCurrentGameState() {
        this.storage.removeItem(STORAGE_KEYS.CURRENT_GAME);
    }
    
    saveSettings(settings) {
        const currentSettings = this.getSettings();
        const merged = { ...currentSettings, ...settings };
        this.save(STORAGE_KEYS.SETTINGS, merged);
    }
    
    getSettings() {
        return this.load(STORAGE_KEYS.SETTINGS, {
            soundEnabled: true,
            showWindArrows: true,
            showGrid: false,
            defaultBattery: 100
        });
    }
    
    exportAllData() {
        return {
            levels: this.getLevels(),
            history: this.getGameHistory(),
            settings: this.getSettings(),
            exportedAt: new Date().toISOString()
        };
    }
    
    importAllData(data) {
        if (data.levels) {
            this.save(STORAGE_KEYS.LEVELS, data.levels);
        }
        if (data.history) {
            this.save(STORAGE_KEYS.HISTORY, data.history);
        }
        if (data.settings) {
            this.save(STORAGE_KEYS.SETTINGS, data.settings);
        }
    }
    
    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    save(key, data) {
        try {
            this.storage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            throw new Error('存储失败: ' + error.message);
        }
    }
    
    load(key, defaultValue) {
        try {
            const data = this.storage.getItem(key);
            if (data === null) {
                return defaultValue;
            }
            return JSON.parse(data);
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            return defaultValue;
        }
    }
}

export class PathHistoryManager {
    constructor() {
        this.history = [];
        this.currentIndex = -1;
        this.maxHistory = 50;
    }
    
    push(path) {
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }
        
        const pathCopy = path.map(p => ({ x: p.x, y: p.y }));
        this.history.push(pathCopy);
        
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.currentIndex++;
        }
    }
    
    undo() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            return this.history[this.currentIndex].map(p => new Point(p.x, p.y));
        }
        return null;
    }
    
    redo() {
        if (this.currentIndex < this.history.length - 1) {
            this.currentIndex++;
            return this.history[this.currentIndex].map(p => new Point(p.x, p.y));
        }
        return null;
    }
    
    canUndo() {
        return this.currentIndex > 0;
    }
    
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }
    
    clear() {
        this.history = [];
        this.currentIndex = -1;
    }
    
    getCurrentPath() {
        if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
            return this.history[this.currentIndex].map(p => new Point(p.x, p.y));
        }
        return [];
    }
    
    getHistoryLength() {
        return this.history.length;
    }
}

export const storageManager = new StorageManager();
