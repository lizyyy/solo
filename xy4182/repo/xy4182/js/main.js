/**
 * 窄水道避碰演练 - 主程序
 * 整合所有模块，管理游戏生命周期和UI交互
 */

const AppState = {
    INITIALIZING: 'initializing',
    READY: 'ready',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'game_over'
};

class GameApp {
    constructor() {
        this.state = AppState.INITIALIZING;
        
        this.engine = null;
        this.editor = null;
        this.renderer = null;
        this.inputHandler = null;
        this.storage = null;
        this.undoManager = null;
        this.replaySystem = null;
        this.markdownExporter = null;
        this.jsonExporter = null;
        
        this.currentLevel = null;
        this.levels = [];
        
        this.init();
    }

    init() {
        console.log('正在初始化窄水道避碰演练...');
        
        this.initModules();
        
        this.initUI();
        
        this.loadSampleLevels();
        
        this.loadLocalLevels();
        
        this.initDefaultLevel();
        
        this.bindEvents();
        
        this.state = AppState.READY;
        
        this.updateUI();
        this.renderer.render();
        
        console.log('初始化完成！');
    }

    initModules() {
        this.engine = new GameEngine();
        
        this.editor = new LevelEditor(this.engine);
        
        this.renderer = new Renderer(
            document.getElementById('game-canvas'),
            this.engine,
            this.editor
        );
        
        this.inputHandler = new InputHandler(this.engine, this.editor, this.renderer);
        
        this.storage = new Storage();
        
        this.undoManager = new UndoManager(this.engine, this.editor, this.renderer);
        
        this.replaySystem = new ReplaySystem(this.engine, this.renderer);
        
        this.markdownExporter = null;
        
        this.jsonExporter = null;
    }

    initUI() {
        this.updateLevelList();
        this.updateModeButtons();
        this.updateToolButtons();
    }

    loadSampleLevels() {
        try {
            const sampleLevels = SampleLevels.getAllLevels();
            for (const level of sampleLevels) {
                level.isSample = true;
                this.levels.push(level);
            }
            console.log(`已加载 ${sampleLevels.length} 个示例关卡`);
        } catch (e) {
            console.error('加载示例关卡失败:', e);
        }
    }

    loadLocalLevels() {
        try {
            const localLevels = this.storage.loadLevels();
            for (const level of localLevels) {
                const existing = this.levels.find(l => l.id === level.id);
                if (!existing) {
                    level.isSample = false;
                    this.levels.push(level);
                }
            }
            console.log(`已加载 ${localLevels.length} 个本地关卡`);
        } catch (e) {
            console.error('加载本地关卡失败:', e);
        }
    }

    initDefaultLevel() {
        if (this.levels.length > 0) {
            this.loadLevel(this.levels[0]);
        } else {
            this.createNewLevel();
        }
    }

    createNewLevel() {
        const level = new Level({
            name: '新关卡',
            description: '新建的关卡',
            author: '教师',
            difficulty: 'easy',
            totalTurns: 20
        });
        
        const boardData = level.boardData;
        boardData.grid = [];
        
        for (let y = 0; y < boardData.height; y++) {
            const row = [];
            for (let x = 0; x < boardData.width; x++) {
                row.push({
                    terrain: TerrainType.DEEP_WATER,
                    speedLimit: 2,
                    berthId: null,
                    currentId: null
                });
            }
            boardData.grid.push(row);
        }
        
        this.currentLevel = level;
        this.editor.setLevel(level);
        this.engine.initLevel(level);
        
        this.updateUI();
        this.renderer.render();
        
        return level;
    }

    loadLevel(level) {
        this.currentLevel = level.clone();
        this.editor.setLevel(this.currentLevel);
        this.engine.initLevel(this.currentLevel);
        
        document.getElementById('level-name').textContent = `关卡: ${level.name}`;
        
        this.updateUI();
        this.renderer.render();
        
        this.undoManager.clear();
        
        console.log(`已加载关卡: ${level.name}`);
    }

