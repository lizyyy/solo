const DataNormalizer = {
    fieldAliases: {
        name: ['保单名称', '名称', '产品名', '保', '产品名称', 'name'],
        type: ['险种类型', '类型', '险种', '种', '险种类别', 'type', '险种分类'],
        premium: ['保费', '年交保费', '保费金额', '费', '应交保费', 'premium'],
        deductible: ['免赔额', '年度免赔额', '免赔', '扣', '免赔金额', 'deductible'],
        limit: ['保障额度', '最高赔付', '保额', '额', '保险金额', 'limit'],
        levels: ['承保风险等级', '风险等级', '可承保险级', '级', '保障风险', 'levels'],
        ratio: ['赔付比例', '报销比例', '赔付比', '比', '理赔比例', 'ratio'],
        maxUses: ['可用次数', '剩余次数', '次数限制', '次', '最多赔付', 'count']
    },

    claimFieldAliases: {
        id: ['赔案号', '编号', '赔案编号', 'id', '案件号'],
        description: ['案件描述', '描述', '案情', 'desc', '内容'],
        amount: ['索赔金额', '金额', '索赔额', 'amt', '申请金额'],
        level: ['风险等级', '等级', '风险级', 'level', '风险层级'],
        type: ['险种类型', '类型', '险种', 'type', '险种分类']
    },

    extractField(obj, fieldName, aliases) {
        const possibleFields = aliases[fieldName] || [];
        for (const field of possibleFields) {
            if (obj.hasOwnProperty(field) && obj[field] !== null && obj[field] !== undefined && obj[field] !== '') {
                return obj[field];
            }
        }
        return undefined;
    },

    parseLevels(levelsValue) {
        if (Array.isArray(levelsValue)) {
            return levelsValue.map(l => parseInt(l)).filter(l => !isNaN(l) && l >= 1 && l <= 5);
        }
        if (typeof levelsValue === 'string') {
            if (levelsValue.includes('-')) {
                const [min, max] = levelsValue.split('-').map(s => parseInt(s.trim()));
                if (!isNaN(min) && !isNaN(max)) {
                    const levels = [];
                    for (let i = min; i <= max; i++) levels.push(i);
                    return levels;
                }
            }
            if (levelsValue.includes(',')) {
                return levelsValue.split(',').map(s => parseInt(s.trim())).filter(l => !isNaN(l));
            }
            const num = parseInt(levelsValue);
            if (!isNaN(num)) return [num];
        }
        if (typeof levelsValue === 'number') {
            return [levelsValue];
        }
        return [];
    },

    parseRatio(ratioValue) {
        if (typeof ratioValue === 'number') {
            return Math.max(0, Math.min(1, ratioValue));
        }
        if (typeof ratioValue === 'string') {
            if (ratioValue.includes('%')) {
                const num = parseFloat(ratioValue);
                if (!isNaN(num)) return Math.max(0, Math.min(1, num / 100));
            }
            const num = parseFloat(ratioValue);
            if (!isNaN(num)) return Math.max(0, Math.min(1, num));
        }
        return 1;
    },

    parseMaxUses(usesValue) {
        if (typeof usesValue === 'number') {
            return usesValue;
        }
        if (typeof usesValue === 'string') {
            if (usesValue.includes('无限') || usesValue.includes('不限') || usesValue.toLowerCase() === 'unlimited') {
                return Infinity;
            }
            const num = parseInt(usesValue);
            if (!isNaN(num)) return num;
        }
        return 1;
    },

    normalizePolicy(rawPolicy, index) {
        const errors = [];
        const warnings = [];

        const name = this.extractField(rawPolicy, 'name', this.fieldAliases);
        const type = this.extractField(rawPolicy, 'type', this.fieldAliases);
        const premium = this.extractField(rawPolicy, 'premium', this.fieldAliases);
        const deductible = this.extractField(rawPolicy, 'deductible', this.fieldAliases);
        const limit = this.extractField(rawPolicy, 'limit', this.fieldAliases);
        const levelsRaw = this.extractField(rawPolicy, 'levels', this.fieldAliases);
        const ratioRaw = this.extractField(rawPolicy, 'ratio', this.fieldAliases);
        const maxUsesRaw = this.extractField(rawPolicy, 'maxUses', this.fieldAliases);

        if (!name) {
            errors.push(`缺少保单名称字段，已使用默认名称"保单${index + 1}"`);
        }
        if (!type) {
            errors.push(`保单"${name || index + 1}"缺少险种类型字段`);
        }
        if (premium === undefined || premium === null || isNaN(premium)) {
            errors.push(`保单"${name || index + 1}"保费字段缺失或无效，已设为默认值1000`);
        }
        if (deductible === undefined || deductible === null || isNaN(deductible)) {
            warnings.push(`保单"${name || index + 1}"免赔额字段缺失，已设为0`);
        }
        if (limit === undefined || limit === null || isNaN(limit)) {
            errors.push(`保单"${name || index + 1}"保障额度字段缺失或无效`);
        }
        if (!levelsRaw) {
            errors.push(`保单"${name || index + 1}"承保风险等级字段缺失`);
        }

        const levels = this.parseLevels(levelsRaw);
        if (levels.length === 0) {
            errors.push(`保单"${name || index + 1}"承保风险等级解析失败，无法识别"${levelsRaw}"`);
        }

        const policy = {
            id: `POL-${String(index + 1).padStart(3, '0')}`,
            name: name || `保单${index + 1}`,
            type: type || '未知险种',
            premium: isNaN(premium) ? 1000 : Math.max(0, Number(premium)),
            deductible: isNaN(deductible) ? 0 : Math.max(0, Number(deductible)),
            limit: isNaN(limit) ? 100000 : Math.max(0, Number(limit)),
            levels: levels,
            ratio: this.parseRatio(ratioRaw),
            maxUses: this.parseMaxUses(maxUsesRaw),
            remainingUses: this.parseMaxUses(maxUsesRaw),
            rawData: rawPolicy,
            normalizationErrors: errors,
            normalizationWarnings: warnings
        };

        return policy;
    },

    normalizeClaim(rawClaim, index) {
        const errors = [];
        const warnings = [];

        const id = this.extractField(rawClaim, 'id', this.claimFieldAliases);
        const description = this.extractField(rawClaim, 'description', this.claimFieldAliases);
        const amount = this.extractField(rawClaim, 'amount', this.claimFieldAliases);
        const level = this.extractField(rawClaim, 'level', this.claimFieldAliases);
        const type = this.extractField(rawClaim, 'type', this.claimFieldAliases);

        if (!id) {
            warnings.push(`赔案${index + 1}缺少编号，已自动生成`);
        }
        if (!description) {
            warnings.push(`赔案"${id || index + 1}"缺少案件描述`);
        }
        if (amount === undefined || amount === null || isNaN(amount)) {
            errors.push(`赔案"${id || index + 1}"索赔金额缺失或无效`);
        }
        if (level === undefined || level === null || isNaN(level)) {
            errors.push(`赔案"${id || index + 1}"风险等级缺失或无效`);
        }
        if (!type) {
            warnings.push(`赔案"${id || index + 1}"缺少险种类型字段`);
        }

        const claim = {
            id: id || `CLM-${String(index + 1).padStart(3, '0')}`,
            description: description || '未描述案件',
            amount: isNaN(amount) ? 10000 : Math.max(0, Number(amount)),
            level: isNaN(level) ? 1 : Math.max(1, Math.min(5, Number(level))),
            type: type || '未知',
            rawData: rawClaim,
            normalizationErrors: errors,
            normalizationWarnings: warnings
        };

        return claim;
    }
};

