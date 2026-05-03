// 主入口文件 - 游戏初始化和UI交互

import { GameController, GameState } from './game/gameController.js';
import { GameRenderer, EditorRenderer } from './ui/renderer.js';
import { Point, ElementType, createDefaultLevel, createMediumLevel, createHardLevel } from './models/level.js';
import { storageManager } from './storage/storage.js';

class App {
    constructor() {
        this.gameController = null;
        this.gameRenderer = null;
        this.editorRenderer = null;
        this.currentScreen = 'main-menu';
        this.selectedTool = ElementType.START_POINT;
        this.polygonPoints = [];
        this.lastResult = null;
        
        this.initializeDefaultLevels();
        this.initializeGame();
        this.bindEvents();
    }
    
    initializeDefaultLevels() {
        const existingLevels = storageManager.getLevels();
        if (existingLevels.length === 0) {
            const defaultLevels = [
                createDefaultLevel(),
                createMediumLevel(),
                createHardLevel()
            ];
            
            for (const level of defaultLevels) {
                storageManager.saveLevel(level);
            }
        }
    }
    
    initializeGame() {
        this.gameController = new GameController({
            onStateChange: (state) => this.handleStateChange(state),
            onPathUpdate: (path) => this.handlePathUpdate(path),
            onGameUpdate: (update) => this.handleGameUpdate(update),
            onMessage: (message, type) => this.showMessage(message, type)
        });
        
        const gameCanvas = document.getElementById('game-canvas');
        if (gameCanvas) {
            this.gameRenderer = new GameRenderer(gameCanvas);
        }
        
        const editorCanvas = document.getElementById('editor-canvas');
        if (editorCanvas) {
            this.editorRenderer = new EditorRenderer(editorCanvas);
        }
    }
    