    saveCurrentLevel() {
        if (!this.currentLevel) return false;
        
        this.currentLevel.updatedAt = new Date().toISOString();
        
        const result = this.storage.saveLevel(this.currentLevel);
        
        if (result) {
            const existingIndex = this.levels.findIndex(l => l.id === this.currentLevel.id);
            if (existingIndex >= 0) {
                this.levels[existingIndex] = this.currentLevel;
            } else {
                this.currentLevel.isSample = false;
                this.levels.push(this.currentLevel);
            }
            
            this.updateLevelList();
            console.log('关卡已保存');
        }
        
        return result;
    }

    deleteLevel(levelId) {
        const index = this.levels.findIndex(l => l.id === levelId);
        if (index < 0) return false;
        
        const level = this.levels[index];
        if (level.isSample) {
            alert('示例关卡不能删除');
            return false;
        }
        
        this.storage.deleteLevel(levelId);
        this.levels.splice(index, 1);
        
        if (this.currentLevel && this.currentLevel.id === levelId) {
            if (this.levels.length > 0) {
                this.loadLevel(this.levels[0]);
            } else {
                this.createNewLevel();
            }
        }
        
        this.updateLevelList();
        console.log('关卡已删除');
        
        return true;
    }

    switchToEditMode() {
        this.engine.setMode(GameMode.EDIT);
        this.editor.setTool(EditTool.DEEP_WATER);
        
        document.getElementById('play-controls').style.display = 'none';
        
        this.updateModeButtons();
        this.updateToolButtons();
        this.updateInfoText('编辑模式：选择工具开始绘制关卡');
        
        this.renderer.render();
    }

    switchToPlayMode() {
        const validation = this.editor.validateLevel();
        
        if (!validation.valid) {
            alert('关卡验证失败：\n' + validation.issues.map(i => '- ' + i.message).join('\n'));
            return;
        }
        
        this.engine.setMode(GameMode.PLAY);
        this.engine.startGame();
        
        document.getElementById('play-controls').style.display = 'block';
        
        this.undoManager.saveState();
        
        this.updateModeButtons();
        this.updateInfoText('演练模式：点击船舶选中，再点击目标位置规划移动');
        
        this.updateUI();
        this.renderer.render();
    }

    restartLevel() {
        if (this.currentLevel) {
            this.loadLevel(this.currentLevel);
            if (this.engine.getMode() === GameMode.PLAY) {
                this.switchToPlayMode();
            }
        }
    }

    executeTurn() {
        if (this.engine.getMode() !== GameMode.PLAY) return;
        
        if (!this.engine.allControllableShipsMoved()) {
            const unmoved = this.engine.getControllableShips().filter(
                s => !this.engine.pendingMoves.has(s.id)
            );
            this.updateInfoText(`请为以下船舶规划移动: ${unmoved.map(s => s.name).join(', ')}`);
            return;
        }
        
        this.undoManager.saveState();
        
        this.engine.executeTurn();
        
        this.updateUI();
        this.renderer.render();
    }

    undo() {
        if (this.undoManager.canUndo()) {
            this.undoManager.undo();
            this.updateInfoText('已撤销上一步操作');
        } else {
            this.updateInfoText('没有可撤销的操作');
        }
    }

    exportMarkdown() {
        try {
            const exporter = new MarkdownExporter(this.engine, this.currentLevel, this.replaySystem);
            const markdown = exporter.generateReview();
            
            const filename = `复盘_${this.currentLevel.name}_${new Date().toISOString().slice(0, 10)}.md`;
            this.storage.downloadFile(markdown, filename, 'text/markdown');
            
            this.updateInfoText(`复盘报告已导出: ${filename}`);
        } catch (e) {
            console.error('导出Markdown失败:', e);
            alert('导出失败: ' + e.message);
        }
    }

    exportJSON() {
        try {
            const exporter = new JSONExporter(this.engine, this.currentLevel, this.replaySystem);
            const jsonData = exporter.exportReplayJSON();
            
            const filename = `回放_${this.currentLevel.name}_${new Date().toISOString().slice(0, 10)}.json`;
            this.storage.downloadFile(jsonData, filename, 'application/json');
            
            this.updateInfoText(`回放数据已导出: ${filename}`);
        } catch (e) {
            console.error('导出JSON失败:', e);
            alert('导出失败: ' + e.message);
        }
    }

