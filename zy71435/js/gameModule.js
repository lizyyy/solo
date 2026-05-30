const GameModule = {
    state: {
        active: false,
        batchId: null,
        gameId: null,
        ship: null,
        bodies: [],
        fuels: [],
        usedFuelIds: new Set(),
        currentRound: 0,
        escapedCount: 0,
        score: 0,
        selectedFuelIds: new Set(),
        direction: 'away',
        currentBody: null,
        escapeResult: null,
        velocityResult: null,
        checkResult: null,
        rounds: [],
        startTime: null,
        endTime: null
    },

    init() {
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
        document.getElementById('abandonBtn').addEventListener('click', () => this.abandonRound());
        document.getElementById('clearSelectionBtn').addEventListener('click', () => this.clearSelection());
        document.getElementById('attemptEscapeBtn').addEventListener('click', () => this.attemptEscape());
        document.getElementById('nextRoundBtn').addEventListener('click', () => this.nextRound());
        document.getElementById('newGameBtn').addEventListener('click', () => this.startGame());
        document.getElementById('goReviewBtn').addEventListener('click', () => this.goToReview());

        document.querySelectorAll('.dir-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.state.direction = e.target.dataset.direction;
                this.updateVelocitySummary();
            });
        });
    },

    startGame() {
        const data = ImportModule.getValidData();
        
        if (!data.ships || data.ships.length === 0) {
            showToast('请先导入飞船数据', 'error');
            this.switchToTab('import');
            return;
        }
        
        if (!data.bodies || data.bodies.length === 0) {
            showToast('请先导入可用的天体数据', 'error');
            this.switchToTab('import');
            return;
        }
        
        if (!data.fuels || data.fuels.length === 0) {
            showToast('请先导入燃料卡数据', 'error');
            this.switchToTab('import');
            return;
        }

        let selectedShip = data.ships[0];
        if (data.ships.length > 1) {
            const shipOptions = data.ships.map((s, i) => 
                `${i + 1}. ${s.name} (${s.baseVelocity}) - ${s.description || ''}`
            ).join('\n');
            
            let shipIndex = 0;
            try {
                const choice = window.prompt ? 
                    window.prompt(`请选择飞船 (输入序号):\n${shipOptions}`, '1') : '1';
                const parsed = parseInt(choice) - 1;
                if (parsed >= 0 && parsed < data.ships.length) {
                    shipIndex = parsed;
                }
            } catch (e) {
                shipIndex = 0;
            }
            
            selectedShip = data.ships[shipIndex];
            showToast(`已选择飞船: ${selectedShip.name}`, 'info');
        }

        this.state.batchId = data.batchId;
        this.state.gameId = 'GAME-' + Date.now();
        this.state.ship = selectedShip;
        this.state.bodies = [...data.bodies].sort(() => Math.random() - 0.5);
        this.state.fuels = [...data.fuels];
        this.state.usedFuelIds = new Set();
        this.state.currentRound = 0;
        this.state.escapedCount = 0;
        this.state.score = 0;
        this.state.selectedFuelIds = new Set();
        this.state.direction = 'away';
        this.state.rounds = [];
        this.state.startTime = Date.now();
        this.state.active = true;

        DataTrace.register({ id: this.state.gameId, name: `游戏-${selectedShip.name}` }, 'game', data.batchId, 'game_start');
        DataTrace.addLink(this.state.gameId, selectedShip.id, 'used_ship');

        document.querySelectorAll('.dir-btn').forEach(b => {
            b.classList.remove('active');
            if (b.dataset.direction === 'away') b.classList.add('active');
        });

        document.getElementById('gameEmpty').style.display = 'none';
        document.getElementById('gameActive').style.display = 'none';
        document.getElementById('gameOver').style.display = 'none';

        this.nextRound();
    },

    nextRound() {
        if (this.state.currentRound >= this.state.bodies.length) {
            this.endGame(true);
            return;
        }

        if (this.state.usedFuelIds.size >= this.state.fuels.length && this.state.currentRound > 0) {
            showToast('燃料已耗尽！游戏结束', 'warning');
            this.endGame(false);
            return;
        }

        this.state.currentRound++;
        this.state.currentBody = this.state.bodies[this.state.currentRound - 1];
        this.state.selectedFuelIds = new Set();
        this.state.direction = 'away';

        DataTrace.register({ 
            id: `ROUND-${this.state.gameId}-${this.state.currentRound}`, 
            name: `回合${this.state.currentRound}` 
        }, 'round', this.state.batchId, 'game_round');
        DataTrace.addLink(`ROUND-${this.state.gameId}-${this.state.currentRound}`, this.state.currentBody.id, 'used_in_round');
        DataTrace.addLink(this.state.gameId, `ROUND-${this.state.gameId}-${this.state.currentRound}`, 'round');

        this.state.escapeResult = Physics.calculateEscapeVelocity(this.state.currentBody);

        document.getElementById('gameEmpty').style.display = 'none';
        document.getElementById('gameOver').style.display = 'none';
        document.getElementById('gameActive').style.display = 'block';
        document.getElementById('resultPanel').style.display = 'none';

        this.updateStatusBar();
        this.renderCurrentBody();
        this.renderPlayerShip();
        this.renderFuelCards();
        this.updateVelocitySummary();
    },

    updateStatusBar() {
        document.getElementById('currentRound').textContent = this.state.currentRound;
        document.getElementById('totalRounds').textContent = this.state.bodies.length;
        document.getElementById('escapedCount').textContent = this.state.escapedCount;
        document.getElementById('remainingFuel').textContent = this.state.fuels.length - this.state.usedFuelIds.size;
        document.getElementById('currentScore').textContent = this.state.score;
    },

    renderCurrentBody() {
        const body = this.state.currentBody;
        const typeInfo = GAME_CONFIG.BODY_TYPES[body.type] || { name: body.type, icon: '❓' };
        const escapeResult = this.state.escapeResult;

        const cardHtml = `
            <div class="body-card">
                <div class="body-name">
                    ${typeInfo.icon} ${body.name}
                    <span class="body-type ${body.type}">${typeInfo.name}</span>
                </div>
                <div class="body-stats">
                    <div class="stat-row">
                        <span class="stat-label">质量</span>
                        <span class="stat-value">${body.mass}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">半径</span>
                        <span class="stat-value">${body.radius}</span>
                    </div>
                </div>
                ${body.description ? `<div style="margin-top: 10px; font-size: 12px; color: var(--text-secondary);">${body.description}</div>` : ''}
            </div>
        `;

        document.getElementById('currentBodyCard').innerHTML = cardHtml;

        const calcHtml = escapeResult.steps.map(step => 
            `<span class="calc-step">${step.label}: ${step.output}</span>`
        ).join('');

        document.getElementById('calcDetails').innerHTML = calcHtml;

        if (escapeResult.valid) {
            document.getElementById('escapeVelocity').textContent = `${escapeResult.escapeVelocityKms.toFixed(2)} km/s`;
            document.getElementById('escapeVelocity').style.color = 'var(--accent-warning)';
        } else {
            document.getElementById('escapeVelocity').textContent = '计算错误';
            document.getElementById('escapeVelocity').style.color = 'var(--accent-danger)';
        }
    },

    renderPlayerShip() {
        const ship = this.state.ship;
        const cardHtml = `
            <div class="ship-card">
                <div class="ship-name">
                    🚀 ${ship.name}
                </div>
                <div class="ship-stats">
                    <div class="stat-row">
                        <span class="stat-label">基础速度</span>
                        <span class="stat-value">${ship.baseVelocity}</span>
                    </div>
                </div>
                ${ship.description ? `<div style="margin-top: 10px; font-size: 12px; color: var(--text-secondary);">${ship.description}</div>` : ''}
            </div>
        `;
        document.getElementById('playerShipCard').innerHTML = cardHtml;
    },

    renderFuelCards() {
        const container = document.getElementById('fuelCards');
        container.innerHTML = this.state.fuels.map(fuel => {
            const isUsed = this.state.usedFuelIds.has(fuel.id);
            const isSelected = this.state.selectedFuelIds.has(fuel.id);
            const typeInfo = GAME_CONFIG.FUEL_TYPES[fuel.type] || { name: fuel.type, color: '#888' };

            let cardClass = 'fuel-card';
            if (isUsed) cardClass += ' used';
            if (isSelected) cardClass += ' selected';

            return `
                <div class="${cardClass}" data-fuel-id="${fuel.id}" ${isUsed ? 'title="已使用"' : ''}>
                    ${DataTrace.createTraceButton(fuel.id, 'fuel').outerHTML}
                    <div class="fuel-name">${fuel.name}</div>
                    <div class="fuel-boost" style="color: ${typeInfo.color}">+${fuel.velocityBoost}</div>
                    <div class="fuel-type">${typeInfo.name}</div>
                    <div class="fuel-id">${fuel.id}</div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.fuel-card:not(.used)').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('trace-btn')) return;
                const fuelId = card.dataset.fuelId;
                this.toggleFuelSelection(fuelId);
            });
        });
    },

    toggleFuelSelection(fuelId) {
        if (this.state.usedFuelIds.has(fuelId)) return;

        if (this.state.selectedFuelIds.has(fuelId)) {
            this.state.selectedFuelIds.delete(fuelId);
        } else {
            this.state.selectedFuelIds.add(fuelId);
        }

        this.renderFuelCards();
        this.updateVelocitySummary();
    },

    clearSelection() {
        this.state.selectedFuelIds.clear();
        this.renderFuelCards();
        this.updateVelocitySummary();
        showToast('已清空选择', 'info');
    },

    getSelectedFuels() {
        return this.state.fuels.filter(f => this.state.selectedFuelIds.has(f.id));
    },

    updateVelocitySummary() {
        const selectedFuels = this.getSelectedFuels();
        this.state.velocityResult = Physics.calculateTotalVelocity(
            this.state.ship,
            selectedFuels,
            this.state.direction
        );

        const vel = this.state.velocityResult;
        const escape = this.state.escapeResult;

        document.getElementById('baseVelocity').textContent = `${vel.baseVelocityKms.toFixed(2)} km/s`;
        document.getElementById('fuelBoost').textContent = `+${vel.fuelBoostKms.toFixed(2)} km/s`;
        document.getElementById('dirModifier').textContent = `×${vel.directionModifier}`;

        const totalVelEl = document.getElementById('totalVelocity');
        totalVelEl.textContent = `${vel.totalVelocityKms.toFixed(2)} km/s`;
        totalVelEl.className = 'vel-value';
        if (vel.totalVelocityKms < 0) totalVelEl.classList.add('negative');
        else if (vel.totalVelocityKms > 0) totalVelEl.classList.add('positive');

        if (escape.valid && vel.valid) {
            this.state.checkResult = Physics.checkEscape(vel, escape);
            const diff = this.state.checkResult.velocityDiffKms;
            const diffEl = document.getElementById('velocityDiff');
            diffEl.textContent = `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} km/s`;
            diffEl.className = 'vel-value';
            if (diff >= 0) diffEl.classList.add('positive');
            else diffEl.classList.add('negative');
        } else {
            document.getElementById('velocityDiff').textContent = '无法计算';
            document.getElementById('velocityDiff').className = 'vel-value warning';
        }
    },

    attemptEscape() {
        if (!this.state.escapeResult.valid) {
            showToast('当前天体数据错误，无法计算逃逸速度', 'error');
            return;
        }

        const selectedFuels = this.getSelectedFuels();
        if (selectedFuels.length === 0) {
            if (!confirm('未选择任何燃料卡，仅使用飞船基础速度。确定要尝试逃逸吗？')) {
                return;
            }
        }

        this.state.velocityResult = Physics.calculateTotalVelocity(
            this.state.ship,
            selectedFuels,
            this.state.direction
        );

        this.state.checkResult = Physics.checkEscape(
            this.state.velocityResult,
            this.state.escapeResult
        );

        const roundRecord = {
            roundNumber: this.state.currentRound,
            body: this.state.currentBody,
            bodyId: this.state.currentBody.id,
            ship: this.state.ship,
            shipId: this.state.ship.id,
            selectedFuels: selectedFuels,
            selectedFuelIds: [...this.state.selectedFuelIds],
            direction: this.state.direction,
            escapeResult: this.state.escapeResult,
            velocityResult: this.state.velocityResult,
            checkResult: this.state.checkResult,
            success: this.state.checkResult.canEscape,
            abandoned: false,
            timestamp: Date.now(),
            decisionReason: this.generateDecisionReason()
        };

        selectedFuels.forEach(fuel => {
            DataTrace.addLink(`ROUND-${this.state.gameId}-${this.state.currentRound}`, fuel.id, 'selected_fuel');
        });

        if (this.state.checkResult.canEscape) {
            selectedFuels.forEach(fuel => {
                this.state.usedFuelIds.add(fuel.id);
            });
            this.state.escapedCount++;
            
            const score = Physics.calculateScore(
                this.state.escapeResult,
                this.state.velocityResult,
                this.state.checkResult,
                selectedFuels.length
            );
            this.state.score += score;
            roundRecord.scoreGained = score;
        }

        this.state.rounds.push(roundRecord);
        this.showResult(roundRecord);
    },

    generateDecisionReason() {
        const check = this.state.checkResult;
        const escape = this.state.escapeResult;
        const vel = this.state.velocityResult;
        const fuels = this.getSelectedFuels();

        if (check.errorType === 'wrong_direction') {
            return `玩家选择了朝向天体的方向，这是一个战术失误。即使速度达到 ${vel.totalVelocityKms.toFixed(2)} km/s（超过逃逸速度 ${escape.escapeVelocityKms.toFixed(2)} km/s），但方向错误导致无法逃逸。正确的策略应该是选择"远离天体"方向。`;
        }

        if (check.errorType === 'insufficient_fuel') {
            const deficit = Math.abs(check.velocityDiffKms).toFixed(2);
            return `燃料不足。当前飞船基础速度 ${vel.baseVelocityKms.toFixed(2)} km/s，加上 ${fuels.length} 张燃料卡提供的 ${vel.fuelBoostKms.toFixed(2)} km/s，总速度 ${vel.totalVelocityKms.toFixed(2)} km/s，还差 ${deficit} km/s 才能达到逃逸速度 ${escape.escapeVelocityKms.toFixed(2)} km/s。需要选择更多或更强的燃料卡。`;
        }

        if (check.errorType === 'mass_unit_error') {
            return `天体质量单位错误，系统无法识别 "${escape.body.mass}" 中的单位。支持的单位包括：kg、吨、M⊕（地球质量）、M☉（太阳质量）。请修正数据后重新导入。`;
        }

        if (check.canEscape) {
            const efficiency = (escape.escapeVelocityKms / vel.totalVelocityKms * 100).toFixed(1);
            return `成功逃逸！选择了 ${fuels.length} 张燃料卡，总速度 ${vel.totalVelocityKms.toFixed(2)} km/s，超出逃逸速度 ${check.velocityDiffKms.toFixed(2)} km/s。燃料利用效率 ${efficiency}%。`;
        }

        return '决策原因待分析。';
    },

    showResult(roundRecord) {
        const resultPanel = document.getElementById('resultPanel');
        const resultContent = document.getElementById('resultContent');
        const check = roundRecord.checkResult;

        if (roundRecord.abandoned) {
            resultPanel.className = 'result-panel warning';
            const icon = '🙈';
            const title = '回合放弃';
            
            resultContent.innerHTML = `
                <div class="result-icon">${icon}</div>
                <h3>${title}</h3>
                <div class="decision-reason">
                    <h4>🤔 决策分析</h4>
                    <p>${roundRecord.decisionReason}</p>
                </div>
            `;
            
            document.getElementById('nextRoundBtn').style.display = 'inline-block';
            return;
        }

        resultPanel.className = `result-panel ${check.canEscape ? 'success' : 'failure'}`;

        let icon = check.canEscape ? '🎉' : '💥';
        let title = check.canEscape ? '逃逸成功！' : '逃逸失败';

        if (check.errorType === 'wrong_direction') {
            icon = '🔄';
            title = '方向错误！';
        } else if (check.errorType === 'insufficient_fuel') {
            icon = '⛽';
            title = '燃料不足！';
        } else if (check.errorType === 'mass_unit_error') {
            icon = '⚠️';
            title = '数据错误！';
        }

        const calcStepsHtml = roundRecord.velocityResult.steps.map(s => 
            `<div>${s.label}: ${s.output}</div>`
        ).join('');

        resultContent.innerHTML = `
            <div class="result-icon">${icon}</div>
            <div class="result-title">${title}</div>
            <div class="result-reason">${check.reason}</div>
            ${roundRecord.scoreGained ? `<div style="color: var(--accent-success); margin-top: 8px;">+${roundRecord.scoreGained} 分</div>` : ''}
            <div class="result-calc">
                <strong>计算过程:</strong><br>
                ${calcStepsHtml}
                <hr style="margin: 10px 0; border-color: var(--border-color);">
                <div>逃逸速度: ${roundRecord.escapeResult.escapeVelocityKms.toFixed(2)} km/s</div>
                <div>实际速度: ${roundRecord.velocityResult.totalVelocityKms.toFixed(2)} km/s</div>
                <div>速度差: ${check.velocityDiffKms >= 0 ? '+' : ''}${check.velocityDiffKms.toFixed(2)} km/s</div>
            </div>
            <div class="result-decision">
                <h4>🤔 决策分析</h4>
                <p>${roundRecord.decisionReason}</p>
            </div>
        `;

        resultPanel.style.display = 'block';
        this.updateStatusBar();
    },

    abandonRound() {
        if (!confirm('确定要放弃本回合吗？将跳过当前天体。')) return;

        const roundRecord = {
            roundNumber: this.state.currentRound,
            body: this.state.currentBody,
            bodyId: this.state.currentBody.id,
            ship: this.state.ship,
            shipId: this.state.ship.id,
            selectedFuels: [],
            selectedFuelIds: [],
            direction: this.state.direction,
            escapeResult: this.state.escapeResult,
            velocityResult: null,
            checkResult: null,
            success: false,
            abandoned: true,
            timestamp: Date.now(),
            decisionReason: `玩家选择放弃本回合。天体 ${this.state.currentBody.name} 的逃逸速度为 ${this.state.escapeResult.escapeVelocityKms.toFixed(2)} km/s，可能是因为燃料不足或策略性放弃以保存燃料应对后续天体。`
        };

        this.state.rounds.push(roundRecord);
        this.showResult(roundRecord);
    },

    endGame(completed) {
        this.state.active = false;
        this.state.endTime = Date.now();

        const gameRecord = {
            gameId: this.state.gameId,
            batchId: this.state.batchId,
            ship: this.state.ship,
            shipId: this.state.ship.id,
            startTime: this.state.startTime,
            endTime: this.state.endTime,
            duration: this.state.endTime - this.state.startTime,
            totalRounds: this.state.bodies.length,
            completedRounds: this.state.currentRound,
            escapedCount: this.state.escapedCount,
            score: this.state.score,
            success: completed && this.state.escapedCount === this.state.bodies.length,
            rounds: this.state.rounds,
            usedFuelIds: [...this.state.usedFuelIds],
            traceData: DataTrace.exportTraceData(this.state.batchId)
        };

        const history = JSON.parse(localStorage.getItem(GAME_CONFIG.STORAGE_KEYS.history) || '[]');
        history.unshift(gameRecord);
        localStorage.setItem(GAME_CONFIG.STORAGE_KEYS.history, JSON.stringify(history));

        document.getElementById('gameActive').style.display = 'none';
        document.getElementById('gameOver').style.display = 'block';

        const overIcon = document.getElementById('overIcon');
        const overTitle = document.getElementById('overTitle');
        const finalStats = document.getElementById('finalStats');

        if (gameRecord.success) {
            overIcon.textContent = '🏆';
            overTitle.textContent = '完美通关！';
        } else if (this.state.escapedCount > 0) {
            overIcon.textContent = '🎯';
            overTitle.textContent = '游戏结束';
        } else {
            overIcon.textContent = '💔';
            overTitle.textContent = '任务失败';
        }

        finalStats.innerHTML = `
            <div class="final-stat">
                <div class="final-stat-label">总分数</div>
                <div class="final-stat-value">${gameRecord.score}</div>
            </div>
            <div class="final-stat">
                <div class="final-stat-label">成功逃逸</div>
                <div class="final-stat-value">${gameRecord.escapedCount}/${gameRecord.totalRounds}</div>
            </div>
            <div class="final-stat">
                <div class="final-stat-label">成功率</div>
                <div class="final-stat-value">${Math.round(gameRecord.escapedCount / gameRecord.totalRounds * 100)}%</div>
            </div>
            <div class="final-stat">
                <div class="final-stat-label">用时</div>
                <div class="final-stat-value">${Math.round(gameRecord.duration / 1000)}秒</div>
            </div>
        `;

        ExportModule.refreshExportList();
        ReviewModule.refreshHistoryList();
    },

    goToReview() {
        this.switchToTab('review');
    },

    switchToTab(tabName) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });
    },

    getCurrentState() {
        return { ...this.state };
    }
};
