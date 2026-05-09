import { GameEngine } from './gameEngine.js';
import { GameState, FailureReason } from './game.js';

class GameUI {
    constructor() {
        this.gameEngine = new GameEngine();
        this.animationFrameId = null;
        this.lastTimestamp = 0;
        this.replayCurrentIndex = 0;
        this.initialRenderDone = false;
        
        this.cacheElements();
        this.bindEvents();
        this.render();
        this.initialRenderDone = true;
    }

    cacheElements() {
        this.elements = {
            score: document.getElementById('score'),
            time: document.getElementById('time'),
            products: document.getElementById('products'),
            btnStart: document.getElementById('btn-start'),
            btnPause: document.getElementById('btn-pause'),
            btnRestart: document.getElementById('btn-restart'),
            btnReplay: document.getElementById('btn-replay'),
            statusText: document.getElementById('status-text'),
            workstationsContainer: document.getElementById('workstations-container'),
            scoreLog: document.getElementById('score-log'),
            gameOverModal: document.getElementById('game-over-modal'),
            gameOverTitle: document.getElementById('game-over-title'),
            gameOverMessage: document.getElementById('game-over-message'),
            finalScore: document.getElementById('final-score'),
            finalProducts: document.getElementById('final-products'),
            btnModalRestart: document.getElementById('btn-modal-restart'),
            btnModalReplay: document.getElementById('btn-modal-replay'),
            replayModal: document.getElementById('replay-modal'),
            replayProgress: document.getElementById('replay-progress'),
            btnReplayPrev: document.getElementById('btn-replay-prev'),
            btnReplayNext: document.getElementById('btn-replay-next'),
            btnReplayClose: document.getElementById('btn-replay-close'),
            replayContainer: document.getElementById('replay-container')
        };
    }

    bindEvents() {
        this.elements.btnStart.addEventListener('click', () => this.onStart());
        this.elements.btnPause.addEventListener('click', () => this.onPause());
        this.elements.btnRestart.addEventListener('click', () => this.onRestart());
        this.elements.btnReplay.addEventListener('click', () => this.onReplay());
        this.elements.btnModalRestart.addEventListener('click', () => {
            this.hideGameOverModal();
            this.onRestart();
        });
        this.elements.btnModalReplay.addEventListener('click', () => {
            this.hideGameOverModal();
            this.onReplay();
        });
        this.elements.btnReplayPrev.addEventListener('click', () => this.onReplayPrev());
        this.elements.btnReplayNext.addEventListener('click', () => this.onReplayNext());
        this.elements.btnReplayClose.addEventListener('click', () => this.hideReplayModal());
    }

    onStart() {
        const state = this.gameEngine.getState();
        if (state.gameState === GameState.PAUSED) {
            this.gameEngine.resume();
        } else {
            this.gameEngine.start();
            this.startGameLoop();
        }
        this.updateButtonStates();
    }

    onPause() {
        this.gameEngine.pause();
        this.updateButtonStates();
    }

    onRestart() {
        this.stopGameLoop();
        this.gameEngine.restart();
        this.startGameLoop();
        this.updateButtonStates();
    }

    onReplay() {
        if (this.gameEngine.getHistoryCount() === 0) {
            return;
        }
        this.gameEngine.startReplay();
        this.replayCurrentIndex = this.gameEngine.getHistoryCount() - 1;
        this.showReplayModal();
        this.renderReplay();
    }

    onReplayPrev() {
        if (this.replayCurrentIndex > 0) {
            this.replayCurrentIndex--;
            this.renderReplay();
        }
    }

    onReplayNext() {
        if (this.replayCurrentIndex < this.gameEngine.getHistoryCount() - 1) {
            this.replayCurrentIndex++;
            this.renderReplay();
        }
    }

    startGameLoop() {
        this.lastTimestamp = performance.now();
        this.gameLoop();
    }

    stopGameLoop() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    gameLoop() {
        const currentTimestamp = performance.now();
        const deltaTime = (currentTimestamp - this.lastTimestamp) / 1000;
        this.lastTimestamp = currentTimestamp;
        
        const state = this.gameEngine.getState();
        if (state.gameState === GameState.RUNNING) {
            this.gameEngine.tick(Math.min(deltaTime, 0.1));
        }
        
        this.render();
        
        const newState = this.gameEngine.getState();
        if (newState.gameState === GameState.FAILED || newState.gameState === GameState.FINISHED) {
            this.stopGameLoop();
            this.showGameOverModal(newState);
            this.updateButtonStates();
            return;
        }
        
        this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
    }

