import { GameEngine } from '../game/GameEngine.js';
import { ErrorDetector } from '../validation/ErrorDetector.js';
import { ChangeTracker } from '../data/ChangeTracker.js';
import { ImportManager } from '../data/ImportManager.js';
import { ReplayEngine } from '../export/ReplayEngine.js';
import { ReportGenerator } from '../export/ReportGenerator.js';
import { CanvasRenderer } from './CanvasRenderer.js';
import { Wall } from '../models/Wall.js';
import { Character } from '../models/Character.js';
import { SoundSource } from '../models/SoundSource.js';

export class UIController {
    constructor() {
        this.gameEngine = new GameEngine();
        this.errorDetector = new ErrorDetector();
        this.changeTracker = new ChangeTracker();
        this.importManager = null;
        this.replayEngine = null;
        this.reportGenerator = null;
        this.canvasRenderer = null;
        
        this.currentAngle = 0;
        this.currentIntensity = 1.0;
        this.currentWave = null;
        this.currentEchoes = [];
        this.pendingAction = null;
        
        this.elements = {};
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;

        this.cacheElements();
        this.setupRenderer();
        this.setupManagers();
        this.setupEventListeners();
        this.setupGameEvents();
        
        this.gameEngine.initDefaultMaze();
        this.importManager = new ImportManager(
            this.gameEngine.maze,
            this.changeTracker,
            this.errorDetector
        );
        
        this.render();
        this.updateUI();
        
        this.isInitialized = true;
    }

    cacheElements() {
        this.elements = {
            canvas: document.getElementById('game-canvas'),
            turnDisplay: document.getElementById('turn-display'),
            scoreDisplay: document.getElementById('score-display'),
            riskDisplay: document.getElementById('risk-display'),
            statusMessage: document.getElementById('status-message'),
            
            soundPulsesBar: document.getElementById('sound-pulses-bar'),
            soundPulsesValue: document.getElementById('sound-pulses-value'),
            energyBar: document.getElementById('energy-bar'),
            energyValue: document.getElementById('energy-value'),
            timeUnitsBar: document.getElementById('time-units-bar'),
            timeUnitsValue: document.getElementById('time-units-value'),
            
            angleSlider: document.getElementById('angle-slider'),
            angleValue: document.getElementById('angle-value'),
            intensitySlider: document.getElementById('intensity-slider'),
            intensityValue: document.getElementById('intensity-value'),
            
            btnMoveUp: document.getElementById('btn-move-up'),
            btnMoveDown: document.getElementById('btn-move-down'),
            btnMoveLeft: document.getElementById('btn-move-left'),
            btnMoveRight: document.getElementById('btn-move-right'),
            btnSoundPulse: document.getElementById('btn-sound-pulse'),
            
            btnImportJson: document.getElementById('btn-import-json'),
            btnAddWalls: document.getElementById('btn-add-walls'),
            btnAddSoundSource: document.getElementById('btn-add-sound-source'),
            btnAddTarget: document.getElementById('btn-add-target'),
            fileInput: document.getElementById('file-input'),
            
            changeLog: document.getElementById('change-log'),
            detectedErrors: document.getElementById('detected-errors'),
            
            btnShowHistory: document.getElementById('btn-show-history'),
            btnReplayFail: document.getElementById('btn-replay-fail'),
            
            btnExportReport: document.getElementById('btn-export-report'),
            btnExportJson: document.getElementById('btn-export-json'),
            
            echoOverlay: document.getElementById('echo-overlay'),
            echoResults: document.getElementById('echo-results'),
            btnCloseEcho: document.getElementById('btn-close-echo'),
            
            errorOverlay: document.getElementById('error-overlay'),
            errorList: document.getElementById('error-list'),
            btnConfirmErrors: document.getElementById('btn-confirm-errors'),
            btnCancelAction: document.getElementById('btn-cancel-action'),
            
            historyModal: document.getElementById('history-modal'),
            historyList: document.getElementById('history-list'),
            btnCloseHistory: document.getElementById('btn-close-history'),
            
            replayModal: document.getElementById('replay-modal'),
            replayCanvas: document.getElementById('replay-canvas'),
            btnReplayPlay: document.getElementById('btn-replay-play'),
            btnReplayPause: document.getElementById('btn-replay-pause'),
            btnReplayReset: document.getElementById('btn-replay-reset'),
            replayStatus: document.getElementById('replay-status'),
            btnCloseReplay: document.getElementById('btn-close-replay'),
            
            importModal: document.getElementById('import-modal'),
            importResult: document.getElementById('import-result'),
            importActions: document.getElementById('import-actions'),
            btnImportConfirm: document.getElementById('btn-import-confirm'),
            btnImportCancel: document.getElementById('btn-import-cancel'),
            
            inputModal: document.getElementById('input-modal'),
            inputModalTitle: document.getElementById('input-modal-title'),
            inputModalForm: document.getElementById('input-modal-form'),
            btnInputConfirm: document.getElementById('btn-input-confirm'),
            btnInputCancel: document.getElementById('btn-input-cancel')
        };
    }