class PolicyCard {
    constructor(normalizedData) {
        Object.assign(this, normalizedData);
        this.totalPayout = 0;
        this.claimCount = 0;
        this.deductibleApplied = 0;
    }

    canHandleClaim(claim) {
        const validation = {
            valid: true,
            errors: [],
            warnings: []
        };

        if (!this.levels.includes(claim.level)) {
            validation.valid = false;
            validation.errors.push({
                type: 'RISK_LEVEL_MISMATCH',
                step: '风险等级校验',
                description: `本保单仅承保${this.levels.join('、')}级风险，当前赔案为${claim.level}级`,
                fix: `请选择可承保${claim.level}级风险的保单，或调整该赔案的风险层级配置`,
                data: { policyLevels: this.levels, claimLevel: claim.level }
            });
        }

        if (this.remainingUses !== Infinity && this.remainingUses <= 0) {
            validation.valid = false;
            validation.errors.push({
                type: 'USAGE_EXCEEDED',
                step: '赔付次数校验',
                description: `本保单最多赔付${this.maxUses}次，已用完所有赔付次数`,
                fix: `请更换其他保单，或联系核保部门增加赔付次数限制`,
                data: { maxUses: this.maxUses, remainingUses: this.remainingUses }
            });
        }

        if (this.totalPayout >= this.limit) {
            validation.valid = false;
            validation.errors.push({
                type: 'LIMIT_EXCEEDED',
                step: '保障额度校验',
                description: `本保单保障额度${this.formatMoney(this.limit)}已用尽，累计赔付${this.formatMoney(this.totalPayout)}`,
                fix: `请更换保障额度更高的保单，或申请增加本保单的保障额度`,
                data: { limit: this.limit, totalPayout: this.totalPayout }
            });
        }

        return validation;
    }

