class GameUI {
    constructor(game) {
        this.game = game;
        this.uiUpdateInterval = null;
        this.lastLogCount = 0;
        this.lastErrorCount = 0;
        
        this.elements = {
            roundDisplay: document.getElementById('round-display'),
            premiumDisplay: document.getElementById('premium-display'),
            reserveDisplay: document.getElementById('reserve-display'),
            escapedDisplay: document.getElementById('escaped-display'),
            btnStart: document.getElementById('btn-start'),
            btnPause: document.getElementById('btn-pause'),
            btnRestart: document.getElementById('btn-restart'),
            btnReport: document.getElementById('btn-report'),
            btnNextWave: document.getElementById('btn-next-wave'),
            policyCards: document.getElementById('policy-cards'),
            selectedPolicyInfo: document.getElementById('selected-policy-info'),
            towerSlots: document.getElementById('tower-slots'),
            monstersLayer: document.getElementById('monsters-layer'),
            roundStatus: document.getElementById('round-status'),
            settlementLog: document.getElementById('settlement-log'),
            errorMessages: document.getElementById('error-messages'),
            modalOverlay: document.getElementById('modal-overlay'),
            modalTitle: document.getElementById('modal-title'),
            modalContent: document.getElementById('modal-content'),
            modalClose: document.getElementById('modal-close'),
            modalCloseBtn: document.getElementById('modal-close-btn'),
            modalExport: document.getElementById('modal-export'),
            replayOverlay: document.getElementById('replay-overlay'),
            replayContent: document.getElementById('replay-content'),
            replayProgress: document.getElementById('replay-progress'),
            replayPrev: document.getElementById('replay-prev'),
            replayNext: document.getElementById('replay-next'),
            replayClose: document.getElementById('replay-close')
        };

        this.currentReplaySession = null;
        this._initEventListeners();
    }