    setupRenderer() {
        this.canvasRenderer = new CanvasRenderer(this.elements.canvas);
    }

    setupManagers() {
        this.replayEngine = new ReplayEngine(this.elements.replayCanvas);
        this.reportGenerator = new ReportGenerator(
            this.gameEngine,
            this.errorDetector,
            this.changeTracker
        );
    }

    setupEventListeners() {
        this.elements.btnMoveUp.addEventListener('click', () => this.handleMove('up'));
        this.elements.btnMoveDown.addEventListener('click', () => this.handleMove('down'));
        this.elements.btnMoveLeft.addEventListener('click', () => this.handleMove('left'));
        this.elements.btnMoveRight.addEventListener('click', () => this.handleMove('right'));
        this.elements.btnSoundPulse.addEventListener('click', () => this.handleSoundPulse());

        this.elements.angleSlider.addEventListener('input', (e) => {
            this.currentAngle = parseInt(e.target.value);
            this.elements.angleValue.textContent = `${this.currentAngle}°`;
            this.render();
        });

        this.elements.intensitySlider.addEventListener('input', (e) => {
            this.currentIntensity = parseInt(e.target.value) / 100;
            this.elements.intensityValue.textContent = `${e.target.value}%`;
            this.render();
        });

        this.elements.btnImportJson.addEventListener('click', () => {
            this.elements.fileInput.click();
        });

        this.elements.fileInput.addEventListener('change', (e) => {
            this.handleFileImport(e.target.files[0]);
        });

        this.elements.btnAddWalls.addEventListener('click', () => {
            this.showInputModal('添加墙体', this.createWallForm());
        });

        this.elements.btnAddSoundSource.addEventListener('click', () => {
            this.showInputModal('添加声源', this.createSoundSourceForm());
        });

        this.elements.btnAddTarget.addEventListener('click', () => {
            this.showInputModal('添加救援目标', this.createTargetForm());
        });

        this.elements.btnCloseEcho.addEventListener('click', () => {
            this.elements.echoOverlay.classList.add('hidden');
        });

        this.elements.btnConfirmErrors.addEventListener('click', () => {
            this.handleConfirmErrors();
        });

        this.elements.btnCancelAction.addEventListener('click', () => {
            this.handleCancelAction();
        });

        this.elements.btnShowHistory.addEventListener('click', () => {
            this.showHistoryModal();
        });

        this.elements.btnCloseHistory.addEventListener('click', () => {
            this.elements.historyModal.classList.add('hidden');
        });

        this.elements.btnReplayFail.addEventListener('click', () => {
            this.showReplayModal();
        });

        this.elements.btnReplayPlay.addEventListener('click', () => {
            this.replayEngine.play();
            this.updateReplayStatus();
        });

        this.elements.btnReplayPause.addEventListener('click', () => {
            this.replayEngine.pause();
            this.updateReplayStatus();
        });

        this.elements.btnReplayReset.addEventListener('click', () => {
            this.replayEngine.reset();
            this.updateReplayStatus();
        });

        this.elements.btnCloseReplay.addEventListener('click', () => {
            this.replayEngine.stop();
            this.elements.replayModal.classList.add('hidden');
        });

        this.elements.btnImportConfirm.addEventListener('click', () => {
            this.elements.importModal.classList.add('hidden');
            this.elements.importActions.classList.add('hidden');
            this.render();
            this.updateUI();
        });

        this.elements.btnImportCancel.addEventListener('click', () => {
            this.elements.importModal.classList.add('hidden');
            this.elements.importActions.classList.add('hidden');
        });

        this.elements.btnInputConfirm.addEventListener('click', () => {
            this.handleInputConfirm();
        });

        this.elements.btnInputCancel.addEventListener('click', () => {
            this.elements.inputModal.classList.add('hidden');
        });

        this.elements.btnExportReport.addEventListener('click', () => {
            this.exportReport();
        });

        this.elements.btnExportJson.addEventListener('click', () => {
            this.reportGenerator.downloadGameState();
        });

        document.addEventListener('keydown', (e) => {
            if (this.elements.echoOverlay.classList.contains('hidden') &&
                this.elements.errorOverlay.classList.contains('hidden') &&
                this.elements.historyModal.classList.contains('hidden') &&
                this.elements.replayModal.classList.contains('hidden') &&
                this.elements.importModal.classList.contains('hidden') &&
                this.elements.inputModal.classList.contains('hidden')) {
                switch (e.key) {
                    case 'ArrowUp':
                    case 'w':
                    case 'W':
                        e.preventDefault();
                        this.handleMove('up');
                        break;
                    case 'ArrowDown':
                    case 's':
                    case 'S':
                        e.preventDefault();
                        this.handleMove('down');
                        break;
                    case 'ArrowLeft':
                    case 'a':
                    case 'A':
                        e.preventDefault();
                        this.handleMove('left');
                        break;
                    case 'ArrowRight':
                    case 'd':
                    case 'D':
                        e.preventDefault();
                        this.handleMove('right');
                        break;
                    case ' ':
                        e.preventDefault();
                        this.handleSoundPulse();
                        break;
                }
            }
        });
    }

