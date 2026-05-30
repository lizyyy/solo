const ReviewModule = {
    currentGame: null,
    currentHistory: [],

    init() {
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('closeDetailBtn').addEventListener('click', () => this.closeDetail());
    },

    refreshHistoryList() {
        this.currentHistory = JSON.parse(localStorage.getItem(GAME_CONFIG.STORAGE_KEYS.history) || '[]');
        
        const container = document.getElementById('historyList');
        
        if (this.currentHistory.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📜</div>
                    <p>暂无游戏记录</p>
                    <p style="font-size: 12px; margin-top: 8px;">完成一局游戏后，记录将显示在这里</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.currentHistory.map((game, index) => {
            const date = new Date(game.startTime);
            const successRate = Math.round(game.escapedCount / game.totalRounds * 100);
            
            return `
                <div class="history-item" data-index="${index}">
                    <div class="history-batch">${game.batchId}</div>
                    <div class="history-date">${formatDisplayTime(date)}</div>
                    <div class="history-summary">
                        <span>🚀 ${game.ship?.name || '未知飞船'}</span>
                        <span>⭐ ${game.score} 分</span>
                    </div>
                    <div class="history-summary">
                        <span>🎯 ${game.escapedCount}/${game.totalRounds}</span>
                        <span>${successRate}% 成功率</span>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.showGameDetail(this.currentHistory[index]);
                
                document.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });
    },

    showGameDetail(game) {
        this.currentGame = game;
        
        if (game.traceData) {
            DataTrace.importTraceData(game.traceData);
        }

        const detailPanel = document.getElementById('reviewDetail');
        const detailContent = document.getElementById('detailContent');

        const date = new Date(game.startTime);
        const endDate = new Date(game.endTime);
        const duration = Math.round(game.duration / 1000);
        const successRate = Math.round(game.escapedCount / game.totalRounds * 100);

        let roundsHtml = '';
        for (const round of game.rounds) {
            roundsHtml += this.renderRoundEntry(round);
        }

        detailContent.innerHTML = `
            <div class="trace-section">
                <h4>📊 游戏概览</h4>
                <div class="trace-item">
                    <span class="trace-label">批次号</span>
                    <span class="trace-value">${game.batchId}</span>
                </div>
                <div class="trace-item">
                    <span class="trace-label">游戏ID</span>
                    <span class="trace-value">${game.gameId}</span>
                </div>
                <div class="trace-item">
                    <span class="trace-label">飞船</span>
                    <span class="trace-value">${this.createTraceableSpan(game.ship?.name || '未知', game.shipId, 'ship').outerHTML}</span>
                </div>
                <div class="trace-item">
                    <span class="trace-label">开始时间</span>
                    <span class="trace-value">${formatDisplayTime(date)}</span>
                </div>
                <div class="trace-item">
                    <span class="trace-label">结束时间</span>
                    <span class="trace-value">${formatDisplayTime(endDate)}</span>
                </div>
                <div class="trace-item">
                    <span class="trace-label">总用时</span>
                    <span class="trace-value">${duration} 秒</span>
                </div>
                <div class="trace-item">
                    <span class="trace-label">总分数</span>
                    <span class="trace-value" style="color: var(--accent-warning);">${game.score}</span>
                </div>
                <div class="trace-item">
                    <span class="trace-label">成功逃逸</span>
                    <span class="trace-value">${game.escapedCount}/${game.totalRounds} (${successRate}%)</span>
                </div>
            </div>

            <div class="trace-section">
                <h4>🎮 回合详情</h4>
                ${roundsHtml}
            </div>
        `;

        detailPanel.style.display = 'block';

        detailContent.querySelectorAll('.traceable').forEach(el => {
            el.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const type = e.target.dataset.type;
                DataTrace.showTraceModal(id, type);
            });
        });
    },

    renderRoundEntry(round) {
        let resultClass = 'success';
        let resultText = '成功逃逸';
        let resultIcon = '✅';

        if (round.abandoned) {
            resultClass = 'abandoned';
            resultText = '已放弃';
            resultIcon = '⏭️';
        } else if (!round.success) {
            resultClass = 'failure';
            resultText = '逃逸失败';
            resultIcon = '❌';
        }

        const roundTime = new Date(round.timestamp);
        const body = round.body;
        const fuels = round.selectedFuels || [];

        let bodyLink = this.createTraceableSpan(body?.name || '未知天体', round.bodyId, 'body').outerHTML;

        let fuelsHtml = '';
        if (fuels.length > 0) {
            fuelsHtml = fuels.map(f => 
                this.createTraceableSpan(f.name, f.id, 'fuel').outerHTML
            ).join(', ');
        } else {
            fuelsHtml = '<span class="text-muted">未选择燃料</span>';
        }

        let calcHtml = '';
        if (round.escapeResult && round.velocityResult) {
            const ev = round.escapeResult.escapeVelocityKms?.toFixed(2) || '--';
            const tv = round.velocityResult.totalVelocityKms?.toFixed(2) || '--';
            const diff = round.checkResult?.velocityDiffKms?.toFixed(2) || '--';
            
            calcHtml = `
                <div style="margin-top: 10px; padding: 10px; background: var(--bg-card); border-radius: 8px; font-family: 'SF Mono', monospace; font-size: 12px;">
                    <div>逃逸速度: ${ev} km/s</div>
                    <div>实际速度: ${tv} km/s</div>
                    <div>速度差: ${diff} km/s</div>
                    <div>方向: ${round.direction === 'away' ? '远离天体 (+)' : '朝向天体 (-)'}</div>
                </div>
            `;
        }

        let errorHtml = '';
        if (round.checkResult?.errorType) {
            const errorDesc = SampleData.getErrorCaseDescription(round.checkResult.errorType);
            if (errorDesc) {
                errorHtml = `
                    <div style="margin-top: 10px; padding: 10px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border-left: 3px solid var(--accent-danger);">
                        <div style="font-weight: 600; color: var(--accent-danger); margin-bottom: 4px;">⚠️ ${errorDesc.title}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${errorDesc.description}</div>
                    </div>
                `;
            }
        }

        let decisionHtml = '';
        if (round.decisionReason) {
            decisionHtml = `
                <div style="margin-top: 10px; padding: 10px; background: rgba(99, 102, 241, 0.1); border-radius: 8px; border-left: 3px solid var(--accent-primary);">
                    <div style="font-weight: 600; color: var(--accent-primary); margin-bottom: 4px;">🤔 当时为什么这么处理</div>
                    <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.6;">${round.decisionReason}</div>
                </div>
            `;
        }

        let scoreHtml = '';
        if (round.scoreGained) {
            scoreHtml = `<div style="margin-top: 8px; color: var(--accent-success); font-weight: 600;">+${round.scoreGained} 分</div>`;
        }

        return `
            <div class="round-entry ${resultClass}">
                <div class="round-header">
                    <span class="round-number">第 ${round.roundNumber} 回合</span>
                    <span class="round-result ${resultClass}">${resultIcon} ${resultText}</span>
                </div>
                <div class="round-body">
                    <div><strong>天体:</strong> ${bodyLink}</div>
                    <div><strong>使用燃料:</strong> ${fuelsHtml}</div>
                    ${round.abandoned ? '<div style="color: var(--accent-warning);"><strong>状态:</strong> 玩家主动放弃本回合</div>' : ''}
                    ${calcHtml}
                    ${errorHtml}
                    ${decisionHtml}
                    ${scoreHtml}
                    <div style="margin-top: 8px; font-size: 11px; color: var(--text-muted);">
                        ${formatDisplayTime(roundTime)}
                    </div>
                </div>
            </div>
        `;
    },

    createTraceableSpan(text, id, type) {
        const span = document.createElement('span');
        span.className = 'traceable';
        span.textContent = text;
        span.dataset.id = id;
        span.dataset.type = type;
        span.title = '点击追溯来源';
        return span;
    },

    closeDetail() {
        document.getElementById('reviewDetail').style.display = 'none';
        document.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
        this.currentGame = null;
    },

    loadHistory() {
        this.refreshHistoryList();
    }
};
