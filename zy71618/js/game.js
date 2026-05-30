const GameState = {
    NOT_STARTED: 'not_started',
    PREPARING: 'preparing',
    WAVE_IN_PROGRESS: 'wave_in_progress',
    PAUSED: 'paused',
    ROUND_COMPLETE: 'round_complete',
    GAME_OVER: 'game_over',
    VICTORY: 'victory'
};

class InsuranceTowerDefense {
    constructor() {
        this.state = GameState.NOT_STARTED;
        this.currentRound = 0;
        this.totalRounds = GameData.roundConfigs.length;
        this.maxPosition = 100;
        
        this.policies = [];
        this.placedPolicies = new Array(GameData.towerSlotCount).fill(null);
        this.availableClaims = [];
        this.activeMonsters = [];
        this.escapedMonsters = [];
        this.killedMonsters = [];
        
        this.reserve = null;
        this.errorTracker = null;
        
        this.selectedPolicyId = null;
        this.totalPremiumIncome = 0;
        this.totalPayout = 0;
        
        this.gameLoopId = null;
        this.spawnTimeoutIds = [];
        this.roundStartTime = null;
        this.gameStartTime = null;
        
        this.settlementLog = [];
        this.roundHistory = [];
        
        this._initData();
    }

    _initData() {
        this.policies = GameData.rawPolicies.map((raw, index) => {
            const normalized = DataNormalizer.normalizePolicy(raw, index);
            return new PolicyCard(normalized);
        });

        this.availableClaims = GameData.rawClaims.map((raw, index) => {
            return DataNormalizer.normalizeClaim(raw, index);
        });

        this.reserve = new ReserveManager(GameData.initialReserve);
        this.errorTracker = new ErrorTracker();
    }

    startGame() {
        if (this.state !== GameState.NOT_STARTED && this.state !== GameState.GAME_OVER && this.state !== GameState.VICTORY) {
            return { success: false, message: '游戏已在进行中' };
        }

        this.resetGame();
        this.state = GameState.PREPARING;
        this.gameStartTime = Date.now();
        this.currentRound = 1;

        this._logSettlement('info', '游戏开始', '欢迎来到保险精算怪物塔！请放置保单卡来防御赔案怪物。', {
            initialReserve: GameData.initialReserve,
            maxEscaped: GameData.maxEscaped,
            totalRounds: this.totalRounds
        });

        return { success: true, message: '游戏已开始' };
    }

    resetGame() {
        this._clearTimeouts();
        this._stopGameLoop();
        
        this.state = GameState.NOT_STARTED;
        this.currentRound = 0;
        this.placedPolicies = new Array(GameData.towerSlotCount).fill(null);
        this.activeMonsters = [];
        this.escapedMonsters = [];
        this.killedMonsters = [];
        this.selectedPolicyId = null;
        this.totalPremiumIncome = 0;
        this.totalPayout = 0;
        this.settlementLog = [];
        this.roundHistory = [];
        
        this._initData();
    }

    pauseGame() {
        if (this.state !== GameState.WAVE_IN_PROGRESS) {
            return { success: false, message: '当前状态无法暂停' };
        }
        
        this.state = GameState.PAUSED;
        this._stopGameLoop();
        this._clearTimeouts();
        
        return { success: true, message: '游戏已暂停' };
    }

    resumeGame() {
        if (this.state !== GameState.PAUSED) {
            return { success: false, message: '游戏未暂停' };
        }
        
        this.state = GameState.WAVE_IN_PROGRESS;
        this._startGameLoop();
        
        return { success: true, message: '游戏已继续' };
    }

    restartGame() {
        this._clearTimeouts();
        this._stopGameLoop();
        this.startGame();
        return { success: true, message: '游戏已重新开始' };
    }

    selectPolicy(policyId) {
        const policy = this.policies.find(p => p.id === policyId);
        if (!policy) {
            return { success: false, message: `未找到保单${policyId}` };
        }

        if (policy.remainingUses !== Infinity && policy.remainingUses <= 0) {
            return { success: false, message: `保单${policy.name}赔付次数已用尽` };
        }

        this.selectedPolicyId = policyId;
        return { success: true, policy: policy };
    }

