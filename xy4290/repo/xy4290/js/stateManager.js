// 状态管理模块 - 负责管理游戏状态和撤销/重做功能

import { GameState } from './types.js';

/**
 * 状态管理器类
 * 支持撤销/重做功能，使用命令模式和历史栈
 */
export class StateManager {
    constructor() {
        this.history = [];
        this.currentIndex = -1;
        this.maxHistorySize = 50;
        
        this.currentState = null;
        this.levelConfig = null;
        
        this.listeners = [];
    }

    /**
     * 初始化游戏状态
     * @param {import('./types.js').LevelConfig} levelConfig - 关卡配置
     */
    initialize(levelConfig) {
        this.levelConfig = levelConfig;
        
        this.currentState = this.createInitialState(levelConfig);
        
        this.history = [];
        this.currentIndex = -1;
        
        this.saveState();
        
        this.notifyListeners('initialize');
    }

    /**
     * 创建初始游戏状态
     * @param {import('./types.js').LevelConfig} levelConfig - 关卡配置
     * @returns {import('./types.js').GameSnapshot} 初始游戏状态
     */
    createInitialState(levelConfig) {
        const { grid, initialUnits } = levelConfig;
        
        const cells = grid.cells.map(row => 
            row.map(cell => this.deepClone(cell))
        );
        
        const units = initialUnits.map(unit => this.deepClone(unit));
        
        return {
            timestamp: Date.now(),
            currentTime: 0,
            cells,
            units,
            pendingCommands: [],
            coverage: 0,
            gameState: GameState.PLAYING
        };
    }

    /**
     * 深拷贝对象
     * @param {Object} obj - 要拷贝的对象
     * @returns {Object} 拷贝后的对象
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * 获取当前游戏状态
     * @returns {import('./types.js').GameSnapshot} 当前游戏状态
     */
    getCurrentState() {
        return this.currentState;
    }

    /**
     * 获取关卡配置
     * @returns {import('./types.js').LevelConfig} 关卡配置
     */
    getLevelConfig() {
        return this.levelConfig;
    }

    /**
     * 保存当前状态到历史栈
     */
    saveState() {
        if (!this.currentState) return;
        
        const stateSnapshot = this.deepClone(this.currentState);
        
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }
        