    setupGameEvents() {
        this.gameEngine.on('stateUpdated', () => {
            this.updateUI();
        });

        this.gameEngine.on('playerMoved', () => {
            this.canvasRenderer.resetAnimation();
            this.currentWave = null;
            this.currentEchoes = [];
            this.render();
        });

        this.gameEngine.on('soundPulseFired', ({ wave, echoes }) => {
            this.currentWave = wave;
            this.currentEchoes = echoes;
            
            this.canvasRenderer.startWaveAnimation(wave, 2500, () => {
                this.showEchoResults(echoes, wave);
            });
            
            const errors = this.errorDetector.validateAll(wave, this.gameEngine.maze.walls, echoes);
            if (errors.length > 0) {
                this.showErrorOverlay(errors, { type: 'sound_pulse', wave, echoes });
            }
            
            this.updateErrorLog();
            this.render();
        });

        this.gameEngine.on('victory', (state) => {
            this.updateStatusMessage(`🎉 恭喜！成功救援所有队友！最终得分: ${state.score.total}`);
            this.updateUI();
        });

        this.gameEngine.on('gameOver', (state) => {
            this.updateStatusMessage(`💔 救援失败: ${state.failReason}。最终得分: ${state.score.total}`);
            this.updateUI();
        });

        this.changeTracker.on('changeRecorded', (change) => {
            this.updateChangeLog();
        });

        this.errorDetector.on('errorsDetected', (errors) => {
            this.updateErrorLog();
        });
    }

