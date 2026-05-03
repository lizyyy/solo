export class UIController {
    constructor(game, renderer) {
        this.game = game;
        this.renderer = renderer;
        this.canvas = renderer.getCanvas();
        this.currentTool = 'select';
        this.isGameEnded = false;
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleCanvasRightClick(e);
        });

        document.getElementById('tool-select').addEventListener('click', () => this.setTool('select'));
        document.getElementById('tool-maintenance-car').addEventListener('click', () => this.setTool('maintenance-car'));
        document.getElementById('tool-block').addEventListener('click', () => this.setTool('block'));
        document.getElementById('tool-remove').addEventListener('click', () => this.setTool('remove'));

        document.getElementById('undo-btn').addEventListener('click', () => this.handleUndo());
        document.getElementById('redo-btn').addEventListener('click', () => this.handleRedo());
        document.getElementById('reset-btn').addEventListener('click', () => this.handleReset());
        document.getElementById('save-progress-btn').addEventListener('click', () => this.handleSaveProgress());
        document.getElementById('load-progress-btn').addEventListener('click', () => this.handleLoadProgress());

        document.getElementById('prev-turn').addEventListener('click', () => this.handlePrevTurn());
        document.getElementById('next-turn').addEventListener('click', () => this.handleNextTurn());

        document.getElementById('import-level').addEventListener('click', () => this.handleImportLevel());
        document.getElementById('export-level').addEventListener('click', () => this.handleExportLevel());

        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') {
                this.closeModal();
            }
        });

        window.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    setTool(tool) {
        this.currentTool = tool;
        
        document.querySelectorAll('.tool-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.tool === tool) {
                item.classList.add('active');
            }
        });

        this.showMessage(`当前工具: ${this.getToolName(tool)}`);
    }

    getToolName(tool) {
        const names = {
            'select': '选择',
            'maintenance-car': '检修车控制',
            'block': '放置封锁区',
            'remove': '移除'
        };
        return names[tool] || tool;
    }

    handleCanvasClick(e) {
        if (this.isGameEnded) return;

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const cell = this.renderer.getCellFromMousePosition(mouseX, mouseY);
        
        if (!cell) return;

        switch (this.currentTool) {
            case 'select':
                this.handleSelectTool(cell);
                break;
            case 'maintenance-car':
                this.handleMaintenanceCarTool(cell);
                break;
            case 'block':
                this.handleBlockTool(cell);
                break;
            case 'remove':
                this.handleRemoveTool(cell);
                break;
        }
    }

    handleCanvasMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const cell = this.renderer.getCellFromMousePosition(mouseX, mouseY);
        
        if (cell) {
            this.renderer.setHoveredCell(cell.x, cell.y);
        } else {
            this.renderer.setHoveredCell(null, null);
        }
        
        this.game.render();
    }

    handleCanvasRightClick(e) {
        if (this.isGameEnded) return;

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const cell = this.renderer.getCellFromMousePosition(mouseX, mouseY);
        
        if (!cell) return;

        this.showSelectionDetails(cell);
    }

    handleSelectTool(cell) {
        const car = this.game.getCarAtPosition(cell.x, cell.y);
        if (car) {
            this.renderer.setSelectedCar(car.id);
            this.renderer.setSelectedCell(null, null);
            this.showMessage(`已选中 ${car.name}，点击相邻位置移动`);
            this.showCarDetails(car);
        } else {
            this.renderer.setSelectedCell(cell.x, cell.y);
            this.renderer.setSelectedCar(null);
            this.showSelectionDetails(cell);
        }
        
        this.game.render();
    }

    handleMaintenanceCarTool(cell) {
        const selectedCarId = this.renderer.getSelectedCar();
        
        if (selectedCarId) {
            const car = this.game.getCarById(selectedCarId);
            
            if (car.x === cell.x && car.y === cell.y) {
                const segment = this.game.getCriticalSegmentAt(cell.x, cell.y);
                if (segment && !segment.isRepaired) {
                    this.attemptRepair(selectedCarId, cell.x, cell.y);
                } else {
                    this.showMessage('该位置没有需要维修的轨段，或已维修完成');
                }
                return;
            }

            this.attemptMoveCar(selectedCarId, cell.x, cell.y);
        } else {
            const car = this.game.getCarAtPosition(cell.x, cell.y);
            if (car) {
                this.renderer.setSelectedCar(car.id);
                this.showMessage(`已选中 ${car.name}，点击相邻位置移动`);
                this.showCarDetails(car);
            } else {
                this.showMessage('请先点击选中一个检修车');
            }
        }
        
        this.game.render();
    }

    handleBlockTool(cell) {
        this.attemptPlaceBlock(cell.x, cell.y);
        this.game.render();
    }

    handleRemoveTool(cell) {
        const block = this.game.getBlockAt(cell.x, cell.y);
        if (block) {
            this.attemptRemoveBlock(cell.x, cell.y);
        } else {
            this.showMessage('该位置没有可移除的对象');
        }
        
        this.game.render();
    }

    attemptMoveCar(carId, targetX, targetY) {
        const result = this.game.attemptMoveCar(carId, targetX, targetY);
        
        if (result.success) {
            this.showMessage(`检修车已移动到 (${targetX}, ${targetY})`);
            this.updateUndoRedoButtons();
        } else {
            this.showMessage(result.reason, 'error');
        }
    }

    attemptRepair(carId, targetX, targetY) {
        const result = this.game.attemptRepair(carId, targetX, targetY);
        
        if (result.success) {
            const segment = this.game.getCriticalSegmentAt(targetX, targetY);
            if (segment.isRepaired) {
                this.showMessage(`关键轨段 (${targetX}, ${targetY}) 已修复完成！`, 'success');
            } else {
                this.showMessage(`维修中... 剩余 ${segment.remainingTime} 回合`);
            }
            this.updateUndoRedoButtons();
            this.updateUI();
        } else {
            this.showMessage(result.reason, 'error');
        }
    }

    attemptPlaceBlock(x, y) {
        const result = this.game.attemptPlaceBlock(x, y);
        
        if (result.success) {
            this.showMessage(`已在 (${x}, ${y}) 放置封锁区`);
            this.updateUndoRedoButtons();
        } else {
            this.showMessage(result.reason, 'error');
        }
    }

    attemptRemoveBlock(x, y) {
        const result = this.game.attemptRemoveBlock(x, y);
        
        if (result.success) {
            this.showMessage(`已移除 (${x}, ${y}) 的封锁区`);
            this.updateUndoRedoButtons();
        } else {
            this.showMessage(result.reason, 'error');
        }
    }

    handleUndo() {
        if (this.isGameEnded) return;
        
        const result = this.game.undo();
        if (result.success) {
            this.showMessage('已撤销上一步操作');
            this.updateUndoRedoButtons();
            this.updateUI();
        } else {
            this.showMessage(result.reason, 'error');
        }
    }

    handleRedo() {
        if (this.isGameEnded) return;
        
        const result = this.game.redo();
        if (result.success) {
            this.showMessage('已重做操作');
            this.updateUndoRedoButtons();
            this.updateUI();
        } else {
            this.showMessage(result.reason, 'error');
        }
    }

    handleReset() {
        this.showConfirmModal(
            '确认重置',
            '确定要重置当前关卡吗？所有进度将丢失。',
            () => {
                this.game.resetLevel();
                this.isGameEnded = false;
                this.renderer.setSelectedCar(null);
                this.renderer.setSelectedCell(null, null);
                this.updateUndoRedoButtons();
                this.updateUI();
                this.showMessage('关卡已重置');
            }
        );
    }

    handleSaveProgress() {
        const result = this.game.saveProgress();
        if (result.success) {
            this.showMessage('进度已保存', 'success');
        } else {
            this.showMessage(result.reason, 'error');
        }
    }

    handleLoadProgress() {
        const result = this.game.loadProgress();
        if (result.success) {
            this.isGameEnded = false;
            this.renderer.setSelectedCar(null);
            this.renderer.setSelectedCell(null, null);
            this.updateUndoRedoButtons();
            this.updateUI();
            this.showMessage('进度已加载', 'success');
        } else {
            this.showMessage(result.reason, 'error');
        }
    }

    handlePrevTurn() {
        this.showMessage('当前回合不能回退，请使用撤销功能', 'warning');
    }

    handleNextTurn() {
        if (this.isGameEnded) return;

        const result = this.game.advanceTurn();
        
        if (result.gameEnded) {
            this.isGameEnded = true;
            
            if (result.endType === 'victory') {
                this.showVictoryModal(result.score);
            } else {
                this.showGameOverModal(result.endType, result.reason);
            }
        } else {
            this.showMessage(`进入第 ${this.game.getCurrentTurn()} 回合`);
            this.updateUndoRedoButtons();
        }
        
        this.updateUI();
    }

    handleImportLevel() {
        this.showImportModal();
    }

    handleExportLevel() {
        const result = this.game.exportCurrentLevel();
        if (result.success) {
            this.showExportModal(result.data);
        } else {
            this.showMessage(result.reason, 'error');
        }
    }

    handleKeyboard(e) {
        if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (e.shiftKey) {
                this.handleRedo();
            } else {
                this.handleUndo();
            }
        } else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.handleRedo();
        } else if (e.key === 'Enter') {
            this.handleNextTurn();
        } else if (e.key === 'Escape') {
            this.closeModal();
            this.renderer.setSelectedCar(null);
            this.renderer.setSelectedCell(null, null);
            this.game.render();
        } else if (e.key >= '1' && e.key <= '4') {
            const tools = ['select', 'maintenance-car', 'block', 'remove'];
            const index = parseInt(e.key) - 1;
            if (index < tools.length) {
                this.setTool(tools[index]);
            }
        }
    }

    showMessage(message, type = 'info') {
        const messageEl = document.getElementById('game-message');
        messageEl.textContent = message;
        messageEl.className = '';
        
        if (type === 'error') {
            messageEl.classList.add('error');
        } else if (type === 'success') {
            messageEl.classList.add('success');
        } else if (type === 'warning') {
            messageEl.classList.add('warning');
        }
    }

    showSelectionDetails(cell) {
        const detailsEl = document.getElementById('selection-details');
        const cellData = this.game.getCellAt(cell.x, cell.y);
        const segment = this.game.getCriticalSegmentAt(cell.x, cell.y);
        const block = this.game.getBlockAt(cell.x, cell.y);
        const car = this.game.getCarAtPosition(cell.x, cell.y);
        const trains = this.game.getTrainsAtPosition(cell.x, cell.y);

        let html = `<div><strong>位置:</strong> (${cell.x}, ${cell.y})</div>`;
        
        if (cellData) {
            html += `<div><strong>类型:</strong> ${this.getCellTypeName(cellData.type)}</div>`;
            html += `<div><strong>连接:</strong> ${cellData.connections.join(', ') || '无'}</div>`;
        }

        if (car) {
            html += `<div style="margin-top: 10px;"><strong>检修车:</strong> ${car.name}</div>`;
            html += `<div style="margin-left: 10px;">电量: ${car.battery}/${car.maxBattery}</div>`;
        }

        if (trains.length > 0) {
            html += `<div style="margin-top: 10px;"><strong>列车:</strong> ${trains.map(t => t.name).join(', ')}</div>`;
        }

        if (segment) {
            html += `<div style="margin-top: 10px;"><strong>关键轨段:</strong></div>`;
            html += `<div style="margin-left: 10px;">状态: ${segment.isRepaired ? '已修复' : '待修复'}</div>`;
            if (!segment.isRepaired) {
                html += `<div style="margin-left: 10px;">剩余回合: ${segment.remainingTime}</div>`;
                if (segment.deadline !== Infinity) {
                    html += `<div style="margin-left: 10px;">截止回合: ${segment.deadline}</div>`;
                }
            }
        }

        if (block) {
            html += `<div style="margin-top: 10px;"><strong>封锁区:</strong> 已放置</div>`;
        }

        detailsEl.innerHTML = html;
    }

    showCarDetails(car) {
        const detailsEl = document.getElementById('selection-details');
        const html = `
            <div><strong>检修车:</strong> ${car.name}</div>
            <div><strong>位置:</strong> (${car.x}, ${car.y})</div>
            <div><strong>电量:</strong> ${car.battery}/${car.maxBattery} (${Math.floor(car.battery / car.maxBattery * 100)}%)</div>
            <div><strong>移动消耗:</strong> ${car.movementCost}</div>
            <div><strong>维修消耗:</strong> ${car.repairCost}</div>
            <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                点击相邻位置移动，右键查看详情
            </div>
        `;
        detailsEl.innerHTML = html;
    }

    getCellTypeName(type) {
        const names = {
            'empty': '空地',
            'track': '轨道',
            'station': '车站',
            'junction': '交汇点',
            'depot': '车库',
            'terminus': '终点站'
        };
        return names[type] || type;
    }

    updateUI() {
        this.updateGameInfo();
        this.updateLevelList();
        this.updateLastTrainList();
        this.updateScore();
    }

    updateGameInfo() {
        document.getElementById('level-name').textContent = this.game.getLevelName();
        document.getElementById('turn-count').textContent = this.game.getCurrentTurn();
        document.getElementById('current-turn-display').textContent = `回合 ${this.game.getCurrentTurn()}`;
        
        const batteryPercent = this.game.getAverageBattery();
        document.getElementById('battery-level').textContent = `${batteryPercent}%`;
        
        const timeLimit = this.game.getTimeLimit();
        document.getElementById('remaining-time').textContent = 
            timeLimit === Infinity ? '∞' : `${timeLimit - this.game.getCurrentTurn()}`;
    }

    updateLevelList() {
        const levelList = this.game.getLevelList();
        
        const builtInEl = document.getElementById('level-list');
        builtInEl.innerHTML = '';
        
        levelList.builtIn.forEach(level => {
            const item = document.createElement('div');
            item.className = 'level-item';
            if (level.id === this.game.getCurrentLevelId()) {
                item.classList.add('active');
            }
            item.textContent = level.name;
            item.addEventListener('click', () => {
                this.showConfirmModal(
                    '切换关卡',
                    `确定要切换到关卡 "${level.name}" 吗？当前进度将丢失。`,
                    () => {
                        this.game.loadLevel(level.id);
                        this.isGameEnded = false;
                        this.renderer.setSelectedCar(null);
                        this.renderer.setSelectedCell(null, null);
                        this.updateUndoRedoButtons();
                        this.updateUI();
                        this.showMessage(`已加载关卡: ${level.name}`);
                    }
                );
            });
            builtInEl.appendChild(item);
        });

        const customEl = document.getElementById('custom-level-list');
        customEl.innerHTML = '';
        
        levelList.custom.forEach(level => {
            const item = document.createElement('div');
            item.className = 'level-item';
            if (level.id === this.game.getCurrentLevelId()) {
                item.classList.add('active');
            }
            item.textContent = level.name;
            item.addEventListener('click', () => {
                this.showConfirmModal(
                    '切换关卡',
                    `确定要切换到关卡 "${level.name}" 吗？当前进度将丢失。`,
                    () => {
                        this.game.loadLevel(level.id);
                        this.isGameEnded = false;
                        this.renderer.setSelectedCar(null);
                        this.renderer.setSelectedCell(null, null);
                        this.updateUndoRedoButtons();
                        this.updateUI();
                        this.showMessage(`已加载关卡: ${level.name}`);
                    }
                );
            });
            customEl.appendChild(item);
        });
    }

    updateLastTrainList() {
        const trains = this.game.getLastTrains();
        const listEl = document.getElementById('last-train-list');
        
        listEl.innerHTML = '';
        
        trains.forEach(train => {
            const item = document.createElement('div');
            item.className = 'train-item';
            
            let statusText = '';
            switch (train.status) {
                case 'waiting':
                    statusText = `等待 (第 ${train.startTime} 回合出发)`;
                    break;
                case 'moving':
                    statusText = `行驶中 (位置 ${train.currentPosition + 1}/${train.route.length})`;
                    break;
                case 'completed':
                    statusText = '已到站';
                    break;
            }
            
            item.innerHTML = `
                <div><strong>${train.name}</strong></div>
                <div style="font-size: 0.85em; color: #666;">${statusText}</div>
            `;
            
            listEl.appendChild(item);
        });
    }

    updateScore() {
        const scoreEl = document.getElementById('score-display');
        const repaired = this.game.getRepairedSegmentsCount();
        const total = this.game.getTotalSegmentsCount();
        
        scoreEl.textContent = `当前进度: ${repaired}/${total} 关键轨段已修复`;
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        const history = this.game.getHistoryStatus();
        
        undoBtn.disabled = !history.canUndo;
        redoBtn.disabled = !history.canRedo;
    }

    showModal(title, content, footer = '') {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-content').innerHTML = content;
        document.getElementById('modal-footer').innerHTML = footer;
        document.getElementById('modal-overlay').classList.remove('hidden');
    }

    closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    }

    showConfirmModal(title, message, onConfirm) {
        const content = `<p>${message}</p>`;
        const footer = `
            <button class="btn" id="modal-cancel">取消</button>
            <button class="btn" id="modal-confirm">确认</button>
        `;
        
        this.showModal(title, content, footer);
        
        setTimeout(() => {
            document.getElementById('modal-cancel').addEventListener('click', () => this.closeModal());
            document.getElementById('modal-confirm').addEventListener('click', () => {
                this.closeModal();
                onConfirm();
            });
        }, 10);
    }

    showVictoryModal(score) {
        const content = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 4rem; margin-bottom: 20px;">🎉</div>
                <h3 style="font-size: 1.5rem; margin-bottom: 15px; color: #27ae60;">任务完成！</h3>
                <div style="font-size: 2rem; font-weight: bold; margin-bottom: 10px;">
                    评分: ${score.grade}
                </div>
                <div style="font-size: 1.2rem; margin-bottom: 20px;">
                    得分: ${score.points}
                </div>
                <div style="text-align: left; background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <div><strong>基础分:</strong> ${score.breakdown.baseScore}</div>
                    <div><strong>时间奖励:</strong> +${score.breakdown.timeBonus}</div>
                    <div><strong>电量奖励:</strong> +${score.breakdown.batteryBonus}</div>
                </div>
            </div>
        `;
        
        const footer = `
            <button class="btn" id="modal-restart">重新开始</button>
            <button class="btn" id="modal-close-btn">关闭</button>
        `;
        
        this.showModal('恭喜通关', content, footer);
        
        setTimeout(() => {
            document.getElementById('modal-restart').addEventListener('click', () => {
                this.closeModal();
                this.handleReset();
            });
            document.getElementById('modal-close-btn').addEventListener('click', () => this.closeModal());
        }, 10);
    }

    showGameOverModal(endType, reason) {
        const titleMap = {
            'conflict': '列车冲突',
            'battery_depleted': '电量耗尽',
            'deadline_missed': '维修超时',
            'time_limit_exceeded': '时间超限'
        };
        
        const emojiMap = {
            'conflict': '💥',
            'battery_depleted': '🔋',
            'deadline_missed': '⏰',
            'time_limit_exceeded': '⌛'
        };
        
        const content = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 4rem; margin-bottom: 20px;">${emojiMap[endType] || '❌'}</div>
                <h3 style="font-size: 1.5rem; margin-bottom: 15px; color: #e74c3c;">任务失败</h3>
                <div style="font-size: 1.1rem; line-height: 1.6;">
                    ${reason}
                </div>
            </div>
        `;
        
        const footer = `
            <button class="btn" id="modal-restart">重新开始</button>
            <button class="btn" id="modal-undo">撤销一步</button>
            <button class="btn" id="modal-close-btn">关闭</button>
        `;
        
        this.showModal(titleMap[endType] || '游戏结束', content, footer);
        
        setTimeout(() => {
            document.getElementById('modal-restart').addEventListener('click', () => {
                this.closeModal();
                this.handleReset();
            });
            document.getElementById('modal-undo').addEventListener('click', () => {
                this.closeModal();
                this.handleUndo();
                this.isGameEnded = false;
            });
            document.getElementById('modal-close-btn').addEventListener('click', () => this.closeModal());
        }, 10);
    }

    showImportModal() {
        const content = `
            <div>
                <p style="margin-bottom: 15px;">请粘贴关卡JSON数据:</p>
                <textarea id="import-json" 
                    style="width: 100%; height: 200px; padding: 10px; 
                           font-family: monospace; font-size: 12px;
                           border: 1px solid #bdc3c7; border-radius: 4px;
                           resize: vertical;"></textarea>
            </div>
        `;
        
        const footer = `
            <button class="btn" id="modal-cancel-import">取消</button>
            <button class="btn" id="modal-do-import">导入</button>
        `;
        
        this.showModal('导入关卡', content, footer);
        
        setTimeout(() => {
            document.getElementById('modal-cancel-import').addEventListener('click', () => this.closeModal());
            document.getElementById('modal-do-import').addEventListener('click', () => {
                const jsonText = document.getElementById('import-json').value;
                this.importLevel(jsonText);
            });
        }, 10);
    }

    showExportModal(jsonData) {
        const content = `
            <div>
                <p style="margin-bottom: 15px;">关卡数据 (已复制到剪贴板):</p>
                <textarea id="export-json" readonly
                    style="width: 100%; height: 200px; padding: 10px; 
                           font-family: monospace; font-size: 12px;
                           border: 1px solid #bdc3c7; border-radius: 4px;
                           resize: vertical; background: #f8f9fa;">${jsonData}</textarea>
            </div>
        `;
        
        const footer = `
            <button class="btn" id="modal-copy-export">复制</button>
            <button class="btn" id="modal-close-export">关闭</button>
        `;
        
        this.showModal('导出关卡', content, footer);
        
        setTimeout(() => {
            const textarea = document.getElementById('export-json');
            textarea.select();
            document.execCommand('copy');
            
            document.getElementById('modal-copy-export').addEventListener('click', () => {
                textarea.select();
                document.execCommand('copy');
                this.showMessage('已复制到剪贴板', 'success');
            });
            document.getElementById('modal-close-export').addEventListener('click', () => this.closeModal());
        }, 10);
    }

    importLevel(jsonText) {
        try {
            const levelData = JSON.parse(jsonText);
            const result = this.game.importLevel(levelData);
            
            if (result.success) {
                this.closeModal();
                this.showConfirmModal(
                    '导入成功',
                    `关卡 "${levelData.name}" 已导入。是否现在加载？`,
                    () => {
                        this.game.loadLevel(levelData.id);
                        this.isGameEnded = false;
                        this.renderer.setSelectedCar(null);
                        this.renderer.setSelectedCell(null, null);
                        this.updateUndoRedoButtons();
                        this.updateUI();
                        this.showMessage(`已加载关卡: ${levelData.name}`);
                    }
                );
            } else {
                this.showMessage(`导入失败: ${result.errors.join(', ')}`, 'error');
            }
        } catch (e) {
            this.showMessage(`JSON解析失败: ${e.message}`, 'error');
        }
    }
}