    placePolicy(slotIndex) {
        if (this.state !== GameState.PREPARING) {
            return { 
                success: false, 
                message: '只能在准备阶段放置保单',
                step: '保单放置阶段检查',
                fix: '请等待本回合结束后，在下一回合准备阶段放置保单'
            };
        }

        if (slotIndex < 0 || slotIndex >= GameData.towerSlotCount) {
            return { 
                success: false, 
                message: `无效的放置位置${slotIndex}`,
                step: '放置位置校验',
                fix: `请选择0到${GameData.towerSlotCount - 1}之间的有效位置`
            };
        }

        if (!this.selectedPolicyId) {
            return { 
                success: false, 
                message: '请先从左侧选择一张保单卡',
                step: '保单选择检查',
                fix: '点击左侧保单卡库中的任意保单进行选择'
            };
        }

        const policy = this.policies.find(p => p.id === this.selectedPolicyId);
        if (!policy) {
            return { success: false, message: '选中的保单无效' };
        }

        if (this.placedPolicies.includes(policy)) {
            return { 
                success: false, 
                message: `保单"${policy.name}"已放置在其他位置`,
                step: '保单唯一性检查',
                fix: '每张保单只能放置一次，请选择其他保单'
            };
        }

        if (this.placedPolicies[slotIndex]) {
            return { 
                success: false, 
                message: `位置${slotIndex + 1}已有保单`,
                step: '位置占用检查',
                fix: '请先移除该位置的保单，或选择其他空位'
            };
        }

        this.placedPolicies[slotIndex] = policy;
        const incomeResult = this.reserve.addIncome(
            policy.premium,
            '保费收入',
            `保单${policy.name}已部署，保费入账`
        );
        this.totalPremiumIncome += policy.premium;

        this._logSettlement('success', '保费入账', 
            `保单"${policy.name}"已部署到位置${slotIndex + 1}，保费${this._formatMoney(policy.premium)}已计入准备金`,
            { policyId: policy.id, policyName: policy.name, premium: policy.premium, slot: slotIndex }
        );

        this.selectedPolicyId = null;

        return { success: true, policy: policy, slotIndex: slotIndex };
    }

    removePolicy(slotIndex) {
        if (this.state !== GameState.PREPARING) {
            return { 
                success: false, 
                message: '只能在准备阶段移除保单',
                step: '保单移除阶段检查',
                fix: '请等待本回合结束后，在下一回合准备阶段移除保单'
            };
        }

        if (slotIndex < 0 || slotIndex >= GameData.towerSlotCount) {
            return { success: false, message: `无效的位置${slotIndex}` };
        }

        const policy = this.placedPolicies[slotIndex];
        if (!policy) {
            return { success: false, message: `位置${slotIndex + 1}没有保单` };
        }

        this.placedPolicies[slotIndex] = null;

        this._logSettlement('warning', '保单移除', 
            `保单"${policy.name}"已从位置${slotIndex + 1}移除`,
            { policyId: policy.id, policyName: policy.name, slot: slotIndex }
        );

        return { success: true, policy: policy };
    }

    startWave() {
        if (this.state !== GameState.PREPARING) {
            return { success: false, message: '当前状态无法开始出怪' };
        }

        const placedCount = this.placedPolicies.filter(p => p !== null).length;
        if (placedCount === 0) {
            return { 
                success: false, 
                message: '请至少放置一张保单卡再开始',
                step: '保单放置检查',
                fix: '从左侧选择保单，点击中间的空位放置'
            };
        }

        this.state = GameState.WAVE_IN_PROGRESS;
        this.roundStartTime = Date.now();
        
        const roundConfig = GameData.roundConfigs[this.currentRound - 1];
        this._spawnMonsters(roundConfig);
        this._startGameLoop();

        this._logSettlement('info', `第${this.currentRound}回合开始`, 
            `本回合将出现${roundConfig.monsters}个赔案怪物，风险等级${roundConfig.minLevel}-${roundConfig.maxLevel}级`,
            roundConfig
        );

        return { success: true };
    }

    _spawnMonsters(roundConfig) {
        const { monsters: count, minLevel, maxLevel, spawnInterval } = roundConfig;
        
        for (let i = 0; i < count; i++) {
            const timeoutId = setTimeout(() => {
                if (this.state === GameState.WAVE_IN_PROGRESS) {
                    this._spawnSingleMonster(minLevel, maxLevel);
                }
            }, i * spawnInterval);
            this.spawnTimeoutIds.push(timeoutId);
        }
    }