    handleMove(direction) {
        if (this.gameEngine.gameState.isGameOver()) {
            this.updateStatusMessage('游戏已结束，请刷新页面重新开始');
            return;
        }

        if (!this.gameEngine.resourceManager.canAfford('move')) {
            this.updateStatusMessage('资源不足，无法移动！');
            return;
        }

        const player = this.gameEngine.maze.getPlayer();
        if (!player) return;

        const oldX = player.x;
        const oldY = player.y;
        let newX = oldX, newY = oldY;
        const step = this.gameEngine.moveStep;

        switch (direction) {
            case 'up': newY -= step; break;
            case 'down': newY += step; break;
            case 'left': newX -= step; break;
            case 'right': newX += step; break;
        }

        const moveErrors = this.errorDetector.validateMovement(
            oldX, oldY, newX, newY,
            this.gameEngine.maze.walls,
            this.gameEngine.maze.width,
            this.gameEngine.maze.height
        );

        if (moveErrors.length > 0) {
            this.updateStatusMessage(moveErrors[0].description);
            this.updateErrorLog(moveErrors);
            return;
        }

        const result = this.gameEngine.movePlayer(direction);
        
        if (result.success) {
            let message = `向${this.getDirectionLabel(direction)}移动`;
            if (result.efficiencyGain > 0) {
                message += `，效率+${result.efficiencyGain}`;
            }
            if (result.rescued) {
                message += '，成功救援队友！';
            }
            this.updateStatusMessage(message);
        } else {
            this.updateStatusMessage(result.reason);
        }
    }

    handleSoundPulse() {
        if (this.gameEngine.gameState.isGameOver()) {
            this.updateStatusMessage('游戏已结束，请刷新页面重新开始');
            return;
        }

        if (!this.gameEngine.resourceManager.canAfford('soundPulse')) {
            this.updateStatusMessage('资源不足，无法发射声波！');
            return;
        }

        const result = this.gameEngine.fireSoundPulse(this.currentAngle, this.currentIntensity);
        
        if (result.success) {
            this.updateStatusMessage(`发射声波：角度 ${this.currentAngle}°，强度 ${(this.currentIntensity * 100).toFixed(0)}%`);
        } else {
            this.updateStatusMessage(result.reason);
        }
    }

    handleConfirmErrors() {
        this.errorDetector.confirmAllErrors();
        this.elements.errorOverlay.classList.add('hidden');
        
        if (this.pendingAction) {
            if (this.pendingAction.type === 'sound_pulse') {
                this.showEchoResults(this.pendingAction.echoes, this.pendingAction.wave);
            }
            this.pendingAction = null;
        }
        
        this.updateErrorLog();
    }

    handleCancelAction() {
        this.elements.errorOverlay.classList.add('hidden');
        this.pendingAction = null;
        this.canvasRenderer.resetAnimation();
        this.currentWave = null;
        this.currentEchoes = [];
        this.render();
    }