    updateButtonStates() {
        const state = this.gameEngine.getState();
        
        const isIdle = state.gameState === GameState.IDLE;
        const isRunning = state.gameState === GameState.RUNNING;
        const isPaused = state.gameState === GameState.PAUSED;
        const isEnded = state.gameState === GameState.FAILED || state.gameState === GameState.FINISHED;
        const hasHistory = this.gameEngine.getHistoryCount() > 0;
        
        if (isPaused) {
            this.elements.btnStart.textContent = '继续';
        } else {
            this.elements.btnStart.textContent = '开始游戏';
        }
        
        this.elements.btnStart.disabled = isRunning;
        this.elements.btnPause.disabled = !isRunning;
        this.elements.btnRestart.disabled = isIdle;
        this.elements.btnReplay.disabled = !hasHistory || isRunning;
    }

    render() {
        const state = this.gameEngine.getState();
        this.renderHeader(state);
        this.renderStatus(state);
        this.renderWorkstations(state);
        this.renderScoreLog(state);
    }

    renderHeader(state) {
        this.elements.score.textContent = state.score;
        this.elements.time.textContent = `${Math.ceil(state.timeLeft)}秒`;
        this.elements.products.textContent = `${state.productsCompleted}/${state.targetProducts}`;
    }

    renderStatus(state) {
        let statusText = '';
        switch (state.gameState) {
            case GameState.IDLE:
                statusText = '点击「开始游戏」按钮开始';
                break;
            case GameState.RUNNING:
                statusText = '🏃 游戏进行中...';
                break;
            case GameState.PAUSED:
                statusText = '⏸ 游戏已暂停';
                break;
            case GameState.FAILED:
                statusText = this.getFailureReasonText(state.failureReason);
                break;
            case GameState.FINISHED:
                statusText = '🎉 恭喜！你成功完成了任务！';
                break;
        }
        this.elements.statusText.textContent = statusText;
    }

    getFailureReasonText(reason) {
        switch (reason) {
            case FailureReason.TIME_EXHAUSTED:
                return '⏰ 时间耗尽！请优化你的调度策略。';
            case FailureReason.SCORE_TOO_LOW:
                return '💔 分数过低！缓冲区问题太严重了。';
            default:
                return '❌ 游戏失败！';
        }
    }

    renderWorkstations(state) {
        if (!this.initialRenderDone) {
            this.elements.workstationsContainer.innerHTML = '';
            
            for (let i = 0; i < state.workstations.length; i++) {
                const ws = state.workstations[i];
                
                if (i > 0) {
                    const bufferId = `b${i}`;
                    const buffer = state.buffers.find(b => b.id === bufferId);
                    if (buffer) {
                        this.elements.workstationsContainer.appendChild(
                            this.createBufferElement(buffer)
                        );
                    }
                }
                
                this.elements.workstationsContainer.appendChild(
                    this.createWorkstationElement(ws)
                );
            }
        }
        
        for (const ws of state.workstations) {
            this.updateWorkstationElement(ws);
        }
        
        for (const buffer of state.buffers) {
            this.updateBufferElement(buffer);
        }
    }