    bindEvents() {
        document.getElementById('btn-main-menu').addEventListener('click', () => {
            this.showScreen('main-menu');
        });
        document.getElementById('btn-levels').addEventListener('click', () => {
            this.showScreen('level-select');
            this.loadLevelList();
        });
        document.getElementById('btn-editor').addEventListener('click', () => {
            this.gameController.createNewLevel();
            this.showScreen('editor-screen');
            this.renderEditor();
        });
        document.getElementById('btn-history').addEventListener('click', () => {
            this.showScreen('history-screen');
            this.loadHistoryList();
        });
        
        document.getElementById('btn-start-game').addEventListener('click', () => {
            this.showScreen('level-select');
            this.loadLevelList();
        });
        document.getElementById('btn-create-level').addEventListener('click', () => {
            this.gameController.createNewLevel();
            this.showScreen('editor-screen');
            this.renderEditor();
        });
        document.getElementById('btn-view-history').addEventListener('click', () => {
            this.showScreen('history-screen');
            this.loadHistoryList();
        });
        
        document.getElementById('btn-back-from-levels').addEventListener('click', () => {
            this.showScreen('main-menu');
        });
        document.getElementById('btn-back-from-history').addEventListener('click', () => {
            this.showScreen('main-menu');
        });
        
        document.getElementById('btn-execute-plan').addEventListener('click', () => {
            this.gameController.executePlan();
        });
        document.getElementById('btn-undo').addEventListener('click', () => {
            this.gameController.undo();
        });
        document.getElementById('btn-reset').addEventListener('click', () => {
            this.gameController.resetGame();
            this.renderGame();
        });
        document.getElementById('btn-clear-path').addEventListener('click', () => {
            this.gameController.clearPath();
            this.renderGame();
        });
        document.getElementById('btn-replay').addEventListener('click', () => {
            this.gameController.startReplay();
        });
        document.getElementById('btn-export-json').addEventListener('click', () => {
            this.gameController.exportReplay();
        });
        
        document.querySelectorAll('.editor-tool').forEach(button => {
            button.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                this.selectTool(tool);
            });
        });
        
        document.getElementById('btn-save-level').addEventListener('click', () => {
            this.saveCurrentLevel();
        });
        document.getElementById('btn-load-level').addEventListener('click', () => {
            this.showLoadLevelDialog();
        });
        document.getElementById('btn-clear-editor').addEventListener('click', () => {
            this.clearEditor();
        });
        document.getElementById('btn-test-level').addEventListener('click', () => {
            this.testCurrentLevel();
        });
        document.getElementById('btn-back-from-editor').addEventListener('click', () => {
            this.showScreen('main-menu');
        });
        
        document.getElementById('btn-replay-result').addEventListener('click', () => {
            if (this.lastResult && this.lastResult.replayData) {
                this.gameController.startReplay(this.lastResult.replayData);
                this.showScreen('game-screen');
                this.renderGame();
            }
        });
        document.getElementById('btn-export-result').addEventListener('click', () => {
            this.gameController.exportReplay();
        });
        document.getElementById('btn-retry').addEventListener('click', () => {
            this.gameController.resetGame();
            this.showScreen('game-screen');
            this.renderGame();
        });
        document.getElementById('btn-back-to-menu').addEventListener('click', () => {
            this.showScreen('main-menu');
        });
        
        const gameCanvas = document.getElementById('game-canvas');
        if (gameCanvas) {
            gameCanvas.addEventListener('click', (e) => this.handleGameCanvasClick(e));
        }
        
        const editorCanvas = document.getElementById('editor-canvas');
        if (editorCanvas) {
            editorCanvas.addEventListener('click', (e) => this.handleEditorCanvasClick(e));
            editorCanvas.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.cancelPolygonDrawing();
            });
        }
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (e.shiftKey) {
                    this.gameController.redo();
                } else {
                    this.gameController.undo();
                }
            }
            if (e.key === 'Escape') {
                this.cancelPolygonDrawing();
            }
        });
        
        window.addEventListener('resize', () => {
            if (this.currentScreen === 'game-screen') {
                this.renderGame();
            } else if (this.currentScreen === 'editor-screen') {
                this.renderEditor();
            }
        });
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;
        }
    }
    
    handleStateChange(state) {
        console.log('Game state changed:', state);
        
        if (state === GameState.REPLAYING) {
            this.startReplayAnimation();
        }
    }
    
    handlePathUpdate(path) {
        this.renderGame();
    }
    
    handleGameUpdate(update) {
        switch (update.type) {
            case 'UI_UPDATE':
                this.updateGameUI(update.data);
                break;
            case 'RESULT':
                this.showResultScreen(update.data);
                break;
            case 'REPLAY_STEP':
                this.renderGameWithDrone(update.data);
                break;
            case 'LEVEL_UPDATED':
                this.renderEditor();
                break;
        }
    }
    
    updateGameUI(data) {
        document.getElementById('path-length').textContent = `${data.pathLength} 个点`;
        document.getElementById('estimated-energy').textContent = `${data.estimatedEnergy}%`;
        document.getElementById('remaining-battery').textContent = `${data.remainingBattery}%`;
        document.getElementById('rescue-points-status').textContent = 
            `${data.visitedRescuePoints}/${data.totalRescuePoints}`;
    }
    
    showResultScreen(result) {
        this.lastResult = result;
        this.showScreen('result-screen');
        
        document.getElementById('result-title').textContent = result.success ? '任务完成!' : '任务失败';
        document.getElementById('result-level').textContent = result.levelName || '未知关卡';
        document.getElementById('result-score').textContent = result.score || 0;
        document.getElementById('result-battery').textContent = `${result.remainingBattery?.toFixed(1) || 0}%`;
        document.getElementById('result-distance').textContent = `${result.totalDistance?.toFixed(1) || 0} 单位`;
        
        const playedAt = result.playedAt ? new Date(result.playedAt) : new Date();
        document.getElementById('result-time').textContent = 
            `${playedAt.getHours().toString().padStart(2, '0')}:${playedAt.getMinutes().toString().padStart(2, '0')}`;
    }
    
    loadLevelList() {
        const levelListElement = document.getElementById('level-list');
        const levels = this.gameController.getAvailableLevels();
        
        if (levels.length === 0) {
            levelListElement.innerHTML = '<p class="no-levels">暂无可用关卡，请先创建关卡</p>';
            return;
        }
        
        levelListElement.innerHTML = levels.map(levelData => `
            <div class="level-item" data-level-id="${levelData.id}">
                <h3>${levelData.name}</h3>
                <p>创建时间: ${new Date(levelData.createdAt).toLocaleDateString()}</p>
                <p>求救点数: ${levelData.levelData.elements?.filter(e => e.type === 'rescue-point').length || 0}</p>
            </div>
        `).join('');
        
        levelListElement.querySelectorAll('.level-item').forEach(item => {
            item.addEventListener('click', () => {
                const levelId = item.dataset.levelId;
                this.startGame(levelId);
            });
        });
    }
    
    loadHistoryList() {
        const historyListElement = document.getElementById('history-list');
        const history = this.gameController.getGameHistory();
        
        if (history.length === 0) {
            historyListElement.innerHTML = '<p class="no-history">暂无游戏记录</p>';
            return;
        }
        
        historyListElement.innerHTML = history.map(record => `
            <div class="history-item" data-history-id="${record.id}">
                <div class="history-info">
                    <h3>${record.levelName}</h3>
                    <p>时间: ${new Date(record.playedAt).toLocaleString()}</p>
                    <p>状态: ${record.success ? '✓ 成功' : '✗ 失败'}</p>
                    <p>电量剩余: ${record.remainingBattery?.toFixed(1) || 0}%</p>
                </div>
                <div class="history-score">
                    ${record.grade || '-'}
                </div>
                <div class="history-controls">
                    ${record.replayData ? '<button class="btn-replay-history">回放</button>' : ''}
                    <button class="btn-delete-history">删除</button>
                </div>
            </div>
        `).join('');
        
        historyListElement.querySelectorAll('.btn-replay-history').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = btn.closest('.history-item');
                const historyId = item.dataset.historyId;
                this.replayHistory(historyId);
            });
        });
        
        historyListElement.querySelectorAll('.btn-delete-history').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = btn.closest('.history-item');
                const historyId = item.dataset.historyId;
                this.gameController.deleteHistory(historyId);
                this.loadHistoryList();
            });
        });
    }
    
    startGame(levelId) {
        this.gameController.loadLevel(levelId).then(success => {
            if (success) {
                const state = this.gameController.getCurrentState();
                document.getElementById('current-level-name').textContent = state.level.name;
                document.getElementById('initial-battery').textContent = 
                    `${state.level.settings.initialBattery}%`;
                this.updateGameUI({
                    pathLength: state.path.length,
                    estimatedEnergy: '0',
                    remainingBattery: state.remainingBattery,
                    visitedRescuePoints: 0,
                    totalRescuePoints: state.level.rescuePoints.length
                });
                this.showScreen('game-screen');
                this.renderGame();
            }
        });
    }
    
    replayHistory(historyId) {
        const history = this.gameController.getGameHistory();
        const record = history.find(h => h.id === historyId);
        
        if (record && record.replayData && record.levelId) {
            this.gameController.loadLevel(record.levelId).then(() => {
                this.lastResult = record;
                this.gameController.startReplay(record.replayData);
                this.showScreen('game-screen');
                this.renderGame();
            });
        }
    }
    
    renderGame() {
        const state = this.gameController.getCurrentState();
        if (!state.level || !this.gameRenderer) return;
        
        this.gameRenderer.clear();
        this.gameRenderer.drawLevel(state.level);
        
        if (state.path && state.path.length > 0) {
            this.gameRenderer.drawPath(state.path, state.state === GameState.PLANNING);
        }
        
        if (state.dronePosition) {
            this.gameRenderer.drawDrone(state.dronePosition, state.droneRotation);
        }
        
        if (this.gameController.physicsEngine) {
            this.gameRenderer.drawEnergyInfo(
                state.path, 
                state.level, 
                this.gameController.physicsEngine
            );
        }
    }
    
    renderGameWithDrone(data) {
        this.renderGame();
    }
    
    startReplayAnimation() {
        const animate = () => {
            const state = this.gameController.getCurrentState();
            if (state.state === GameState.REPLAYING) {
                this.renderGame();
                requestAnimationFrame(animate);
            }
        };
        animate();
    }
    
    handleGameCanvasClick(e) {
        const state = this.gameController.getCurrentState();
        if (state.state !== GameState.PLANNING) return;
        
        const canvas = e.currentTarget;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.gameController.addPathPoint(x, y);
    }
    
    selectTool(tool) {
        this.selectedTool = tool;
        this.polygonPoints = [];
        
        document.querySelectorAll('.editor-tool').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tool === tool) {
                btn.classList.add('active');
            }
        });
        
        const windOptions = document.getElementById('wind-options');
        if (tool === ElementType.WIND_ZONE) {
            windOptions.classList.remove('hidden');
        } else {
            windOptions.classList.add('hidden');
        }
    }
    
    handleEditorCanvasClick(e) {
        const canvas = e.currentTarget;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const point = new Point(x, y);
        
        if (this.selectedTool === ElementType.START_POINT || 
            this.selectedTool === ElementType.RESCUE_POINT) {
            
            if (this.selectedTool === ElementType.START_POINT) {
                const state = this.gameController.getCurrentState();
                if (state.level.startPoint) {
                    this.gameController.removeEditorElement(state.level.startPoint.id);
                }
            }
            
            this.gameController.addEditorElement(this.selectedTool, point);
            this.renderEditor();
        } else {
            this.polygonPoints.push(point);
            
            if (this.polygonPoints.length >= 3) {
                const firstPoint = this.polygonPoints[0];
                const distToFirst = point.distanceTo(firstPoint);
                
                if (distToFirst < 20 && this.polygonPoints.length >= 3) {
                    this.finishPolygonDrawing();
                }
            }
            
            this.renderEditor();
        }
    }
    
    finishPolygonDrawing() {
        if (this.polygonPoints.length < 3) {
            this.showMessage('多边形至少需要3个点', 'warning');
            return;
        }
        
        let options = {};
        if (this.selectedTool === ElementType.WIND_ZONE) {
            const direction = parseInt(document.getElementById('wind-direction').value) || 0;
            const speed = parseFloat(document.getElementById('wind-speed').value) || 1.0;
            options = { direction, speed };
        }
        
        this.gameController.addEditorElement(this.selectedTool, this.polygonPoints, options);
        this.polygonPoints = [];
        this.renderEditor();
    }
    
    cancelPolygonDrawing() {
        this.polygonPoints = [];
        this.renderEditor();
    }
    
    renderEditor() {
        const state = this.gameController.getCurrentState();
        if (!state.level || !this.editorRenderer) return;
        
        this.editorRenderer.render(state.level, []);
        
        if (this.polygonPoints.length > 0) {
            const ctx = this.editorRenderer.ctx;
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            
            ctx.beginPath();
            ctx.moveTo(this.polygonPoints[0].x, this.polygonPoints[0].y);
            for (let i = 1; i < this.polygonPoints.length; i++) {
                ctx.lineTo(this.polygonPoints[i].x, this.polygonPoints[i].y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            
            for (const point of this.polygonPoints) {
                ctx.fillStyle = '#e74c3c';
                ctx.beginPath();
                ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    
    saveCurrentLevel() {
        const levelName = document.getElementById('level-name').value.trim() || '未命名关卡';
        const battery = parseInt(document.getElementById('level-battery').value) || 100;
        const baseEnergy = parseFloat(document.getElementById('base-energy').value) || 0.1;
        
        const state = this.gameController.getCurrentState();
        state.level.setName(levelName);
        state.level.setSettings({
            initialBattery: battery,
            baseEnergyConsumption: baseEnergy
        });
        
        this.gameController.saveCurrentLevel();
    }
    
    showLoadLevelDialog() {
        const levels = this.gameController.getAvailableLevels();
        
        if (levels.length === 0) {
            this.showMessage('没有可加载的关卡', 'warning');
            return;
        }
        
        const levelNames = levels.map(l => l.name).join('\n');
        const input = prompt(
            `请输入要加载的关卡序号 (1-${levels.length}):\n${levels.map((l, i) => `${i + 1}. ${l.name}`).join('\n')}`
        );
        
        if (input) {
            const index = parseInt(input) - 1;
            if (index >= 0 && index < levels.length) {
                const levelData = levels[index];
                this.gameController.currentLevel = levelData;
                
                const state = this.gameController.getCurrentState();
                this.gameController.physicsEngine = null;
                this.gameController.pathValidator = null;
                
                import('./models/level.js').then(module => {
                    const Level = module.Level;
                    const loadedLevel = Level.fromJSON(levelData.levelData);
                    this.gameController.currentLevel = loadedLevel;
                    this.gameController.currentLevelId = levelData.id;
                    
                    import('./physics/physics.js').then(physicsModule => {
                        import('./validation/pathValidator.js').then(validatorModule => {
                            this.gameController.physicsEngine = 
                                new physicsModule.PhysicsEngine(loadedLevel.settings);
                            this.gameController.pathValidator = 
                                new validatorModule.PathValidator(loadedLevel, this.gameController.physicsEngine);
                            
                            document.getElementById('level-name').value = loadedLevel.name;
                            document.getElementById('level-battery').value = loadedLevel.settings.initialBattery;
                            document.getElementById('base-energy').value = loadedLevel.settings.baseEnergyConsumption;
                            
                            this.renderEditor();
                            this.showMessage('关卡加载成功!', 'success');
                        });
                    });
                });
            } else {
                this.showMessage('无效的序号', 'error');
            }
        }
    }
    
    clearEditor() {
        if (confirm('确定要清空当前关卡吗?')) {
            this.gameController.createNewLevel();
            this.polygonPoints = [];
            document.getElementById('level-name').value = '';
            this.renderEditor();
        }
    }
    
    testCurrentLevel() {
        const state = this.gameController.getCurrentState();
        const validation = state.level.validate();
        
        if (!validation.valid) {
            this.showMessage(validation.errors.join('; '), 'error');
            return;
        }
        
        this.saveCurrentLevel();
        
        if (this.gameController.currentLevelId) {
            this.startGame(this.gameController.currentLevelId);
        }
    }
    
    showMessage(message, type = 'info') {
        const statusBar = document.getElementById('status-bar') || 
                          document.getElementById('editor-status-bar');
        
        if (statusBar) {
            const statusMessage = statusBar.querySelector('span') || statusBar;
            statusMessage.textContent = message;
            
            const originalColor = statusBar.style.backgroundColor;
            switch (type) {
                case 'success':
                    statusBar.style.backgroundColor = '#27ae60';
                    break;
                case 'error':
                    statusBar.style.backgroundColor = '#e74c3c';
                    break;
                case 'warning':
                    statusBar.style.backgroundColor = '#f39c12';
                    break;
                default:
                    statusBar.style.backgroundColor = '#34495e';
            }
            
            setTimeout(() => {
                statusBar.style.backgroundColor = originalColor || '#34495e';
            }, 3000);
        }
        
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