    calculatePayout(claim) {
        const result = {
            deductible: 0,
            payout: 0,
            remainingClaim: 0,
            steps: []
        };

        result.steps.push({
            step: '接收赔案',
            description: `收到赔案${claim.id}，索赔金额${this.formatMoney(claim.amount)}`,
            data: { claimId: claim.id, claimAmount: claim.amount }
        });

        result.deductible = Math.min(this.deductible, claim.amount);
        if (result.deductible > 0) {
            result.steps.push({
                step: '扣除免赔额',
                description: `根据保单约定，扣除免赔额${this.formatMoney(result.deductible)}`,
                data: { deductible: this.deductible, applied: result.deductible }
            });
        } else {
            result.steps.push({
                step: '免赔额校验',
                description: '本保单无免赔额，无需扣除',
                data: { deductible: 0 }
            });
        }

        let eligibleAmount = claim.amount - result.deductible;
        result.steps.push({
            step: '计算可赔金额',
            description: `扣除免赔额后，可赔金额基数为${this.formatMoney(eligibleAmount)}`,
            data: { claimAmount: claim.amount, deductible: result.deductible, eligibleAmount }
        });

        let ratioAmount = eligibleAmount * this.ratio;
        result.steps.push({
            step: '应用赔付比例',
            description: `按赔付比例${(this.ratio * 100).toFixed(0)}%计算，应赔${this.formatMoney(ratioAmount)}`,
            data: { eligibleAmount, ratio: this.ratio, ratioAmount }
        });

        const remainingLimit = this.limit - this.totalPayout;
        result.payout = Math.min(ratioAmount, remainingLimit);
        if (result.payout < ratioAmount) {
            result.steps.push({
                step: '保障额度限制',
                description: `保单剩余保障额度仅${this.formatMoney(remainingLimit)}，实际赔付${this.formatMoney(result.payout)}`,
                data: { remainingLimit, ratioAmount, actualPayout: result.payout }
            });
        }

        result.remainingClaim = claim.amount - result.deductible - result.payout;
        if (result.remainingClaim > 0) {
            result.steps.push({
                step: '计算剩余损失',
                description: `被保险人自行承担${this.formatMoney(result.remainingClaim)}`,
                data: { remainingClaim: result.remainingClaim }
            });
        }

        result.steps.push({
            step: '赔付完成',
            description: `最终赔付${this.formatMoney(result.payout)}，免赔${this.formatMoney(result.deductible)}，自付${this.formatMoney(result.remainingClaim)}`,
            data: { payout: result.payout, deductible: result.deductible, remainingClaim: result.remainingClaim }
        });

        return result;
    }

    applyPayout(payoutResult) {
        this.totalPayout += payoutResult.payout;
        this.deductibleApplied += payoutResult.deductible;
        this.claimCount++;
        if (this.remainingUses !== Infinity) {
            this.remainingUses--;
        }
    }

    formatMoney(amount) {
        return '¥' + amount.toLocaleString('zh-CN');
    }

    clone() {
        const cloned = new PolicyCard(this);
        cloned.id = this.id;
        cloned.totalPayout = this.totalPayout;
        cloned.claimCount = this.claimCount;
        cloned.deductibleApplied = this.deductibleApplied;
        cloned.remainingUses = this.remainingUses;
        return cloned;
    }
}

class ClaimMonster {
    constructor(normalizedData) {
        Object.assign(this, normalizedData);
        this.hp = normalizedData.amount;
        this.maxHp = normalizedData.amount;
        this.position = 0;
        this.isDead = false;
        this.hasEscaped = false;
        this.speed = GameData.monsterSpeed;
        this.emoji = GameData.monsterEmojis[Math.floor(Math.random() * GameData.monsterEmojis.length)];
        this.damageHistory = [];
        this.payouts = [];
    }

    takeDamage(amount, policyId) {
        const actualDamage = Math.min(amount, this.hp);
        this.hp -= actualDamage;
        this.damageHistory.push({
            amount: actualDamage,
            policyId: policyId,
            timestamp: Date.now()
        });
        if (this.hp <= 0) {
            this.isDead = true;
        }
        return actualDamage;
    }

    move(maxPosition) {
        if (!this.isDead && !this.hasEscaped) {
            this.position += this.speed;
            if (this.position >= maxPosition) {
                this.hasEscaped = true;
            }
        }
    }

