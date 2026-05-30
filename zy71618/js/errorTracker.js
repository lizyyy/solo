class ErrorTracker {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.deductibleTracking = new Map();
        this.replaySessions = new Map();
        this.errorIdCounter = 0;
    }

    trackDeductibleApplication(claimId, policyId, deductible, round) {
        const key = `${claimId}-${policyId}`;
        
        if (this.deductibleTracking.has(key)) {
            const previous = this.deductibleTracking.get(key);
            
            const error = {
                id: `ERR-${String(++this.errorIdCounter).padStart(5, '0')}`,
                type: 'DEDUCTIBLE_DUPLICATE',
                timestamp: Date.now(),
                round: round,
                step: '免赔额扣除校验',
                claimId: claimId,
                policyId: policyId,
                description: `免赔额重复扣除！赔案${claimId}在保单${policyId}下已扣除过免赔额`,
                details: {
                    previousDeduction: previous.deductible,
                    previousRound: previous.round,
                    attemptedDeduction: deductible,
                    currentRound: round
                },
                fix: `同一赔案在同一保单项下只能扣除一次免赔额。本次免赔额${this.formatMoney(deductible)}已在第${previous.round}回合扣除，本次跳过扣除。`,
                userMessage: `⚠️ 免赔额重复扣除：赔案${claimId}在本保单下已扣除过免赔额，本次不再重复扣除`,
                replaySteps: this.buildDeductibleReplaySteps(previous, deductible, round)
            };

            this.errors.push(error);
            return { hasError: true, error: error };
        }

        this.deductibleTracking.set(key, {
            deductible: deductible,
            round: round,
            timestamp: Date.now()
        });

        return { hasError: false };
    }

    buildDeductibleReplaySteps(previous, attempted, round) {
        return [
            {
                step: '第1步：首次免赔扣除',
                description: `在第${previous.round}回合，该赔案首次经过本保单时，已扣除免赔额${this.formatMoney(previous.deductible)}`,
                data: {
                    round: previous.round,
                    deductible: previous.deductible,
                    timestamp: new Date(previous.timestamp).toLocaleString('zh-CN')
                }
            },
            {
                step: '第2步：当前操作检测',
                description: `在第${round}回合，同一赔案再次经过同一保单，系统检测到免赔额字段仍为${this.formatMoney(attempted)}`,
                data: {
                    currentRound: round,
                    attemptedDeductible: attempted,
                    policyRule: '同一赔案同一保单仅扣一次免赔额'
                }
            },
            {
                step: '第3步：问题定位',
                description: `问题出在【免赔额重复扣除校验】环节。根据保险理赔原则，同一赔案在同一保单项下只能扣除一次免赔额。`,
                highlight: `核心问题：赔案已在第${previous.round}回合扣除免赔额，第${round}回合不应再次扣除`
            },
            {
                step: '第4步：处理结果',
                description: `系统已自动跳过本次免赔额扣除，赔案金额将不重复扣除免赔额。`,
                data: {
                    action: '跳过重复免赔扣除',
                    actualDeduction: 0,
                    savedAmount: attempted
                }
            }
        ];
    }

    trackReserveOverdraft(requested, available, overdraft, round, claimId) {
        const error = {
            id: `ERR-${String(++this.errorIdCounter).padStart(5, '0')}`,
            type: 'RESERVE_OVERDRAFT',
            timestamp: Date.now(),
            round: round,
            step: '准备金赔付校验',
            claimId: claimId,
            description: `准备金透支！申请赔付${this.formatMoney(requested)}，但仅剩余${this.formatMoney(available)}`,
            details: {
                requested: requested,
                available: available,
                overdraft: overdraft
            },
            fix: `需要补充准备金至少${this.formatMoney(overdraft)}才能完成本次赔付。当前准备金已归零，后续赔案将无法赔付。`,
            userMessage: `❌ 准备金不足：申请赔付${this.formatMoney(requested)}，但仅剩${this.formatMoney(available)}，还差${this.formatMoney(overdraft)}`,
            replaySteps: this.buildReserveReplaySteps(requested, available, overdraft, round, claimId)
        };

        this.errors.push(error);
        return error;
    }

    trackReserveEmpty(requested, round, claimId) {
        const error = {
            id: `ERR-${String(++this.errorIdCounter).padStart(5, '0')}`,
            type: 'RESERVE_EMPTY',
            timestamp: Date.now(),
            round: round,
            step: '准备金赔付校验',
            claimId: claimId,
            description: `准备金已归零！申请赔付${this.formatMoney(requested)}被完全拒绝`,
            details: {
                requested: requested,
                available: 0
            },
            fix: `必须立即补充准备金，否则后续所有赔案都将逃脱，游戏将失败。`,
            userMessage: `💀 准备金耗尽：已无资金赔付，赔案${claimId}将全额逃脱`,
            replaySteps: this.buildReserveEmptyReplaySteps(requested, round, claimId)
        };

        this.errors.push(error);
        return error;
    }

    buildReserveReplaySteps(requested, available, overdraft, round, claimId) {
        return [
            {
                step: '第1步：赔案到达',
                description: `第${round}回合，赔案${claimId}到达，申请赔付${this.formatMoney(requested)}`,
                data: {
                    round: round,
                    claimId: claimId,
                    requestedAmount: requested
                }
            },
            {
                step: '第2步：准备金检查',
                description: `系统检查准备金账户，当前余额仅为${this.formatMoney(available)}`,
                data: {
                    reserveBalance: available,
                    timestamp: new Date().toLocaleString('zh-CN')
                }
            },
            {
                step: '第3步：问题定位',
                description: `问题出在【准备金赔付校验】环节。赔付需要${this.formatMoney(requested)}，但准备金仅${this.formatMoney(available)}，差额${this.formatMoney(overdraft)}。`,
                highlight: `核心问题：准备金不足，缺口${this.formatMoney(overdraft)}`
            },
            {
                step: '第4步：部分赔付',
                description: `系统尽最大能力赔付${this.formatMoney(available)}，剩余${this.formatMoney(overdraft)}无法赔付。`,
                data: {
                    actualPayout: available,
                    unpaidAmount: overdraft,
                    remainingReserve: 0
                }
            },
            {
                step: '第5步：后果说明',
                description: `准备金已归零，后续赔案将无法获得任何赔付，会直接逃脱。逃脱${GameData.maxEscaped}个赔案游戏结束。`,
                data: {
                    escapedSoFar: 0,
                    maxEscaped: GameData.maxEscaped
                }
            }
        ];
    }

    buildReserveEmptyReplaySteps(requested, round, claimId) {
        return [
            {
                step: '第1步：赔案到达',
                description: `第${round}回合，赔案${claimId}到达，申请赔付${this.formatMoney(requested)}`,
                data: {
                    round: round,
                    claimId: claimId,
                    requestedAmount: requested
                }
            },
            {
                step: '第2步：准备金检查',
                description: `系统检查准备金账户，发现余额已为¥0`,
                data: {
                    reserveBalance: 0,
                    timestamp: new Date().toLocaleString('zh-CN')
                }
            },
            {
                step: '第3步：问题定位',
                description: `问题出在【准备金赔付校验】环节。准备金已完全耗尽，无法支付任何赔付金额。`,
                highlight: `核心问题：准备金已归零，无资金可赔付`
            },
            {
                step: '第4步：处理结果',
                description: `赔案${claimId}无法获得任何赔付，将全额逃脱。`,
                data: {
                    actualPayout: 0,
                    escapedAmount: requested
                }
            }
        ];
    }

    trackRiskLevelMismatch(policyId, policyLevels, claimId, claimLevel, round) {
        const error = {
            id: `ERR-${String(++this.errorIdCounter).padStart(5, '0')}`,
            type: 'RISK_LEVEL_MISMATCH',
            timestamp: Date.now(),
            round: round,
            step: '风险等级校验',
            policyId: policyId,
            claimId: claimId,
            description: `风险层级错配！保单${policyId}仅承保${policyLevels.join('、')}级风险，赔案${claimId}为${claimLevel}级`,
            details: {
                policyId: policyId,
                policyLevels: policyLevels,
                claimId: claimId,
                claimLevel: claimLevel
            },
            fix: `请选择可承保${claimLevel}级风险的保单，或将该保单替换为保障范围更广的产品。`,
            userMessage: `🚫 风险等级不匹配：本保单不保${claimLevel}级风险，赔案${claimId}将直接通过`,
            replaySteps: this.buildRiskLevelReplaySteps(policyId, policyLevels, claimId, claimLevel, round)
        };

        this.errors.push(error);
        return error;
    }

    buildRiskLevelReplaySteps(policyId, policyLevels, claimId, claimLevel, round) {
        const levelNames = {
            1: '轻微风险', 2: '普通风险', 3: '中等风险', 4: '重大风险', 5: '巨灾风险'
        };
        
        return [
            {
                step: '第1步：保单配置检查',
                description: `保单${policyId}的承保范围配置为：${policyLevels.map(l => `${l}级(${levelNames[l]})`).join('、')}`,
                data: {
                    policyId: policyId,
                    coveredLevels: policyLevels,
                    coveredLevelNames: policyLevels.map(l => levelNames[l])
                }
            },
            {
                step: '第2步：赔案风险评估',
                description: `赔案${claimId}经风险评估，被判定为${claimLevel}级(${levelNames[claimLevel]})`,
                data: {
                    claimId: claimId,
                    claimLevel: claimLevel,
                    claimLevelName: levelNames[claimLevel]
                }
            },
            {
                step: '第3步：风险匹配校验',
                description: `系统进行风险层级匹配检查：${claimLevel}级是否在[${policyLevels.join(',')}]中？`,
                data: {
                    check: `${claimLevel} ∈ [${policyLevels.join(',')}]`,
                    result: policyLevels.includes(claimLevel) ? '匹配' : '不匹配'
                }
            },
            {
                step: '第4步：问题定位',
                description: `问题出在【风险等级校验】环节。${claimLevel}级风险不在保单承保范围内，保单无法对该赔案进行赔付。`,
                highlight: `核心问题：风险层级错配 - 保单保${policyLevels.join('、')}级，赔案是${claimLevel}级`
            },
            {
                step: '第5步：处理结果',
                description: `赔案${claimId}绕过本保单，继续向下一个保单移动。如无合适保单，最终将逃脱。`,
                data: {
                    action: '跳过本保单',
                    riskToInsurer: claimLevel >= 4 ? '高' : '中'
                }
            }
        ];
    }

    trackUsageExceeded(policyId, maxUses, round, claimId) {
        const error = {
            id: `ERR-${String(++this.errorIdCounter).padStart(5, '0')}`,
            type: 'USAGE_EXCEEDED',
            timestamp: Date.now(),
            round: round,
            step: '赔付次数校验',
            policyId: policyId,
            claimId: claimId,
            description: `赔付次数超限！保单${policyId}最多赔付${maxUses}次，已用完`,
            details: {
                policyId: policyId,
                maxUses: maxUses
            },
            fix: `请更换其他保单，或联系核保部门增加赔付次数限制。`,
            userMessage: `📛 赔付次数用完：本保单最多赔${maxUses}次，已用尽`,
            replaySteps: this.buildUsageReplaySteps(policyId, maxUses, round, claimId)
        };

        this.errors.push(error);
        return error;
    }

    buildUsageReplaySteps(policyId, maxUses, round, claimId) {
        return [
            {
                step: '第1步：保单条款检查',
                description: `保单${policyId}条款约定：最多赔付${maxUses}次`,
                data: {
                    policyId: policyId,
                    maxUses: maxUses
                }
            },
            {
                step: '第2步：使用情况统计',
                description: `截至第${round}回合，该保单已赔付${maxUses}次，次数已用尽`,
                data: {
                    currentRound: round,
                    usedCount: maxUses,
                    remaining: 0
                }
            },
            {
                step: '第3步：问题定位',
                description: `问题出在【赔付次数校验】环节。赔案${claimId}是第${maxUses + 1}次申请，超出保单约定的赔付次数限制。`,
                highlight: `核心问题：赔付次数超限 - 已用${maxUses}次，最多${maxUses}次`
            },
            {
                step: '第4步：处理结果',
                description: `保单拒绝赔付，赔案${claimId}继续向下移动。`,
                data: {
                    action: '拒绝赔付',
                    reason: '次数超限'
                }
            }
        ];
    }

    trackLimitExceeded(policyId, limit, totalPayout, round, claimId) {
        const error = {
            id: `ERR-${String(++this.errorIdCounter).padStart(5, '0')}`,
            type: 'LIMIT_EXCEEDED',
            timestamp: Date.now(),
            round: round,
            step: '保障额度校验',
            policyId: policyId,
            claimId: claimId,
            description: `保障额度用尽！保单${policyId}额度${this.formatMoney(limit)}已赔付${this.formatMoney(totalPayout)}`,
            details: {
                policyId: policyId,
                limit: limit,
                totalPayout: totalPayout
            },
            fix: `请更换保障额度更高的保单，或申请增加本保单的保障额度。`,
            userMessage: `💰 额度用尽：本保单${this.formatMoney(limit)}已赔完${this.formatMoney(totalPayout)}`,
            replaySteps: this.buildLimitReplaySteps(policyId, limit, totalPayout, round, claimId)
        };

        this.errors.push(error);
        return error;
    }

    buildLimitReplaySteps(policyId, limit, totalPayout, round, claimId) {
        return [
            {
                step: '第1步：保单额度检查',
                description: `保单${policyId}的保障额度为${this.formatMoney(limit)}`,
                data: {
                    policyId: policyId,
                    limit: limit
                }
            },
            {
                step: '第2步：累计赔付统计',
                description: `截至第${round}回合，该保单已累计赔付${this.formatMoney(totalPayout)}`,
                data: {
                    currentRound: round,
                    totalPayout: totalPayout,
                    remaining: limit - totalPayout
                }
            },
            {
                step: '第3步：问题定位',
                description: `问题出在【保障额度校验】环节。累计赔付${this.formatMoney(totalPayout)} ≥ 保障额度${this.formatMoney(limit)}，额度已用尽。`,
                highlight: `核心问题：保障额度用尽 - 已赔${this.formatMoney(totalPayout)}，总额度${this.formatMoney(limit)}`
            },
            {
                step: '第4步：处理结果',
                description: `保单无法继续赔付，赔案${claimId}继续向下移动。`,
                data: {
                    action: '拒绝赔付',
                    reason: '额度用尽'
                }
            }
        ];
    }

    trackWarning(type, message, round, data = {}) {
        const warning = {
            id: `WRN-${String(this.warnings.length + 1).padStart(5, '0')}`,
            type: type,
            timestamp: Date.now(),
            round: round,
            message: message,
            data: data
        };
        this.warnings.push(warning);
        return warning;
    }

    getErrorsByRound(round) {
        return this.errors.filter(e => e.round === round);
    }

    getErrorsByType(type) {
        return this.errors.filter(e => e.type === type);
    }

    getAllErrors() {
        return [...this.errors];
    }

    getAllWarnings() {
        return [...this.warnings];
    }

    getErrorById(id) {
        return this.errors.find(e => e.id === id);
    }

    getErrorSummary() {
        const summary = {
            totalErrors: this.errors.length,
            totalWarnings: this.warnings.length,
            byType: {},
            byRound: {}
        };

        for (const error of this.errors) {
            summary.byType[error.type] = (summary.byType[error.type] || 0) + 1;
            summary.byRound[error.round] = (summary.byRound[error.round] || 0) + 1;
        }

        return summary;
    }

    startReplaySession(errorId) {
        const error = this.getErrorById(errorId);
        if (!error || !error.replaySteps) {
            return null;
        }

        const sessionId = `REPLAY-${Date.now()}`;
        const session = {
            sessionId: sessionId,
            errorId: errorId,
            error: error,
            steps: error.replaySteps,
            currentStep: 0,
            startTime: Date.now()
        };

        this.replaySessions.set(sessionId, session);
        return session;
    }

    getReplaySession(sessionId) {
        return this.replaySessions.get(sessionId);
    }

    advanceReplayStep(sessionId) {
        const session = this.replaySessions.get(sessionId);
        if (!session) return null;
        
        if (session.currentStep < session.steps.length - 1) {
            session.currentStep++;
            return session.steps[session.currentStep];
        }
        return null;
    }

    previousReplayStep(sessionId) {
        const session = this.replaySessions.get(sessionId);
        if (!session) return null;
        
        if (session.currentStep > 0) {
            session.currentStep--;
            return session.steps[session.currentStep];
        }
        return null;
    }

    closeReplaySession(sessionId) {
        this.replaySessions.delete(sessionId);
    }

    clearAll() {
        this.errors = [];
        this.warnings = [];
        this.deductibleTracking.clear();
        this.replaySessions.clear();
        this.errorIdCounter = 0;
    }

    formatMoney(amount) {
        return '¥' + amount.toLocaleString('zh-CN');
    }
}
