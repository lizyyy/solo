const App = {
    currentTab: 'rooms',
    
    init: function() {
        DataStore.init();
        this.initViews();
        this.bindEvents();
        this.render();
    },
    
    initViews: function() {
        RoomsView.init();
        MaterialsView.init();
        RisksView.init();
        ReportsView.init();
    },
    
    bindEvents: function() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });
        
        const btnImport = document.getElementById('btnImport');
        const btnExport = document.getElementById('btnExport');
        const btnSaveDraft = document.getElementById('btnSaveDraft');
        const fileInput = document.getElementById('fileInput');
        const btnRecalculate = document.getElementById('btnRecalculate');
        
        if (btnImport) {
            btnImport.addEventListener('click', () => {
                this.showImportModal();
            });
        }
        
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                ImportExport.downloadJSON();
            });
        }
        
        if (btnSaveDraft) {
            btnSaveDraft.addEventListener('click', () => {
                this.saveDraft();
            });
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileUpload(e.target.files[0]);
                    e.target.value = '';
                }
            });
        }
        
        if (btnRecalculate) {
            btnRecalculate.addEventListener('click', () => {
                DataStore.recalculate();
                this.render();
                this.showNotification('✅ 重新计算完成');
            });
        }
    },
    
    switchTab: function(tab) {
        this.currentTab = tab;
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        document.querySelectorAll('.view-container').forEach(view => {
            view.classList.add('hidden');
        });
        
        const viewElement = document.getElementById(`view-${tab}`);
        if (viewElement) {
            viewElement.classList.remove('hidden');
        }
        
        this.renderCurrentView();
    },
    
    renderCurrentView: function() {
        switch (this.currentTab) {
            case 'rooms':
                RoomsView.render();
                break;
            case 'materials':
                MaterialsView.render();
                break;
            case 'risks':
                RisksView.render();
                break;
            case 'reports':
                ReportsView.render();
                break;
        }
    },
    
    render: function() {
        this.renderCurrentView();
    },
    
    showImportModal: function() {
        const modalContent = `
            <div class="modal-header">
                <h2>📁 导入数据</h2>
                <button class="modal-close" onclick="Modal.close()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 24px;">
                    <h3 style="margin-bottom: 12px; font-size: 16px;">支持的文件格式</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                        <div style="padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <div style="font-weight: 600; margin-bottom: 8px;">📄 JSON 文件</div>
                            <div style="font-size: 12px; color: #64748b;">
                                包含所有数据的完整导出文件
                            </div>
                        </div>
                        <div style="padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <div style="font-weight: 600; margin-bottom: 8px;">📊 CSV 文件</div>
                            <div style="font-size: 12px; color: #64748b;">
                                rooms.csv, materials.csv, purchases.csv, changes.csv
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 24px;">
                    <h3 style="margin-bottom: 12px; font-size: 16px;">选择文件</h3>
                    <div style="text-align: center; padding: 40px; border: 2px dashed #e2e8f0; border-radius: 8px; cursor: pointer;" 
                         onclick="document.getElementById('modalFileInput').click()">
                        <div style="font-size: 48px; margin-bottom: 12px;">📁</div>
                        <div style="font-weight: 600; margin-bottom: 4px;">点击选择文件或拖拽到此处</div>
                        <div style="font-size: 12px; color: #64748b;">支持 .json 和 .csv 格式</div>
                    </div>
                    <input type="file" id="modalFileInput" accept=".json,.csv" style="display: none;">
                </div>
                
                <div style="background: #dbeafe; padding: 16px; border-radius: 8px;">
                    <div style="font-weight: 600; margin-bottom: 8px;">💡 使用示例数据</div>
                    <div style="font-size: 13px; color: #1e40af; margin-bottom: 12px;">
                        想快速体验功能？点击下方按钮加载示例数据。
                    </div>
                    <button class="btn btn-primary" onclick="App.loadSampleData()">
                        🔧 加载示例数据
                    </button>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Modal.close()">取消</button>
            </div>
        `;
        
        Modal.show(modalContent);
        
        setTimeout(() => {
            const modalFileInput = document.getElementById('modalFileInput');
            if (modalFileInput) {
                modalFileInput.addEventListener('change', (e) => {
                    if (e.target.files.length > 0) {
                        Modal.close();
                        this.handleFileUpload(e.target.files[0]);
                    }
                });
            }
        }, 100);
    },
    
    async handleFileUpload(file) {
        try {
            const result = await ImportExport.importFromFile(file);
            
            if (result.type === 'json') {
                DataStore.importData(result.data);
                this.showNotification('✅ JSON 数据导入成功');
            } else if (result.type === 'csv') {
                if (result.dataType === 'rooms') {
                    DataStore.loadRooms(result.data);
                    this.showNotification('✅ 房间数据导入成功');
                } else if (result.dataType === 'materials') {
                    DataStore.loadMaterials(result.data);
                    this.showNotification('✅ 材料数据导入成功');
                } else if (result.dataType === 'purchases') {
                    DataStore.loadPurchases(result.data);
                    this.showNotification('✅ 采购数据导入成功');
                } else if (result.dataType === 'changes') {
                    DataStore.loadChanges(result.data);
                    this.showNotification('✅ 变更数据导入成功');
                } else {
                    this.showNotification('⚠️ 无法识别数据类型，请检查文件名或格式');
                    return;
                }
            }
            
            this.render();
            
        } catch (error) {
            this.showNotification('❌ 导入失败: ' + error.message);
        }
    },
    
    loadSampleData: function() {
        const sampleRooms = [
            { id: 'room_1', name: '主卧', width: 3.6, length: 4.8, height: 2.8, area: 17.28, perimeter: 16.8 },
            { id: 'room_2', name: '次卧', width: 3.2, length: 4.2, height: 2.8, area: 13.44, perimeter: 14.8 },
            { id: 'room_3', name: '客厅', width: 4.5, length: 6.0, height: 2.8, area: 27.0, perimeter: 21.0 },
            { id: 'room_4', name: '厨房', width: 2.4, length: 3.6, height: 2.8, area: 8.64, perimeter: 12.0 },
            { id: 'room_5', name: '卫生间', width: 1.8, length: 2.4, height: 2.4, area: 4.32, perimeter: 8.4 }
        ];
        
        const sampleMaterials = [
            { id: 'mat_1', name: '客厅地砖 800x800', type: '瓷砖', specification: '800mm×800mm', unitPrice: 128, unit: '㎡', lossRate: 8, coveragePerUnit: 0.64 },
            { id: 'mat_2', name: '卧室木地板', type: '地板', specification: '1218mm×198mm', unitPrice: 189, unit: '㎡', lossRate: 5, coveragePerUnit: 1 },
            { id: 'mat_3', name: '厨房墙砖 300x600', type: '瓷砖', specification: '300mm×600mm', unitPrice: 68, unit: '㎡', lossRate: 10, coveragePerUnit: 0.18 },
            { id: 'mat_4', name: '卫生间地砖 300x300', type: '瓷砖', specification: '300mm×300mm', unitPrice: 45, unit: '㎡', lossRate: 10, coveragePerUnit: 0.09 },
            { id: 'mat_5', name: '乳胶漆 白色', type: '乳胶漆', specification: '5L/桶', unitPrice: 399, unit: '桶', lossRate: 5, coverageArea: 35, hasExpiry: true, expiryDays: 730 },
            { id: 'mat_6', name: '实木踢脚线', type: '踢脚线', specification: '8cm高', unitPrice: 35, unit: '米', lossRate: 5, coveragePerUnit: 1 },
            { id: 'mat_7', name: '瓷砖背胶', type: '胶水', specification: '5kg/桶', unitPrice: 89, unit: '桶', hasExpiry: true, expiryDays: 180, isAdhesive: true },
            { id: 'mat_8', name: '填缝剂', type: '辅料', specification: '2kg/袋', unitPrice: 28, unit: '袋', hasExpiry: true, expiryDays: 365, isAccessory: true }
        ];
        
        const samplePurchases = [
            { id: 'pur_1', materialId: 'mat_1', materialName: '客厅地砖 800x800', batchNo: 'B20260101', colorNo: '浅灰A01', quantity: 25, unit: '㎡', unitPrice: 128, totalPrice: 3200, purchaseDate: '2026-01-15', supplier: '马可波罗瓷砖' },
            { id: 'pur_2', materialId: 'mat_1', materialName: '客厅地砖 800x800', batchNo: 'B20260115', colorNo: '浅灰A02', quantity: 5, unit: '㎡', unitPrice: 128, totalPrice: 640, purchaseDate: '2026-01-20', supplier: '马可波罗瓷砖' },
            { id: 'pur_3', materialId: 'mat_2', materialName: '卧室木地板', batchNo: 'F20260101', quantity: 28, unit: '㎡', unitPrice: 189, totalPrice: 5292, purchaseDate: '2026-01-18', supplier: '圣象地板' },
            { id: 'pur_4', materialId: 'mat_3', materialName: '厨房墙砖 300x600', batchNo: 'W20260105', quantity: 18, unit: '㎡', unitPrice: 68, totalPrice: 1224, purchaseDate: '2026-01-22', supplier: '东鹏瓷砖' },
            { id: 'pur_5', materialId: 'mat_4', materialName: '卫生间地砖 300x300', batchNo: 'W20260106', quantity: 4, unit: '㎡', unitPrice: 45, totalPrice: 180, purchaseDate: '2026-01-22', supplier: '东鹏瓷砖' },
            { id: 'pur_6', materialId: 'mat_5', materialName: '乳胶漆 白色', batchNo: 'P20250615', quantity: 8, unit: '桶', unitPrice: 399, totalPrice: 3192, purchaseDate: '2026-02-01', expiryDate: '2026-06-15', supplier: '多乐士' },
            { id: 'pur_7', materialId: 'mat_6', materialName: '实木踢脚线', batchNo: 'T20260110', quantity: 50, unit: '米', unitPrice: 35, totalPrice: 1750, purchaseDate: '2026-01-25', supplier: '圣象地板' },
            { id: 'pur_8', materialId: 'mat_7', materialName: '瓷砖背胶', batchNo: 'G20251201', quantity: 6, unit: '桶', unitPrice: 89, totalPrice: 534, purchaseDate: '2026-01-10', expiryDate: '2026-05-30', supplier: '德高' },
            { id: 'pur_9', materialId: 'mat_8', materialName: '填缝剂', batchNo: 'F20250801', quantity: 10, unit: '袋', unitPrice: 28, totalPrice: 280, purchaseDate: '2026-01-10', expiryDate: '2026-07-15', supplier: '德高' }
        ];
        
        const sampleChanges = [
            { id: 'chg_1', roomId: 'room_3', roomName: '客厅', changeDate: '2026-02-10', changeType: '面积增加', reason: '设计师建议扩大客厅', originalArea: 25.0, newArea: 27.0, areaDifference: 2.0, originalPerimeter: 20.0, newPerimeter: 21.0, perimeterDifference: 1.0 }
        ];
        
        DataStore.rooms = sampleRooms;
        DataStore.materials = sampleMaterials;
        DataStore.purchases = samplePurchases;
        DataStore.changes = sampleChanges;
        
        DataStore.recalculate();
        
        Modal.close();
        this.render();
        this.showNotification('✅ 示例数据加载成功！');
        
        this.switchTab('risks');
    },
    
    saveDraft: function() {
        const success = Storage.saveDraft({
            rooms: DataStore.rooms,
            materials: DataStore.materials,
            purchases: DataStore.purchases,
            changes: DataStore.changes
        });
        
        if (success) {
            this.showNotification('✅ 草稿已保存到本地');
        } else {
            this.showNotification('❌ 保存失败');
        }
    },
    
    showNotification: function(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            background: #1e293b;
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            font-size: 14px;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
};

const Modal = {
    show: function(content) {
        const container = document.getElementById('modalContainer');
        const modalContent = document.getElementById('modalContent');
        
        if (container && modalContent) {
            modalContent.innerHTML = content;
            container.classList.remove('hidden');
            
            container.addEventListener('click', (e) => {
                if (e.target === container) {
                    this.close();
                }
            });
        }
    },
    
    close: function() {
        const container = document.getElementById('modalContainer');
        if (container) {
            container.classList.add('hidden');
        }
    }
};

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

window.App = App;
window.Modal = Modal;
