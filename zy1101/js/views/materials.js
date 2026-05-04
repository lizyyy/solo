const MaterialsView = {
    init: function() {
        this.bindEvents();
    },
    
    bindEvents: function() {
        const filterType = document.getElementById('filterMaterialType2');
        const filterStatus = document.getElementById('filterStockStatus');
        
        if (filterType) {
            filterType.addEventListener('change', () => this.render());
        }
        
        if (filterStatus) {
            filterStatus.addEventListener('change', () => this.render());
        }
    },
    
    render: function() {
        this.updateFilters();
        
        const materialsList = document.getElementById('materialsList');
        if (!materialsList) return;
        
        if (!DataStore.calculatedData || DataStore.calculatedData.materialSummary.length === 0) {
            materialsList.innerHTML = this.renderEmptyState();
            return;
        }
        
        const selectedType = document.getElementById('filterMaterialType2')?.value || 'all';
        const selectedStatus = document.getElementById('filterStockStatus')?.value || 'all';
        
        let filteredSummary = DataStore.calculatedData.materialSummary;
        
        if (selectedType !== 'all') {
            filteredSummary = filteredSummary.filter(ms => ms.materialType === selectedType);
        }
        
        if (selectedStatus !== 'all') {
            filteredSummary = filteredSummary.filter(ms => {
                if (selectedStatus === 'shortage') return ms.shortage > 0;
                if (selectedStatus === 'surplus') return ms.surplus > 0;
                return ms.shortage === 0 && ms.surplus === 0;
            });
        }
        
        if (filteredSummary.length === 0) {
            materialsList.innerHTML = `
                <div class="empty-state">
                    <h3>没有找到匹配的材料</h3>
                    <p>请尝试调整筛选条件</p>
                </div>
            `;
            return;
        }
        
        materialsList.innerHTML = filteredSummary.map(ms => 
            this.renderMaterialCard(ms)
        ).join('');
        
        this.bindCardEvents();
    },
    
    updateFilters: function() {
        const filterType = document.getElementById('filterMaterialType2');
        
        if (filterType) {
            const currentValue = filterType.value;
            const types = this.getMaterialTypes();
            filterType.innerHTML = '<option value="all">全部类型</option>' +
                types.map(t => `<option value="${t}">${t}</option>`).join('');
            filterType.value = currentValue;
        }
    },
    
    getMaterialTypes: function() {
        const types = new Set();
        DataStore.materials.forEach(m => {
            if (m.type) types.add(m.type);
        });
        return Array.from(types);
    },
    
    renderEmptyState: function() {
        return `
            <div class="empty-state">
                <h3>暂无材料数据</h3>
                <p>请先导入材料和采购数据</p>
            </div>
        `;
    },
    
    renderMaterialCard: function(materialSummary) {
        const statusClass = this.getStatusClass(materialSummary);
        const statusText = this.getStatusText(materialSummary);
        
        const shortagePercentage = materialSummary.totalRequired > 0 
            ? (materialSummary.shortage / materialSummary.totalRequired) * 100 
            : 0;
        const surplusPercentage = materialSummary.totalRequired > 0 
            ? (materialSummary.surplus / materialSummary.totalRequired) * 100 
            : 0;
        
        const progressPercentage = materialSummary.totalRequired > 0 
            ? Math.min(100, (materialSummary.totalPurchased / materialSummary.totalRequired) * 100)
            : 0;
        
        let progressColor = 'green';
        if (progressPercentage < 90) progressColor = 'red';
        else if (progressPercentage > 130) progressColor = 'yellow';
        
        const purchases = materialSummary.purchases || [];
        const hasMultipleBatches = purchases.length > 1;
        const hasDifferentColors = this.hasDifferentColors(purchases);
        
        return `
            <div class="material-card" data-material-id="${materialSummary.materialId}">
                <div class="material-card-header">
                    <div>
                        <h3>${materialSummary.materialName}</h3>
                        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                            类型: ${materialSummary.materialType} | 单位: ${materialSummary.unit}
                            ${hasMultipleBatches ? ' | <span style="color: #f59e0b;">⚠️ 多批次采购</span>' : ''}
                            ${hasDifferentColors ? ' | <span style="color: #ef4444;">⚠️ 不同色号</span>' : ''}
                        </div>
                    </div>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="material-card-body">
                    <div class="material-overview">
                        <div class="overview-item">
                            <div class="overview-label">总需求量</div>
                            <div class="overview-value">${Utils.formatNumber(materialSummary.totalRequired)}</div>
                            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${materialSummary.unit}</div>
                        </div>
                        <div class="overview-item">
                            <div class="overview-label">已采购</div>
                            <div class="overview-value">${Utils.formatNumber(materialSummary.totalPurchased)}</div>
                            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${materialSummary.unit}</div>
                        </div>
                        <div class="overview-item ${materialSummary.shortage > 0 ? 'overview-shortage' : ''}">
                            <div class="overview-label">缺口</div>
                            <div class="overview-value">${Utils.formatNumber(materialSummary.shortage)}</div>
                            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
                                ${materialSummary.shortage > 0 ? `${Utils.formatNumber(shortagePercentage)}%` : ''}
                            </div>
                        </div>
                        <div class="overview-item ${materialSummary.surplus > 0 ? 'overview-surplus' : ''}">
                            <div class="overview-label">剩余</div>
                            <div class="overview-value">${Utils.formatNumber(materialSummary.surplus)}</div>
                            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
                                ${materialSummary.surplus > 0 ? `${Utils.formatNumber(surplusPercentage)}%` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <div class="progress-bar">
                        <div class="progress-bar-fill ${progressColor}" style="width: ${progressPercentage}%;"></div>
                    </div>
                    <div style="margin-top: 8px; font-size: 12px; color: #64748b; text-align: center;">
                        采购进度: ${Utils.formatNumber(progressPercentage)}%
                    </div>
                    
                    ${materialSummary.roomMaterials.length > 0 ? `
                    <div class="rooms-usage">
                        <h4>🏠 使用房间 (${materialSummary.roomMaterials.length} 个)</h4>
                        ${materialSummary.roomMaterials.map(rm => `
                            <div class="room-usage-item">
                                <div class="room-usage-info">
                                    <div class="room-usage-name">${rm.roomName}</div>
                                    <div class="room-usage-details">
                                        需求: ${Utils.formatNumber(rm.totalRequired)} ${rm.unit} | 
                                        已购: ${Utils.formatNumber(rm.totalPurchased)} ${rm.unit} |
                                        ${rm.shortage > 0 ? `缺口: ${Utils.formatNumber(rm.shortage)} ${rm.unit}` : 
                                          rm.surplus > 0 ? `剩余: ${Utils.formatNumber(rm.surplus)} ${rm.unit}` : '平衡'}
                                    </div>
                                </div>
                                <button class="btn btn-sm btn-secondary view-room-detail" 
                                        data-room-id="${rm.roomId}" 
                                        data-material-id="${rm.materialId}">
                                    查看详情
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}
                    
                    ${purchases.length > 0 ? `
                    <div class="purchases-list">
                        <h4>📦 采购批次 (${purchases.length} 笔)</h4>
                        ${purchases.map((p, index) => `
                            <div class="purchase-item">
                                <div class="purchase-info">
                                    <div class="purchase-batch">
                                        ${p.batchNo || '批次 ' + (index + 1)}
                                        ${p.colorNo ? `<span style="color: #64748b; margin-left: 8px;">色号: ${p.colorNo}</span>` : ''}
                                    </div>
                                    <div class="purchase-details">
                                        ${p.purchaseDate ? `采购日期: ${Utils.formatDate(p.purchaseDate)}` : ''}
                                        ${p.supplier ? ` | 供应商: ${p.supplier}` : ''}
                                        ${p.expiryDate ? ` | 到期: ${Utils.formatDate(p.expiryDate)}` : ''}
                                    </div>
                                </div>
                                <div class="purchase-quantity">
                                    ${Utils.formatNumber(p.quantity)} ${p.unit || materialSummary.unit}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    },
    
    hasDifferentColors: function(purchases) {
        if (purchases.length < 2) return false;
        const colors = new Set();
        purchases.forEach(p => {
            if (p.colorNo) colors.add(p.colorNo);
        });
        return colors.size > 1;
    },
    
    getStatusClass: function(ms) {
        if (ms.shortage > 0) return 'status-shortage';
        if (ms.surplus > 0) {
            const percentage = ms.totalRequired > 0 ? (ms.surplus / ms.totalRequired) * 100 : 0;
            if (percentage > 30) return 'status-surplus';
        }
        return 'status-balance';
    },
    
    getStatusText: function(ms) {
        if (ms.shortage > 0) return '库存不足';
        if (ms.surplus > 0) {
            const percentage = ms.totalRequired > 0 ? (ms.surplus / ms.totalRequired) * 100 : 0;
            if (percentage > 30) return '库存过剩';
        }
        return '库存平衡';
    },
    
    bindCardEvents: function() {
        document.querySelectorAll('.view-room-detail').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roomId = e.target.dataset.roomId;
                const materialId = e.target.dataset.materialId;
                RoomsView.showCalculationDetail(roomId, materialId);
            });
        });
    }
};

window.MaterialsView = MaterialsView;
