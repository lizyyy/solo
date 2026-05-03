/**
 * 对象列表 UI
 * 管理左侧边栏的对象列表显示
 */

class ObjectListUI {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.warehouse = uiManager.warehouse;
        this.selectedObjectId = null;
        
        this.init();
    }
    
    init() {
        this.container = document.getElementById('objectList');
        this.refresh();
    }
    
    refresh() {
        if (!this.container || !this.warehouse) return;
        
        const objects = this.warehouse.objects;
        
        if (objects.length === 0) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <div class="empty-state-text">暂无对象</div>
                    <div style="font-size: 12px; color: #666; margin-top: 8px;">点击下方按钮添加货架、货区等对象</div>
                </div>
            `;
            return;
        }
        
        const groupedObjects = {
            [Constants.OBJECT_TYPES.SHELF]: [],
            [Constants.OBJECT_TYPES.ZONE]: [],
            [Constants.OBJECT_TYPES.ENTRANCE]: [],
            [Constants.OBJECT_TYPES.FORBIDDEN]: []
        };
        
        objects.forEach(obj => {
            if (groupedObjects[obj.type]) {
                groupedObjects[obj.type].push(obj);
            }
        });
        
        let html = '';
        
        Object.entries(groupedObjects).forEach(([type, typeObjects]) => {
            if (typeObjects.length === 0) return;
            
            const typeName = Constants.OBJECT_TYPE_NAMES[type] || type;
            const icon = Constants.OBJECT_TYPE_ICONS[type] || '📦';
            
            html += `
                <div class="object-group">
                    <div class="object-group-title">${icon} ${typeName} (${typeObjects.length})</div>
                    ${typeObjects.map(obj => this.renderObjectItem(obj)).join('')}
                </div>
            `;
        });
        
        this.container.innerHTML = html;
        
        this.container.querySelectorAll('.object-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const objId = item.dataset.objId;
                if (objId) {
                    this.uiManager.interactionController.selectObject(objId);
                }
            });
            
            const deleteBtn = item.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const objId = item.dataset.objId;
                    if (objId) {
                        this.deleteObject(objId);
                    }
                });
            }
        });
    }
    
    renderObjectItem(obj) {
        const hasConflict = obj.conflicts && obj.conflicts.length > 0;
        const isSelected = obj.id === this.selectedObjectId;
        
        const classes = [
            'object-item',
            hasConflict ? 'has-conflict' : '',
            isSelected ? 'selected' : ''
        ].filter(Boolean).join(' ');
        
        const colorHex = Utils.colorToHex(obj.color);
        
        return `
            <div class="${classes}" data-obj-id="${obj.id}">
                <div class="object-icon" style="background-color: ${colorHex}20; color: ${colorHex}">
                    ${Constants.OBJECT_TYPE_ICONS[obj.type] || '📦'}
                </div>
                <div class="object-name">
                    ${obj.name}
                    ${hasConflict ? '<span style="color: #ff6b6b; font-size: 10px;"> ⚠️</span>' : ''}
                </div>
                <button class="delete-btn" style="background: none; border: none; color: #666; cursor: pointer; padding: 4px;" title="删除">✕</button>
            </div>
        `;
    }
    
    selectItem(objId) {
        this.selectedObjectId = objId;
        this.refresh();
    }
    
    deselectAll() {
        this.selectedObjectId = null;
        this.refresh();
    }
    
    deleteObject(objId) {
        const obj = this.warehouse.getObjectById(objId);
        if (!obj) return;
        
        if (confirm(`确定要删除对象 "${obj.name}" 吗？`)) {
            if (this.selectedObjectId === objId) {
                this.uiManager.interactionController.deselectAll();
            }
            
            this.warehouse.removeObject(objId);
            this.uiManager.sceneManager.removeObject(objId);
            this.uiManager.runConflictDetection();
            this.refresh();
        }
    }
    
    setWarehouse(warehouse) {
        this.warehouse = warehouse;
        this.refresh();
    }
}
