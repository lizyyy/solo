class StorageManager {
    constructor() {
        this.storageKey = CONFIG.STORAGE.HIGH_SCORE_KEY;
        this.recordsKey = CONFIG.STORAGE.GAME_RECORD_KEY;
        this.settingsKey = CONFIG.STORAGE.SETTINGS_KEY;
    }

    saveHighScore(score, levelId = 'level1') {
        try {
            const highScores = this.getHighScores();
            
            if (!highScores[levelId] || score > highScores[levelId].score) {
                highScores[levelId] = {
                    score: score,
                    date: new Date().toISOString(),
                    levelId: levelId
                };
                
                localStorage.setItem(this.storageKey, JSON.stringify(highScores));
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error saving high score:', error);
            return false;
        }
    }

    getHighScore(levelId = 'level1') {
        try {
            const highScores = this.getHighScores();
            return highScores[levelId] || { score: 0, date: null, levelId: levelId };
        } catch (error) {
            console.error('Error getting high score:', error);
            return { score: 0, date: null, levelId: levelId };
        }
    }

    getHighScores() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('Error getting high scores:', error);
            return {};
        }
    }

    getOverallHighestScore() {
        const highScores = this.getHighScores();
        let highest = 0;
        
        for (const levelId in highScores) {
            if (highScores[levelId].score > highest) {
                highest = highScores[levelId].score;
            }
        }
        
        return highest;
    }

    saveGameRecord(record) {
        try {
            const records = this.getGameRecords();
            
            const newRecord = {
                id: Utils.generateId(),
                ...record,
                timestamp: Date.now(),
                date: new Date().toISOString()
            };
            
            records.push(newRecord);
            
            if (records.length > 20) {
                records.shift();
            }
            
            localStorage.setItem(this.recordsKey, JSON.stringify(records));
            return newRecord.id;
        } catch (error) {
            console.error('Error saving game record:', error);
            return null;
        }
    }

    getGameRecords() {
        try {
            const data = localStorage.getItem(this.recordsKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error getting game records:', error);
            return [];
        }
    }

    getGameRecord(id) {
        const records = this.getGameRecords();
        return records.find(r => r.id === id) || null;
    }

    clearGameRecords() {
        try {
            localStorage.removeItem(this.recordsKey);
            return true;
        } catch (error) {
            console.error('Error clearing game records:', error);
            return false;
        }
    }

    exportGameRecordToJSON(record) {
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            gameData: record
        };
        
        return JSON.stringify(exportData, null, 2);
    }

    createReplayData(gameInstance) {
        const replayData = {
            levelId: gameInstance.levelId,
            levelName: gameInstance.levelData?.name,
            startTime: gameInstance.startTime,
            endTime: Date.now(),
            totalGameTime: gameInstance.timer?.getTime() || 0,
            finalScore: gameInstance.scoringSystem?.getScoreBreakdown() || {},
            missions: gameInstance.missionStateMachine?.getAllMissions() || {},
            events: {
                all: gameInstance.eventManager?.getAllEvents() || [],
                triggered: gameInstance.eventManager?.getTriggeredEvents() || []
            },
            resources: {
                aed: gameInstance.aed ? {
                    used: gameInstance.aed.used,
                    battery: gameInstance.aed.battery,
                    disabled: gameInstance.aed.disabled,
                    path: gameInstance.aed.path
                } : null,
                volunteer: gameInstance.volunteer ? {
                    hasAED: gameInstance.volunteer.hasAED,
                    atPatient: gameInstance.volunteer.atPatient,
                    path: gameInstance.volunteer.path
                } : null,
                ambulance: gameInstance.ambulance ? {
                    arrived: gameInstance.ambulance.arrived,
                    path: gameInstance.ambulance.path
                } : null
            },
            logEntries: gameInstance.logEntries || [],
            gameState: gameInstance.stateMachine?.getState() || {}
        };
        
        return replayData;
    }

    saveSettings(settings) {
        try {
            const currentSettings = this.getSettings();
            const updatedSettings = { ...currentSettings, ...settings };
            localStorage.setItem(this.settingsKey, JSON.stringify(updatedSettings));
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }

    getSettings() {
        try {
            const data = localStorage.getItem(this.settingsKey);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('Error getting settings:', error);
            return {};
        }
    }

    clearAllData() {
        try {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.recordsKey);
            localStorage.removeItem(this.settingsKey);
            return true;
        } catch (error) {
            console.error('Error clearing all data:', error);
            return false;
        }
    }

    isStorageAvailable() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, testKey);
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }
}

window.StorageManager = StorageManager;