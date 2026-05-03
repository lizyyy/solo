// 导出模块 - JSON复盘导出和数据导出

import { Point } from '../models/level.js';

export class ReplayExporter {
    constructor() {
        this.version = '1.0.0';
    }
    
    exportReplay(gameResult, level, options = {}) {
        const replayData = {
            version: this.version,
            exportedAt: new Date().toISOString(),
            levelInfo: {
                name: level.name,
                settings: { ...level.settings }
            },
            gameResult: {
                success: gameResult.success,
                score: gameResult.score,
                grade: gameResult.grade,
                remainingBattery: gameResult.remainingBattery,
                totalDistance: gameResult.totalDistance,
                rescuePointsVisited: gameResult.rescuePointsVisited,
                totalRescuePoints: gameResult.totalRescuePoints,
                playedAt: gameResult.playedAt || new Date().toISOString()
            },
            replay: {
                path: gameResult.replayData?.path || [],
                segments: gameResult.replayData?.segments || [],
                events: gameResult.replayData?.events || [],
                statistics: gameResult.replayData?.statistics || {}
            },
            levelSnapshot: level.toJSON()
        };
        
        if (options.includeScoreBreakdown && gameResult.scoreBreakdown) {
            replayData.scoreBreakdown = gameResult.scoreBreakdown;
        }
        
        if (options.includeValidation && gameResult.validationResult) {
            replayData.validation = gameResult.validationResult;
        }
        
        return replayData;
    }
    
    exportToJSON(replayData, prettyPrint = true) {
        if (prettyPrint) {
            return JSON.stringify(replayData, null, 2);
        }
        return JSON.stringify(replayData);
    }
    
    downloadJSON(replayData, filename = null) {
        const jsonString = this.exportToJSON(replayData, true);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const actualFilename = filename || `replay_${Date.now()}.json`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = actualFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    importReplay(jsonString) {
        try {
            const replayData = JSON.parse(jsonString);
            
            if (!replayData.version || !replayData.levelSnapshot) {
                throw new Error('无效的回放数据格式');
            }
            
            return replayData;
        } catch (error) {
            throw new Error('解析回放数据失败: ' + error.message);
        }
    }
}

export class GameDataExporter {
    exportLevelForShare(level) {
        return {
            version: '1.0.0',
            type: 'level',
            exportedAt: new Date().toISOString(),
            level: level.toJSON()
        };
    }
    
    exportGameStatistics(gameHistory, levels) {
        const stats = {
            totalGames: gameHistory.length,
            successfulGames: gameHistory.filter(g => g.success).length,
            failedGames: gameHistory.filter(g => !g.success).length,
            bestScore: 0,
            averageScore: 0,
            levelsPlayed: [],
            recentGames: []
        };
        
        const successfulGames = gameHistory.filter(g => g.success);
        if (successfulGames.length > 0) {
            stats.bestScore = Math.max(...successfulGames.map(g => g.score));
            stats.averageScore = successfulGames.reduce((sum, g) => sum + g.score, 0) / successfulGames.length;
        }
        
        const levelStats = {};
        for (const game of gameHistory) {
            if (!levelStats[game.levelId]) {
                levelStats[game.levelId] = {
                    levelId: game.levelId,
                    levelName: game.levelName,
                    plays: 0,
                    wins: 0,
                    bestScore: 0
                };
            }
            levelStats[game.levelId].plays++;
            if (game.success) {
                levelStats[game.levelId].wins++;
                if (game.score > levelStats[game.levelId].bestScore) {
                    levelStats[game.levelId].bestScore = game.score;
                }
            }
        }
        stats.levelsPlayed = Object.values(levelStats);
        
        stats.recentGames = gameHistory.slice(0, 10).map(g => ({
            id: g.id,
            levelName: g.levelName,
            score: g.score,
            grade: g.grade,
            success: g.success,
            playedAt: g.playedAt
        }));
        
        return {
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            statistics: stats
        };
    }
    
    createBackup(storageManager) {
        return {
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            backupType: 'full',
            data: {
                levels: storageManager.getLevels(),
                history: storageManager.getGameHistory(),
                settings: storageManager.getSettings()
            }
        };
    }
    
    restoreBackup(backupData, storageManager) {
        if (!backupData.data) {
            throw new Error('无效的备份数据');
        }
        
        if (backupData.data.levels) {
            for (const level of backupData.data.levels) {
                storageManager.save(backupData.data.levels);
            }
        }
        
        if (backupData.data.history) {
            storageManager.save(backupData.data.history);
        }
        
        if (backupData.data.settings) {
            storageManager.saveSettings(backupData.data.settings);
        }
        
        return true;
    }
}

export const replayExporter = new ReplayExporter();
export const gameDataExporter = new GameDataExporter();
