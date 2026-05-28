const App = {
    currentReportFilter: 'all',
    selectedReports: new Set(),
    tempReport: null,
    lastSubmitResult: null,

    init() {
        this.bindEvents();
        this.showLevelSelect();
    },

    bindEvents() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                GameState.currentCategory = btn.dataset.category;
                this.renderMarket();
            });
        });

        document.getElementById('btnSubmit').addEventListener('click', () => this.handleSubmit());
        document.getElementById('btnReset').addEventListener('click', () => this.handleReset());
        document.getElementById('btnReplay').addEventListener('click', () => this.showReplay());
        document.getElementById('btnReports').addEventListener('click', () => this.showReports());

        document.getElementById('btnViewReplay').addEventListener('click', () => {
            this.closeModal('resultModal');
            this.showReplay();
        });
        document.getElementById('btnSaveReport').addEventListener('click', () => this.handleSaveReport());
        document.getElementById('btnNextLevel').addEventListener('click', () => this.handleNextLevel());

        document.getElementById('btnReplayPrev').addEventListener('click', () => this.replayPrev());
        document.getElementById('btnReplayPlay').addEventListener('click', () => this.toggleReplayPlay());
        document.getElementById('btnReplayNext').addEventListener('click', () => this.replayNext());

        document.querySelectorAll('.report-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentReportFilter = tab.dataset.status;
                this.renderReports();
            });
        });

        document.getElementById('checkAllReports').addEventListener('change', (e) => {
            const checked = e.target.checked;
            document.querySelectorAll('.report-checkbox').forEach(cb => {
                cb.checked = checked;
                if (checked) {
                    this.selectedReports.add(cb.dataset.reportId);
                } else {
                    this.selectedReports.delete(cb.dataset.reportId);
                }
            });
        });

        document.getElementById('btnExportSelected').addEventListener('click', () => this.exportSelectedReports());
        document.getElementById('btnExportAll').addEventListener('click', () => this.exportAllReports());
        document.getElementById('btnClearReports').addEventListener('click', () => this.clearReports());

        document.getElementById('btnMarkIncomplete').addEventListener('click', () => this.handleMarkIncomplete());

        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal(btn.dataset.close);
                if (btn.dataset.close === 'replayModal') {
                    GameState.stopReplay();
                }
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    if (modal.id === 'replayModal') {
                        GameState.stopReplay();
                    }
                }
            });
        });
    },

    showLevelSelect() {
        this.renderLevelGrid();
        this.openModal('levelModal');
    },

    renderLevelGrid() {
        const grid = document.getElementById('levelGrid');
        grid.innerHTML = '';

        GameData.levels.forEach(level => {
            const unlocked = GameState.isLevelUnlocked(level.id);
            const bestScore = GameState.bestScores[level.id];
            const completed = bestScore !== undefined;

            const card = document.createElement('div');
            card.className = `level-card ${!unlocked ? 'locked' : ''} ${completed ? 'completed' : ''}`;
            card.innerHTML = `
                ${bestScore ? `<div class="level-best">最高分: ${bestScore}</div>` : ''}
                <div class="level-number">${level.id}</div>
                <div class="level-title">${level.title}</div>
                <div class="level-desc">${level.description}</div>
                <div class="level-meta">
                    <span>预算: ¥${level.budget}</span>
                    <span>${'⭐'.repeat(level.difficulty)}</span>
                </div>
                ${!unlocked ? '<div style="margin-top:10px;color:#999;font-size:12px;">🔒 完成上一关解锁</div>' : ''}
            `;

            if (unlocked) {
                card.addEventListener('click', () => this.startLevel(level.id));
            }

            grid.appendChild(card);
        });
    },

    startLevel(levelId) {
        if (GameState.startLevel(levelId)) {
            this.closeModal('levelModal');
            this.updateUI();
            this.renderMarket();
            this.showToast(`开始关卡：${GameState.currentLevel.title}`, 'info');
        }
    },

    updateUI() {
        if (!GameState.currentLevel) return;

        const level = GameState.currentLevel;
        document.getElementById('levelBadge').textContent = `关卡 ${level.id}`;
        document.getElementById('courseTheme').textContent = `课程主题：${level.theme}`;
        document.getElementById('budgetAmount').textContent = `¥${level.budget}`;

        document.getElementById('reqColors').textContent = level.requiredColors.join('、');
        document.getElementById('reqTools').textContent = level.requiredTools.join('、');
        document.getElementById('reqPaper').textContent = level.requiredPaper;
        document.getElementById('reqDifficulty').textContent = '⭐'.repeat(level.difficulty);

        this.updateBudgetDisplay();
        this.updateCartDisplay();
        this.updateValidationDisplay();
    },

    updateBudgetDisplay() {
        const total = GameState.getCartTotal();
        const budget = GameState.currentLevel?.budget || 0;
        const percentage = Math.min(100, (total / budget) * 100);

        document.getElementById('budgetSpent').textContent = `已用: ¥${total}`;
        
        const barFill = document.getElementById('budgetBarFill');
        barFill.style.width = `${percentage}%`;
        barFill.classList.remove('warning', 'danger');
        
        if (percentage > 100) {
            barFill.classList.add('danger');
        } else if (percentage > 90) {
            barFill.classList.add('warning');
        }
    },

    renderMarket() {
        const grid = document.getElementById('marketGrid');
        const products = GameState.getProductsByCategory(GameState.currentCategory);
        
        grid.innerHTML = '';

        products.forEach(product => {
            const isInCart = GameState.isInCart(product.id);
            const isRequired = this.isRequiredProduct(product);
            
            const card = document.createElement('div');
            card.className = `product-card ${isInCart ? 'selected' : ''} ${isRequired ? 'highlight-req' : ''}`;
            
            let badgeHtml = '';
            if (isRequired) {
                badgeHtml = '<span class="product-badge badge-req">必填</span>';
            } else if (product.grade === 'premium') {
                badgeHtml = '<span class="product-badge badge-premium">高端</span>';
            } else if (product.grade === 'basic') {
                badgeHtml = '<span class="product-badge badge-basic">基础</span>';
            }

            const bgColor = product.colorCode ? 
                `background: linear-gradient(135deg, ${product.colorCode}40, ${product.colorCode}10);` : '';

            const icon = GameData.categoryIcons[product.category];
            const desc = product.category === 'paint' 
                ? `${product.color} · ${product.desc}`
                : product.category === 'paper'
                    ? `${product.spec} · ${product.sheets}张`
                    : `${product.type} · ${product.desc}`;

            card.innerHTML = `
                ${badgeHtml}
                <div class="product-image" style="${bgColor}">${icon}</div>
                <div class="product-name">${product.name}</div>
                <div class="product-desc">${desc}</div>
                <div class="product-price">¥${product.price}</div>
                <div class="product-brand">${product.brand}</div>
            `;

            card.addEventListener('click', () => this.toggleProduct(product.id, card));
            grid.appendChild(card);
        });
    },

    isRequiredProduct(product) {
        if (!GameState.currentLevel) return false;
        const level = GameState.currentLevel;

        if (product.category === 'paint' && level.requiredColors.includes(product.color)) {
            return true;
        }
        if (product.category === 'tool' && level.requiredTools.includes(product.type)) {
            return true;
        }
        if (product.category === 'paper' && product.name.includes(level.requiredPaper.replace(/（专业）/g, ''))) {
            return true;
        }
        return false;
    },

    toggleProduct(productId, card) {
        if (GameState.isInCart(productId)) {
            GameState.removeFromCart(productId);
            card.classList.remove('selected');
            card.classList.add('animate-shake');
            setTimeout(() => card.classList.remove('animate-shake'), 300);
        } else {
            GameState.addToCart(productId);
            card.classList.add('selected');
            card.classList.add('animate-bounce');
            setTimeout(() => card.classList.remove('animate-bounce'), 500);
        }
        this.updateBudgetDisplay();
        this.updateCartDisplay();
        this.updateValidationDisplay();
    },

    updateCartDisplay() {
        const cartItems = document.getElementById('cartItems');
        const cartCount = document.getElementById('cartCount');
        const cartTotal = document.getElementById('cartTotal');

        const count = GameState.getCartCount();
        const total = GameState.getCartTotal();
        const budget = GameState.currentLevel?.budget || 0;

        cartCount.textContent = count;
        cartTotal.textContent = `¥${total}`;
        cartTotal.classList.toggle('over-budget', total > budget);

        if (GameState.cart.length === 0) {
            cartItems.innerHTML = '<div class="empty-cart">购物车是空的，去市场选点东西吧~</div>';
            return;
        }

        cartItems.innerHTML = '';
        GameState.cart.forEach(item => {
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name} ${item.quantity > 1 ? `×${item.quantity}` : ''}</div>
                    <div class="cart-item-desc">${item.brand}</div>
                </div>
                <span class="cart-item-price">¥${item.price * item.quantity}</span>
                <button class="cart-item-remove" data-id="${item.id}">×</button>
            `;

            cartItem.querySelector('.cart-item-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                GameState.removeFromCart(item.id);
                this.updateBudgetDisplay();
                this.updateCartDisplay();
                this.updateValidationDisplay();
                this.renderMarket();
            });

            cartItems.appendChild(cartItem);
        });
    },

    updateValidationDisplay() {
        const validationList = document.getElementById('validationList');
        const validation = GameState.validateCart();

        const items = [];

        if (GameState.cart.length === 0) {
            validationList.innerHTML = '<div class="validation-item info">开始采购后会显示检查结果</div>';
            return;
        }

        validation.issues.forEach(issue => {
            items.push(`<div class="validation-item error"><span>❌</span><strong>${issue.title}:</strong> ${issue.message}</div>`);
        });

        validation.warnings.forEach(warning => {
            items.push(`<div class="validation-item warning"><span>⚠️</span><strong>${warning.title}:</strong> ${warning.message}</div>`);
        });

        validation.infos.forEach(info => {
            items.push(`<div class="validation-item info"><span>ℹ️</span>${info.message}</div>`);
        });

        if (items.length === 0) {
            items.push('<div class="validation-item success"><span>✅</span>当前没有发现问题</div>');
        }

        validationList.innerHTML = items.join('');
    },

    handleSubmit() {
        if (GameState.cart.length === 0) {
            this.showToast('购物车是空的！', 'warning');
            return;
        }

        const result = GameState.submitPurchase();
        this.lastSubmitResult = result;

        if (result.report.incompleteFields && result.report.incompleteFields.length > 0) {
            this.tempReport = result.report;
            this.showIncompleteModal(result.report.incompleteFields);
            return;
        }

        this.showResult(result);
    },

    showIncompleteModal(missingFields) {
        const fieldsContainer = document.getElementById('incompleteFields');
        const fieldLabels = {
            'levelId': '关卡ID',
            'courseTheme': '课程主题',
            'budget': '预算',
            'totalSpent': '实付金额',
            'items': '采购清单',
            'score': '得分',
            'issues': '问题记录'
        };

        fieldsContainer.innerHTML = missingFields.map(field => `
            <div class="incomplete-field-item">
                <span>⚠️</span>
                <span class="incomplete-field-name">${fieldLabels[field] || field}</span>
            </div>
        `).join('');

        document.getElementById('incompleteNote').value = '';
        this.openModal('incompleteModal');
    },

    handleMarkIncomplete() {
        const note = document.getElementById('incompleteNote').value.trim();
        const missingFields = this.tempReport?.incompleteFields || [];

        if (this.tempReport) {
            this.tempReport.status = 'incomplete';
            this.tempReport.incompleteNote = note;
            GameState.saveReport(this.tempReport);
            this.showToast('已标记为字段不齐，报告已保存', 'warning');
            this.closeModal('incompleteModal');
            
            if (this.lastSubmitResult) {
                this.showResult(this.lastSubmitResult);
            }
        }
    },

    showResult(result) {
        const { scoreResult, report } = result;

        document.getElementById('resultTitle').textContent = 
            scoreResult.passed ? '🎉 采购完成' : '😅 还需改进';

        const scoreCircle = document.getElementById('scoreCircle');
        scoreCircle.style.setProperty('--score-percent', `${scoreResult.total}%`);
        document.getElementById('scoreNumber').textContent = scoreResult.total;

        const rankEl = document.getElementById('scoreRank');
        rankEl.textContent = GameState.getRankText(scoreResult.rank);
        rankEl.className = `score-rank ${scoreResult.rank}`;

        const breakdownEl = document.getElementById('scoreBreakdown');
        breakdownEl.innerHTML = scoreResult.breakdown.map(item => `
            <div class="score-item">
                <span class="score-item-name">${item.name}</span>
                <span class="score-item-value ${item.value >= item.max * 0.8 ? 'positive' : item.value < item.max * 0.5 ? 'negative' : ''}">
                    ${item.value}/${item.max}
                </span>
            </div>
        `).join('');

        const issuesEl = document.getElementById('issuesList');
        const allIssues = [
            ...scoreResult.validation.issues.map(i => ({ ...i, severity: 'error' })),
            ...scoreResult.validation.warnings.map(i => ({ ...i, severity: 'warning' }))
        ];

        if (allIssues.length === 0) {
            issuesEl.innerHTML = `
                <div class="issue-item success">
                    <span class="issue-icon">✅</span>
                    <div class="issue-content">
                        <strong>完美！</strong>
                        本次采购没有发现任何问题
                    </div>
                </div>
            `;
        } else {
            issuesEl.innerHTML = allIssues.map(issue => `
                <div class="issue-item ${issue.severity}">
                    <span class="issue-icon">${issue.severity === 'error' ? '❌' : '⚠️'}</span>
                    <div class="issue-content">
                        <strong>${issue.title}</strong>
                        ${issue.message}
                        ${issue.suggestion ? `<div class="issue-suggestion">💡 ${issue.suggestion}</div>` : ''}
                    </div>
                </div>
            `).join('');
        }

        this.openModal('resultModal');
    },

    handleSaveReport() {
        if (this.lastSubmitResult) {
            const report = this.tempReport || this.lastSubmitResult.report;
            if (!GameState.reports.find(r => r.id === report.id)) {
                GameState.saveReport(report);
                this.showToast('报告已保存！', 'success');
            } else {
                this.showToast('报告已经保存过了', 'info');
            }
        }
    },

    handleNextLevel() {
        this.closeModal('resultModal');
        const nextLevelId = (GameState.currentLevel?.id || 0) + 1;
        if (nextLevelId <= GameData.levels.length && GameState.isLevelUnlocked(nextLevelId)) {
            this.startLevel(nextLevelId);
        } else {
            this.showLevelSelect();
        }
    },

    handleReset() {
        if (confirm('确定要重置当前关卡吗？所有选择将被清空。')) {
            GameState.resetLevel();
            this.updateUI();
            this.renderMarket();
            this.showToast('已重置', 'info');
        }
    },

    showReplay() {
        if (GameState.operationLog.length === 0) {
            this.showToast('还没有操作记录可以回放', 'warning');
            return;
        }

        GameState.startReplay();
        this.renderReplayTimeline();
        this.updateReplayDisplay(GameState.getReplayStep(0));
        this.openModal('replayModal');
    },

    renderReplayTimeline() {
        const timeline = document.getElementById('replayTimeline');
        timeline.innerHTML = '';

        GameState.operationLog.forEach((log, index) => {
            const dot = document.createElement('div');
            dot.className = 'timeline-dot';
            
            const hasError = log.validation?.issues?.length > 0;
            const hasWarning = log.validation?.warnings?.length > 0;
            
            if (hasError) dot.classList.add('error');
            else if (hasWarning) dot.classList.add('warning');
            
            dot.textContent = index + 1;
            dot.addEventListener('click', () => {
                const step = GameState.goToReplayStep(index);
                this.updateReplayDisplay(step);
            });
            
            timeline.appendChild(dot);
        });

        this.updateReplayProgress();
    },

    updateReplayDisplay(step) {
        if (!step) return;

        document.querySelectorAll('.timeline-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === GameState.currentReplayIndex);
        });

        const actionMap = {
            'start': '🎬 开始关卡',
            'add': '➕ 添加商品',
            'remove': '➖ 移除商品'
        };

        document.getElementById('replayStepNum').textContent = step.step;
        document.getElementById('replayStepAction').textContent = actionMap[step.action] || step.action;

        let desc = '';
        if (step.action === 'start') {
            desc = `开始关卡：${step.data.title}`;
        } else if (step.action === 'add') {
            desc = `添加了「${step.data.product.name}」，价格 ¥${step.data.product.price}`;
        } else if (step.action === 'remove') {
            desc = `移除了「${step.data.product.name}」`;
        }
        document.getElementById('replayStepDesc').textContent = desc;

        const cartEl = document.getElementById('replayStepCart');
        const cartSnapshot = step.data.cartSnapshot || [];
        
        let cartHtml = '<div class="replay-cart-title">当前购物车：</div><div class="replay-cart-items">';
        if (cartSnapshot.length === 0) {
            cartHtml += '<span class="replay-cart-item">（空）</span>';
        } else {
            cartSnapshot.forEach(item => {
                const isNew = step.action === 'add' && step.data.product.id === item.id;
                const isRemoved = step.action === 'remove' && step.data.product.id === item.id;
                cartHtml += `<span class="replay-cart-item ${isNew ? 'added' : ''} ${isRemoved ? 'removed' : ''}">
                    ${item.name} ×${item.quantity}
                </span>`;
            });
        }
        cartHtml += '</div>';

        if (step.validation) {
            const issues = [...(step.validation.issues || []), ...(step.validation.warnings || [])];
            if (issues.length > 0) {
                cartHtml += '<div style="margin-top:12px;">';
                issues.forEach(issue => {
                    const icon = issue.severity === 'error' ? '❌' : '⚠️';
                    cartHtml += `<div style="font-size:12px;color:${issue.severity === 'error' ? '#f45c43' : '#f59e0b'};margin-top:4px;">
                        ${icon} ${issue.title}：${issue.message}
                    </div>`;
                });
                cartHtml += '</div>';
            }
        }

        cartEl.innerHTML = cartHtml;
        this.updateReplayProgress();
    },

    updateReplayProgress() {
        document.getElementById('replayProgress').textContent = 
            `${GameState.currentReplayIndex + 1} / ${GameState.operationLog.length}`;
    },

    replayPrev() {
        const step = GameState.prevReplayStep();
        if (step) this.updateReplayDisplay(step);
    },

    replayNext() {
        const step = GameState.nextReplayStep();
        if (step) this.updateReplayDisplay(step);
    },

    toggleReplayPlay() {
        const playBtn = document.getElementById('btnReplayPlay');
        
        if (GameState.isReplayPlaying()) {
            GameState.stopReplay();
            playBtn.textContent = '▶️ 播放';
        } else {
            playBtn.textContent = '⏸️ 暂停';
            GameState.autoPlayReplay((step) => {
                if (step) {
                    this.updateReplayDisplay(step);
                } else {
                    playBtn.textContent = '▶️ 播放';
                }
            }, 1500);
        }
    },

    showReports() {
        this.selectedReports.clear();
        document.getElementById('checkAllReports').checked = false;
        this.renderReports();
        this.openModal('reportsModal');
    },

    renderReports() {
        const reports = GameState.getReportsByStatus(this.currentReportFilter);
        const tbody = document.getElementById('reportsTableBody');

        if (reports.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:40px;color:#999;">暂无报告</td></tr>`;
            return;
        }

        tbody.innerHTML = reports.map(report => {
            const statusClass = `status-${report.status}`;
            const issueCount = report.issues?.length || 0;
            
            return `
                <tr>
                    <td><input type="checkbox" class="report-checkbox" data-report-id="${report.id}"></td>
                    <td>${report.levelId || '-'}</td>
                    <td>${report.courseTheme || '-'}</td>
                    <td>¥${report.budget || 0}</td>
                    <td>¥${report.totalSpent || 0}</td>
                    <td><strong>${report.score || 0}</strong></td>
                    <td>${issueCount > 0 ? `<span style="color:#f45c43;">${issueCount}</span>` : '0'}</td>
                    <td><span class="status-badge ${statusClass}">${GameData.statusLabels[report.status] || report.status}</span></td>
                    <td>${report.submittedAtStr || '-'}</td>
                    <td>
                        <div class="report-actions">
                            <button class="report-action-btn view" onclick="App.viewReport('${report.id}')">查看</button>
                            ${report.status === 'pending' ? `
                                <button class="report-action-btn approve" onclick="App.approveReport('${report.id}')">通过</button>
                                <button class="report-action-btn reject" onclick="App.rejectReport('${report.id}')">退回</button>
                            ` : ''}
                            <button class="report-action-btn export" onclick="App.exportSingleReport('${report.id}')">导出</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        document.querySelectorAll('.report-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const reportId = cb.dataset.reportId;
                if (e.target.checked) {
                    this.selectedReports.add(reportId);
                } else {
                    this.selectedReports.delete(reportId);
                }
            });
        });
    },

    viewReport(reportId) {
        const report = GameState.reports.find(r => r.id === reportId);
        if (!report) return;

        const body = document.getElementById('reportDetailBody');
        
        let content = `
            <div class="report-detail-section">
                <h3>📋 基本信息</h3>
                <div class="report-info-grid">
                    <div class="report-info-item">
                        <span class="report-info-label">报告编号</span>
                        <span class="report-info-value">${report.id}</span>
                    </div>
                    <div class="report-info-item">
                        <span class="report-info-label">提交时间</span>
                        <span class="report-info-value">${report.submittedAtStr || '-'}</span>
                    </div>
                    <div class="report-info-item">
                        <span class="report-info-label">关卡</span>
                        <span class="report-info-value">${report.levelTitle || '-'}</span>
                    </div>
                    <div class="report-info-item">
                        <span class="report-info-label">课程主题</span>
                        <span class="report-info-value">${report.courseTheme || '-'}</span>
                    </div>
                    <div class="report-info-item">
                        <span class="report-info-label">状态</span>
                        <span class="report-info-value"><span class="status-badge status-${report.status}">${GameData.statusLabels[report.status] || report.status}</span></span>
                    </div>
                    <div class="report-info-item">
                        <span class="report-info-label">得分</span>
                        <span class="report-info-value">${report.score} 分 (${GameState.getRankText(report.rank)})</span>
                    </div>
                </div>
            </div>

            <div class="report-detail-section">
                <h3>💰 预算执行</h3>
                <div class="report-info-grid">
                    <div class="report-info-item">
                        <span class="report-info-label">预算金额</span>
                        <span class="report-info-value">¥${report.budget}</span>
                    </div>
                    <div class="report-info-item">
                        <span class="report-info-label">实际支出</span>
                        <span class="report-info-value">¥${report.totalSpent}</span>
                    </div>
                    <div class="report-info-item">
                        <span class="report-info-label">结余</span>
                        <span class="report-info-value" style="color:${report.budget - report.totalSpent >= 0 ? '#11998e' : '#f45c43'}">
                            ¥${report.budget - report.totalSpent}
                        </span>
                    </div>
                    <div class="report-info-item">
                        <span class="report-info-label">使用率</span>
                        <span class="report-info-value">${((report.totalSpent / report.budget) * 100).toFixed(1)}%</span>
                    </div>
                </div>
            </div>

            <div class="report-detail-section">
                <h3>🛒 采购清单</h3>
                <div class="report-items-list">
                    ${report.items.map(item => `
                        <div class="report-item-row">
                            <div class="report-item-info">
                                <div class="report-item-name">${item.name} × ${item.quantity}</div>
                                <div class="report-item-meta">${GameData.categoryIcons[item.category]} ${item.category === 'paint' ? '颜料' : item.category === 'paper' ? '画纸' : '工具'}</div>
                            </div>
                            <span class="report-item-price">¥${item.price * item.quantity}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        if (report.issues && report.issues.length > 0) {
            content += `
                <div class="report-detail-section">
                    <h3>⚠️ 问题识别</h3>
                    ${report.issues.map(issue => `
                        <div class="report-issue-item ${issue.severity}">
                            <strong>${issue.severity === 'error' ? '❌' : '⚠️'} ${issue.title}</strong><br>
                            ${issue.message}
                            ${issue.suggestion ? `<br><span style="opacity:0.8;">💡 ${issue.suggestion}</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (report.incompleteFields && report.incompleteFields.length > 0) {
            const fieldLabels = {
                'levelId': '关卡ID',
                'courseTheme': '课程主题',
                'budget': '预算',
                'totalSpent': '实付金额',
                'items': '采购清单',
                'score': '得分',
                'issues': '问题记录'
            };
            content += `
                <div class="report-detail-section">
                    <h3>⚠️ 缺失字段</h3>
                    <p>${report.incompleteFields.map(f => fieldLabels[f] || f).join('、')}</p>
                    ${report.incompleteNote ? `<p style="margin-top:8px;"><strong>备注：</strong>${report.incompleteNote}</p>` : ''}
                </div>
            `;
        }

        if (report.notes) {
            content += `
                <div class="report-detail-section">
                    <h3>📝 审核备注</h3>
                    <p>${report.notes}</p>
                </div>
            `;
        }

        content += `
            <div class="report-detail-actions">
                ${report.status === 'pending' ? `
                    <button class="btn btn-success" onclick="App.approveReport('${report.id}');App.closeModal('reportDetailModal');App.renderReports();">✅ 通过</button>
                    <button class="btn btn-danger" onclick="App.rejectReport('${report.id}');App.closeModal('reportDetailModal');App.renderReports();">❌ 退回</button>
                ` : ''}
                <button class="btn btn-primary" onclick="App.exportSingleReport('${report.id}')">📥 导出报告</button>
                <button class="btn btn-secondary" onclick="App.deleteReport('${report.id}')">🗑️ 删除</button>
            </div>
        `;

        body.innerHTML = content;
        this.openModal('reportDetailModal');
    },

    approveReport(reportId) {
        GameState.updateReportStatus(reportId, 'approved', '审核通过');
        this.showToast('报告已通过', 'success');
        this.renderReports();
    },

    rejectReport(reportId) {
        const note = prompt('请输入退回原因：');
        if (note !== null) {
            GameState.updateReportStatus(reportId, 'rejected', note || '需要修改');
            this.showToast('报告已退回', 'warning');
            this.renderReports();
        }
    },

    deleteReport(reportId) {
        if (confirm('确定要删除这份报告吗？')) {
            GameState.deleteReport(reportId);
            this.showToast('报告已删除', 'info');
            this.closeModal('reportDetailModal');
            this.renderReports();
        }
    },

    exportSelectedReports() {
        if (this.selectedReports.size === 0) {
            this.showToast('请先选择要导出的报告', 'warning');
            return;
        }
        const result = GameState.exportReports(Array.from(this.selectedReports));
        this.downloadFile(result.csv, `采购报告_${new Date().toLocaleDateString()}.csv`, 'text/csv');
        this.showToast(`已导出 ${result.count} 份报告`, 'success');
    },

    exportAllReports() {
        const result = GameState.exportReports();
        if (result.count === 0) {
            this.showToast('没有报告可以导出', 'warning');
            return;
        }
        this.downloadFile(result.csv, `全部采购报告_${new Date().toLocaleDateString()}.csv`, 'text/csv');
        this.showToast(`已导出 ${result.count} 份报告`, 'success');
    },

    exportSingleReport(reportId) {
        const content = GameState.exportSingleReport(reportId);
        if (content) {
            this.downloadFile(content, `采购报告_${reportId}.txt`, 'text/plain');
            this.showToast('报告已导出', 'success');
        }
    },

    clearReports() {
        if (confirm('确定要清空所有报告吗？此操作不可恢复。')) {
            GameState.clearReports();
            this.renderReports();
            this.showToast('所有报告已清空', 'info');
        }
    },

    downloadFile(content, filename, type) {
        const blob = new Blob(['\ufeff' + content], { type: type + ';charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    },

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2500);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
