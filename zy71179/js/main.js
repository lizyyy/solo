class UIController {
    constructor(game) {
        this.game = game;
        this.selectedHistoryId = null;
        this.elements = {};
        this.cacheElements();
        this.bindEvents();
    }

    cacheElements() {
        this.elements = {
            levelName: document.getElementById('levelName'),
            scoreValue: document.getElementById('scoreValue'),
            timeValue: document.getElementById('timeValue'),
            phaseStatus: document.getElementById('phaseStatus'),
            conflictCount: document.getElementById('conflictCount'),
            timeoutCount: document.getElementById('timeoutCount'),
            levelList: document.getElementById('levelList'),
            eventPool: document.getElementById('eventPool'),
            conflictList: document.getElementById('conflictList'),
            playLog: document.getElementById('playLog'),
            historyList: document.getElementById('historyList'),
            btnPause: document.getElementById('btnPause'),
            btnRestart: document.getElementById('btnRestart'),
            btnPlay: document.getElementById('btnPlay'),
            btnReplay: document.getElementById('btnReplay'),
            btnExport: document.getElementById('btnExport'),
            conflictOverlay: document.getElementById('conflictOverlay'),
            resultModal: document.getElementById('resultModal'),
            resultTitle: document.getElementById('resultTitle'),
            resultBody: document.getElementById('resultBody'),
            btnCloseResult: document.getElementById('btnCloseResult'),
            btnReplayResult: document.getElementById('btnReplayResult'),
            btnExportResult: document.getElementById('btnExportResult')
        };
    }

    bindEvents() {
        this.elements.btnPause.addEventListener('click', () => {
            if (this.game.state.phase === GamePhase.PLAYING) {
                this.game.pause();
                this.elements.btnPause.textContent = '▶ 继续';
            } else if (this.game.state.phase === GamePhase.PAUSED) {
                this.game.resume();
                this.elements.btnPause.textContent = '⏸ 暂停';
            }
            this.updateStatus();
        });

        this.elements.btnRestart.addEventListener('click', () => {
            this.game.restart();
            this.elements.btnPause.textContent = '⏸ 暂停';
            this.elements.btnPlay.disabled = false;
            this.elements.btnExport.disabled = true;
        });

        this.elements.btnPlay.addEventListener('click', () => {
            if (this.game.state.phase === GamePhase.PLANNING) {
                this.game.startPlayback();
                this.elements.btnPlay.disabled = true;
                this.elements.btnPause.textContent = '⏸ 暂停';
            }
            this.updateStatus();
        });

        this.elements.btnReplay.addEventListener('click', () => {
            if (this.selectedHistoryId) {
                this.game.replayRecord(this.selectedHistoryId);
                this.elements.btnPlay.disabled = true;
            }
        });

        this.elements.btnExport.addEventListener('click', () => {
            this.showExportMenu();
        });

        this.elements.btnCloseResult.addEventListener('click', () => {
            this.elements.resultModal.classList.add('hidden');
        });

        this.elements.btnReplayResult.addEventListener('click', () => {
            this.elements.resultModal.classList.add('hidden');
            if (this.game.state.lastResult && this.game.state.currentLevel) {
                const records = this.game.replayManager.getRecordsByLevel(this.game.state.currentLevel);
                const latest = records[0];
                if (latest) {
                    this.game.replayRecord(latest.id);
                    this.elements.btnPlay.disabled = true;
                }
            }
        });

        this.elements.btnExportResult.addEventListener('click', () => {
            this.showExportMenu();
        });

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                this.elements.resultModal.classList.add('hidden');
            }
        });
    }

    renderLevelList() {
        this.elements.levelList.innerHTML = '';
        LEVELS.forEach(level => {
            const div = document.createElement('div');
            div.className = 'level-item';
            if (this.game.currentLevelData && this.game.currentLevelData.id === level.id) {
                div.classList.add('active');
            }
            
            const best = this.game.replayManager.getBestRecord(level.id);
            const bestScore = best ? `最高: ${best.result.score}` : '未完成';
            
            div.innerHTML = `
                <div class="level-title">${'★'.repeat(level.difficulty)} ${level.name}</div>
                <div class="level-desc">${level.description}</div>
                <div class="level-desc">${bestScore}</div>
            `;
            
            div.addEventListener('click', () => {
                this.game.loadLevel(level.id);
                this.renderLevelList();
                this.updateAll();
            });
            
            this.elements.levelList.appendChild(div);
        });
    }

    updateEventPool() {
        this.elements.eventPool.innerHTML = '';
        
        const typeLabels = {
            [EventType.LIGHT]: { label: '灯光', class: 'event-type-light' },
            [EventType.PROP]: { label: '道具', class: 'event-type-prop' },
            [EventType.ACTOR]: { label: '演员', class: 'event-type-actor' }
        };

        const grouped = {};
        this.game.state.eventPool.forEach(evt => {
            if (!grouped[evt.type]) grouped[evt.type] = [];
            grouped[evt.type].push(evt);
        });

        Object.keys(grouped).forEach(type => {
            grouped[type].forEach(evt => {
                const div = document.createElement('div');
                div.className = `event-item ${typeLabels[type].class}`;
                if (evt.placed) {
                    div.classList.add('used');
                }
                
                const orderBadge = evt.order && evt.order > 0 ? 
                    `<span style="background:rgba(0,0,0,0.3);padding:1px 6px;border-radius:10px;font-size:10px;">#${evt.order}</span>` : '';
                
                div.innerHTML = `
                    <span class="event-name">${evt.name} ${orderBadge}</span>
                    <span class="event-duration">${evt.duration}s</span>
                `;
                
                if (!evt.placed) {
                    div.addEventListener('mousedown', (e) => {
                        if (this.game.state.phase === GamePhase.PLANNING) {
                            this.game.interaction.startPoolDrag(evt, e.clientX, e.clientY);
                        }
                    });
                    
                    div.addEventListener('touchstart', (e) => {
                        if (this.game.state.phase === GamePhase.PLANNING) {
                            const touch = e.touches[0];
                            this.game.interaction.startPoolDrag(evt, touch.clientX, touch.clientY);
                        }
                    }, { passive: true });
                }
                
                this.elements.eventPool.appendChild(div);
            });
        });
    }

    updateConflictList() {
        const conflicts = this.game.state.conflicts;
        
        if (conflicts.length === 0) {
            this.elements.conflictList.innerHTML = '<p class="empty">暂无冲突</p>';
            this.elements.conflictOverlay.classList.add('hidden');
            return;
        }

        const errors = conflicts.filter(c => c.severity === 'error');
        if (errors.length > 0) {
            this.elements.conflictOverlay.classList.remove('hidden');
        } else {
            this.elements.conflictOverlay.classList.add('hidden');
        }

        this.elements.conflictList.innerHTML = '';
        conflicts.forEach(conflict => {
            const div = document.createElement('div');
            div.className = `conflict-item ${conflict.severity === 'warning' ? 'warning' : ''}`;
            
            const timeStr = this.game.formatTime(conflict.time);
            const icon = conflict.severity === 'error' ? '✗' : '⚠';
            
            div.innerHTML = `<strong>[${timeStr}]</strong> ${icon} ${conflict.message}`;
            
            div.addEventListener('mouseenter', () => {
                this.game.renderer.conflictHighlightEvents.clear();
                conflict.eventIds.forEach(id => {
                    this.game.renderer.conflictHighlightEvents.add(id);
                });
            });
            
            div.addEventListener('mouseleave', () => {
                this.game.renderer.highlightConflicts(conflicts);
            });
            
            this.elements.conflictList.appendChild(div);
        });
    }

    updateStatus() {
        const phase = this.game.state.phase;
        const phaseTexts = {
            [GamePhase.PLANNING]: '排程中',
            [GamePhase.PLAYING]: '演出中',
            [GamePhase.PAUSED]: '已暂停',
            [GamePhase.FINISHED]: '已完成'
        };
        
        this.elements.phaseStatus.textContent = phaseTexts[phase] || '准备中';
        this.elements.phaseStatus.className = 'value';
        if (phase === GamePhase.PLAYING) {
            this.elements.phaseStatus.classList.add('success');
        } else if (phase === GamePhase.PAUSED) {
            this.elements.phaseStatus.classList.add('warning');
        }

        const errors = this.game.state.conflicts.filter(c => c.severity === 'error');
        const warnings = this.game.state.conflicts.filter(c => c.severity === 'warning');
        const timeouts = this.game.state.conflicts.filter(c => c.type === ConflictType.SCENECHANGE_TIMEOUT);

        this.elements.conflictCount.textContent = errors.length;
        this.elements.conflictCount.className = 'value';
        if (errors.length > 0) {
            this.elements.conflictCount.classList.add('danger');
        } else if (warnings.length > 0) {
            this.elements.conflictCount.classList.add('warning');
        } else {
            this.elements.conflictCount.classList.add('success');
        }

        this.elements.timeoutCount.textContent = timeouts.length;
        this.elements.timeoutCount.className = 'value';
        if (timeouts.length > 0) {
            this.elements.timeoutCount.classList.add('danger');
        } else {
            this.elements.timeoutCount.classList.add('success');
        }

        this.elements.scoreValue.textContent = this.game.state.score;
        
        if (this.game.currentLevelData) {
            this.elements.levelName.textContent = this.game.currentLevelData.name;
        }
    }

    updateTimeDisplay(time) {
        this.elements.timeValue.textContent = this.game.formatTime(time);
    }

    addPlayLog(type, message) {
        const div = document.createElement('div');
        div.className = `log-item ${type}`;
        div.textContent = message;
        this.elements.playLog.appendChild(div);
        this.elements.playLog.scrollTop = this.elements.playLog.scrollHeight;
        
        while (this.elements.playLog.children.length > 100) {
            this.elements.playLog.removeChild(this.elements.playLog.firstChild);
        }
    }

    clearPlayLog() {
        this.elements.playLog.innerHTML = '<p class="empty">开始演出后显示日志</p>';
    }

    updateHistoryList() {
        const records = this.game.replayManager.records;
        
        if (records.length === 0) {
            this.elements.historyList.innerHTML = '<p class="empty">暂无历史记录</p>';
            this.elements.btnReplay.disabled = true;
            return;
        }

        this.elements.historyList.innerHTML = '';
        records.forEach(record => {
            const div = document.createElement('div');
            div.className = 'history-item';
            if (this.selectedHistoryId === record.id) {
                div.classList.add('selected');
            }
            
            const scorePercent = Math.round((record.result.score / record.result.maxScore) * 100);
            const resultClass = record.result.success ? 'success' : 'danger';
            
            div.innerHTML = `
                <div class="history-title">${record.levelName}</div>
                <div class="history-meta">
                    <span class="${resultClass}">${record.result.score}/${record.result.maxScore} (${scorePercent}%)</span>
                </div>
                <div class="history-meta">${record.getDisplayTime()}</div>
            `;
            
            div.addEventListener('click', () => {
                this.selectedHistoryId = record.id;
                this.game.state.selectedHistoryId = record.id;
                this.updateHistoryList();
                this.elements.btnReplay.disabled = false;
            });
            
            div.addEventListener('dblclick', () => {
                this.game.replayRecord(record.id);
                this.elements.btnPlay.disabled = true;
            });
            
            this.elements.historyList.appendChild(div);
        });
    }

    showResult(result, levelData, state) {
        this.elements.resultModal.classList.remove('hidden');
        
        this.elements.resultTitle.textContent = result.success ? '🎉 演出成功！' : '💔 演出失败';
        
        const scorePercent = Math.round((result.score / result.maxScore) * 100);
        const errors = result.conflicts.filter(c => c.severity === 'error');
        const warnings = result.conflicts.filter(c => c.severity === 'warning');

        let html = '';
        
        if (result.failReason) {
            html += `
                <div class="fail-reason">
                    <h4>失败原因</h4>
                    <p>${result.failReason}</p>
                </div>
            `;
        }

        html += `
            <div class="result-section">
                <h3>📊 得分统计</h3>
                <div class="result-item">
                    <span class="label">最终得分</span>
                    <span class="value ${result.success ? 'success' : 'danger'}">${result.score} / ${result.maxScore}</span>
                </div>
                <div class="result-item">
                    <span class="label">完成度</span>
                    <span class="value ${scorePercent >= 80 ? 'success' : scorePercent >= 60 ? 'warning' : 'danger'}">${scorePercent}%</span>
                </div>
                <div class="result-item">
                    <span class="label">错误数量</span>
                    <span class="value ${errors.length > 0 ? 'danger' : 'success'}">${errors.length}</span>
                </div>
                <div class="result-item">
                    <span class="label">警告数量</span>
                    <span class="value ${warnings.length > 0 ? 'warning' : 'success'}">${warnings.length}</span>
                </div>
            </div>
        `;

        if (state.sceneChanges.length > 0) {
            html += `<div class="result-section"><h3>🔄 换景统计</h3>`;
            state.sceneChanges.forEach((sc, idx) => {
                const onTime = sc.actualDuration <= sc.maxDuration;
                const overTime = Math.max(0, sc.actualDuration - sc.maxDuration);
                html += `
                    <div class="result-item">
                        <span class="label">换景 ${idx + 1}: ${sc.fromScene} → ${sc.toScene}</span>
                        <span class="value ${onTime ? 'success' : 'danger'}">
                            ${sc.actualDuration.toFixed(1)}s / ${sc.maxDuration}s
                            ${onTime ? '✓' : `✗ 超时 ${overTime.toFixed(1)}s`}
                        </span>
                    </div>
                `;
            });
            html += `</div>`;
        }

        if (result.conflicts.length > 0) {
            html += `
                <div class="result-section">
                    <h3>⚠️ 冲突详情</h3>
                    ${result.conflicts.map(c => `
                        <div class="result-item">
                            <span class="label">[${this.game.formatTime(c.time)}] ${c.message}</span>
                            <span class="value ${c.severity === 'error' ? 'danger' : 'warning'}">
                                ${c.severity === 'error' ? '错误' : '警告'}
                            </span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (levelData.hints && levelData.hints.length > 0) {
            html += `
                <div class="result-section">
                    <h3>💡 关卡提示</h3>
                    ${levelData.hints.map(h => `<p style="margin:4px 0;color:#aaa;">• ${h}</p>`).join('')}
                </div>
            `;
        }

        this.elements.resultBody.innerHTML = html;
    }

    enableExport() {
        this.elements.btnExport.disabled = false;
    }

    showExportMenu() {
        const format = prompt('请选择导出格式:\n1. 文本报告 (.txt)\n2. HTML报告 (.html)\n3. JSON数据 (.json)\n\n请输入数字 (1-3):', '1');
        
        let exportFormat = 'text';
        if (format === '2') exportFormat = 'html';
        else if (format === '3') exportFormat = 'json';
        
        this.game.downloadReport(exportFormat);
        this.addPlayLog('success', `报告已导出: ${exportFormat.toUpperCase()}格式`);
    }

    updateAll() {
        this.updateStatus();
        this.updateEventPool();
        this.updateConflictList();
        this.updateTimeDisplay(0);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('timelineCanvas');
    const game = new Game();
    const ui = new UIController(game);
    
    game.init(canvas, ui);
    game.ui = ui;
    
    ui.renderLevelList();
    
    if (LEVELS.length > 0) {
        game.loadLevel(LEVELS[0].id);
        ui.updateAll();
    }
    
    ui.updateHistoryList();
    
    const observer = new MutationObserver(() => {
        ui.updateEventPool();
        ui.updateConflictList();
        ui.updateStatus();
    });
    
    setInterval(() => {
        ui.updateEventPool();
        ui.updateConflictList();
        ui.updateStatus();
    }, 200);
    
    window.__game = game;
    window.__ui = ui;
    
    console.log('🎭 剧场换景节奏游戏已加载！');
    console.log('快捷键: Space=暂停/继续, R=重开, Enter=开始演出, Delete=删除事件, 方向键=滚动, Ctrl+滚轮=缩放');
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UIController };
}