    addPayout(payout) {
        this.payouts.push(payout);
    }

    formatMoney(amount) {
        return '¥' + amount.toLocaleString('zh-CN');
    }
}

class ReserveManager {
    constructor(initialAmount) {
        this.balance = initialAmount;
        this.initialBalance = initialAmount;
        this.totalIncome = 0;
        this.totalPayout = 0;
        this.transactions = [];
        this.overdraftCount = 0;
        this.maxOverdraft = 0;
    }

    addIncome(amount, source, description) {
        const result = {
            success: true,
            type: 'INCOME',
            amount: amount,
            source: source,
            description: description,
            balanceBefore: this.balance,
            balanceAfter: this.balance + amount,
            timestamp: Date.now(),
            steps: []
        };

        result.steps.push({
            step: '收入入账',
            description: `${source}：${this.formatMoney(amount)}`,
            data: { amount, source, description }
        });

        this.balance += amount;
        this.totalIncome += amount;
        result.balanceAfter = this.balance;
        this.transactions.push(result);

        return result;
    }

    tryPayout(amount, claimId, description) {
        const result = {
            success: false,
            type: 'PAYOUT',
            amount: amount,
            claimId: claimId,
            description: description,
            balanceBefore: this.balance,
            balanceAfter: this.balance,
            actualPayout: 0,
            overdraft: 0,
            timestamp: Date.now(),
            steps: [],
            errors: []
        };

        result.steps.push({
            step: '赔付申请',
            description: `申请赔付${this.formatMoney(amount)}，赔案号：${claimId}`,
            data: { amount, claimId, description }
        });

        result.steps.push({
            step: '准备金余额检查',
            description: `当前准备金余额：${this.formatMoney(this.balance)}`,
            data: { balance: this.balance }
        });

        if (this.balance >= amount) {
            result.actualPayout = amount;
            this.balance -= amount;
            this.totalPayout += amount;
            result.balanceAfter = this.balance;
            result.success = true;

            result.steps.push({
                step: '赔付完成',
                description: `准备金充足，成功赔付${this.formatMoney(amount)}，剩余准备金${this.formatMoney(this.balance)}`,
                data: { payout: amount, remainingBalance: this.balance }
            });
        } else {
            result.overdraft = amount - this.balance;
            this.overdraftCount++;
            this.maxOverdraft = Math.max(this.maxOverdraft, result.overdraft);

            if (this.balance > 0) {
                result.actualPayout = this.balance;
                this.totalPayout += this.balance;
                this.balance = 0;
                result.balanceAfter = 0;

                result.steps.push({
                    step: '准备金不足警告',
                    description: `准备金仅剩余${this.formatMoney(result.actualPayout)}，不足${this.formatMoney(amount)}，差额${this.formatMoney(result.overdraft)}`,
                    data: { available: result.actualPayout, requested: amount, overdraft: result.overdraft }
                });

                result.errors.push({
                    type: 'RESERVE_OVERDRAFT',
                    step: '准备金赔付',
                    description: `准备金透支！申请赔付${this.formatMoney(amount)}，但仅剩余${this.formatMoney(result.actualPayout)}，透支${this.formatMoney(result.overdraft)}`,
                    fix: `需要补充准备金至少${this.formatMoney(result.overdraft)}才能完成本次赔付`,
                    data: { requested: amount, available: result.actualPayout, overdraft: result.overdraft }
                });
            } else {
                result.steps.push({
                    step: '准备金耗尽',
                    description: `准备金已归零，无法支付任何赔付`,
                    data: { balance: 0, requested: amount }
                });

                result.errors.push({
                    type: 'RESERVE_EMPTY',
                    step: '准备金赔付',
                    description: `准备金已归零，申请赔付${this.formatMoney(amount)}被拒绝`,
                    fix: `必须立即补充准备金，否则游戏将失败`,
                    data: { requested: amount, balance: 0 }
                });
            }

            result.success = this.balance >= 0;
        }

        this.transactions.push(result);
        return result;
    }

    getBalance() {
        return this.balance;
    }

    isOverdrawn() {
        return this.balance < 0;
    }

    getSummary() {
        return {
            initialBalance: this.initialBalance,
            currentBalance: this.balance,
            totalIncome: this.totalIncome,
            totalPayout: this.totalPayout,
            netChange: this.balance - this.initialBalance,
            transactionCount: this.transactions.length,
            overdraftCount: this.overdraftCount,
            maxOverdraft: this.maxOverdraft
        };
    }

    formatMoney(amount) {
        return '¥' + amount.toLocaleString('zh-CN');
    }
}