    _initEventListeners() {
        this.elements.btnStart.addEventListener('click', () => this._handleStart());
        this.elements.btnPause.addEventListener('click', () => this._handlePause());
        this.elements.btnRestart.addEventListener('click', () => this._handleRestart());
        this.elements.btnReport.addEventListener('click', () => this._handleReport());
        this.elements.btnNextWave.addEventListener('click', () => this._handleNextWave());
        this.elements.modalClose.addEventListener('click', () => this._hideModal());
        this.elements.modalCloseBtn.addEventListener('click', () => this._hideModal());
        this.elements.modalExport.addEventListener('click', () => this._handleExportReport());
        this.elements.replayPrev.addEventListener('click', () => this._handleReplayPrev());
        this.elements.replayNext.addEventListener('click', () => this._handleReplayNext());
        this.elements.replayClose.addEventListener('click', () => this._handleReplayClose());
        this.elements.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.elements.modalOverlay) this._hideModal();
        });
        this.elements.replayOverlay.addEventListener('click', (e) => {
            if (e.target === this.elements.replayOverlay) this._handleReplayClose();
        });
    }

    init() {
        this._renderPolicyCards();
        this._renderTowerSlots();
        this._updateStats();
        this._startUIUpdateLoop();
    }

    _startUIUpdateLoop() {
        if (this.uiUpdateInterval) return;
        this.uiUpdateInterval = setInterval(() => this._updateUI(), 100);
    }

    _stopUIUpdateLoop() {
        if (this.uiUpdateInterval) {
            clearInterval(this.uiUpdateInterval);
            this.uiUpdateInterval = null;
        }
    }

    _updateUI() {
        this._updateStats();
        this._updateMonsters();
        this._updateSettlementLog();
        this._updateErrorMessages();
        this._updateRoundStatus();
        this._updateButtons();
        this._updatePlacedPolicies();
    }

    _renderPolicyCards() {
        const container = this.elements.policyCards;
        container.innerHTML = '';

        for (const policy of this.game.policies) {
            const isDisabled = policy.remainingUses !== Infinity && policy.remainingUses <= 0;
            const isSelected = this.game.selectedPolicyId === policy.id;
            const isPlaced = this.game.placedPolicies.includes(policy);

            const card = document.createElement('div');
            card.className = `policy-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`;
            card.dataset.policyId = policy.id;
            
            card.innerHTML = `
                <div class="policy-card-header">
                    <span class="policy-card-name">${policy.name}</span>
                    <span class="policy-card-type">${policy.type}</span>
                </div>
                <div class="policy-card-stats">
                    <div class="policy-card-stat">
                        <span>保费</span>
                        <span>${this._formatMoney(policy.premium)}</span>
                    </div>
                    <div class="policy-card-stat">
                        <span>免赔</span>
                        <span>${this._formatMoney(policy.deductible)}</span>
                    </div>
                    <div class="policy-card-stat">
                        <span>保额</span>
                        <span>${this._formatMoney(policy.limit)}</span>
                    </div>
                    <div class="policy-card-stat">
                        <span>比例</span>
                        <span>${(policy.ratio * 100).toFixed(0)}%</span>
                    </div>
                </div>
                <div class="policy-card-level">
                    ${[1, 2, 3, 4, 5].map(l => `
                        <div class="level-dot ${policy.levels.includes(l) ? 'active' : ''}" title="${l}级风险${policy.levels.includes(l) ? '承保' : '不承保'}"></div>
                    `).join('')}
                </div>
                <div style="margin-top: 6px; font-size: 10px; color: ${policy.remainingUses === Infinity ? '#4caf50' : '#a0aec0'};">
                    剩余赔付: ${policy.remainingUses === Infinity ? '无限' : policy.remainingUses}次
                    ${isPlaced ? ' | 已放置' : ''}
                </div>
                ${policy.normalizationErrors.length > 0 ? `
                    <div style="margin-top: 4px; font-size: 10px; color: #ff9800;">
                        ⚠️ 数据导入时发现${policy.normalizationErrors.length}个问题
                    </div>
                ` : ''}
            `;

            if (!isDisabled && !isPlaced) {
                card.addEventListener('click', () => this._handlePolicySelect(policy.id));
            }

            container.appendChild(card);
        }

        this._updateSelectedPolicyInfo();
    }

    _renderTowerSlots() {
        const container = this.elements.towerSlots;
        container.innerHTML = '';

        for (let i = 0; i < GameData.towerSlotCount; i++) {
            const slot = document.createElement('div');
            slot.className = 'tower-slot';
            slot.dataset.slotIndex = i;
            
            slot.innerHTML = `
                <span class="slot-label">位置${i + 1}<br>点击放置</span>
            `;

            slot.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-btn')) {
                    e.stopPropagation();
                    this._handleRemovePolicy(i);
                } else {
                    this._handleSlotClick(i);
                }
            });

            container.appendChild(slot);
        }
    }

    _updatePlacedPolicies() {
        const slots = this.elements.towerSlots.querySelectorAll('.tower-slot');
        const placedPolicies = this.game.getPlacedPolicies();

        slots.forEach((slot, index) => {
            const placed = placedPolicies[index];
            
            if (placed.policy) {
                slot.classList.add('occupied');
                slot.innerHTML = `
                    <button class="remove-btn" title="移除保单">×</button>
                    <div class="placed-policy">
                        <div class="placed-policy-name">${placed.policy.name}</div>
                        <div class="placed-policy-stats">
                            <div class="placed-policy-stat">
                                <span>免赔</span>
                                <span>${this._formatMoney(placed.policy.deductible)}</span>
                            </div>
                            <div class="placed-policy-stat">
                                <span>已赔</span>
                                <span>${this._formatMoney(placed.policy.totalPayout)}</span>
                            </div>
                            <div class="placed-policy-stat">
                                <span>剩余</span>
                                <span>${this._formatMoney(placed.policy.remainingLimit)}</span>
                            </div>
                            <div class="placed-policy-stat">
                                <span>次数</span>
                                <span>${placed.policy.remainingUses === Infinity ? '∞' : placed.policy.remainingUses}</span>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                slot.classList.remove('occupied');
                slot.innerHTML = `<span class="slot-label">位置${index + 1}<br>点击放置</span>`;
            }
        });
    }

    _updateMonsters() {
        const container = this.elements.monstersLayer;
        const monsters = this.game.getActiveMonsters();
        const boardRect = container.parentElement.getBoundingClientRect();
        const pathWidth = boardRect.width * 0.9;
        const pathLeft = (boardRect.width - pathWidth) / 2;

        container.innerHTML = '';

        for (const monster of monsters) {
            const monsterEl = document.createElement('div');
            monsterEl.className = `monster risk-${monster.level}`;
            monsterEl.dataset.instanceId = monster.instanceId;
            
            const leftPercent = monster.position;
            const leftPx = pathLeft + (pathWidth * leftPercent / 100);
            
            monsterEl.style.left = `${leftPx}px`;
            monsterEl.style.top = '50%';
            monsterEl.style.transform = 'translate(-50%, -50%)';

            const hpPercent = (monster.hp / monster.maxHp) * 100;
            const hpColor = hpPercent > 60 ? '#4caf50' : hpPercent > 30 ? '#ffc107' : '#e94560';

            monsterEl.innerHTML = `
                <div class="monster-body">${monster.emoji}</div>
                <div class="monster-hp-bar">
                    <div class="monster-hp-fill" style="width: ${hpPercent}%; background: ${hpColor};"></div>
                </div>
                <div class="monster-amount">${monster.id} ${this._formatMoney(monster.amount)}</div>
            `;

            container.appendChild(monsterEl);
        }
    }

    _updateStats() {
        const summary = this.game.getGameSummary();
        
        this.elements.roundDisplay.textContent = `${this.game.currentRound || 1} / ${this.game.totalRounds}`;
        this.elements.premiumDisplay.textContent = this._formatMoney(this.game.totalPremiumIncome);
        
        const reserveEl = this.elements.reserveDisplay;
        reserveEl.textContent = this._formatMoney(this.game.reserve.getBalance());
        reserveEl.className = 'stat-value';
        if (this.game.reserve.getBalance() < 20000) {
            reserveEl.classList.add('danger');
        } else if (this.game.reserve.getBalance() < 50000) {
            reserveEl.classList.add('warning');
        } else {
            reserveEl.classList.add('success');
        }

        const escapedEl = this.elements.escapedDisplay;
        escapedEl.textContent = `${this.game.escapedMonsters.length} / ${GameData.maxEscaped}`;
        escapedEl.className = 'stat-value';
        if (this.game.escapedMonsters.length >= GameData.maxEscaped - 1) {
            escapedEl.classList.add('danger');
        } else if (this.game.escapedMonsters.length >= GameData.maxEscaped - 2) {
            escapedEl.classList.add('warning');
        }
    }

    _updateRoundStatus() {
        const statusEl = this.elements.roundStatus;
        const state = this.game.state;

        let statusText = '';
        let statusClass = '';

        switch (state) {
            case GameState.NOT_STARTED:
                statusText = '游戏未开始 - 点击"开始游戏"按钮';
                break;
            case GameState.PREPARING:
                statusText = `准备阶段 - 第${this.game.currentRound}回合，请放置保单卡`;
                break;
            case GameState.WAVE_IN_PROGRESS:
                statusText = `战斗中 - 第${this.game.currentRound}回合，剩余${this.game.activeMonsters.length}个赔案`;
                statusClass = 'warning';
                break;
            case GameState.PAUSED:
                statusText = '游戏已暂停 - 点击"继续"恢复游戏';
                statusClass = 'warning';
                break;
            case GameState.ROUND_COMPLETE:
                statusText = `第${this.game.currentRound}回合结束，准备下一回合...`;
                statusClass = 'success';
                break;
            case GameState.GAME_OVER:
                statusText = `💔 游戏结束 - 第${this.game.currentRound}回合失败，逃脱${this.game.escapedMonsters.length}个赔案`;
                statusClass = 'danger';
                break;
            case GameState.VICTORY:
                statusText = `🎉 恭喜通关！成功抵御了所有${this.game.totalRounds}回合的赔案攻击`;
                statusClass = 'success';
                break;
        }

        statusEl.textContent = statusText;
        statusEl.className = `round-status ${statusClass}`;
    }

    _updateButtons() {
        const state = this.game.state;
        
        this.elements.btnStart.disabled = state !== GameState.NOT_STARTED && state !== GameState.GAME_OVER && state !== GameState.VICTORY;
        this.elements.btnPause.disabled = state !== GameState.WAVE_IN_PROGRESS && state !== GameState.PAUSED;
        this.elements.btnPause.textContent = state === GameState.PAUSED ? '继续' : '暂停';
        this.elements.btnReport.disabled = state === GameState.NOT_STARTED;
        this.elements.btnNextWave.disabled = state !== GameState.PREPARING;
    }

    _updateSettlementLog() {
        const logs = this.game.getSettlementLog();
        if (logs.length === this.lastLogCount) return;

        const container = this.elements.settlementLog;
        const newLogs = logs.slice(this.lastLogCount);
        this.lastLogCount = logs.length;

        if (logs.length === 0) {
            container.innerHTML = '<p class="placeholder">游戏开始后显示赔付结算记录</p>';
            return;
        }

        if (this.lastLogCount === newLogs.length) {
            container.innerHTML = '';
        }

        for (const log of newLogs) {
            const logEl = document.createElement('div');
            logEl.className = `log-entry ${log.type}`;
            
            const time = new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour12: false });
            
            logEl.innerHTML = `
                <div class="log-time">[${log.round ? '第' + log.round + '回合 ' : ''}${time}]</div>
                <div class="log-title">${log.title}</div>
                <div class="log-details">${log.message}</div>
            `;

            container.appendChild(logEl);
        }

        container.scrollTop = container.scrollHeight;
    }

    _updateErrorMessages() {
        const errors = this.game.getErrors();
        if (errors.length === this.lastErrorCount) return;

        const container = this.elements.errorMessages;
        const newErrors = errors.slice(this.lastErrorCount);
        this.lastErrorCount = errors.length;

        if (errors.length === 0) {
            container.innerHTML = '<p class="placeholder">操作错误会在这里显示详细原因</p>';
            return;
        }

        if (this.lastErrorCount === newErrors.length) {
            container.innerHTML = '';
        }

        for (const error of newErrors) {
            const errorEl = document.createElement('div');
            errorEl.className = 'error-entry';
            errorEl.dataset.errorId = error.id;
            
            errorEl.innerHTML = `
                <div class="error-step">第${error.round}回合 | ${error.step}</div>
                <div class="error-desc">${error.userMessage}</div>
                <div class="error-fix">💡 ${error.fix}</div>
                <button class="error-replay-btn" data-error-id="${error.id}">🔍 查看错因回放</button>
            `;

            const replayBtn = errorEl.querySelector('.error-replay-btn');
            replayBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._handleErrorReplay(error.id);
            });

            container.appendChild(errorEl);
        }

        container.scrollTop = container.scrollHeight;
    }

    _updateSelectedPolicyInfo() {
        const container = this.elements.selectedPolicyInfo;
        const policyId = this.game.selectedPolicyId;

        if (!policyId) {
            container.innerHTML = '<p class="placeholder">点击上方保单卡选择</p>';
            return;
        }

        const policy = this.game.policies.find(p => p.id === policyId);
        if (!policy) {
            container.innerHTML = '<p class="placeholder">未找到选中的保单</p>';
            return;
        }

        container.innerHTML = `
            <div style="font-weight: 600; color: #e94560; margin-bottom: 8px;">${policy.name}</div>
            <div style="font-size: 11px; color: #a0aec0; margin-bottom: 8px;">${policy.type} | ${policy.id}</div>
            <div style="font-size: 11px; color: #bbb; line-height: 1.5;">
                <div>保费：${this._formatMoney(policy.premium)}</div>
                <div>免赔额：${this._formatMoney(policy.deductible)}</div>
                <div>保障额度：${this._formatMoney(policy.limit)}</div>
                <div>赔付比例：${(policy.ratio * 100).toFixed(0)}%</div>
                <div>承保等级：${policy.levels.join('、')}级</div>
                <div>赔付次数：${policy.remainingUses === Infinity ? '无限' : policy.remainingUses + ' / ' + policy.maxUses}</div>
            </div>
            ${policy.normalizationErrors.length > 0 ? `
                <div style="margin-top: 8px; padding: 8px; background: rgba(255, 152, 0, 0.1); border-radius: 4px; font-size: 10px; color: #ff9800;">
                    <div style="font-weight: 600; margin-bottom: 4px;">⚠️ 数据导入问题：</div>
                    ${policy.normalizationErrors.map(e => `<div>• ${e}</div>`).join('')}
                </div>
            ` : ''}
            ${policy.normalizationWarnings.length > 0 ? `
                <div style="margin-top: 8px; padding: 8px; background: rgba(255, 193, 7, 0.1); border-radius: 4px; font-size: 10px; color: #ffc107;">
                    <div style="font-weight: 600; margin-bottom: 4px;">ℹ️ 数据提示：</div>
                    ${policy.normalizationWarnings.map(w => `<div>• ${w}</div>`).join('')}
                </div>
            ` : ''}
            <div style="margin-top: 10px; font-size: 10px; color: #4caf50;">
                👆 点击中间的空位放置此保单
            </div>
        `;
    }

    _handleStart() {
        const result = this.game.startGame();
        if (result.success) {
            this._renderPolicyCards();
            this._renderTowerSlots();
        } else {
            this._showUserError(result);
        }
    }

    _handlePause() {
        if (this.game.state === GameState.PAUSED) {
            this.game.resumeGame();
        } else {
            this.game.pauseGame();
        }
    }

    _handleRestart() {
        if (confirm('确定要重新开始游戏吗？当前进度将丢失。')) {
            this.game.restartGame();
            this.lastLogCount = 0;
            this.lastErrorCount = 0;
            this._renderPolicyCards();
            this._renderTowerSlots();
        }
    }

    _handleReport() {
        const report = ReportGenerator.generateReport(this.game);
        this.elements.modalTitle.textContent = '📊 复盘报告';
        this.elements.modalContent.innerHTML = report.html;
        this._showModal();
    }

    _handleExportReport() {
        const report = ReportGenerator.generateReport(this.game);
        ReportGenerator.exportReport(report);
    }

    _handleNextWave() {
        const result = this.game.startWave();
        if (!result.success) {
            this._showUserError(result);
        }
    }

    _handlePolicySelect(policyId) {
        const result = this.game.selectPolicy(policyId);
        if (result.success) {
            this._renderPolicyCards();
            this._updateSelectedPolicyInfo();
        } else {
            this._showUserError(result);
        }
    }

    _handleSlotClick(slotIndex) {
        if (this.game.placedPolicies[slotIndex]) {
            return;
        }

        const result = this.game.placePolicy(slotIndex);
        if (result.success) {
            this._renderPolicyCards();
            this._updateSelectedPolicyInfo();
            this._updatePlacedPolicies();
        } else {
            this._showUserError(result);
        }
    }

    _handleRemovePolicy(slotIndex) {
        const result = this.game.removePolicy(slotIndex);
        if (result.success) {
            this._renderPolicyCards();
            this._updatePlacedPolicies();
        } else {
            this._showUserError(result);
        }
    }

    _handleErrorReplay(errorId) {
        const session = this.game.startErrorReplay(errorId);
        if (!session) {
            this._showUserError({ message: '无法启动错因回放' });
            return;
        }

        this.currentReplaySession = session;
        this._renderReplayContent();
        this.elements.replayOverlay.classList.remove('hidden');
    }

    _handleReplayPrev() {
        if (!this.currentReplaySession) return;
        
        const step = this.game.previousReplayStep(this.currentReplaySession.sessionId);
        this._renderReplayContent();
    }

    _handleReplayNext() {
        if (!this.currentReplaySession) return;
        
        const step = this.game.advanceReplayStep(this.currentReplaySession.sessionId);
        this._renderReplayContent();
    }

    _handleReplayClose() {
        if (this.currentReplaySession) {
            this.game.closeReplaySession(this.currentReplaySession.sessionId);
            this.currentReplaySession = null;
        }
        this.elements.replayOverlay.classList.add('hidden');
    }

    _renderReplayContent() {
        if (!this.currentReplaySession) return;

        const session = this.currentReplaySession;
        const currentStep = session.currentStep;
        const totalSteps = session.steps.length;

        this.elements.replayProgress.textContent = `${currentStep + 1} / ${totalSteps}`;
        this.elements.replayPrev.disabled = currentStep === 0;
        this.elements.replayNext.disabled = currentStep === totalSteps - 1;

        const container = this.elements.replayContent;
        container.innerHTML = '';

        session.steps.forEach((step, index) => {
            const stepEl = document.createElement('div');
            stepEl.className = `replay-step ${index === currentStep ? 'active' : ''}`;
            
            let dataHtml = '';
            if (step.data) {
                dataHtml = `<div class="step-data">${JSON.stringify(step.data, null, 2)}</div>`;
            }

            let highlightHtml = '';
            if (step.highlight) {
                highlightHtml = `<div class="step-highlight">📍 ${step.highlight}</div>`;
            }

            stepEl.innerHTML = `
                <h4>${step.step}</h4>
                <div class="step-desc">${step.description}</div>
                ${dataHtml}
                ${highlightHtml}
            `;

            container.appendChild(stepEl);
        });
    }

    _showUserError(error) {
        const container = this.elements.errorMessages;
        
        if (container.querySelector('.placeholder')) {
            container.innerHTML = '';
        }

        const errorEl = document.createElement('div');
        errorEl.className = 'error-entry';
        
        const stepText = error.step || '操作错误';
        const fixText = error.fix || '请检查操作后重试';
        
        errorEl.innerHTML = `
            <div class="error-step">${stepText}</div>
            <div class="error-desc">${error.message}</div>
            <div class="error-fix">💡 ${fixText}</div>
        `;

        container.appendChild(errorEl);
        container.scrollTop = container.scrollHeight;

        setTimeout(() => {
            errorEl.style.opacity = '0';
            errorEl.style.transition = 'opacity 0.5s ease';
            setTimeout(() => errorEl.remove(), 500);
        }, 8000);
    }

    _showModal() {
        this.elements.modalOverlay.classList.remove('hidden');
    }

    _hideModal() {
        this.elements.modalOverlay.classList.add('hidden');
    }

    _formatMoney(amount) {
        return '¥' + amount.toLocaleString('zh-CN');
    }

    destroy() {
        this._stopUIUpdateLoop();
    }
}
