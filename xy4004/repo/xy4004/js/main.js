(function(global) {
    'use strict';

    const App = {
        validationResults: new Map(),
        currentMode: 'edit',

        init: function() {
            this.loadSavedData();
            this.bindEvents();
            this.subscribeToStateChanges();
            this.subscribeToRehearsalEvents();
            this.render();
        },

        loadSavedData: function() {
            const savedData = Persistence.load();
            if (savedData && savedData.cues) {
                CueState.setState(savedData.cues);
            }
            this.validateAll();
        },

        validateAll: function() {
            const cues = CueState.getCues();
            this.validationResults = Validation.validateAll(cues);
        },

        saveData: function() {
            const state = CueState.getState();
            Persistence.save(state);
        },

        bindEvents: function() {
            document.getElementById('btn-add-cue').addEventListener('click', () => {
                Components.openCueEditor(null);
            });

            document.getElementById('btn-edit-mode').addEventListener('click', () => {
                this.switchToEditMode();
            });

            document.getElementById('btn-rehearsal-mode').addEventListener('click', () => {
                this.switchToRehearsalMode();
            });

            document.getElementById('cue-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveCueFromForm();
            });

            document.getElementById('btn-close-editor').addEventListener('click', () => {
                Components.closeCueEditor();
            });

            document.getElementById('btn-cancel-edit').addEventListener('click', () => {
                Components.closeCueEditor();
            });

            document.getElementById('cue-list').addEventListener('click', (e) => {
                const target = e.target;

                if (target.dataset.action === 'edit') {
                    const cueId = target.dataset.cueId;
                    Components.openCueEditor(cueId);
                }

                if (target.dataset.action === 'delete') {
                    const cueId = target.dataset.cueId;
                    if (Components.confirm('确定要删除这个 Cue 吗？')) {
                        CueState.deleteCue(cueId);
                    }
                }

                if (target.classList.contains('btn-order-up')) {
                    const cueId = target.dataset.cueId;
                    CueState.moveCueUp(cueId);
                }

                if (target.classList.contains('btn-order-down')) {
                    const cueId = target.dataset.cueId;
                    CueState.moveCueDown(cueId);
                }
            });

            document.getElementById('btn-import').addEventListener('click', () => {
                ImportExport.selectFile((file) => {
                    ImportExport.importFromFile(file, (result) => {
                        this.handleImportResult(result);
                    });
                });
            });

            document.getElementById('btn-export').addEventListener('click', () => {
                const state = CueState.getState();
                ImportExport.exportData(state);
                Components.showMessage('导出成功！', 'success');
            });

            document.getElementById('btn-reset').addEventListener('click', () => {
                if (Components.confirm('确定要清空所有数据吗？此操作不可撤销。')) {
                    CueState.clearAll();
                    Persistence.clear();
                    Components.showMessage('数据已清空', 'success');
                }
            });

            document.getElementById('btn-play-pause').addEventListener('click', () => {
                this.togglePlayPause();
            });

            document.getElementById('btn-prev-cue').addEventListener('click', () => {
                RehearsalManager.moveToPrevCue();
            });

            document.getElementById('btn-next-cue').addEventListener('click', () => {
                RehearsalManager.moveToNextCue();
            });

            document.getElementById('btn-stop-rehearsal').addEventListener('click', () => {
                this.stopRehearsal();
            });

            document.getElementById('btn-close-summary').addEventListener('click', () => {
                Components.hideRehearsalSummary();
            });
        },

        subscribeToStateChanges: function() {
            CueState.subscribe((action, data) => {
                this.validateAll();
                this.render();
                this.saveData();

                switch (action) {
                    case 'add':
                        Components.showMessage('Cue 已添加', 'success');
                        break;
                    case 'update':
                        Components.showMessage('Cue 已更新', 'success');
                        break;
                    case 'delete':
                        Components.showMessage('Cue 已删除', 'info');
                        break;
                    case 'reorder':
                        Components.showMessage('顺序已调整', 'info');
                        break;
                }
            });
        },

        subscribeToRehearsalEvents: function() {
            RehearsalManager.subscribe((event, data) => {
                switch (event) {
                    case 'start':
                        this.onRehearsalStart();
                        break;
                    case 'pause':
                        this.onRehearsalPause();
                        break;
                    case 'resume':
                        this.onRehearsalResume();
                        break;
                    case 'stop':
                        this.onRehearsalStop(data.summary);
                        break;
                    case 'cueChange':
                        this.onCueChange(data);
                        break;
                    case 'tick':
                        this.onRehearsalTick(data);
                        break;
                    case 'error':
                        Components.showMessage(data.message, 'error');
                        break;
                }
            });
        },

        saveCueFromForm: function() {
            const id = document.getElementById('cue-id').value;
            const number = document.getElementById('cue-number').value.trim();
            const durationValue = document.getElementById('cue-duration').value;
            const group = document.getElementById('cue-group').value;
            const riskLevel = document.getElementById('cue-risk').value;
            const dependsOn = document.getElementById('cue-depends').value || null;
            const description = document.getElementById('cue-description').value.trim();
            const notes = document.getElementById('cue-notes').value.trim();

            if (!number) {
                Components.showMessage('请输入 Cue 编号', 'error');
                return;
            }

            const duration = durationValue !== '' ? parseInt(durationValue, 10) : null;

            const cueData = {
                number: number,
                duration: duration,
                group: group,
                riskLevel: riskLevel,
                dependsOn: dependsOn,
                description: description,
                notes: notes
            };

            if (id) {
                CueState.updateCue(id, cueData);
            } else {
                CueState.addCue(cueData);
            }

            Components.closeCueEditor();
        },

        handleImportResult: function(result) {
            if (!result || !result.cues) {
                Components.showMessage('导入失败：数据无效', 'error');
                return;
            }

            const currentCues = CueState.getCues();
            const confirmed = ImportExport.confirmAndImport(result, currentCues.length);

            if (confirmed) {
                CueState.setState(result.cues);
                Components.showMessage(`成功导入 ${result.cueCount} 个 Cue`, 'success');
            }
        },

        switchToEditMode: function() {
            if (RehearsalManager.isRunning) {
                if (!Components.confirm('排练进行中，切换到编辑模式将结束当前排练。确定吗？')) {
                    return;
                }
                RehearsalManager.stopRehearsal();
            }

            this.currentMode = 'edit';
            Components.switchMode('edit');
            this.render();
        },

        switchToRehearsalMode: function() {
            const cues = CueState.getCues();
            
            if (cues.length === 0) {
                Components.showMessage('请先添加 Cue 再进入排练模式', 'warning');
                return;
            }

            const errors = Validation.getAllErrors(this.validationResults);
            if (errors.length > 0) {
                if (!Components.confirm(`存在 ${errors.length} 个错误，是否继续进入排练模式？`)) {
                    return;
                }
            }

            this.currentMode = 'rehearsal';
            Components.switchMode('rehearsal');
            this.renderRehearsalList();
        },

        togglePlayPause: function() {
            if (!RehearsalManager.isRunning) {
                this.startRehearsal();
            } else if (RehearsalManager.isPaused) {
                RehearsalManager.resumeRehearsal();
            } else {
                RehearsalManager.pauseRehearsal();
            }
        },

        startRehearsal: function() {
            const cues = CueState.getCues();
            RehearsalManager.startRehearsal(cues);
        },

        stopRehearsal: function() {
            if (RehearsalManager.isRunning) {
                RehearsalManager.stopRehearsal();
            }
        },

        onRehearsalStart: function() {
            Components.updatePlayPauseButton(true, false);
            Components.showMessage('排练开始', 'success');
        },

        onRehearsalPause: function() {
            Components.updatePlayPauseButton(true, true);
            Components.showMessage('排练已暂停', 'info');
        },

        onRehearsalResume: function() {
            Components.updatePlayPauseButton(true, false);
            Components.showMessage('排练继续', 'info');
        },

        onRehearsalStop: function(summary) {
            Components.updatePlayPauseButton(false, false);
            Components.hideRehearsalSummary();
            
            if (summary && summary.cues.length > 0) {
                Components.renderRehearsalSummary(summary);
            }
            
            Components.showMessage('排练已结束', 'info');
        },

        onCueChange: function(data) {
            this.renderRehearsalList();
            
            const currentCue = data.cue;
            const elapsedTime = RehearsalManager.getRehearsalElapsedTime();
            const currentCueElapsed = RehearsalManager.getCurrentCueElapsedTime();
            
            Components.renderCurrentCueDisplay(currentCue, elapsedTime, currentCueElapsed);
        },

        onRehearsalTick: function(data) {
            Components.updateRehearsalTimer(data.elapsedTime);
            
            if (data.currentCue) {
                Components.renderCurrentCueDisplay(
                    data.currentCue, 
                    data.elapsedTime, 
                    data.currentCueElapsed
                );
            }
        },

        render: function() {
            if (this.currentMode === 'edit') {
                this.renderEditMode();
            } else {
                this.renderRehearsalList();
            }
        },

        renderEditMode: function() {
            const cues = CueState.getCues();
            Components.renderCueList('cue-list', cues, this.validationResults, true);
        },

        renderRehearsalList: function() {
            let cues;
            
            if (RehearsalManager.isRunning) {
                cues = RehearsalManager.getAllCues();
            } else {
                cues = CueState.getCues().map(cue => ({
                    ...cue,
                    actualStartTime: null,
                    actualEndTime: null,
                    status: 'pending'
                }));
            }
            
            Components.renderCueList('rehearsal-cue-list', cues, null, false);
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        App.init();
    });

    global.App = App;

})(window);
