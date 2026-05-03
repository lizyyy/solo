import { LevelManager } from './levels/levelManager.js';
import { GameState } from './state/gameState.js';
import { HistoryManager } from './state/historyManager.js';
import { RulesEngine } from './engine/rulesEngine.js';
import { SaveManager } from './storage/saveManager.js';

export class Game {
    constructor() {
        this.levelManager = new LevelManager();
        this.gameState = new GameState();
        this.historyManager = new HistoryManager();
        this.rulesEngine = null;
        this.saveManager = new SaveManager();
        this.initialLevelState = null;
        this.renderCallback = null;
    }

    async initialize() {
        await this.levelManager.initialize();
        
        const levelList = this.levelManager.getLevelList();
        if (levelList.builtIn.length > 0) {
            await this.loadLevel(levelList.builtIn[0].id);
        }
    }

    async loadLevel(levelId) {
        const level = this.levelManager.getLevelById(levelId);
        if (!level) {
            return {
                success: false,
                reason: `关卡 ${levelId} 不存在`
            };
        }

        this.gameState.initializeFromLevel(level);
        this.rulesEngine = new RulesEngine(this.gameState);
        this.historyManager.clear();
        this.initialLevelState = this.gameState.clone();
        
        this._triggerRender();
        
        return {
            success: true
        };
    }

    resetLevel() {
        if (!this.initialLevelState) {
            return {
                success: false,
                reason: '没有关卡可重置'
            };
        }

        this.gameState.restoreFrom(this.initialLevelState);
        this.rulesEngine = new RulesEngine(this.gameState);
        this.historyManager.clear();
        
        this._triggerRender();
        
        return {
            success: true
        };
    }

    setRenderCallback(callback) {
        this.renderCallback = callback;
    }

    _triggerRender() {
        if (this.renderCallback) {
            this.renderCallback();
        }
    }

    render() {
        this._triggerRender();
    }

    attemptMoveCar(carId, targetX, targetY) {
        this._saveStateBeforeAction();
        
        const result = this.rulesEngine.executeMove({
            type: 'move_car',
            carId,
            targetX,
            targetY
        });
        
        if (result.success) {
            this._triggerRender();
        }
        
        return result;
    }

    attemptRepair(carId, targetX, targetY) {
        this._saveStateBeforeAction();
        
        const result = this.rulesEngine.executeMove({
            type: 'repair',
            carId,
            targetX,
            targetY
        });
        
        if (result.success) {
            this._triggerRender();
        }
        
        return result;
    }

    attemptPlaceBlock(x, y) {
        this._saveStateBeforeAction();
        
        const result = this.rulesEngine.executeMove({
            type: 'place_block',
            targetX: x,
            targetY: y
        });
        
        if (result.success) {
            this._triggerRender();
        }
        
        return result;
    }

    attemptRemoveBlock(x, y) {
        this._saveStateBeforeAction();
        
        const result = this.rulesEngine.executeMove({
            type: 'remove_block',
            targetX: x,
            targetY: y
        });
        
        if (result.success) {
            this._triggerRender();
        }
        
        return result;
    }

    advanceTurn() {
        this._saveStateBeforeAction();
        
        const result = this.rulesEngine.advanceTurn();
        
        this._triggerRender();
        
        return result;
    }

    _saveStateBeforeAction() {
        const stateSnapshot = this.gameState.toJSON();
        this.historyManager.saveState(stateSnapshot);
    }

    undo() {
        if (!this.historyManager.canUndo()) {
            return {
                success: false,
                reason: '没有可撤销的操作'
            };
        }

        const currentState = this.gameState.toJSON();
        const previousState = this.historyManager.undo(currentState);
        
        if (previousState) {
            this.gameState.restoreFrom(previousState);
            this.rulesEngine = new RulesEngine(this.gameState);
            this._triggerRender();
            
            return {
                success: true
            };
        }
        
        return {
            success: false,
            reason: '撤销失败'
        };
    }

    redo() {
        if (!this.historyManager.canRedo()) {
            return {
                success: false,
                reason: '没有可重做的操作'
            };
        }

        const currentState = this.gameState.toJSON();
        const nextState = this.historyManager.redo(currentState);
        
        if (nextState) {
            this.gameState.restoreFrom(nextState);
            this.rulesEngine = new RulesEngine(this.gameState);
            this._triggerRender();
            
            return {
                success: true
            };
        }
        
        return {
            success: false,
            reason: '重做失败'
        };
    }

    getHistoryStatus() {
        return this.historyManager.getHistorySummary();
    }

    saveProgress() {
        const levelId = this.gameState.getLevelId();
        const turn = this.gameState.getCurrentTurn();
        
        const result = this.saveManager.saveGame(
            this.gameState,
            levelId,
            turn
        );
        
        return result;
    }

    loadProgress() {
        const latestSave = this.saveManager.getLatestSave();
        
        if (!latestSave) {
            return {
                success: false,
                reason: '没有找到存档'
            };
        }

        try {
            this.gameState.restoreFrom(latestSave.gameState);
            this.rulesEngine = new RulesEngine(this.gameState);
            this.historyManager.clear();
            this._triggerRender();
            
            return {
                success: true
            };
        } catch (error) {
            return {
                success: false,
                reason: `加载存档失败: ${error.message}`
            };
        }
    }

    importLevel(levelData) {
        const result = this.levelManager.saveCustomLevel(levelData);
        return result;
    }

    exportCurrentLevel() {
        const data = this.levelManager.exportCurrentLevel();
        if (data) {
            return {
                success: true,
                data
            };
        }
        return {
            success: false,
            reason: '没有可导出的关卡'
        };
    }

    getLevelList() {
        return this.levelManager.getLevelList();
    }

    getCurrentLevelId() {
        return this.gameState.getLevelId();
    }

    getLevelName() {
        return this.gameState.getLevelName();
    }

    getCurrentTurn() {
        return this.gameState.getCurrentTurn();
    }

    getTimeLimit() {
        return this.gameState.getTimeLimit();
    }

    getAverageBattery() {
        return this.gameState.getAverageBattery();
    }

    getRepairedSegmentsCount() {
        return this.gameState.getRepairedSegmentsCount();
    }

    getTotalSegmentsCount() {
        return this.gameState.getTotalSegmentsCount();
    }

    getCarById(carId) {
        return this.gameState.getCarById(carId);
    }

    getCarAtPosition(x, y) {
        const cars = this.gameState.getMaintenanceCars();
        return cars.find(car => car.x === x && car.y === y);
    }

    getLastTrains() {
        return this.gameState.getLastTrains();
    }

    getTrainsAtPosition(x, y) {
        const trains = this.gameState.getLastTrains();
        return trains.filter(train => {
            if (train.status === 'waiting') return false;
            const pos = train.route[train.currentPosition];
            return pos && pos.x === x && pos.y === y;
        });
    }

    getCriticalSegmentAt(x, y) {
        return this.gameState.getCriticalSegmentAt(x, y);
    }

    getBlockAt(x, y) {
        return this.gameState.getBlockAt(x, y);
    }

    getCellAt(x, y) {
        return this.gameState.getCellAt(x, y);
    }

    getGameState() {
        return this.gameState;
    }
}