    createWorkstationElement(ws) {
        const div = document.createElement('div');
        div.className = 'workstation';
        div.id = `ws-${ws.id}`;
        
        div.innerHTML = `
            <div class="ws-name">${ws.name}</div>
            <div class="progress-bar">
                <div class="progress-bar-fill" id="ws-progress-${ws.id}"></div>
            </div>
            <div class="cycle-time">
                <span class="cycle-time-value" id="ws-cycle-${ws.id}">${ws.cycleTime}</span>
                <span class="cycle-time-unit">秒</span>
            </div>
            <div class="ws-controls">
                <button class="ws-control-btn decrease" id="ws-decrease-${ws.id}" data-id="${ws.id}" data-change="-1">-</button>
                <button class="ws-control-btn increase" id="ws-increase-${ws.id}" data-id="${ws.id}" data-change="1">+</button>
            </div>
        `;
        
        const decreaseBtn = div.querySelector(`#ws-decrease-${ws.id}`);
        const increaseBtn = div.querySelector(`#ws-increase-${ws.id}`);
        
        decreaseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const id = e.target.getAttribute('data-id');
            const change = parseInt(e.target.getAttribute('data-change'));
            this.gameEngine.adjustWorkstationCycleTime(id, change);
            this.updateWorkstationButtons();
        });
        
        increaseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const id = e.target.getAttribute('data-id');
            const change = parseInt(e.target.getAttribute('data-change'));
            this.gameEngine.adjustWorkstationCycleTime(id, change);
            this.updateWorkstationButtons();
        });
        
        return div;
    }

    updateWorkstationElement(ws) {
        const wsDiv = document.getElementById(`ws-${ws.id}`);
        if (!wsDiv) return;
        
        if (ws.isWorking) {
            wsDiv.classList.add('working');
        } else {
            wsDiv.classList.remove('working');
        }
        
        const progressFill = document.getElementById(`ws-progress-${ws.id}`);
        if (progressFill) {
            progressFill.style.width = `${ws.progressPercent}%`;
        }
        
        const cycleValue = document.getElementById(`ws-cycle-${ws.id}`);
        if (cycleValue) {
            cycleValue.textContent = ws.cycleTime;
        }
        
        this.updateWorkstationButtons();
    }

    updateWorkstationButtons() {
        const state = this.gameEngine.getState();
        for (const ws of state.workstations) {
            const decreaseBtn = document.getElementById(`ws-decrease-${ws.id}`);
            const increaseBtn = document.getElementById(`ws-increase-${ws.id}`);
            
            if (decreaseBtn) {
                decreaseBtn.disabled = !ws.canDecreaseCycleTime || state.gameState !== GameState.RUNNING;
            }
            if (increaseBtn) {
                increaseBtn.disabled = !ws.canIncreaseCycleTime || state.gameState !== GameState.RUNNING;
            }
        }
    }

    createBufferElement(buffer) {
        const div = document.createElement('div');
        div.className = 'buffer';
        div.id = `buffer-${buffer.id}`;
        
        div.innerHTML = `
            <div class="buffer-name">缓冲区 ${buffer.id}</div>
            <div class="buffer-items" id="buffer-items-${buffer.id}">
            </div>
            <div class="buffer-stats" id="buffer-stats-${buffer.id}">
                ${buffer.items} / ${buffer.capacity}
            </div>
        `;
        
        return div;
    }

    updateBufferElement(buffer) {
        const bufferDiv = document.getElementById(`buffer-${buffer.id}`);
        if (!bufferDiv) return;
        
        bufferDiv.classList.remove('warning-full', 'warning-empty');
        if (buffer.isFull) {
            bufferDiv.classList.add('warning-full');
        } else if (buffer.isEmpty) {
            bufferDiv.classList.add('warning-empty');
        }
        
        const itemsDiv = document.getElementById(`buffer-items-${buffer.id}`);
        if (itemsDiv) {
            itemsDiv.innerHTML = '';
            for (let i = 0; i < buffer.items; i++) {
                const item = document.createElement('div');
                item.className = 'buffer-item';
                itemsDiv.appendChild(item);
            }
        }
        
        const statsDiv = document.getElementById(`buffer-stats-${buffer.id}`);
        if (statsDiv) {
            statsDiv.textContent = `${buffer.items} / ${buffer.capacity}`;
        }
    }

    renderScoreLog(state) {
        if (state.scoreRecords.length === 0) {
            this.elements.scoreLog.innerHTML = '<div class="empty-log">暂无记录</div>';
            return;
        }
        
        this.elements.scoreLog.innerHTML = '';
        for (const record of state.scoreRecords) {
            const div = document.createElement('div');
            div.className = `score-log-item ${record.scoreChange >= 0 ? 'positive' : 'negative'}`;
            
            const timeStr = record.time.toFixed(1);
            const scoreStr = record.scoreChange >= 0 ? `+${record.scoreChange}` : `${record.scoreChange}`;
            
            div.innerHTML = `
                <span class="log-time">[${timeStr}s]</span>
                <span class="log-reason">${record.reason}</span>
                <span class="log-score">${scoreStr}</span>
            `;
            
            this.elements.scoreLog.appendChild(div);
        }
    }

    showGameOverModal(state) {
        const isWin = state.gameState === GameState.FINISHED;
        
        this.elements.gameOverTitle.textContent = isWin ? '🎉 胜利！' : '😢 游戏结束';
        
        if (isWin) {
            this.elements.gameOverMessage.textContent = '太棒了！你成功地平衡了产线，完成了所有目标！';
        } else {
            this.elements.gameOverMessage.textContent = this.getFailureReasonText(state.failureReason);
        }
        
        this.elements.finalScore.textContent = state.score;
        this.elements.finalProducts.textContent = `${state.productsCompleted}/${state.targetProducts}`;
        
        this.elements.gameOverModal.classList.remove('hidden');
    }

    hideGameOverModal() {
        this.elements.gameOverModal.classList.add('hidden');
    }

    showReplayModal() {
        this.elements.replayModal.classList.remove('hidden');
    }

    hideReplayModal() {
        this.elements.replayModal.classList.add('hidden');
        this.gameEngine.stopReplay();
    }

    renderReplay() {
        const state = this.gameEngine.getReplayState(this.replayCurrentIndex);
        if (!state) return;
        
        this.elements.replayProgress.textContent = `${this.replayCurrentIndex + 1} / ${state.replayTotal}`;
        
        this.elements.btnReplayPrev.disabled = this.replayCurrentIndex <= 0;
        this.elements.btnReplayNext.disabled = this.replayCurrentIndex >= state.replayTotal - 1;
        
        let html = `
            <div class="replay-info">
                <p><strong>时间:</strong> ${state.elapsedTime.toFixed(1)}s</p>
                <p><strong>分数:</strong> ${state.score}</p>
                <p><strong>完成产品:</strong> ${state.productsCompleted}/${state.targetProducts}</p>
            </div>
            <div class="replay-line" style="display: flex; align-items: center; justify-content: center; gap: 10px; padding: 20px; overflow-x: auto;">
                <div style="text-align: center; min-width: 80px;">
                    <div style="font-size: 2rem; margin-bottom: 5px;">📦</div>
                    <div style="font-size: 0.9rem; color: #6c757d;">原料</div>
                </div>
        `;
        
        for (let i = 0; i < state.workstations.length; i++) {
            const ws = state.workstations[i];
            
            if (i > 0) {
                const bufferId = `b${i}`;
                const buffer = state.buffers.find(b => b.id === bufferId);
                if (buffer) {
                    const bufferClass = buffer.isFull ? 'warning-full' : (buffer.isEmpty ? 'warning-empty' : '');
                    html += `
                        <div style="background: #fff; border-radius: 12px; padding: 15px; min-width: 100px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); text-align: center; border: 3px solid ${buffer.isFull ? '#ff6b6b' : (buffer.isEmpty ? '#ffa502' : '#dee2e6')};">
                            <div style="font-size: 0.8rem; color: #6c757d; margin-bottom: 5px;">缓冲区 ${buffer.id}</div>
                            <div style="font-size: 0.9rem; font-weight: 600;">${buffer.items} / ${buffer.capacity}</div>
                        </div>
                    `;
                }
            }
            
            const wsWorkingClass = ws.isWorking ? 'working' : '';
            html += `
                <div style="background: #fff; border-radius: 12px; padding: 15px; min-width: 120px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 3px solid ${ws.isWorking ? '#28a745' : '#dee2e6'};">
                    <div style="font-size: 1rem; font-weight: bold; color: #333; margin-bottom: 5px; text-align: center;">${ws.name}</div>
                    <div style="width: 100%; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; margin-bottom: 5px;">
                        <div style="height: 100%; background: linear-gradient(90deg, #28a745, #20c997); width: ${ws.progressPercent}%;"></div>
                    </div>
                    <div style="text-align: center; font-size: 0.9rem;">
                        <span style="font-size: 1.2rem; font-weight: bold; color: #667eea;">${ws.cycleTime}</span>
                        <span style="color: #6c757d;">秒</span>
                    </div>
                </div>
            `;
        }
        
        html += `
                <div style="text-align: center; min-width: 80px;">
                    <div style="font-size: 2rem; margin-bottom: 5px;">✅</div>
                    <div style="font-size: 0.9rem; color: #6c757d;">成品</div>
                </div>
            </div>
            <div style="margin-top: 20px;">
                <h4 style="margin-bottom: 10px;">计分明细</h4>
                <div style="max-height: 150px; overflow-y: auto; background: #fff; border-radius: 8px; padding: 10px;">
        `;
        
        if (state.scoreRecords.length === 0) {
            html += '<p style="color: #adb5bd; text-align: center;">暂无记录</p>';
        } else {
            for (const record of state.scoreRecords) {
                const scoreStr = record.scoreChange >= 0 ? `+${record.scoreChange}` : `${record.scoreChange}`;
                const scoreClass = record.scoreChange >= 0 ? '#28a745' : '#dc3545';
                html += `
                    <div style="padding: 5px; border-left: 3px solid ${record.scoreChange >= 0 ? '#28a745' : '#dc3545'}; margin-bottom: 5px; background: #f8f9fa;">
                        <span style="color: #6c757d; font-size: 0.8rem;">[${record.time.toFixed(1)}s]</span>
                        <span style="font-weight: 600; margin: 0 5px;">${record.reason}</span>
                        <span style="font-weight: bold; color: ${scoreClass};">${scoreStr}</span>
                    </div>
                `;
            }
        }
        
        html += `
                </div>
            </div>
        `;
        
        this.elements.replayContainer.innerHTML = html;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GameUI();
});