        this.history.push(stateSnapshot);
        
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.currentIndex++;
        }
        
        this.notifyListeners('stateSaved');
    }

    /**
     * 撤销操作
     * @returns {boolean} 是否成功撤销
     */
    undo() {
        if (!this.canUndo()) {
            return false;
        }
        
        this.currentIndex--;
        this.currentState = this.deepClone(this.history[this.currentIndex]);
        
        this.notifyListeners('undo');
        
        return true;
    }

    /**
     * 重做操作
     * @returns {boolean} 是否成功重做
     */
    redo() {
        if (!this.canRedo()) {
            return false;
        }
        
        this.currentIndex++;
        this.currentState = this.deepClone(this.history[this.currentIndex]);
        
        this.notifyListeners('redo');
        
        return true;
    }

    /**
     * 检查是否可以撤销
     * @returns {boolean} 是否可以撤销
     */
    canUndo() {
        return this.currentIndex > 0;
    }

    /**
     * 检查是否可以重做
     * @returns {boolean} 是否可以重做
     */
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }

    /**
     * 添加待执行的指令
     * @param {import('./types.js').Command} command - 要添加的指令
     */
    addCommand(command) {
        if (!this.currentState) return;
        
        const exists = this.currentState.pendingCommands.some(
            c => c.unitId === command.unitId
        );
        
        if (exists) {
            this.currentState.pendingCommands = this.currentState.pendingCommands.filter(
                c => c.unitId !== command.unitId
            );
        }
        
        this.currentState.pendingCommands.push(command);
        
        this.notifyListeners('commandAdded');
    }

    /**
     * 移除指定单位的待执行指令
     * @param {string} unitId - 单位 ID
     */
    removeCommand(unitId) {
        if (!this.currentState) return;
        
        this.currentState.pendingCommands = this.currentState.pendingCommands.filter(
            c => c.unitId !== unitId
        );
        
        this.notifyListeners('commandRemoved');
    }

    /**
     * 清空所有待执行指令
     */
    clearCommands() {
        if (!this.currentState) return;
        
        this.currentState.pendingCommands = [];
        
        this.notifyListeners('commandsCleared');
    }

    /**
     * 获取所有待执行指令
     * @returns {import('./types.js').Command[]} 待执行指令数组
     */
    getPendingCommands() {
        return this.currentState ? this.currentState.pendingCommands : [];
    }

    /**
     * 更新游戏时间
     * @param {number} timeDelta - 时间增量（秒）
     */
    updateTime(timeDelta) {
        if (!this.currentState) return;
        
        this.currentState.currentTime += timeDelta;
        
        if (this.levelConfig && this.currentState.currentTime >= this.levelConfig.timeLimit) {
            this.currentState.gameState = GameState.LOST;
        }
        
        this.notifyListeners('timeUpdated');
    }

    /**
     * 设置当前时间
     * @param {number} time - 当前时间（秒）
     */
    setTime(time) {
        if (!this.currentState) return;
        
        this.currentState.currentTime = time;
        
        this.notifyListeners('timeUpdated');
    }

    /**
     * 更新覆盖率
     * @param {number} coverage - 覆盖率（百分比）
     */
    updateCoverage(coverage) {
        if (!this.currentState) return;
        
        this.currentState.coverage = Math.min(100, Math.max(0, coverage));
        
        this.notifyListeners('coverageUpdated');
    }

    /**
     * 更新游戏状态
     * @param {GameState} gameState - 游戏状态
     */
    updateGameState(gameState) {
        if (!this.currentState) return;
        
        this.currentState.gameState = gameState;
        
        this.notifyListeners('gameStateChanged');
    }

    /**
     * 获取指定 ID 的单位
     * @param {string} unitId - 单位 ID
     * @returns {import('./types.js').RepairVehicle|import('./types.js').Generator|null} 单位对象，如果不存在则返回 null
     */
    getUnitById(unitId) {
        if (!this.currentState) return null;
        
        return this.currentState.units.find(unit => unit.id === unitId) || null;
    }

    /**
     * 更新单位状态
     * @param {string} unitId - 单位 ID
     * @param {Object} updates - 更新的属性
     * @returns {boolean} 是否成功更新
     */
    updateUnit(unitId, updates) {
        const unit = this.getUnitById(unitId);
        
        if (!unit) {
            return false;
        }
        
        Object.assign(unit, updates);
        
        this.notifyListeners('unitUpdated');
        
        return true;
    }

    /**
     * 获取指定位置的格子
     * @param {number} x - X 坐标
     * @param {number} y - Y 坐标
     * @returns {import('./types.js').Cell|null} 格子对象，如果超出范围则返回 null
     */
    getCell(x, y) {
        if (!this.currentState) return null;
        
        const { cells } = this.currentState;
        
        if (y < 0 || y >= cells.length || x < 0 || x >= cells[0].length) {
            return null;
        }
        
        return cells[y][x];
    }

    /**
     * 更新指定位置的格子
     * @param {number} x - X 坐标
     * @param {number} y - Y 坐标
     * @param {Object} updates - 更新的属性
     * @returns {boolean} 是否成功更新
     */
    updateCell(x, y, updates) {
        const cell = this.getCell(x, y);
        
        if (!cell) {
            return false;
        }
        
        Object.assign(cell, updates);
        
        this.notifyListeners('cellUpdated');
        
        return true;
    }

    /**
     * 添加状态变化监听器
     * @param {Function} listener - 监听器函数
     */
    addListener(listener) {
        this.listeners.push(listener);
    }

    /**
     * 移除状态变化监听器
     * @param {Function} listener - 要移除的监听器函数
     */
    removeListener(listener) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    /**
     * 通知所有监听器
     * @param {string} eventType - 事件类型
     */
    notifyListeners(eventType) {
        for (const listener of this.listeners) {
            try {
                listener(eventType, this.currentState);
            } catch (error) {
                console.error('监听器执行出错:', error);
            }
        }
    }

    /**
     * 创建当前状态的快照
     * @returns {import('./types.js').GameSnapshot} 状态快照
     */
    createSnapshot() {
        return this.deepClone(this.currentState);
    }

    /**
     * 从快照恢复状态
     * @param {import('./types.js').GameSnapshot} snapshot - 状态快照
     */
    restoreFromSnapshot(snapshot) {
        this.currentState = this.deepClone(snapshot);
        
        this.saveState();
        
        this.notifyListeners('restored');
    }

    /**
     * 重置到初始状态
     */
    reset() {
        if (!this.levelConfig) return;
        
        this.currentState = this.createInitialState(this.levelConfig);
        
        this.history = [];
        this.currentIndex = -1;
        
        this.saveState();
        
        this.notifyListeners('reset');
    }

    /**
     * 获取历史记录数量
     * @returns {number} 历史记录数量
     */
    getHistoryCount() {
        return this.history.length;
    }

    /**
     * 获取当前历史索引
     * @returns {number} 当前历史索引
     */
    getCurrentIndex() {
        return this.currentIndex;
    }
}

export default StateManager;
