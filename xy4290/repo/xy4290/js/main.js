// 主入口文件 - 整合所有模块并处理游戏主循环

import { StateManager } from './stateManager.js';
import { RulesEngine } from './rulesEngine.js';
import { Renderer } from './renderer.js';
import { LevelParser } from './levelParser.js';
import { SaveManager } from './saveManager.js';
import { ImportExportManager } from './importExport.js';
import { GameState, UnitType, CommandType } from './types.js';

/**
 * 游戏主类
 */
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        
        this.stateManager = new StateManager();
        this.rulesEngine = new RulesEngine(this.stateManager);
        this.renderer = new Renderer(this.canvas, this.stateManager, this.rulesEngine);
        this.levelParser = new LevelParser();
        this.saveManager = new SaveManager();
        this.importExportManager = new ImportExportManager();

        this.currentLevelConfig = null;
        this.selectedUnitId = null;
        this.pendingCommands = [];
        this.isGameOver = false;

        this.setupUI();
        this.setupEventListeners();
        this.resizeCanvas();
    }

    /**
     * 设置 UI 元素引用
     */
    setupUI() {
        this.uiElements = {
            undoBtn: document.getElementById('undo-btn'),
            redoBtn: document.getElementById('redo-btn'),
            saveBtn: document.getElementById('save-btn'),
            loadBtn: document.getElementById('load-btn'),
            importBtn: document.getElementById('import-btn'),
            exportBtn: document.getElementById('export-btn'),
            restartBtn: document.getElementById('restart-btn'),
            executeBtn: document.getElementById('execute-btn'),
            levelName: document.getElementById('level-name'),
            timer: document.getElementById('timer'),
            coverage: document.getElementById('coverage'),
            score: document.getElementById('score'),
            selectedUnitInfo: document.getElementById('selected-unit-info'),
            pendingCommands: document.getElementById('pending-commands'),
            gameStatus: document.getElementById('game-status'),
            gameLog: document.getElementById('game-log'),
            messageOverlay: document.getElementById('message-overlay'),
            fileInput: document.getElementById('file-input'),
            repairVehiclesCount: document.getElementById('repair-vehicles-count'),
            generatorsCount: document.getElementById('generators-count'),
            broadcastPointsCount: document.getElementById('broadcast-points-count')
        };
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        this.uiElements.undoBtn.addEventListener('click', () => this.undo());
        this.uiElements.redoBtn.addEventListener('click', () => this.redo());
        this.uiElements.saveBtn.addEventListener('click', () => this.saveGame());
        this.uiElements.loadBtn.addEventListener('click', () => this.loadGame());
        this.uiElements.importBtn.addEventListener('click', () => this.importLevel());
        this.uiElements.exportBtn.addEventListener('click', () => this.exportLevel());
        this.uiElements.restartBtn.addEventListener('click', () => this.restartGame());
        this.uiElements.executeBtn.addEventListener('click', () => this.executeCommands());
        this.uiElements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        this.renderer.addListener((eventType, ...data) => this.handleRendererEvent(eventType, ...data));

        this.stateManager.addListener((eventType) => this.handleStateChange(eventType));

        window.addEventListener('resize', () => this.resizeCanvas());
    }

    /**
     * 调整画布大小
     */
    resizeCanvas() {
        const gameArea = this.canvas.parentElement;
        const width = gameArea.clientWidth - 40;
        const height = gameArea.clientHeight - 40;
        
        this.renderer.resize(Math.max(600, width), Math.max(400, height));
    }

    /**
     * 处理渲染器事件
     * @param {string} eventType - 事件类型
     * @param {*} data - 数据
     */
    handleRendererEvent(eventType, ...data) {
        switch (eventType) {
            case 'unitSelected':
                this.selectedUnitId = data[0];
                this.updateSelectedUnitInfo();
                break;
            case 'unitDeselected':
                this.selectedUnitId = null;
                this.updateSelectedUnitInfo();
                break;
            case 'commandCreated':
                this.addPendingCommand(data[0], data[1]);
                break;
            case 'commandInvalid':
                this.addLog(`指令无效: ${data[0]}`);
                break;
        }
    }

    /**
     * 处理状态变化
     * @param {string} eventType - 事件类型
     */
    handleStateChange(eventType) {
        this.updateUI();
        
        switch (eventType) {
            case 'gameStateChanged':
                this.checkGameEnd();
                break;
            case 'undo':
            case 'redo':
            case 'reset':
            case 'restored':
                this.pendingCommands = [];
                this.updatePendingCommandsUI();
                break;
        }
    }

    /**
     * 初始化游戏
     * @param {Object} levelConfig - 关卡配置
     */
    initialize(levelConfig) {
        this.currentLevelConfig = levelConfig;
        this.stateManager.initialize(levelConfig);
        this.isGameOver = false;
        this.pendingCommands = [];
        this.selectedUnitId = null;

        this.uiElements.levelName.textContent = `关卡: ${levelConfig.name}`;
        
        this.updateUI();
        this.updateSelectedUnitInfo();
        this.updatePendingCommandsUI();
        this.renderer.render();

        this.addLog(`关卡 ${levelConfig.name} 已加载`);
        this.addLog(levelConfig.description);
    }

    /**
     * 撤销操作
     */
    undo() {
        if (this.stateManager.canUndo()) {
            this.stateManager.undo();
            this.addLog('已撤销上一步操作');
        } else {
            this.addLog('没有可撤销的操作');
        }
    }

    /**
     * 重做操作
     */
    redo() {
        if (this.stateManager.canRedo()) {
            this.stateManager.redo();
            this.addLog('已重做操作');
        } else {
            this.addLog('没有可重做的操作');
        }
    }

    /**
     * 保存游戏
     */
    saveGame() {
        if (!this.currentLevelConfig) {
            this.addLog('没有可保存的游戏');
            return;
        }

        const snapshot = this.stateManager.createSnapshot();
        const success = this.saveManager.save(this.currentLevelConfig.id, snapshot);

        if (success) {
            this.addLog('游戏进度已保存');
        } else {
            this.addLog('保存游戏失败');
        }
    }

    /**
     * 加载游戏
     */
    loadGame() {
        if (!this.currentLevelConfig) {
            this.addLog('没有当前关卡，无法加载存档');
            return;
        }

        const saveData = this.saveManager.load(this.currentLevelConfig.id);

        if (saveData) {
            this.stateManager.restoreFromSnapshot(saveData.snapshot);
            this.isGameOver = false;
            this.pendingCommands = [];
            this.addLog('游戏进度已加载');
        } else {
            this.addLog('没有找到该关卡的存档');
        }
    }

    /**
     * 导入关卡
     */
    importLevel() {
        this.importExportManager.triggerFileSelection(
            (levelConfig) => {
                this.initialize(levelConfig);
                this.addLog(`关卡 ${levelConfig.name} 导入成功`);
            },
            (error) => {
                this.addLog(`导入关卡失败: ${error.message}`);
            }
        );
    }

    /**
     * 导出关卡
     */
    exportLevel() {
        if (!this.currentLevelConfig) {
            this.addLog('没有可导出的关卡');
            return;
        }

        const success = this.importExportManager.exportLevel(this.currentLevelConfig);
        
        if (success) {
            this.addLog('关卡已导出');
        } else {
            this.addLog('导出关卡失败');
        }
    }

    /**
     * 处理文件选择
     * @param {Event} event - 文件选择事件
     */
    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const levelConfig = await this.importExportManager.importLevelFromFile(file);
            this.initialize(levelConfig);
            this.addLog(`关卡 ${levelConfig.name} 导入成功`);
        } catch (error) {
            this.addLog(`导入关卡失败: ${error.message}`);
        }

        event.target.value = '';
    }

    /**
     * 重新开始游戏
     */
    restartGame() {
        if (!this.currentLevelConfig) {
            this.addLog('没有可重新开始的关卡');
            return;
        }

        this.stateManager.reset();
        this.isGameOver = false;
        this.pendingCommands = [];
        this.selectedUnitId = null;

        this.updateUI();
        this.updateSelectedUnitInfo();
        this.updatePendingCommandsUI();

        this.addLog('游戏已重新开始');
    }

    /**
     * 添加待执行指令
     * @param {Object} command - 指令
     * @param {Object} validationResult - 验证结果
     */
    addPendingCommand(command, validationResult) {
        const existingIndex = this.pendingCommands.findIndex(
            c => c.unitId === command.unitId
        );

        const commandWithDetails = {
            ...command,
            validationDetails: validationResult.details
        };

        if (existingIndex >= 0) {
            this.pendingCommands[existingIndex] = commandWithDetails;
        } else {
            this.pendingCommands.push(commandWithDetails);
        }

        this.updatePendingCommandsUI();
        this.addLog(`已添加指令: ${this.getCommandDescription(command)}`);
    }

    /**
     * 执行所有待执行指令
     */
    executeCommands() {
        if (this.pendingCommands.length === 0) {
            this.addLog('没有待执行的指令');
            return;
        }

        if (this.isGameOver) {
            this.addLog('游戏已结束，无法执行指令');
            return;
        }

        this.stateManager.saveState();

        for (const command of this.pendingCommands) {
            const result = this.rulesEngine.executeCommand(command);

            if (result.valid) {
                this.addLog(`指令执行成功: ${this.getCommandDescription(command)}`);
            } else {
                this.addLog(`指令执行失败: ${this.getCommandDescription(command)} - ${result.error}`);
            }
        }

        this.stateManager.saveState();

        this.pendingCommands = [];
        this.updatePendingCommandsUI();
        this.updateUI();
        this.renderer.render();
    }

    /**
     * 获取指令描述
     * @param {Object} command - 指令
     * @returns {string} 描述文本
     */
    getCommandDescription(command) {
        const typeDescriptions = {
            [CommandType.MOVE]: '移动',
            [CommandType.REPAIR]: '维修',
            [CommandType.SUPPLY]: '补给',
            [CommandType.DEPLOY]: '部署'
        };

        const unit = this.stateManager.getUnitById(command.unitId);
        const unitName = unit ? (unit.type === UnitType.REPAIR_VEHICLE ? '维修车' : '发电机') : '未知单位';

        return `${unitName} ${typeDescriptions[command.type] || command.type} 到 (${command.target.x}, ${command.target.y})`;
    }

    /**
     * 检查游戏是否结束
     */
    checkGameEnd() {
        const state = this.stateManager.getCurrentState();
        if (!state) return;

        if (state.gameState === GameState.WON) {
            this.isGameOver = true;
            const scoreResult = this.rulesEngine.calculateScore();
            this.showGameEndMessage(true, scoreResult);
        } else if (state.gameState === GameState.LOST) {
            this.isGameOver = true;
            this.showGameEndMessage(false, null);
        }
    }

    /**
     * 显示游戏结束消息
     * @param {boolean} won - 是否获胜
     * @param {Object} scoreResult - 评分结果
     */
    showGameEndMessage(won, scoreResult) {
        const overlay = this.uiElements.messageOverlay;
        let message = '';

        if (won) {
            message = `
                <h2>🎉 恭喜通关！</h2>
                <p>评级: ${scoreResult.grade}</p>
                <p>总分: ${scoreResult.totalScore}</p>
                <p>覆盖率分数: ${scoreResult.breakdown.coverageScore}</p>
                <p>时间分数: ${scoreResult.breakdown.timeScore}</p>
                <p>效率分数: ${scoreResult.breakdown.efficiencyScore}</p>
            `;
        } else {
            message = `
                <h2>😢 游戏结束</h2>
                <p>时间耗尽，未能达到目标覆盖率</p>
                <p>当前覆盖率: ${this.stateManager.getCurrentState().coverage}%</p>
                <p>目标覆盖率: ${this.currentLevelConfig.targetCoverage}%</p>
            `;
        }

        overlay.innerHTML = message;
        overlay.classList.add('visible');

        setTimeout(() => {
            overlay.addEventListener('click', () => {
                overlay.classList.remove('visible');
            }, { once: true });
        }, 100);

        if (won) {
            this.addLog(`恭喜通关！评级: ${scoreResult.grade}, 总分: ${scoreResult.totalScore}`);
        } else {
            this.addLog('游戏结束，未能达到目标覆盖率');
        }
    }

    /**
     * 更新 UI
     */
    updateUI() {
        const state = this.stateManager.getCurrentState();
        const config = this.currentLevelConfig;

        if (!state || !config) return;

        const minutes = Math.floor(state.currentTime / 60);
        const seconds = Math.floor(state.currentTime % 60);
        this.uiElements.timer.textContent = `时间: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        this.uiElements.coverage.textContent = `覆盖: ${state.coverage}%`;

        const scoreResult = this.rulesEngine.calculateScore();
        this.uiElements.score.textContent = `评分: ${scoreResult.totalScore}`;

        const repairVehicles = state.units.filter(u => u.type === UnitType.REPAIR_VEHICLE).length;
        const generators = state.units.filter(u => u.type === UnitType.GENERATOR).length;
        
        let broadcastPoints = 0;
        for (const row of state.cells) {
            for (const cell of row) {
                if (cell.hasBroadcast) broadcastPoints++;
            }
        }

        this.uiElements.repairVehiclesCount.textContent = repairVehicles;
        this.uiElements.generatorsCount.textContent = generators;
        this.uiElements.broadcastPointsCount.textContent = broadcastPoints;

        this.uiElements.undoBtn.disabled = !this.stateManager.canUndo();
        this.uiElements.redoBtn.disabled = !this.stateManager.canRedo();

        const statusMessage = this.uiElements.gameStatus.querySelector('.status-message');
        if (state.gameState === GameState.WON) {
            statusMessage.textContent = '游戏胜利！';
            statusMessage.classList.add('failed');
        } else if (state.gameState === GameState.LOST) {
            statusMessage.textContent = '游戏失败';
            statusMessage.classList.add('failed');
        } else {
            statusMessage.textContent = '游戏进行中';
            statusMessage.classList.remove('failed');
        }

        this.renderer.render();
    }

    /**
     * 更新选中单位信息
     */
    updateSelectedUnitInfo() {
        const container = this.uiElements.selectedUnitInfo;

        if (!this.selectedUnitId) {
            container.innerHTML = '<p>请选择一个单位</p>';
            return;
        }

        const unit = this.stateManager.getUnitById(this.selectedUnitId);
        if (!unit) {
            container.innerHTML = '<p>单位不存在</p>';
            return;
        }

        const unitType = unit.type === UnitType.REPAIR_VEHICLE ? '维修车' : '发电机';
        
        let extraInfo = '';
        if (unit.type === UnitType.REPAIR_VEHICLE) {
            extraInfo = `
                <p>载重: ${unit.currentLoad}/${unit.capacity}</p>
                <p>修复速度: ${unit.repairSpeed}x</p>
            `;
        } else if (unit.type === UnitType.GENERATOR) {
            extraInfo = `
                <p>输出功率: ${unit.powerOutput}</p>
                <p>状态: ${unit.isDeployed ? '已部署' : '未部署'}</p>
            `;
        }

        container.innerHTML = `
            <p><strong>${unitType}</strong></p>
            <p>ID: ${unit.id}</p>
            <p>位置: (${unit.position.x}, ${unit.position.y})</p>
            <p>移动速度: ${unit.moveSpeed}秒/格</p>
            <p>油量: ${unit.fuel}/${unit.maxFuel}</p>
            ${extraInfo}
        `;
    }

    /**
     * 更新待执行指令 UI
     */
    updatePendingCommandsUI() {
        const container = this.uiElements.pendingCommands;
        const executeBtn = this.uiElements.executeBtn;

        if (this.pendingCommands.length === 0) {
            container.innerHTML = '<p>暂无可执行指令</p>';
            executeBtn.disabled = true;
            return;
        }

        executeBtn.disabled = false;

        let html = '<ul style="list-style: none; padding: 0; margin: 0;">';
        
        for (const command of this.pendingCommands) {
            const unit = this.stateManager.getUnitById(command.unitId);
            const unitName = unit ? (unit.type === UnitType.REPAIR_VEHICLE ? '维修车' : '发电机') : '未知';
            
            const typeNames = {
                [CommandType.MOVE]: '移动',
                [CommandType.REPAIR]: '维修',
                [CommandType.SUPPLY]: '补给',
                [CommandType.DEPLOY]: '部署'
            };

            const time = command.estimatedTime || 0;
            const timeStr = time > 60 ? `${Math.floor(time/60)}分${time%60}秒` : `${time}秒`;

            html += `
                <li style="margin-bottom: 8px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px;">
                    <strong>${unitName} ${typeNames[command.type]}</strong><br>
                    目标: (${command.target.x}, ${command.target.y})<br>
                    预计耗时: ${timeStr}
                </li>
            `;
        }

        html += '</ul>';
        container.innerHTML = html;
    }

    /**
     * 添加日志
     * @param {string} message - 日志消息
     */
    addLog(message) {
        const logContainer = this.uiElements.gameLog;
        const time = new Date().toLocaleTimeString();
        const p = document.createElement('p');
        p.textContent = `[${time}] ${message}`;
        logContainer.appendChild(p);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    /**
     * 加载默认关卡
     */
    async loadDefaultLevel() {
        try {
            const response = await fetch('levels/level1.json');
            if (!response.ok) {
                throw new Error('无法加载默认关卡');
            }
            const jsonString = await response.text();
            const levelConfig = this.levelParser.parse(jsonString);
            this.initialize(levelConfig);
        } catch (error) {
            console.error('加载默认关卡失败:', error);
            
            const defaultLevel = this.importExportManager.createLevelTemplate({
                id: 'default_level',
                name: '默认关卡',
                width: 8,
                height: 8,
                timeLimit: 300
            });
            this.initialize(defaultLevel);
        }
    }
}

// 启动游戏
document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.loadDefaultLevel();
});

export default Game;