    handleFileImport(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const result = this.importManager.importJSON(data, file.name);
                this.showImportResult(result);
            } catch (err) {
                alert('文件解析失败: ' + err.message);
            }
        };
        reader.readAsText(file);
        this.elements.fileInput.value = '';
    }

    handleInputConfirm() {
        const form = this.elements.inputModalForm;
        const inputType = form.dataset.inputType;
        
        try {
            if (inputType === 'wall') {
                const wallData = {
                    x1: parseFloat(form.querySelector('#wall-x1').value),
                    y1: parseFloat(form.querySelector('#wall-y1').value),
                    x2: parseFloat(form.querySelector('#wall-x2').value),
                    y2: parseFloat(form.querySelector('#wall-y2').value),
                    material: form.querySelector('#wall-material').value,
                    reflectionCoefficient: parseFloat(form.querySelector('#wall-reflection').value),
                    notes: form.querySelector('#wall-notes').value,
                    addedInBatch: 'manual_input'
                };

                const errors = this.errorDetector.validateWallData(wallData, this.gameEngine.maze.walls);
                if (errors.length > 0) {
                    alert('数据错误: ' + errors.map(e => e.description).join('\n'));
                    return;
                }

                const oldWalls = [...this.gameEngine.maze.walls];
                const wall = this.gameEngine.maze.addWall(wallData);
                this.changeTracker.recordCreate('wall', wall, '手动添加');
                this.updateStatusMessage('墙体添加成功');

            } else if (inputType === 'soundSource') {
                const sourceData = {
                    x: parseFloat(form.querySelector('#source-x').value),
                    y: parseFloat(form.querySelector('#source-y').value),
                    direction: parseFloat(form.querySelector('#source-direction').value),
                    frequency: parseFloat(form.querySelector('#source-frequency').value),
                    amplitude: parseFloat(form.querySelector('#source-amplitude').value),
                    notes: form.querySelector('#source-notes').value,
                    addedInBatch: 'manual_input'
                };

                const oldSources = [...this.gameEngine.maze.soundSources];
                const source = this.gameEngine.maze.addSoundSource(sourceData);
                this.changeTracker.recordCreate('soundSource', source, '手动添加');
                this.updateStatusMessage('声源添加成功');

            } else if (inputType === 'target') {
                const charData = {
                    type: 'teammate',
                    x: parseFloat(form.querySelector('#target-x').value),
                    y: parseFloat(form.querySelector('#target-y').value),
                    status: 'trapped',
                    health: parseFloat(form.querySelector('#target-health').value),
                    notes: form.querySelector('#target-notes').value,
                    addedInBatch: 'manual_input'
                };

                const errors = this.errorDetector.validateCharacterData(
                    charData, this.gameEngine.maze.width, this.gameEngine.maze.height
                );
                if (errors.length > 0) {
                    alert('数据错误: ' + errors.map(e => e.description).join('\n'));
                    return;
                }

                const oldChars = [...this.gameEngine.maze.characters];
                const char = this.gameEngine.maze.addCharacter(charData);
                this.changeTracker.recordCreate('character', char, '手动添加');
                this.updateStatusMessage('救援目标添加成功');
            }

            this.elements.inputModal.classList.add('hidden');
            this.render();
            this.updateUI();
        } catch (err) {
            alert('输入错误: ' + err.message);
        }
    }

    createWallForm() {
        return `
            <div data-input-type="wall">
                <div class="input-row">
                    <div class="input-form-group">
                        <label>起点 X</label>
                        <input type="number" id="wall-x1" value="100" step="1">
                    </div>
                    <div class="input-form-group">
                        <label>起点 Y</label>
                        <input type="number" id="wall-y1" value="100" step="1">
                    </div>
                </div>
                <div class="input-row">
                    <div class="input-form-group">
                        <label>终点 X</label>
                        <input type="number" id="wall-x2" value="200" step="1">
                    </div>
                    <div class="input-form-group">
                        <label>终点 Y</label>
                        <input type="number" id="wall-y2" value="100" step="1">
                    </div>
                </div>
                <div class="input-form-group">
                    <label>材质</label>
                    <select id="wall-material">
                        <option value="hard">硬质 (反射率 95%)</option>
                        <option value="soft">软质 (反射率 60%)</option>
                        <option value="absorbent">吸声 (反射率 10%)</option>
                    </select>
                </div>
                <div class="input-form-group">
                    <label>反射系数 (0-1)</label>
                    <input type="number" id="wall-reflection" value="0.95" step="0.05" min="0" max="1">
                </div>
                <div class="input-form-group">
                    <label>备注</label>
                    <input type="text" id="wall-notes" placeholder="可选备注">
                </div>
            </div>
        `;
    }

    createSoundSourceForm() {
        return `
            <div data-input-type="soundSource">
                <div class="input-row">
                    <div class="input-form-group">
                        <label>位置 X</label>
                        <input type="number" id="source-x" value="300" step="1">
                    </div>
                    <div class="input-form-group">
                        <label>位置 Y</label>
                        <input type="number" id="source-y" value="300" step="1">
                    </div>
                </div>
                <div class="input-row">
                    <div class="input-form-group">
                        <label>方向 (度)</label>
                        <input type="number" id="source-direction" value="0" step="1">
                    </div>
                    <div class="input-form-group">
                        <label>频率 (Hz)</label>
                        <input type="number" id="source-frequency" value="2000" step="100">
                    </div>
                </div>
                <div class="input-form-group">
                    <label>振幅</label>
                    <input type="number" id="source-amplitude" value="1.0" step="0.1" min="0" max="2">
                </div>
                <div class="input-form-group">
                    <label>备注</label>
                    <input type="text" id="source-notes" placeholder="可选备注">
                </div>
            </div>
        `;
    }

    createTargetForm() {
        return `
            <div data-input-type="target">
                <div class="input-row">
                    <div class="input-form-group">
                        <label>位置 X</label>
                        <input type="number" id="target-x" value="500" step="1">
                    </div>
                    <div class="input-form-group">
                        <label>位置 Y</label>
                        <input type="number" id="target-y" value="100" step="1">
                    </div>
                </div>
                <div class="input-form-group">
                    <label>初始生命值</label>
                    <input type="number" id="target-health" value="80" step="1" min="0" max="100">
                </div>
                <div class="input-form-group">
                    <label>备注</label>
                    <input type="text" id="target-notes" placeholder="可选备注">
                </div>
            </div>
        `;
    }

    showInputModal(title, formHTML) {
        this.elements.inputModalTitle.textContent = title;
        this.elements.inputModalForm.innerHTML = formHTML;
        this.elements.inputModal.classList.remove('hidden');
    }

    showEchoResults(echoes, wave) {
        const analysis = wave.getEchoAnalysis();
        let html = '';
        
        if (analysis.length === 0) {
            html = '<p class="empty-log">未检测到回声</p>';
        } else {
            for (const item of analysis) {
                html += `
                    <div class="echo-item">
                        <strong>回声 ${item.echoNumber}:</strong>
                        <br>时间: ${item.time}s | 距离: ${item.distance} | 强度: ${item.intensity}%
                        <br>材质: ${item.material} | 入射角: ${item.incidentAngle}° | 反射角: ${item.reflectionAngle}°
                        <br>位置: ${item.position}
                    </div>
                `;
            }
        }
        
        this.elements.echoResults.innerHTML = html;
        this.elements.echoOverlay.classList.remove('hidden');
    }

    showErrorOverlay(errors, pendingAction) {
        this.pendingAction = pendingAction;
        
        let html = '';
        const typeLabels = {
            reflection_angle: '反射角错误',
            time_unit: '时间单位错误',
            wall_penetration: '墙体穿透',
            boundary_violation: '边界违规',
            echo_consistency: '回声一致性错误'
        };
        
        for (const error of errors) {
            html += `
                <div class="error-item severity-${error.severity}">
                    <div class="error-type">${typeLabels[error.type] || error.type} (${error.severity})</div>
                    <div class="error-desc">${error.description}</div>
                </div>
            `;
        }
        
        this.elements.errorList.innerHTML = html;
        this.elements.errorOverlay.classList.remove('hidden');
    }

    showImportResult(result) {
        let html = `<p>导入完成！共 ${result.summary.total} 项：</p>`;
        
        const statusLabels = {
            new: { label: '新增', class: 'new' },
            duplicate: { label: '重复', class: 'duplicate' },
            update: { label: '更新', class: 'update' },
            conflict: { label: '冲突', class: 'conflict' },
            error: { label: '错误', class: 'conflict' }
        };
        
        for (const item of result.items) {
            const status = statusLabels[item.status] || { label: item.status, class: '' };
            html += `
                <div class="import-item ${status.class}">
                    <strong>${item.type}: ${status.label}</strong>
                    <br>${item.message}
                    ${item.conflictFields && item.conflictFields.length > 0 ? `<br>变更: ${item.conflictFields.join(', ')}` : ''}
                </div>
            `;
        }
        
        if (result.summary.conflict > 0) {
            html += '<p style="color: #f87171; margin-top: 1rem;">⚠️ 检测到冲突，请在变更记录中手动处理</p>';
        }
        
        this.elements.importResult.innerHTML = html;
        this.elements.importActions.classList.remove('hidden');
        this.elements.importModal.classList.remove('hidden');
        
        this.updateChangeLog();
    }

    showHistoryModal() {
        const history = this.gameEngine.getHistory();
        let html = '';
        
        if (history.length === 0) {
            html = '<p class="empty-log">暂无历史记录</p>';
        } else {
            for (const action of history) {
                const typeLabel = action.type === 'move' ? '移动' : 
                                  action.type === 'sound_pulse' ? '发射声波' : action.type;
                
                let params = '';
                if (action.type === 'move') {
                    params = `${this.getDirectionLabel(action.parameters.direction)} (${action.parameters.fromX},${action.parameters.fromY}) → (${action.parameters.toX},${action.parameters.toY})`;
                } else if (action.type === 'sound_pulse') {
                    params = `角度 ${action.parameters.direction}°, 强度 ${(action.parameters.intensity * 100).toFixed(0)}%`;
                }
                
                let result = '';
                if (action.result.success) {
                    if (action.type === 'sound_pulse') {
                        result = `${action.result.echoCount} 个回声, ${action.result.reflectionCount} 次反射`;
                    } else if (action.type === 'move' && action.result.rescued) {
                        result = '成功救援队友！';
                    }
                } else {
                    result = action.result.reason || '失败';
                }
                
                html += `
                    <div class="history-item">
                        <div class="history-turn">回合 ${action.turn}: ${typeLabel}</div>
                        <div class="history-action">${params}</div>
                        ${result ? `<div class="history-result">${result}</div>` : ''}
                    </div>
                `;
            }
        }
        
        this.elements.historyList.innerHTML = html;
        this.elements.historyModal.classList.remove('hidden');
    }

    showReplayModal() {
        const latestFailure = this.gameEngine.getLatestFailure();
        if (!latestFailure) {
            alert('暂无失败记录可以回放');
            return;
        }
        
        this.replayEngine.loadReplay(latestFailure);
        this.replayEngine.renderFrame(0);
        this.updateReplayStatus();
        this.elements.replayModal.classList.remove('hidden');
    }

    updateReplayStatus() {
        const status = this.replayEngine.getStatus();
        let text = '';
        
        if (!status.hasReplay) {
            text = '无回放数据';
        } else if (status.isPlaying && !status.isPaused) {
            text = `播放中 ${status.currentFrame + 1}/${status.totalFrames}`;
        } else if (status.isPaused) {
            text = `已暂停 ${status.currentFrame + 1}/${status.totalFrames}`;
        } else {
            text = `就绪 ${status.currentFrame + 1}/${status.totalFrames}`;
        }
        
        this.elements.replayStatus.textContent = text;
    }

    exportReport() {
        const report = this.reportGenerator.generateExperimentReport({
            studentName: prompt('请输入学生姓名:', '匿名学生') || '匿名学生',
            class: prompt('请输入班级:', '') || ''
        });
        
        const format = confirm('点击确定导出为文本格式，取消导出为JSON格式') ? 'text' : 'json';
        this.reportGenerator.downloadReport(report, format);
    }

    render() {
        this.canvasRenderer.render(this.gameEngine.maze, {
            wave: this.currentWave,
            reflections: this.currentWave ? this.currentWave.reflections : null,
            echoes: this.currentEchoes,
            directionAngle: this.currentAngle,
            directionIntensity: this.currentIntensity,
            animate: true,
            showAllReflections: !this.canvasRenderer.isAnimating,
            showAllEchoes: !this.canvasRenderer.isAnimating
        });
    }

    updateUI() {
        const state = this.gameEngine.gameState;
        const resources = this.gameEngine.resourceManager.getResourceStatus();
        
        this.elements.turnDisplay.textContent = `回合: ${state.turn}`;
        this.elements.scoreDisplay.textContent = `分数: ${state.score.total}`;
        
        const riskClass = state.risk.level === 'low' ? 'risk-low' :
                         state.risk.level === 'medium' ? 'risk-medium' : 'risk-high';
        const riskLabel = state.risk.level === 'low' ? '低' :
                         state.risk.level === 'medium' ? '中' : '高';
        this.elements.riskDisplay.className = riskClass;
        this.elements.riskDisplay.textContent = `风险: ${riskLabel}`;
        
        this.elements.soundPulsesBar.style.width = `${resources.soundPulses.percent}%`;
        this.elements.soundPulsesValue.textContent = `${resources.soundPulses.current} / ${resources.soundPulses.max}`;
        
        this.elements.energyBar.style.width = `${resources.energy.percent}%`;
        this.elements.energyValue.textContent = `${resources.energy.current} / ${resources.energy.max}`;
        
        this.elements.timeUnitsBar.style.width = `${resources.timeUnits.percent}%`;
        this.elements.timeUnitsValue.textContent = `${resources.timeUnits.current} / ${resources.timeUnits.max}`;
        
        const canMove = this.gameEngine.resourceManager.canAfford('move');
        const canSound = this.gameEngine.resourceManager.canAfford('soundPulse');
        
        this.elements.btnMoveUp.disabled = !canMove || state.isGameOver();
        this.elements.btnMoveDown.disabled = !canMove || state.isGameOver();
        this.elements.btnMoveLeft.disabled = !canMove || state.isGameOver();
        this.elements.btnMoveRight.disabled = !canMove || state.isGameOver();
        this.elements.btnSoundPulse.disabled = !canSound || state.isGameOver();
    }

    updateStatusMessage(message) {
        this.elements.statusMessage.textContent = message;
    }

    updateChangeLog() {
        const changes = this.changeTracker.getRecentChanges(10);
        
        if (changes.length === 0) {
            this.elements.changeLog.innerHTML = '<p class="empty-log">暂无变更记录</p>';
            return;
        }
        
        let html = '';
        for (const change of changes) {
            const formatted = this.changeTracker.formatChangeForDisplay(change);
            html += `
                <div class="change-item ${change.action}">
                    <div>${formatted.summary}</div>
                    <div class="change-batch">${formatted.timestamp} | ${formatted.batchId}</div>
                </div>
            `;
        }
        
        this.elements.changeLog.innerHTML = html;
    }

    updateErrorLog(errors = null) {
        const errorList = errors || this.errorDetector.detectedErrors;
        
        if (errorList.length === 0) {
            this.elements.detectedErrors.innerHTML = '<p class="empty-log">未检测到错误</p>';
            return;
        }
        
        let html = '';
        const typeLabels = {
            reflection_angle: '反射角错误',
            time_unit: '时间单位错误',
            wall_penetration: '墙体穿透',
            boundary_violation: '边界违规',
            echo_consistency: '回声一致性错误',
            movement_boundary: '移动边界错误',
            movement_collision: '移动碰撞错误'
        };
        
        for (const error of errorList) {
            html += `
                <div class="error-item severity-${error.severity}">
                    <div class="error-type">${typeLabels[error.type] || error.type}</div>
                    <div class="error-desc">${error.description}</div>
                </div>
            `;
        }
        
        this.elements.detectedErrors.innerHTML = html;
    }

    getDirectionLabel(direction) {
        const labels = {
            up: '上',
            down: '下',
            left: '左',
            right: '右'
        };
        return labels[direction] || direction;
    }

    startRenderLoop() {
        const loop = () => {
            if (this.canvasRenderer.isAnimating) {
                this.render();
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}
