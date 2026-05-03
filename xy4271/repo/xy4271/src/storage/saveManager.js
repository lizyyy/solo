export class SaveManager {
    constructor() {
        this.storageKey = 'metroGameSave';
        this.maxSaves = 5;
    }

    saveGame(gameState, levelId, turn, additionalData = {}) {
        try {
            const saveData = {
                id: this._generateSaveId(),
                levelId,
                turn,
                timestamp: Date.now(),
                gameState: gameState.toJSON(),
                additionalData
            };

            const saves = this.getSaves();
            saves.push(saveData);

            if (saves.length > this.maxSaves) {
                saves.sort((a, b) => b.timestamp - a.timestamp);
                saves.splice(this.maxSaves);
            }

            localStorage.setItem(this.storageKey, JSON.stringify(saves));

            return {
                success: true,
                saveId: saveData.id
            };
        } catch (error) {
            console.error('保存游戏失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    loadGame(saveId) {
        try {
            const saves = this.getSaves();
            const save = saves.find(s => s.id === saveId);

            if (!save) {
                return {
                    success: false,
                    error: '存档不存在'
                };
            }

            return {
                success: true,
                saveData: save
            };
        } catch (error) {
            console.error('加载存档失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    deleteSave(saveId) {
        try {
            let saves = this.getSaves();
            saves = saves.filter(s => s.id !== saveId);
            localStorage.setItem(this.storageKey, JSON.stringify(saves));

            return {
                success: true
            };
        } catch (error) {
            console.error('删除存档失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    getSaves() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('获取存档列表失败:', error);
            return [];
        }
    }

    getLatestSave() {
        const saves = this.getSaves();
        if (saves.length === 0) return null;

        saves.sort((a, b) => b.timestamp - a.timestamp);
        return saves[0];
    }

    clearAllSaves() {
        try {
            localStorage.removeItem(this.storageKey);
            return {
                success: true
            };
        } catch (error) {
            console.error('清除存档失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    exportSave(saveId) {
        const save = this.loadGame(saveId);
        if (!save.success) {
            return null;
        }
        return JSON.stringify(save.saveData, null, 2);
    }

    importSave(saveJson) {
        try {
            const saveData = JSON.parse(saveJson);
            
            if (!this._validateSaveData(saveData)) {
                return {
                    success: false,
                    error: '无效的存档数据'
                };
            }

            const saves = this.getSaves();
            
            saveData.id = this._generateSaveId();
            saveData.timestamp = Date.now();
            saves.push(saveData);

            if (saves.length > this.maxSaves) {
                saves.sort((a, b) => b.timestamp - a.timestamp);
                saves.splice(this.maxSaves);
            }

            localStorage.setItem(this.storageKey, JSON.stringify(saves));

            return {
                success: true,
                saveId: saveData.id
            };
        } catch (error) {
            console.error('导入存档失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    _validateSaveData(saveData) {
        if (!saveData || typeof saveData !== 'object') return false;
        if (!saveData.levelId) return false;
        if (typeof saveData.turn !== 'number') return false;
        if (!saveData.gameState || typeof saveData.gameState !== 'object') return false;
        
        return true;
    }

    _generateSaveId() {
        return `save_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    formatSaveInfo(saveData) {
        const date = new Date(saveData.timestamp);
        const dateStr = date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        return {
            id: saveData.id,
            levelId: saveData.levelId,
            turn: saveData.turn,
            timestamp: saveData.timestamp,
            formattedDate: dateStr,
            additionalData: saveData.additionalData || {}
        };
    }
}