    bindEvents() {
        document.getElementById('btn-edit-mode').addEventListener('click', () => {
            this.switchToEditMode();
        });
        
        document.getElementById('btn-play-mode').addEventListener('click', () => {
            this.switchToPlayMode();
        });
        
        document.getElementById('btn-undo').addEventListener('click', () => {
            this.undo();
        });
        
        document.getElementById('btn-next-turn').addEventListener('click', () => {
            this.executeTurn();
        });
        
        document.getElementById('btn-restart').addEventListener('click', () => {
            this.restartLevel();
        });
        
        document.getElementById('btn-export-md').addEventListener('click', () => {
            this.exportMarkdown();
        });
        
        document.getElementById('btn-export-json').addEventListener('click', () => {
            this.exportJSON();
        });
        
        document.getElementById('btn-new-level').addEventListener('click', () => {
            this.createNewLevel();
            this.switchToEditMode();
        });
        
        document.getElementById('btn-save-level').addEventListener('click', () => {
            if (this.saveCurrentLevel()) {
                alert('关卡已保存');
            } else {
                alert('保存失败');
            }
        });
        
        document.getElementById('btn-load-level').addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json';
            
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.storage.importFromFile(file, (err, level) => {
                        if (err) {
                            alert('导入失败: ' + err.message);
                        } else {
                            this.currentLevel = level;
                            this.editor.setLevel(level);
                            this.engine.initLevel(level);
                            this.levels.push(level);
                            this.updateLevelList();
                            this.updateUI();
                            this.renderer.render();
                            alert('关卡导入成功');
                        }
                    });
                }
            });
            
            fileInput.click();
        });
        
        const editButtons = document.querySelectorAll('.edit-btn');
        editButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                const editTool = this.mapToolName(tool);
                if (editTool) {
                    this.editor.setTool(editTool);
                    this.updateToolButtons();
                    this.updateInfoText(`已选择工具: ${this.getToolDisplayName(editTool)}`);
                }
            });
        });
        
        this.engine.on('incident', (incident) => {
            console.log('发生事件:', incident);
        });
        
        this.engine.on('gameEnd', (data) => {
            this.state = AppState.GAME_OVER;
            console.log('游戏结束:', data);
        });
    }

    mapToolName(tool) {
        const mapping = {
            'select': EditTool.SELECT,
            'deep-water': EditTool.DEEP_WATER,
            'shallow-water': EditTool.SHALLOW_WATER,
            'speed-limit': EditTool.SPEED_LIMIT,
            'berth': EditTool.BERTH,
            'current': EditTool.CURRENT,
            'tug': EditTool.TUG,
            'cargo': EditTool.CARGO,
            'other-ship': EditTool.OTHER
        };
        return mapping[tool];
    }

    getToolDisplayName(tool) {
        const names = {
            [EditTool.SELECT]: '选择',
            [EditTool.DEEP_WATER]: '深水航道',
            [EditTool.SHALLOW_WATER]: '浅滩',
            [EditTool.SPEED_LIMIT]: '限速区',
            [EditTool.BERTH]: '泊位',
            [EditTool.CURRENT]: '潮流',
            [EditTool.TUG]: '拖轮',
            [EditTool.CARGO]: '货船',
            [EditTool.OTHER]: '来船'
        };
        return names[tool] || '未知';
    }

    updateUI() {
        const state = this.engine.getGameState();
        
        document.getElementById('turn-counter').textContent = `回合: ${state.turn}/${this.engine.totalTurns}`;
        document.getElementById('score').textContent = `扣分: ${state.penaltyPoints}`;
        
        this.updateShipList();
        this.updateIncidentList();
    }

    updateModeButtons() {
        const editBtn = document.getElementById('btn-edit-mode');
        const playBtn = document.getElementById('btn-play-mode');
        
        const mode = this.engine.getMode();
        
        editBtn.classList.toggle('active', mode === GameMode.EDIT);
        playBtn.classList.toggle('active', mode === GameMode.PLAY);
    }

    updateToolButtons() {
        const editButtons = document.querySelectorAll('.edit-btn');
        const currentTool = this.editor.getTool();
        
        editButtons.forEach(btn => {
            const tool = this.mapToolName(btn.dataset.tool);
            btn.classList.toggle('active', tool === currentTool);
        });
    }

    updateLevelList() {
        const levelList = document.getElementById('level-list');
        if (!levelList) return;
        
        levelList.innerHTML = '';
        
        for (const level of this.levels) {
            const item = document.createElement('div');
            item.className = 'level-item';
            
            if (this.currentLevel && this.currentLevel.id === level.id) {
                item.classList.add('selected');
            }
            
            const sampleBadge = level.isSample ? '<span class="sample-badge">示例</span>' : '';
            
            item.innerHTML = `
                <div class="level-name">${level.name} ${sampleBadge}</div>
                <div class="level-info">
                    <span>难度: ${this.getDifficultyDisplayName(level.difficulty)}</span>
                    <span>回合: ${level.settings?.totalTurns || 20}</span>
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.loadLevel(level);
            });
            
            if (!level.isSample) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-level-btn';
                deleteBtn.textContent = '×';
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`确定要删除关卡 "${level.name}" 吗？`)) {
                        this.deleteLevel(level.id);
                    }
                });
                item.appendChild(deleteBtn);
            }
            
            levelList.appendChild(item);
        }
    }

    getDifficultyDisplayName(difficulty) {
        const names = {
            'easy': '简单',
            'medium': '中等',
            'hard': '困难'
        };
        return names[difficulty] || '中等';
    }

    updateShipList() {
        const shipList = document.getElementById('ship-list');
        if (!shipList) return;
        
        shipList.innerHTML = '';
        
        for (const ship of this.engine.ships) {
            const item = document.createElement('div');
            item.className = 'ship-item';
            
            if (this.engine.selectedShipId === ship.id) {
                item.classList.add('selected');
            }
            if (ship.isArrived()) {
                item.classList.add('arrived');
            }
            
            item.innerHTML = `
                <div class="ship-name">${ship.name}</div>
                <div class="ship-info">
                    <span>类型: ${ship.getTypeDisplayName()}</span>
                    <span>状态: ${ship.getStateDisplayName()}</span>
                    <span>位置: (${ship.x}, ${ship.y})</span>
                </div>
            `;
            
            item.addEventListener('click', () => {
                if (ship.isControllable()) {
                    this.engine.selectShip(ship.id);
                    this.updateUI();
                    this.renderer.render();
                }
            });
            
            shipList.appendChild(item);
        }
    }

    updateIncidentList() {
        const incidentList = document.getElementById('incident-list');
        if (!incidentList) return;
        
        if (this.engine.incidents.length === 0) {
            incidentList.innerHTML = '<p class="no-incidents">暂无事故记录</p>';
            return;
        }
        
        incidentList.innerHTML = '';
        
        for (const incident of this.engine.incidents.slice().reverse()) {
            const item = document.createElement('div');
            item.className = `incident-item ${incident.type}`;
            
            let typeText;
            switch (incident.type) {
                case IncidentType.COLLISION: typeText = '碰撞事故'; break;
                case IncidentType.SHALLOW: typeText = '浅滩驶入'; break;
                case IncidentType.SPEED: typeText = '超速违规'; break;
                case IncidentType.GIVE_WAY: typeText = '让路违规'; break;
                case IncidentType.BOUNDARY: typeText = '越界违规'; break;
                default: typeText = '违规';
            }
            
            item.innerHTML = `
                <div class="incident-turn">回合 ${incident.turn}: ${typeText}</div>
                <div class="incident-text">${incident.description}</div>
                <div class="incident-points">扣分: ${incident.points}</div>
            `;
            
            incidentList.appendChild(item);
        }
    }

    updateInfoText(text) {
        const infoText = document.getElementById('info-text');
        if (infoText) {
            infoText.textContent = text;
        }
    }
}

let gameApp;

document.addEventListener('DOMContentLoaded', () => {
    gameApp = new GameApp();
});
