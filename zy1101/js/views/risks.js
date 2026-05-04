const RisksView = {
    init: function() {
        this.bindEvents();
    },
    
    bindEvents: function() {
        const filterLevel = document.getElementById('filterRiskLevel');
        const filterType = document.getElementById('filterRiskType');
        
        if (filterLevel) {
            filterLevel.addEventListener('change', () => this.render());
        }
        
        if (filterType) {
            filterType.addEventListener('change', () => this.render());
        }
    },
    
    render: function() {
        this.updateFilters();
        
        const risksList = document.getElementById('risksList');
        if (!risksList) return;
        
        const risks = DataStore.risks;
        
        if (!risks || risks.length === 0) {
            risksList.innerHTML = this.renderEmptyState();
            return;
        }
        
        const selectedLevel = document.getElementById('filterRiskLevel')?.value || 'all';
        const selectedType = document.getElementById('filterRiskType')?.value || 'all';
        
        let filteredRisks = risks;
        
        if (selectedLevel !== 'all') {
            filteredRisks = filteredRisks.filter(r => r.level === selectedLevel);
        }
        
        if (selectedType !== 'all') {
            filteredRisks = filteredRisks.filter(r => r.type === selectedType);
        }
        
        if (filteredRisks.length === 0) {
            risksList.innerHTML = `
                <div class="empty-state">
                    <h3>没有找到匹配的风险</h3>
                    <p>请尝试调整筛选条件</p>
                </div>
            `;
            return;
        }
        
        risksList.innerHTML = filteredRisks.map(risk => 
            this.renderRiskCard(risk)
        ).join('');
        
        this.bindCardEvents();
    },
    
    updateFilters: function() {
        const filterType = document.getElementById('filterRiskType');
        
        if (filterType) {
            const currentValue = filterType.value;
            const types = this.getRiskTypes();
            filterType.innerHTML = '<option value="all">全部类型</option>' +
                types.map(t => `<option value="${t}">${RiskDetector.getTypeText(t)}</option>`).join('');
            filterType.value = currentValue;
        }
    },
    
    getRiskTypes: function() {
        const types = new Set();
        DataStore.risks.forEach(r => {
            if (r.type) types.add(r.type);
        });
        return Array.from(types);
    },
    
    renderEmptyState: function() {
        return `
            <div class="empty-state">
                <h3>🎉 暂无风险</h3>
                <p>当前没有检测到任何风险，材料管理状况良好！</p>
            </div>
        `;
    },
    
    renderRiskCard: function(risk) {
        const levelClass = this.getLevelClass(risk.level);
        const levelText = RiskDetector.getLevelText(risk.level);
        const typeIcon = RiskDetector.getTypeIcon(risk.type);
        const typeText = RiskDetector.getTypeText(risk.type);
        
        return `
            <div class="risk-card" data-risk-id="${risk.id}">
                <div class="risk-card-header">
                    <h3>
                        <span>${typeIcon}</span>
                        ${risk.title}
                    </h3>
                    <span class="risk-level ${levelClass}">${levelText}</span>
                </div>
                <div class="risk-card-body">
                    <div class="risk-summary">
                        ${risk.summary}
                    </div>
                    ${this.renderKeyInfo(risk)}
                    <div style="margin-top: 16px; text-align: right;">
                        <button class="btn btn-sm btn-secondary view-risk-detail" data-risk-id="${risk.id}">
                            查看计算详情
                        </button>
                    </div>
                </div>
            </div>
        `;
    },
    
    renderKeyInfo: function(risk) {
        if (!risk.details) return '';
        
        const keys = Object.keys(risk.details);
        if (keys.length === 0) return '';
        
        const displayKeys = keys.filter(k => {
            const value = risk.details[k];
            return value !== undefined && value !== null && value !== '';
        }).slice(0, 4);
        
        if (displayKeys.length === 0) return '';
        
        return `
            <div class="risk-key-info">
                ${displayKeys.map(key => {
                    const label = this.getKeyLabel(key);
                    const value = this.formatKeyValue(key, risk.details[key]);
                    return `
                        <div class="key-info-item">
                            <div class="key-label">${label}</div>
                            <div class="key-value">${value}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },
    
    getKeyLabel: function(key) {
        const labels = {
            batches: '批次数量',
            colorNos: '色号数量',
            purchaseCount: '采购笔数',
            isCriticalMaterial: '材料类型',
            originalArea: '原始面积',
            currentArea: '当前面积',
            areaIncrease: '面积增加',
            shortage: '短缺量',
            unit: '单位',
            totalRequired: '总需求',
            totalPurchased: '已采购',
            surplus: '过剩量',
            surplusPercentage: '过剩比例',
            batchNo: '批次号',
            quantity: '数量',
            purchaseDate: '采购日期',
            expiryDate: '到期日期',
            daysUntilExpiry: '剩余天数',
            isAdhesive: '材料类型',
            isAccessory: '材料类型',
            shortagePercentage: '短缺比例',
            affectedRooms: '受影响房间'
        };
        return labels[key] || key;
    },
    
    formatKeyValue: function(key, value) {
        if (key === 'isCriticalMaterial') {
            return value ? '关键材料' : '普通材料';
        }
        if (key === 'isAdhesive') {
            return value ? '胶水类' : '其他';
        }
        if (key === 'isAccessory') {
            return value ? '辅料类' : '其他';
        }
        if (key === 'affectedRooms' && Array.isArray(value)) {
            return value.join(', ');
        }
        if (key === 'surplusPercentage' || key === 'shortagePercentage') {
            return Utils.formatNumber(value) + '%';
        }
        if (key === 'purchaseDate' || key === 'expiryDate') {
            return Utils.formatDate(value);
        }
        if (key === 'daysUntilExpiry') {
            return value + ' 天';
        }
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        if (typeof value === 'number') {
            return Utils.formatNumber(value);
        }
        return String(value);
    },
    
    getLevelClass: function(level) {
        switch (level) {
            case 'high': return 'risk-level-high';
            case 'medium': return 'risk-level-medium';
            case 'low': return 'risk-level-low';
            default: return 'risk-level-low';
        }
    },
    
    bindCardEvents: function() {
        document.querySelectorAll('.risk-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('view-risk-detail') || 
                    e.target.closest('.view-risk-detail')) {
                    return;
                }
                const riskId = card.dataset.riskId;
                this.showRiskDetail(riskId);
            });
        });
        
        document.querySelectorAll('.view-risk-detail').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const riskId = btn.dataset.riskId;
                this.showRiskDetail(riskId);
            });
        });
    },
    
    showRiskDetail: function(riskId) {
        const risk = DataStore.risks.find(r => r.id === riskId);
        if (!risk) return;
        
        const modalContent = this.buildRiskDetailModal(risk);
        Modal.show(modalContent);
    },
    
    buildRiskDetailModal: function(risk) {
        const levelText = RiskDetector.getLevelText(risk.level);
        const levelClass = this.getLevelClass(risk.level);
        const typeIcon = RiskDetector.getTypeIcon(risk.type);
        const typeText = RiskDetector.getTypeText(risk.type);
        
        let calculationSection = '';
        if (risk.calculation && risk.calculation.steps) {
            calculationSection = `
                <div class="calculation-section">
                    <h4>🧮 计算过程</h4>
                    ${risk.calculation.steps.map(step => `
                        <div class="calculation-step">
                            <span class="step-label">${step.label}</span>
                            <span class="step-value">${step.value}</span>
                        </div>
                        ${step.detail ? `
                            <div style="font-size: 11px; color: #64748b; padding-bottom: 8px; border-bottom: 1px dashed #e2e8f0;">
                                ${step.detail}
                            </div>
                        ` : ''}
                    `).join('')}
                </div>
            `;
        }
        
        let relatedPurchasesSection = '';
        if (risk.purchases && risk.purchases.length > 0) {
            relatedPurchasesSection = `
                <div class="calculation-section">
                    <h4>📦 相关采购记录</h4>
                    <div class="batch-details">
                        ${risk.purchases.map((p, index) => `
                            <div class="batch-item">
                                <div class="batch-item-header">
                                    <span class="batch-name">${p.batchNo || '批次 ' + (index + 1)}</span>
                                    ${p.colorNo ? `<span class="batch-color">色号: ${p.colorNo}</span>` : ''}
                                </div>
                                <div class="batch-item-details">
                                    <span>数量: ${Utils.formatNumber(p.quantity)} ${p.unit || ''}</span>
                                    ${p.purchaseDate ? `<span>采购日期: ${Utils.formatDate(p.purchaseDate)}</span>` : ''}
                                    ${p.expiryDate ? `<span>到期日期: ${Utils.formatDate(p.expiryDate)}</span>` : ''}
                                    ${p.supplier ? `<span>供应商: ${p.supplier}</span>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        let changesSection = '';
        if (risk.changes && risk.changes.length > 0) {
            changesSection = `
                <div class="calculation-section">
                    <h4>📐 相关尺寸变更</h4>
                    <div class="change-history">
                        ${risk.changes.map((change, index) => `
                            <div class="change-item">
                                <div class="change-item-header">
                                    <span class="change-reason">${change.reason || '变更 ' + (index + 1)}</span>
                                    <span class="change-date">${Utils.formatDate(change.changeDate)}</span>
                                </div>
                                <div class="change-item-details">
                                    ${change.originalArea > 0 ? `<span>原面积: ${Utils.formatNumber(change.originalArea)} ㎡</span>` : ''}
                                    ${change.newArea > 0 ? `<span>新面积: ${Utils.formatNumber(change.newArea)} ㎡</span>` : ''}
                                    ${change.areaDifference !== undefined && change.areaDifference !== 0 ? `
                                        <span style="color: ${change.areaDifference > 0 ? '#ef4444' : '#22c55e'}">
                                            面积变化: ${change.areaDifference > 0 ? '+' : ''}${Utils.formatNumber(change.areaDifference)} ㎡
                                        </span>
                                    ` : ''}
                                    ${change.materialName ? `<span>涉及材料: ${change.materialName}</span>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        let expiryWarningSection = '';
        if (risk.type === 'expiry_soon' && risk.purchase) {
            const daysLeft = risk.details?.daysUntilExpiry;
            let urgencyText = '';
            if (daysLeft <= 30) {
                urgencyText = '紧急：请尽快使用，避免浪费！';
            } else if (daysLeft <= 60) {
                urgencyText = '注意：请在近期内优先使用。';
            } else {
                urgencyText = '建议：提前规划使用时间。';
            }
            
            expiryWarningSection = `
                <div class="calculation-section">
                    <div class="expiry-warning">
                        <span class="warning-icon">⏰</span>
                        <div class="warning-content">
                            <div class="warning-title">临期材料提醒</div>
                            <div class="warning-details">${urgencyText}</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        let roomMaterialSection = '';
        if (risk.roomMaterial) {
            const rm = risk.roomMaterial;
            roomMaterialSection = `
                <div class="calculation-section">
                    <h4>🏠 房间材料详情</h4>
                    <div class="calculation-step">
                        <span class="step-label">房间</span>
                        <span class="step-value">${rm.roomName}</span>
                    </div>
                    <div class="calculation-step">
                        <span class="step-label">材料</span>
                        <span class="step-value">${rm.materialName}</span>
                    </div>
                    <div class="calculation-step">
                        <span class="step-label">需求量</span>
                        <span class="step-value">${Utils.formatNumber(rm.totalRequired)} ${rm.unit}</span>
                    </div>
                    <div class="calculation-step">
                        <span class="step-label">已采购</span>
                        <span class="step-value">${Utils.formatNumber(rm.totalPurchased)} ${rm.unit}</span>
                    </div>
                    <div class="calculation-total ${rm.shortage > 0 ? 'total-shortage' : rm.surplus > 0 ? 'total-surplus' : ''}">
                        <span class="total-label">${rm.shortage > 0 ? '缺口' : rm.surplus > 0 ? '剩余' : '状态'}</span>
                        <span class="total-value">
                            ${rm.shortage > 0 ? '-' + Utils.formatNumber(rm.shortage) : 
                              rm.surplus > 0 ? '+' + Utils.formatNumber(rm.surplus) : '平衡'}
                            ${rm.unit}
                        </span>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="modal-header">
                <h2>${typeIcon} 风险详情 - ${risk.title}</h2>
                <button class="modal-close" onclick="Modal.close()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="calculation-details">
                    <div class="calculation-section">
                        <h4>📋 风险概述</h4>
                        <div class="calculation-step">
                            <span class="step-label">风险类型</span>
                            <span class="step-value">${typeText}</span>
                        </div>
                        <div class="calculation-step">
                            <span class="step-label">风险等级</span>
                            <span class="step-value"><span class="risk-level ${levelClass}">${levelText}</span></span>
                        </div>
                        <div class="calculation-step">
                            <span class="step-label">风险描述</span>
                            <span class="step-value" style="text-align: left; flex: 1;">${risk.summary}</span>
                        </div>
                    </div>
                    
                    ${expiryWarningSection}
                    ${calculationSection}
                    ${roomMaterialSection}
                    ${relatedPurchasesSection}
                    ${changesSection}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Modal.close()">关闭</button>
            </div>
        `;
    }
};

window.RisksView = RisksView;
