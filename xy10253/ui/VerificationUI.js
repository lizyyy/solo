const VerificationUI = {
    app: null,
    
    init: function(app) {
        this.app = app;
        this.bindEvents();
    },
    
    bindEvents: function() {
        document.getElementById('run-verification-btn').addEventListener('click', () => this.runVerification());
    },
    
    runVerification: function() {
        const result = this.app.runVerification();
        this.render(result);
        this.showToast('验证完成', 'info');
    },
    
    render: function(result) {
        const container = document.getElementById('verification-result');
        
        if (!result) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>点击"运行验证"按钮开始验证</p>
                </div>
            `;
            return;
        }
        
        let html = this.renderOverview(result);
        
        for (const category in result.categories) {
            html += this.renderCategory(result.categories[category]);
        }
        
        html += this.renderFinalSummary(result);
        
        container.innerHTML = html;
    },
    
    renderOverview: function(result) {
        const statusColors = {
            'pass': 'pass',
            'warn': 'warn',
            'fail': 'fail',
            'conflict': 'conflict'
        };
        
        const statusLabels = {
            'pass': '通过',
            'warn': '警告',
            'fail': '失败',
            'conflict': '冲突'
        };
        
        return `
            <div class="verification-overview">
                <div class="overview-card ${statusColors[result.overallStatus]}">
                    <div class="overview-count">${result.summary.pass}</div>
                    <div class="overview-label">通过</div>
                </div>
                <div class="overview-card warn">
                    <div class="overview-count">${result.summary.warn}</div>
                    <div class="overview-label">警告</div>
                </div>
                <div class="overview-card fail">
                    <div class="overview-count">${result.summary.fail}</div>
                    <div class="overview-label">失败</div>
                </div>
                <div class="overview-card conflict">
                    <div class="overview-count">${result.summary.conflict}</div>
                    <div class="overview-label">冲突</div>
                </div>
            </div>
            
            <div class="summary-section">
                <h3>验证结果汇总</h3>
                <p><strong>整体状态：</strong><span class="status-${result.overallStatus}">${statusLabels[result.overallStatus]}</span></p>
                <p><strong>结果说明：</strong>${result.summaryMessage}</p>
                <h4 style="margin-top: 16px;">处理建议：</h4>
                <ul style="margin-left: 24px; color: var(--text-secondary);">
                    ${result.suggestions.map(s => `<li>${s}</li>`).join('')}
                </ul>
            </div>
        `;
    },
    
    renderCategory: function(category) {
        const statusLabels = {
            'pass': '通过',
            'warn': '警告',
            'fail': '失败',
            'conflict': '冲突'
        };
        
        return `
            <div class="verification-category">
                <div class="category-header">
                    <h4>${category.title}</h4>
                    <span class="category-status status-${category.status}">
                        ${statusLabels[category.status]}
                    </span>
                </div>
                <div class="category-items">
                    ${category.items.length === 0 ? `
                        <div style="color: var(--text-secondary); text-align: center; padding: 20px;">
                            ${category.summary}
                        </div>
                    ` : category.items.map(item => this.renderItem(item)).join('')}
                </div>
            </div>
        `;
    },
    
    renderItem: function(item) {
        return `
            <div class="verification-item ${item.status}">
                <div class="item-title">
                    ${this.getStatusIcon(item.status)} ${item.title}
                </div>
                <div class="item-description">
                    ${item.description}
                </div>
                ${item.suggestion ? `
                    <div class="item-suggestion">
                        建议：${item.suggestion}
                    </div>
                ` : ''}
            </div>
        `;
    },
    
    getStatusIcon: function(status) {
        const icons = {
            'pass': '✓',
            'warn': '⚠',
            'fail': '✗',
            'conflict': '⚡'
        };
        return icons[status] || '•';
    },
    
    renderFinalSummary: function(result) {
        let html = '<div class="summary-section" style="margin-top: 24px;">';
        html += '<h3>最终结论</h3>';
        
        if (result.overallStatus === 'pass') {
            html += `
                <p><strong>验收结果：</strong><span class="status-pass">正常处理 ✓</span></p>
                <p><strong>当前状态：</strong>所有验证项均通过，音域匹配有效，声部容量可靠，出勤数据一致</p>
                <p><strong>处理建议：</strong>可以直接使用当前分配方案进行排练</p>
            `;
        } else if (result.overallStatus === 'warn') {
            html += `
                <p><strong>验收结果：</strong><span class="status-warning">需要关注 ⚠</span></p>
                <p><strong>当前状态：</strong>基本验证通过，但存在 ${result.summary.warn} 个警告项需要关注</p>
                <p><strong>处理建议：</strong>可以继续使用，但建议查看警告详情并在方便时进行优化</p>
            `;
        } else if (result.overallStatus === 'conflict') {
            html += `
                <p><strong>验收结果：</strong><span class="status-conflict">需要人工决策 ⚡</span></p>
                <p><strong>当前状态：</strong>存在需要人工判断的冲突问题</p>
                <p><strong>处理建议：</strong>请查看冲突详情，进行人工调整后重新运行验证</p>
            `;
        } else {
            html += `
                <p><strong>验收结果：</strong><span class="status-fail">需要修正 ✗</span></p>
                <p><strong>当前状态：</strong>存在 ${result.summary.fail} 个失败项必须修正</p>
                <p><strong>处理建议：</strong>请按验证报告逐项修复问题，修正后点击"运行验证"重新验收</p>
            `;
        }
        
        html += '</div>';
        return html;
    },
    
    showToast: function(message, type = 'info') {
        if (typeof window.app !== 'undefined' && window.app.showToast) {
            window.app.showToast(message, type);
        }
    }
};
