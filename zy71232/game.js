const GameState = {
    currentLevel: null,
    currentCategory: 'paint',
    cart: [],
    operationLog: [],
    currentReplayIndex: 0,
    replayTimer: null,
    reports: [],
    bestScores: {},

    init() {
        this.loadFromStorage();
        if (this.reports.length === 0) {
            this.reports = [];
        }
    },

    loadFromStorage() {
        try {
            const savedReports = localStorage.getItem('artGame_reports');
            const savedBestScores = localStorage.getItem('artGame_bestScores');
            if (savedReports) this.reports = JSON.parse(savedReports);
            if (savedBestScores) this.bestScores = JSON.parse(savedBestScores);
        } catch (e) {
            console.error('加载数据失败:', e);
        }
    },

    saveToStorage() {
        try {
            localStorage.setItem('artGame_reports', JSON.stringify(this.reports));
            localStorage.setItem('artGame_bestScores', JSON.stringify(this.bestScores));
        } catch (e) {
            console.error('保存数据失败:', e);
        }
    },

    startLevel(levelId) {
        const level = GameData.levels.find(l => l.id === levelId);
        if (!level) return false;

        this.currentLevel = level;
        this.cart = [];
        this.operationLog = [];
        this.currentReplayIndex = 0;

        this.logOperation('start', { levelId, title: level.title });
        return true;
    },

    resetLevel() {
        if (this.currentLevel) {
            this.startLevel(this.currentLevel.id);
        }
    },

    getAllProducts() {
        return [
            ...GameData.paints,
            ...GameData.papers,
            ...GameData.tools
        ];
    },

    getProductsByCategory(category) {
        switch (category) {
            case 'paint': return GameData.paints;
            case 'paper': return GameData.papers;
            case 'tool': return GameData.tools;
            default: return [];
        }
    },

    findProductById(id) {
        return this.getAllProducts().find(p => p.id === id);
    },

    addToCart(productId) {
        const product = this.findProductById(productId);
        if (!product) return false;

        const existingIndex = this.cart.findIndex(item => item.id === productId);
        if (existingIndex >= 0) {
            this.cart[existingIndex].quantity += 1;
        } else {
            this.cart.push({ ...product, quantity: 1 });
        }

        this.logOperation('add', { product, cartSnapshot: this.getCartSnapshot() });
        return true;
    },

    removeFromCart(productId) {
        const product = this.findProductById(productId);
        if (!product) return false;

        const existingIndex = this.cart.findIndex(item => item.id === productId);
        if (existingIndex >= 0) {
            if (this.cart[existingIndex].quantity > 1) {
                this.cart[existingIndex].quantity -= 1;
            } else {
                this.cart.splice(existingIndex, 1);
            }
            this.logOperation('remove', { product, cartSnapshot: this.getCartSnapshot() });
            return true;
        }
        return false;
    },

    getCartSnapshot() {
        return this.cart.map(item => ({
            id: item.id,
            name: item.name,
            category: item.category,
            price: item.price,
            quantity: item.quantity
        }));
    },

    getCartTotal() {
        return this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    },

    getCartCount() {
        return this.cart.reduce((sum, item) => sum + item.quantity, 0);
    },

    isInCart(productId) {
        return this.cart.some(item => item.id === productId);
    },

    logOperation(action, data) {
        this.operationLog.push({
            timestamp: Date.now(),
            step: this.operationLog.length + 1,
            action,
            data,
            validation: this.validateCart()
        });
    },

    validateCart() {
        if (!this.currentLevel) return { issues: [], warnings: [], infos: [] };

        const level = this.currentLevel;
        const issues = [];
        const warnings = [];
        const infos = [];

        const total = this.getCartTotal();
        const remaining = level.budget - total;

        if (total > level.budget) {
            issues.push({
                type: 'over_budget',
                severity: 'error',
                title: '预算超支',
                message: `当前花费 ¥${total}，超出预算 ¥${total - level.budget}`,
                suggestion: '尝试移除一些高价商品，或选择更实惠的基础款'
            });
        } else if (remaining < level.budget * 0.1) {
            warnings.push({
                type: 'low_budget',
                severity: 'warning',
                title: '预算即将用尽',
                message: `仅剩 ¥${remaining}，注意控制开支`,
                suggestion: '优先购买必需品，避免不必要的消费'
            });
        } else {
            infos.push({
                type: 'budget_ok',
                severity: 'info',
                title: '预算充足',
                message: `剩余预算 ¥${remaining}`,
                suggestion: '合理分配预算，兼顾质量和数量'
            });
        }

        const cartColors = this.getCartColors();
        const missingColors = level.requiredColors.filter(c => !cartColors.includes(c));
        if (missingColors.length > 0) {
            issues.push({
                type: 'missing_colors',
                severity: 'error',
                title: '颜色缺口',
                message: `缺少必填颜色：${missingColors.join('、')}`,
                suggestion: `请添加${missingColors.join('、')}颜料到购物车`,
                missing: missingColors
            });
        }

        const duplicateColors = this.getDuplicateColors();
        if (duplicateColors.length > 0) {
            warnings.push({
                type: 'duplicate_colors',
                severity: 'warning',
                title: '同色颜料重复购买',
                message: `以下颜色购买了多款：${duplicateColors.join('、')}`,
                suggestion: '同一种颜色选择一款即可，基础款性价比更高'
            });
        }

        const cartToolTypes = this.getCartToolTypes();
        const missingTools = level.requiredTools.filter(t => !cartToolTypes.includes(t));
        if (missingTools.length > 0) {
            issues.push({
                type: 'missing_tools',
                severity: 'error',
                title: '工具缺失',
                message: `缺少必填工具类型：${missingTools.join('、')}`,
                suggestion: `请添加${missingTools.join('、')}到购物车`,
                missing: missingTools
            });
        }

        const duplicateTools = this.getDuplicateTools();
        if (duplicateTools.length > 0) {
            warnings.push({
                type: 'duplicate_tools',
                severity: 'warning',
                title: '工具重复购买',
                message: `以下类型工具购买了多件：${duplicateTools.join('、')}`,
                suggestion: '同类工具一件足够，除非有特殊需求'
            });
        }

        const cartPapers = this.getCartPapers();
        const hasRequiredPaper = cartPapers.some(p => p.name.includes(level.requiredPaper.replace(/（专业）/g, '')));
        if (!hasRequiredPaper && cartPapers.length > 0) {
            warnings.push({
                type: 'wrong_paper',
                severity: 'warning',
                title: '画纸规格不符',
                message: `课程需要${level.requiredPaper}，当前选择的可能不适用`,
                suggestion: `请选择${level.requiredPaper}`
            });
        } else if (cartPapers.length === 0) {
            issues.push({
                type: 'no_paper',
                severity: 'error',
                title: '缺少画纸',
                message: `还没有选择画纸`,
                suggestion: `请添加${level.requiredPaper}到购物车`
            });
        }

        const premiumItems = this.getPremiumItems();
        if (premiumItems.length >= 3) {
            warnings.push({
                type: 'too_many_premium',
                severity: 'warning',
                title: '过多高端材料',
                message: `购买了${premiumItems.length}件大师级/专业级商品`,
                suggestion: '初学者基础款足够用，不必盲目追求高端品牌'
            });
        }

        return { issues, warnings, infos };
    },

    getCartColors() {
        const colors = new Set();
        this.cart.forEach(item => {
            if (item.category === 'paint' && item.color) {
                colors.add(item.color);
            }
        });
        return Array.from(colors);
    },

    getDuplicateColors() {
        const colorCount = {};
        this.cart.forEach(item => {
            if (item.category === 'paint' && item.color) {
                colorCount[item.color] = (colorCount[item.color] || 0) + 1;
            }
        });
        return Object.entries(colorCount)
            .filter(([color, count]) => count > 1)
            .map(([color]) => color);
    },

    getCartToolTypes() {
        const types = new Set();
        this.cart.forEach(item => {
            if (item.category === 'tool' && item.type) {
                types.add(item.type);
            }
        });
        return Array.from(types);
    },

    getDuplicateTools() {
        const typeCount = {};
        this.cart.forEach(item => {
            if (item.category === 'tool' && item.type) {
                typeCount[item.type] = (typeCount[item.type] || 0) + 1;
            }
        });
        return Object.entries(typeCount)
            .filter(([type, count]) => count > 1)
            .map(([type]) => type);
    },

    getCartPapers() {
        return this.cart.filter(item => item.category === 'paper');
    },

    getPremiumItems() {
        return this.cart.filter(item => item.grade === 'premium');
    },

    calculateScore() {
        if (!this.currentLevel) return { total: 0, breakdown: [], rank: 'fail' };

        const level = this.currentLevel;
        const validation = this.validateCart();
        const scores = [];
        let total = 0;

        const totalSpent = this.getCartTotal();
        const budgetRatio = totalSpent / level.budget;
        let budgetScore = 0;

        if (totalSpent > level.budget) {
            budgetScore = Math.max(0, level.scoring.budgetWeight - (totalSpent - level.budget) / level.budget * 100);
        } else if (budgetRatio >= 0.8 && budgetRatio <= 0.95) {
            budgetScore = level.scoring.budgetWeight;
        } else if (budgetRatio >= 0.6 && budgetRatio < 0.8) {
            budgetScore = level.scoring.budgetWeight * 0.8;
        } else if (budgetRatio > 0.95) {
            budgetScore = level.scoring.budgetWeight * 0.7;
        } else {
            budgetScore = level.scoring.budgetWeight * 0.5;
        }
        scores.push({ name: '预算管理', value: Math.round(budgetScore), max: level.scoring.budgetWeight });
        total += budgetScore;

        const cartColors = this.getCartColors();
        const colorMatch = level.requiredColors.filter(c => cartColors.includes(c)).length;
        const colorScore = (colorMatch / level.requiredColors.length) * level.scoring.colorWeight;
        const duplicatePenalty = this.getDuplicateColors().length * 5;
        const finalColorScore = Math.max(0, colorScore - duplicatePenalty);
        scores.push({ name: '颜色搭配', value: Math.round(finalColorScore), max: level.scoring.colorWeight });
        total += finalColorScore;

        const cartTools = this.getCartToolTypes();
        const toolMatch = level.requiredTools.filter(t => cartTools.includes(t)).length;
        const toolScore = (toolMatch / level.requiredTools.length) * level.scoring.toolWeight;
        const toolPenalty = this.getDuplicateTools().length * 5;
        const finalToolScore = Math.max(0, toolScore - toolPenalty);
        scores.push({ name: '工具选择', value: Math.round(finalToolScore), max: level.scoring.toolWeight });
        total += finalToolScore;

        const cartPapers = this.getCartPapers();
        const hasRequiredPaper = cartPapers.some(p => p.name.includes(level.requiredPaper.replace(/（专业）/g, '')));
        let efficiencyScore = level.scoring.efficiencyWeight;
        if (!hasRequiredPaper) efficiencyScore *= 0.5;
        if (this.getPremiumItems().length >= 3) efficiencyScore *= 0.7;
        scores.push({ name: '效率优化', value: Math.round(efficiencyScore), max: level.scoring.efficiencyWeight });
        total += efficiencyScore;

        total = Math.round(Math.min(100, Math.max(0, total)));

        let rank = 'fail';
        if (total >= 90) rank = 'excellent';
        else if (total >= 75) rank = 'good';
        else if (total >= level.passScore) rank = 'pass';

        return {
            total,
            breakdown: scores,
            rank,
            validation,
            passed: total >= level.passScore
        };
    },

    submitPurchase() {
        const scoreResult = this.calculateScore();
        
        if (this.currentLevel && scoreResult.total > (this.bestScores[this.currentLevel.id] || 0)) {
            this.bestScores[this.currentLevel.id] = scoreResult.total;
        }

        const report = this.createReport(scoreResult);
        return {
            scoreResult,
            report,
            operationLog: [...this.operationLog]
        };
    },

    checkIncompleteFields(report) {
        const missing = [];
        GameData.requiredFields.forEach(field => {
            if (report[field] === undefined || report[field] === null || 
                (Array.isArray(report[field]) && report[field].length === 0)) {
                missing.push(field);
            }
        });
        return missing;
    },

    createReport(scoreResult) {
        const now = new Date();
        const report = {
            id: 'RPT' + now.getTime(),
            levelId: this.currentLevel?.id,
            courseTheme: this.currentLevel?.theme,
            levelTitle: this.currentLevel?.title,
            budget: this.currentLevel?.budget,
            totalSpent: this.getCartTotal(),
            items: this.getCartSnapshot(),
            score: scoreResult.total,
            rank: scoreResult.rank,
            passed: scoreResult.passed,
            scoreBreakdown: scoreResult.breakdown,
            issues: [
                ...scoreResult.validation.issues,
                ...scoreResult.validation.warnings
            ],
            operationLog: [...this.operationLog],
            status: 'pending',
            submittedAt: now.toISOString(),
            submittedAtStr: now.toLocaleString('zh-CN'),
            notes: '',
            incompleteFields: [],
            incompleteNote: ''
        };

        const missingFields = this.checkIncompleteFields(report);
        if (missingFields.length > 0) {
            report.incompleteFields = missingFields;
            report.status = 'incomplete';
        }

        return report;
    },

    saveReport(report) {
        this.reports.unshift(report);
        this.saveToStorage();
    },

    updateReportStatus(reportId, status, notes = '') {
        const report = this.reports.find(r => r.id === reportId);
        if (report) {
            report.status = status;
            if (notes) report.notes = notes;
            this.saveToStorage();
            return true;
        }
        return false;
    },

    markReportIncomplete(reportId, missingFields, note) {
        const report = this.reports.find(r => r.id === reportId);
        if (report) {
            report.status = 'incomplete';
            report.incompleteFields = missingFields;
            report.incompleteNote = note;
            this.saveToStorage();
            return true;
        }
        return false;
    },

    getReportsByStatus(status) {
        if (status === 'all') return this.reports;
        return this.reports.filter(r => r.status === status);
    },

    deleteReport(reportId) {
        const index = this.reports.findIndex(r => r.id === reportId);
        if (index >= 0) {
            this.reports.splice(index, 1);
            this.saveToStorage();
            return true;
        }
        return false;
    },

    clearReports() {
        this.reports = [];
        this.saveToStorage();
    },

    exportReports(reportIds) {
        const toExport = reportIds 
            ? this.reports.filter(r => reportIds.includes(r.id))
            : this.reports;

        const csvContent = this.generateCSV(toExport);
        const jsonContent = JSON.stringify(toExport, null, 2);

        return { csv: csvContent, json: jsonContent, count: toExport.length };
    },

    generateCSV(reports) {
        const headers = ['报告ID', '关卡', '课程主题', '预算', '实付', '得分', '问题数', '状态', '提交时间', '备注'];
        const rows = reports.map(r => [
            r.id,
            r.levelTitle,
            r.courseTheme,
            r.budget,
            r.totalSpent,
            r.score,
            r.issues?.length || 0,
            GameData.statusLabels[r.status] || r.status,
            r.submittedAtStr,
            r.notes?.replace(/,/g, '，') || ''
        ]);

        return [headers, ...rows]
            .map(row => row.join(','))
            .join('\n');
    },

    exportSingleReport(reportId) {
        const report = this.reports.find(r => r.id === reportId);
        if (!report) return null;

        let content = `╔══════════════════════════════════════════════════════════════╗\n`;
        content += `║                    画材采购报告                              ║\n`;
        content += `╚══════════════════════════════════════════════════════════════╝\n\n`;
        
        content += `📋 基本信息\n`;
        content += `  报告编号: ${report.id}\n`;
        content += `  关卡名称: ${report.levelTitle}\n`;
        content += `  课程主题: ${report.courseTheme}\n`;
        content += `  提交时间: ${report.submittedAtStr}\n`;
        content += `  报告状态: ${GameData.statusLabels[report.status] || report.status}\n\n`;
        
        content += `💰 预算执行\n`;
        content += `  预算金额: ¥${report.budget}\n`;
        content += `  实际支出: ¥${report.totalSpent}\n`;
        content += `  预算结余: ¥${report.budget - report.totalSpent}\n`;
        content += `  使用率: ${((report.totalSpent / report.budget) * 100).toFixed(1)}%\n\n`;
        
        content += `📊 得分情况\n`;
        content += `  综合得分: ${report.score} 分\n`;
        content += `  评级: ${this.getRankText(report.rank)}\n`;
        if (report.scoreBreakdown) {
            report.scoreBreakdown.forEach(item => {
                content += `    ${item.name}: ${item.value}/${item.max} 分\n`;
            });
        }
        
        content += `🛒 采购清单\n`;
        report.items.forEach((item, index) => {
            content += `  ${index + 1}. ${item.name} × ${item.quantity} - ¥${item.price * item.quantity}\n`;
        });
        content += `  ─────────────────────────────────────────────\n`;
        content += `  合计: ¥${report.totalSpent}\n\n`;
        
        if (report.issues && report.issues.length > 0) {
            content += `⚠️  问题识别\n`;
            report.issues.forEach((issue, index) => {
                const icon = issue.severity === 'error' ? '❌' : '⚠️';
                content += `  ${icon} ${index + 1}. ${issue.title}\n`;
                content += `     ${issue.message}\n`;
                if (issue.suggestion) {
                    content += `     💡 建议: ${issue.suggestion}\n`;
                }
            });
            content += '\n';
        }
        
        if (report.incompleteFields && report.incompleteFields.length > 0) {
            content += `⚠️  缺失字段: ${report.incompleteFields.join('、')}\n`;
            if (report.incompleteNote) {
                content += `📝 备注: ${report.incompleteNote}\n`;
            }
            content += '\n';
        }
        
        if (report.notes) {
            content += `📝 审核备注: ${report.notes}\n\n`;
        }
        
        content += `══════════════════════════════════════════════════════════════\n`;
        
        return content;
    },

    getRankText(rank) {
        const rankMap = {
            'excellent': '🏆 优秀',
            'good': '👍 良好',
            'pass': '✅ 及格',
            'fail': '❌ 不及格'
        };
        return rankMap[rank] || rank;
    },

    startReplay() {
        this.currentReplayIndex = 0;
    },

    getReplayStep(index) {
        if (index < 0 || index >= this.operationLog.length) return null;
        return this.operationLog[index];
    },

    goToReplayStep(index) {
        if (index >= 0 && index < this.operationLog.length) {
            this.currentReplayIndex = index;
            return this.getReplayStep(index);
        }
        return null;
    },

    nextReplayStep() {
        if (this.currentReplayIndex < this.operationLog.length - 1) {
            this.currentReplayIndex++;
            return this.getReplayStep(this.currentReplayIndex);
        }
        return null;
    },

    prevReplayStep() {
        if (this.currentReplayIndex > 0) {
            this.currentReplayIndex--;
            return this.getReplayStep(this.currentReplayIndex);
        }
        return null;
    },

    autoPlayReplay(callback, interval = 2000) {
        this.stopReplay();
        this.currentReplayIndex = 0;
        callback(this.getReplayStep(0));
        
        this.replayTimer = setInterval(() => {
            const step = this.nextReplayStep();
            if (step) {
                callback(step);
            } else {
                this.stopReplay();
            }
        }, interval);
    },

    stopReplay() {
        if (this.replayTimer) {
            clearInterval(this.replayTimer);
            this.replayTimer = null;
        }
    },

    isReplayPlaying() {
        return this.replayTimer !== null;
    },

    isLevelUnlocked(levelId) {
        if (levelId === 1) return true;
        return this.bestScores[levelId - 1] !== undefined;
    }
};

GameState.init();
