const RoomsView = {
    init: function() {
        this.bindEvents();
    },
    
    bindEvents: function() {
        const filterRoom = document.getElementById('filterRoom');
        const filterMaterialType = document.getElementById('filterMaterialType');
        
        if (filterRoom) {
            filterRoom.addEventListener('change', () => this.render());
        }
        
        if (filterMaterialType) {
            filterMaterialType.addEventListener('change', () => this.render());
        }
    },
    
    render: function() {
        this.updateFilters();
        
        const roomsGrid = document.getElementById('roomsGrid');
        if (!roomsGrid) return;
        
        if (DataStore.rooms.length === 0) {
            roomsGrid.innerHTML = this.renderEmptyState();
            return;
        }
        
        const selectedRoom = document.getElementById('filterRoom')?.value || 'all';
        const selectedType = document.getElementById('filterMaterialType')?.value || 'all';
        
        let filteredRooms = DataStore.rooms;
        
        if (selectedRoom !== 'all') {
            filteredRooms = filteredRooms.filter(r => r.id === selectedRoom);
        }
        
        roomsGrid.innerHTML = filteredRooms.map(room => 
            this.renderRoomCard(room, selectedType)
        ).join('');
        
        this.bindCardEvents();
    },
    
    updateFilters: function() {
        const filterRoom = document.getElementById('filterRoom');
        const filterMaterialType = document.getElementById('filterMaterialType');
        
        if (filterRoom) {
            const currentValue = filterRoom.value;
            filterRoom.innerHTML = '<option value="all">全部房间</option>' +
                DataStore.rooms.map(r => 
                    `<option value="${r.id}">${r.name}</option>`
                ).join('');
            filterRoom.value = currentValue;
        }
        
        if (filterMaterialType) {
            const currentValue = filterMaterialType.value;
            const types = this.getMaterialTypes();
            filterMaterialType.innerHTML = '<option value="all">全部类型</option>' +
                types.map(t => `<option value="${t}">${t}</option>`).join('');
            filterMaterialType.value = currentValue;
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
                <h3>暂无房间数据</h3>
                <p>请点击顶部的 "导入数据" 按钮导入 rooms.csv 文件</p>
                <p>或者使用示例数据开始体验</p>
            </div>
        `;
    },
    
    renderRoomCard: function(room, filterType) {
        const roomMaterials = DataStore.getRoomMaterials(room.id);
        
        let filteredMaterials = roomMaterials;
        if (filterType !== 'all') {
            filteredMaterials = filteredMaterials.filter(rm => rm.materialType === filterType);
        }
        
        const changes = DataStore.getRoomChanges(room.id);
        const hasChanges = changes.length > 0;
        
        return `
            <div class="room-card" data-room-id="${room.id}">
                <div class="room-card-header">
                    <div>
                        <h3>${room.name}</h3>
                        <div class="room-meta">
                            ${room.width && room.length ? `${room.width}m × ${room.length}m = ${Utils.formatNumber(room.area)} ㎡` : ''}
                            ${hasChanges ? ' <span style="color: #f59e0b;">⚠️ 有尺寸变更</span>' : ''}
                        </div>
                    </div>
                    ${hasChanges ? `
                        <button class="btn btn-sm btn-secondary view-changes" data-room-id="${room.id}">
                            查看变更 (${changes.length})
                        </button>
                    ` : ''}
                </div>
                <div class="room-card-body">
                    ${filteredMaterials.length > 0 ? `
                        <div class="room-materials">
                            ${filteredMaterials.map(rm => this.renderMaterialItem(rm)).join('')}
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 20px; color: #64748b;">
                            暂无材料数据
                        </div>
                    `}
                </div>
            </div>
        `;
    },
    
    renderMaterialItem: function(roomMaterial) {
        const statusClass = this.getStatusClass(roomMaterial.status);
        const statusText = this.getStatusText(roomMaterial.status);
        
        return `
            <div class="material-item" data-material-id="${roomMaterial.materialId}" data-room-id="${roomMaterial.roomId}">
                <div class="material-item-header">
                    <h4>${roomMaterial.materialName}</h4>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="material-item-stats">
                    <div class="stat-item">
                        <span class="stat-label">需求量</span>
                        <span class="stat-value">${Utils.formatNumber(roomMaterial.totalRequired)} ${roomMaterial.unit}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">已采购</span>
                        <span class="stat-value">${Utils.formatNumber(roomMaterial.totalPurchased)} ${roomMaterial.unit}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">损耗率</span>
                        <span class="stat-value">${roomMaterial.lossRate || 0}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">${roomMaterial.shortage > 0 ? '缺口' : '剩余'}</span>
                        <span class="stat-value" style="color: ${roomMaterial.shortage > 0 ? '#ef4444' : roomMaterial.surplus > 0 ? '#f59e0b' : '#22c55e'}">
                            ${roomMaterial.shortage > 0 ? '-' + Utils.formatNumber(roomMaterial.shortage) : 
                              roomMaterial.surplus > 0 ? '+' + Utils.formatNumber(roomMaterial.surplus) : '0'}
                        </span>
                    </div>
                </div>
                <div style="margin-top: 12px; text-align: right;">
                    <button class="btn btn-sm btn-secondary view-detail" data-room-id="${roomMaterial.roomId}" data-material-id="${roomMaterial.materialId}">
                        查看计算详情
                    </button>
                </div>
            </div>
        `;
    },
    
    getStatusClass: function(status) {
        switch (status) {
            case 'shortage': return 'status-shortage';
            case 'surplus': return 'status-surplus';
            default: return 'status-balance';
        }
    },
    
    getStatusText: function(status) {
        switch (status) {
            case 'shortage': return '库存不足';
            case 'surplus': return '库存过剩';
            default: return '库存平衡';
        }
    },
    
    bindCardEvents: function() {
        document.querySelectorAll('.view-detail').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roomId = e.target.dataset.roomId;
                const materialId = e.target.dataset.materialId;
                this.showCalculationDetail(roomId, materialId);
            });
        });
        
        document.querySelectorAll('.view-changes').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roomId = e.target.dataset.roomId;
                this.showChangesDetail(roomId);
            });
        });
    },
    
    showCalculationDetail: function(roomId, materialId) {
        const roomMaterials = DataStore.getRoomMaterials(roomId);
        const roomMaterial = roomMaterials.find(rm => rm.materialId === materialId);
        
        if (!roomMaterial) return;
        
        const calculation = roomMaterial.calculationDetails;
        
        const modalContent = `
            <div class="modal-header">
                <h2>📊 计算详情 - ${roomMaterial.roomName} - ${roomMaterial.materialName}</h2>
                <button class="modal-close" onclick="Modal.close()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="calculation-details">
                    <div class="calculation-section">
                        <h4>📐 房间基本信息</h4>
                        <div class="calculation-step">
                            <span class="step-label">房间面积</span>
                            <span class="step-value">${Utils.formatNumber(calculation.area)} ㎡</span>
                        </div>
                        ${calculation.perimeter ? `
                        <div class="calculation-step">
                            <span class="step-label">房间周长</span>
                            <span class="step-value">${Utils.formatNumber(calculation.perimeter)} 米</span>
                        </div>
                        ` : ''}
                        ${roomMaterial.changeCount > 0 ? `
                        <div class="calculation-step">
                            <span class="step-label">尺寸变更次数</span>
                            <span class="step-value" style="color: #f59e0b;">${roomMaterial.changeCount} 次</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="calculation-section">
                        <h4>🧮 需求计算过程</h4>
                        ${calculation.steps.map(step => `
                            <div class="calculation-step">
                                <span class="step-label">${step.label}</span>
                                <span class="step-value">${step.value}</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    ${roomMaterial.purchases.length > 0 ? `
                    <div class="calculation-section">
                        <h4>📦 采购记录</h4>
                        <div class="batch-details">
                            ${roomMaterial.purchases.map(p => `
                                <div class="batch-item">
                                    <div class="batch-item-header">
                                        <span class="batch-name">${p.batchNo || '批次 ' + (roomMaterial.purchases.indexOf(p) + 1)}</span>
                                        ${p.colorNo ? `<span class="batch-color">色号: ${p.colorNo}</span>` : ''}
                                    </div>
                                    <div class="batch-item-details">
                                        <span>采购数量: ${Utils.formatNumber(p.quantity)} ${p.unit || roomMaterial.unit}</span>
                                        ${p.purchaseDate ? `<span>采购日期: ${Utils.formatDate(p.purchaseDate)}</span>` : ''}
                                        ${p.supplier ? `<span>供应商: ${p.supplier}</span>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="calculation-section">
                        <h4>📈 库存状态</h4>
                        <div class="calculation-step">
                            <span class="step-label">总需求量</span>
                            <span class="step-value">${Utils.formatNumber(roomMaterial.totalRequired)} ${roomMaterial.unit}</span>
                        </div>
                        <div class="calculation-step">
                            <span class="step-label">已采购量</span>
                            <span class="step-value">${Utils.formatNumber(roomMaterial.totalPurchased)} ${roomMaterial.unit}</span>
                        </div>
                        <div class="calculation-total ${roomMaterial.shortage > 0 ? 'total-shortage' : roomMaterial.surplus > 0 ? 'total-surplus' : ''}">
                            <span class="total-label">${roomMaterial.shortage > 0 ? '缺口量' : roomMaterial.surplus > 0 ? '剩余量' : '状态'}</span>
                            <span class="total-value">
                                ${roomMaterial.shortage > 0 ? '-' + Utils.formatNumber(roomMaterial.shortage) : 
                                  roomMaterial.surplus > 0 ? '+' + Utils.formatNumber(roomMaterial.surplus) : '平衡'}
                                ${roomMaterial.unit}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Modal.close()">关闭</button>
            </div>
        `;
        
        Modal.show(modalContent);
    },
    
    showChangesDetail: function(roomId) {
        const changes = DataStore.getRoomChanges(roomId);
        const room = DataStore.rooms.find(r => r.id === roomId);
        
        if (!room) return;
        
        const modalContent = `
            <div class="modal-header">
                <h2>📋 尺寸变更记录 - ${room.name}</h2>
                <button class="modal-close" onclick="Modal.close()">&times;</button>
            </div>
            <div class="modal-body">
                ${changes.length > 0 ? `
                    <div class="change-history">
                        ${changes.map((change, index) => `
                            <div class="change-item">
                                <div class="change-item-header">
                                    <span class="change-reason">${change.reason || '变更 ' + (index + 1)}</span>
                                    <span class="change-date">${Utils.formatDate(change.changeDate)}</span>
                                </div>
                                <div class="change-item-details">
                                    ${change.originalArea > 0 ? `<span>原面积: ${Utils.formatNumber(change.originalArea)} ㎡</span>` : ''}
                                    ${change.newArea > 0 ? `<span>新面积: ${Utils.formatNumber(change.newArea)} ㎡</span>` : ''}
                                    ${change.areaDifference !== undefined ? `
                                        <span style="color: ${change.areaDifference > 0 ? '#ef4444' : '#22c55e'}">
                                            面积变化: ${change.areaDifference > 0 ? '+' : ''}${Utils.formatNumber(change.areaDifference)} ㎡
                                        </span>
                                    ` : ''}
                                    ${change.originalPerimeter > 0 ? `<span>原周长: ${Utils.formatNumber(change.originalPerimeter)} 米</span>` : ''}
                                    ${change.newPerimeter > 0 ? `<span>新周长: ${Utils.formatNumber(change.newPerimeter)} 米</span>` : ''}
                                    ${change.materialName ? `<span>涉及材料: ${change.materialName}</span>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="empty-state">
                        <p>暂无变更记录</p>
                    </div>
                `}
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Modal.close()">关闭</button>
            </div>
        `;
        
        Modal.show(modalContent);
    }
};

window.RoomsView = RoomsView;