    _spawnSingleMonster(minLevel, maxLevel) {
        const level = Math.floor(Math.random() * (maxLevel - minLevel + 1)) + minLevel;
        const eligibleClaims = this.availableClaims.filter(c => c.level === level);
        
        let claimData;
        if (eligibleClaims.length > 0) {
            const randomIndex = Math.floor(Math.random() * eligibleClaims.length);
            claimData = eligibleClaims[randomIndex];
        } else {
            const fallbackClaims = this.availableClaims.filter(c => Math.abs(c.level - level) <= 1);
            if (fallbackClaims.length > 0) {
                claimData = fallbackClaims[Math.floor(Math.random() * fallbackClaims.length)];
            } else {
                claimData = this.availableClaims[0];
            }
        }

        const monster = new ClaimMonster({ ...claimData });
        monster.instanceId = `MON-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.activeMonsters.push(monster);

        this._logSettlement('warning', '赔案出现', 
            `${monster.emoji} 赔案${monster.id}出现：${monster.description}，金额${this._formatMoney(monster.amount)}，${monster.level}级风险`,
            { monsterId: monster.id, amount: monster.amount, level: monster.level }
        );
    }

    _startGameLoop() {
        if (this.gameLoopId) return;
        
        this.gameLoopId = setInterval(() => {
            if (this.state === GameState.WAVE_IN_PROGRESS) {
                this._gameTick();
            }
        }, 50);
    }

    _stopGameLoop() {
        if (this.gameLoopId) {
            clearInterval(this.gameLoopId);
            this.gameLoopId = null;
        }
    }

    _clearTimeouts() {
        this.spawnTimeoutIds.forEach(id => clearTimeout(id));
        this.spawnTimeoutIds = [];
    }

    _gameTick() {
        for (const monster of this.activeMonsters) {
            if (monster.isDead || monster.hasEscaped) continue;
            
            monster.move(this.maxPosition);
            
            if (monster.hasEscaped) {
                this._handleMonsterEscape(monster);
            } else {
                this._checkTowerCollisions(monster);
            }
        }

        this.activeMonsters = this.activeMonsters.filter(m => !m.isDead && !m.hasEscaped);
        
        if (this._isWaveComplete()) {
            this._endWave();
        }

        if (this._checkGameOver()) {
            this._endGame(false);
        }
    }

    _checkTowerCollisions(monster) {
        if (monster.isDead || monster.hasEscaped) return;

        for (let i = 0; i < this.placedPolicies.length; i++) {
            const policy = this.placedPolicies[i];
            if (!policy) continue;

            const towerPosition = this._getTowerPosition(i);
            const distance = Math.abs(monster.position - towerPosition);

            if (distance < GameData.damageRange && !monster._processedByPolicies?.includes(policy.id)) {
                this._processClaim(monster, policy, i);
                
                if (!monster._processedByPolicies) {
                    monster._processedByPolicies = [];
                }
                monster._processedByPolicies.push(policy.id);
            }
        }
    }

    _getTowerPosition(slotIndex) {
        const slotSpacing = 100 / (GameData.towerSlotCount + 1);
        return (slotIndex + 1) * slotSpacing;
    }

    _processClaim(monster, policy, slotIndex) {
        const validation = policy.canHandleClaim(monster);
        
        if (!validation.valid) {
            for (const error of validation.errors) {
                let trackedError;
                switch (error.type) {
                    case 'RISK_LEVEL_MISMATCH':
                        trackedError = this.errorTracker.trackRiskLevelMismatch(
                            policy.id, policy.levels, monster.id, monster.level, this.currentRound
                        );
                        break;
                    case 'USAGE_EXCEEDED':
                        trackedError = this.errorTracker.trackUsageExceeded(
                            policy.id, policy.maxUses, this.currentRound, monster.id
                        );
                        break;
                    case 'LIMIT_EXCEEDED':
                        trackedError = this.errorTracker.trackLimitExceeded(
                            policy.id, policy.limit, policy.totalPayout, this.currentRound, monster.id
                        );
                        break;
                }
                
                if (trackedError) {
                    this._logSettlement('danger', error.step, trackedError.userMessage, error.data);
                }
            }
            return;
        }

        const deductibleCheck = this.errorTracker.trackDeductibleApplication(
            monster.id, policy.id, policy.deductible, this.currentRound
        );

        let payoutResult = policy.calculatePayout(monster);
        
        if (deductibleCheck.hasError) {
            payoutResult.deductible = 0;
            payoutResult.steps = payoutResult.steps.map(s => {
                if (s.step === '扣除免赔额') {
                    return {
                        step: '免赔额重复扣除检查',
                        description: `检测到免赔额重复扣除风险，已自动跳过，免赔额设为¥0`,
                        data: { action: 'skipped', reason: 'duplicate' }
                    };
                }
                return s;
            });
            this._logSettlement('warning', '免赔额校验', deductibleCheck.error.userMessage, deductibleCheck.error.details);
        }

        const reserveResult = this.reserve.tryPayout(
            payoutResult.payout, monster.id, monster.description
        );

        if (reserveResult.errors && reserveResult.errors.length > 0) {
            for (const error of reserveResult.errors) {
                let trackedError;
                if (error.type === 'RESERVE_OVERDRAFT') {
                    trackedError = this.errorTracker.trackReserveOverdraft(
                        error.data.requested, error.data.available, 
                        error.data.overdraft, this.currentRound, monster.id
                    );
                } else if (error.type === 'RESERVE_EMPTY') {
                    trackedError = this.errorTracker.trackReserveEmpty(
                        error.data.requested, this.currentRound, monster.id
                    );
                }
                
                if (trackedError) {
                    this._logSettlement('danger', error.step, trackedError.userMessage, error.data);
                }
            }
        }

        const actualPayout = reserveResult.actualPayout;
        if (actualPayout > 0) {
            policy.applyPayout({
                payout: actualPayout,
                deductible: payoutResult.deductible
            });
            monster.takeDamage(actualPayout, policy.id);
            monster.addPayout({
                policyId: policy.id,
                policyName: policy.name,
                amount: actualPayout,
                deductible: payoutResult.deductible,
                round: this.currentRound
            });
            this.totalPayout += actualPayout;

            this._logSettlement('success', '赔付完成', 
                `保单"${policy.name}"赔付${monster.id}：${this._formatMoney(actualPayout)}（免赔${this._formatMoney(payoutResult.deductible)}）`,
                { 
                    policyId: policy.id, 
                    monsterId: monster.id, 
                    payout: actualPayout, 
                    deductible: payoutResult.deductible,
                    remainingHP: monster.hp
                }
            );
        } else if (reserveResult.balanceBefore === 0) {
            this._logSettlement('danger', '赔付失败', 
                `准备金已耗尽，无法赔付赔案${monster.id}`,
                { monsterId: monster.id, amount: monster.amount }
            );
        }

        if (monster.isDead) {
            this.killedMonsters.push(monster);
            this._logSettlement('success', '赔案结案', 
                `赔案${monster.id}已全额赔付结案，共赔付${this._formatMoney(monster.amount - monster.hp)}`,
                { monsterId: monster.id, totalPayout: monster.amount - monster.hp }
            );
        }
    }

    _handleMonsterEscape(monster) {
        this.escapedMonsters.push(monster);
        
        this._logSettlement('danger', '赔案逃脱', 
            `⚠️ 赔案${monster.id}逃脱！损失${this._formatMoney(monster.hp)}，已逃脱${this.escapedMonsters.length}/${GameData.maxEscaped}`,
            { monsterId: monster.id, escapedAmount: monster.hp }
        );

        if (this._checkGameOver()) {
            this._endGame(false);
        }
    }

    _isWaveComplete() {
        const roundConfig = GameData.roundConfigs[this.currentRound - 1];
        const expectedMonsters = roundConfig.monsters;
        const processedMonsters = this.killedMonsters.filter(m => 
            this._isMonsterFromCurrentRound(m)
        ).length + this.escapedMonsters.filter(m => 
            this._isMonsterFromCurrentRound(m)
        ).length;
        
        const allSpawned = this.spawnTimeoutIds.length === 0 || 
            Date.now() - this.roundStartTime > roundConfig.monsters * roundConfig.spawnInterval + 1000;
        
        return allSpawned && this.activeMonsters.length === 0 && processedMonsters >= expectedMonsters;
    }

    _isMonsterFromCurrentRound(monster) {
        return monster.instanceId && monster.instanceId.startsWith('MON-');
    }

    _endWave() {
        this._clearTimeouts();
        this._stopGameLoop();

        const roundSummary = {
            round: this.currentRound,
            startTime: this.roundStartTime,
            endTime: Date.now(),
            killed: this.killedMonsters.filter(m => this._isMonsterFromCurrentRound(m)).length,
            escaped: this.escapedMonsters.filter(m => this._isMonsterFromCurrentRound(m)).length,
            reserve: this.reserve.getSummary(),
            errors: this.errorTracker.getErrorsByRound(this.currentRound)
        };
        this.roundHistory.push(roundSummary);

        if (this.currentRound >= this.totalRounds) {
            this._endGame(true);
        } else {
            this.state = GameState.ROUND_COMPLETE;
            
            this._logSettlement('info', `第${this.currentRound}回合结束`, 
                `本回合结案${roundSummary.killed}件，逃脱${roundSummary.escaped}件。准备金余额：${this._formatMoney(this.reserve.getBalance())}`,
                roundSummary
            );

            setTimeout(() => {
                if (this.state === GameState.ROUND_COMPLETE) {
                    this.currentRound++;
                    this.state = GameState.PREPARING;
                }
            }, 1500);
        }
    }

    _checkGameOver() {
        if (this.escapedMonsters.length >= GameData.maxEscaped) {
            return true;
        }
        if (this.reserve.getBalance() <= 0 && this.activeMonsters.length > 0) {
            const remainingDamage = this.activeMonsters.reduce((sum, m) => sum + m.hp, 0);
            if (remainingDamage > 0) {
                return true;
            }
        }
        return false;
    }

    _endGame(victory) {
        this._clearTimeouts();
        this._stopGameLoop();
        
        this.state = victory ? GameState.VICTORY : GameState.GAME_OVER;

        const finalSummary = this.getGameSummary();
        
        this._logSettlement(victory ? 'success' : 'danger', 
            victory ? '🎉 游戏胜利！' : '💔 游戏结束',
            victory 
                ? `恭喜！你成功抵御了所有${this.totalRounds}回合的赔案攻击！`
                : `游戏在第${this.currentRound}回合失败。逃脱赔案：${this.escapedMonsters.length}/${GameData.maxEscaped}`,
            finalSummary
        );
    }

    getGameSummary() {
        const reserveSummary = this.reserve.getSummary();
        const errorSummary = this.errorTracker.getErrorSummary();
        
        return {
            finalState: this.state,
            currentRound: this.currentRound,
            totalRounds: this.totalRounds,
            totalPremiumIncome: this.totalPremiumIncome,
            totalPayout: this.totalPayout,
            totalClaimsProcessed: this.killedMonsters.length,
            totalClaimsEscaped: this.escapedMonsters.length,
            reserve: reserveSummary,
            errors: errorSummary,
            policies: this.policies.map(p => ({
                id: p.id,
                name: p.name,
                type: p.type,
                claimCount: p.claimCount,
                totalPayout: p.totalPayout,
                deductibleApplied: p.deductibleApplied,
                remainingUses: p.remainingUses,
                remainingLimit: p.limit - p.totalPayout
            })),
            roundHistory: this.roundHistory,
            gameDuration: this.gameStartTime ? Date.now() - this.gameStartTime : 0
        };
    }

    _logSettlement(type, title, message, data = {}) {
        const logEntry = {
            id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            round: this.currentRound,
            type: type,
            title: title,
            message: message,
            data: data
        };
        this.settlementLog.push(logEntry);
        return logEntry;
    }

    _formatMoney(amount) {
        return '¥' + amount.toLocaleString('zh-CN');
    }

    getActiveMonsters() {
        return this.activeMonsters.map(m => ({
            instanceId: m.instanceId,
            id: m.id,
            description: m.description,
            amount: m.amount,
            level: m.level,
            hp: m.hp,
            maxHp: m.maxHp,
            position: m.position,
            emoji: m.emoji,
            isDead: m.isDead,
            hasEscaped: m.hasEscaped
        }));
    }

    getPlacedPolicies() {
        return this.placedPolicies.map((p, i) => ({
            slotIndex: i,
            policy: p ? {
                id: p.id,
                name: p.name,
                type: p.type,
                premium: p.premium,
                deductible: p.deductible,
                limit: p.limit,
                levels: p.levels,
                ratio: p.ratio,
                remainingUses: p.remainingUses,
                totalPayout: p.totalPayout,
                remainingLimit: p.limit - p.totalPayout
            } : null,
            position: this._getTowerPosition(i)
        }));
    }

    getSettlementLog() {
        return [...this.settlementLog];
    }

    getErrors() {
        return this.errorTracker.getAllErrors();
    }

    getErrorById(errorId) {
        return this.errorTracker.getErrorById(errorId);
    }

    startErrorReplay(errorId) {
        return this.errorTracker.startReplaySession(errorId);
    }

    advanceReplayStep(sessionId) {
        return this.errorTracker.advanceReplayStep(sessionId);
    }

    previousReplayStep(sessionId) {
        return this.errorTracker.previousReplayStep(sessionId);
    }

    closeReplaySession(sessionId) {
        this.errorTracker.closeReplaySession(sessionId);
    }
}
