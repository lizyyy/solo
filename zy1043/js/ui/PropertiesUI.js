/**
 * 属性面板 UI
 * 管理右侧边栏的属性编辑面板
 */

class PropertiesUI {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.warehouse = uiManager.warehouse;
        this.selectedObject = null;
        this.isUpdating = false;
        
        this.init();
    }
    
    init() {
        this.emptyState = document.getElementById('emptyProperties');
        this.propertyForm = document.getElementById('propertyForm');
    }
    
    clear() {
        this.selectedObject = null;
        if (this.emptyState) {
            this.emptyState.classList.remove('hidden');
        }
        if (this.propertyForm) {
            this.propertyForm.classList.add('hidden');
        }
    }
    
    showObjectProperties(obj) {
        if (!obj) {
            this.clear();
            return;
        }
        
        this.selectedObject = obj;
        
        if (this.emptyState) {
            this.emptyState.classList.add('hidden');
        }
        if (this.propertyForm) {
            this.propertyForm.classList.remove('hidden');
        }
        
        this.renderPropertyForm(obj);
    }
    
    renderPropertyForm(obj) {
        if (!this.propertyForm) return;
        
        const colorHex = Utils.colorToHex(obj.color);
        
        let formHtml = `
            <div class="property-section">
                <div class="property-section-title">基本信息</div>
                <div class="property-row">
                    <label class="property-label">名称</label>
                    <input type="text" class="property-input" id="prop-name" value="${obj.name}">
                </div>
                <div class="property-row">
                    <label class="property-label">类型</label>
                    <input type="text" class="property-input" value="${Constants.OBJECT_TYPE_NAMES[obj.type] || obj.type}" disabled>
                </div>
            </div>
            
            <div class="property-section">
                <div class="property-section-title">位置和旋转</div>
                <div class="property-row-row">
                    <div class="property-row">
                        <label class="property-label">X 坐标 (m)</label>
                        <input type="number" class="property-input" id="prop-x" value="${obj.x.toFixed(2)}" step="0.1">
                    </div>
                    <div class="property-row">
                        <label class="property-label">Z 坐标 (m)</label>
                        <input type="number" class="property-input" id="prop-z" value="${obj.z.toFixed(2)}" step="0.1">
                    </div>
                </div>
                <div class="property-row">
                    <label class="property-label">旋转角度 (°)</label>
                    <input type="number" class="property-input" id="prop-rotation" value="${obj.rotation.toFixed(0)}" step="5">
                </div>
            </div>
            
            <div class="property-section">
                <div class="property-section-title">尺寸</div>
                <div class="property-row-row">
                    <div class="property-row">
                        <label class="property-label">长度 (m)</label>
                        <input type="number" class="property-input" id="prop-length" value="${obj.length.toFixed(2)}" step="0.1">
                    </div>
                    <div class="property-row">
                        <label class="property-label">宽度 (m)</label>
                        <input type="number" class="property-input" id="prop-width" value="${obj.width.toFixed(2)}" step="0.1">
                    </div>
                </div>
                <div class="property-row">
                    <label class="property-label">高度 (m)</label>
                    <input type="number" class="property-input" id="prop-height" value="${obj.height.toFixed(2)}" step="0.1">
                </div>
            </div>
            
            <div class="property-section">
                <div class="property-section-title">外观</div>
                <div class="property-row">
                    <label class="property-label">颜色</label>
                    <div class="color-input-wrapper">
                        <input type="color" id="prop-color-picker" value="${colorHex}">
                        <input type="text" class="property-input" id="prop-color" value="${colorHex}">
                    </div>
                </div>
            </div>
        `;
        
        if (obj.type === Constants.OBJECT_TYPES.SHELF) {
            formHtml += `
                <div class="property-section">
                    <div class="property-section-title">货架位配置</div>
                    <div class="property-row">
                        <label class="property-label">SKU 位置 (JSON)</label>
                        <textarea class="property-input" id="prop-slots" style="min-height: 100px; font-family: monospace; font-size: 12px;">${JSON.stringify(obj.slots || [], null, 2)}</textarea>
                        <p style="font-size: 11px; color: #666; margin-top: 4px;">格式: [{"slot": "A1", "sku": "SKU001"}, ...]</p>
                    </div>
                </div>
            `;
        }
        
        if (obj.type === Constants.OBJECT_TYPES.ENTRANCE) {
            formHtml += `
                <div class="property-section">
                    <div class="property-section-title">出入口设置</div>
                    <div class="property-row">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="prop-is-start" ${obj.isDefaultStart ? 'checked' : ''}>
                            <span class="property-label" style="margin: 0;">作为默认起点</span>
                        </label>
                    </div>
                    <div class="property-row">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="prop-is-end" ${obj.isDefaultEnd ? 'checked' : ''}>
                            <span class="property-label" style="margin: 0;">作为默认终点</span>
                        </label>
                    </div>
                </div>
            `;
        }
        
        formHtml += `
            <div class="property-section">
                <button class="toolbar-btn" id="prop-delete-btn" style="width: 100%; background-color: #ef4444;">
                    🗑️ 删除此对象
                </button>
            </div>
        `;
        
        this.propertyForm.innerHTML = formHtml;
        
        this.setupPropertyListeners();
    }
    
    setupPropertyListeners() {
        const inputs = {
            'prop-name': 'name',
            'prop-x': 'x',
            'prop-z': 'z',
            'prop-rotation': 'rotation',
            'prop-length': 'length',
            'prop-width': 'width',
            'prop-height': 'height',
            'prop-color': 'color'
        };
        
        Object.entries(inputs).forEach(([id, prop]) => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('change', () => {
                    if (this.isUpdating) return;
                    this.updateObjectProperty(prop, input.value);
                });
                
                if (input.type === 'number') {
                    input.addEventListener('input', () => {
                        if (this.isUpdating) return;
                        this.updateObjectProperty(prop, input.value);
                    });
                }
            }
        });
        
        const colorPicker = document.getElementById('prop-color-picker');
        const colorInput = document.getElementById('prop-color');
        if (colorPicker && colorInput) {
            colorPicker.addEventListener('input', () => {
                colorInput.value = colorPicker.value;
                this.updateObjectProperty('color', colorPicker.value);
            });
        }
        
        const slotsInput = document.getElementById('prop-slots');
        if (slotsInput) {
            slotsInput.addEventListener('change', () => {
                try {
                    const slots = JSON.parse(slotsInput.value);
                    this.updateObjectProperty('slots', slots);
                } catch (e) {
                    console.error('Invalid slots JSON:', e);
                }
            });
        }
        
        const isStartInput = document.getElementById('prop-is-start');
        const isEndInput = document.getElementById('prop-is-end');
        
        if (isStartInput) {
            isStartInput.addEventListener('change', () => {
                this.updateObjectProperty('isDefaultStart', isStartInput.checked);
            });
        }
        
        if (isEndInput) {
            isEndInput.addEventListener('change', () => {
                this.updateObjectProperty('isDefaultEnd', isEndInput.checked);
            });
        }
        
        const deleteBtn = document.getElementById('prop-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (this.selectedObject) {
                    this.uiManager.objectListUI.deleteObject(this.selectedObject.id);
                }
            });
        }
    }
    
    updateObjectProperty(prop, value) {
        if (!this.selectedObject) return;
        
        switch (prop) {
            case 'x':
            case 'z':
            case 'rotation':
            case 'length':
            case 'width':
            case 'height':
                this.selectedObject[prop] = parseFloat(value) || 0;
                break;
            case 'color':
                this.selectedObject.color = Utils.hexToColor(value);
                break;
            case 'slots':
                this.selectedObject.setSlots(value);
                break;
            case 'isDefaultStart':
            case 'isDefaultEnd':
                this.selectedObject[prop] = value;
                break;
            default:
                this.selectedObject[prop] = value;
        }
        
        this.uiManager.sceneManager.updateObject(this.selectedObject);
        eventBus.emit(Constants.EVENTS.OBJECT_UPDATED, this.selectedObject);
        this.uiManager.runConflictDetection();
    }
    
    updateSelectedObject() {
        if (this.selectedObject) {
            this.showObjectProperties(this.selectedObject);
        }
    }
    
    setWarehouse(warehouse) {
        this.warehouse = warehouse;
        this.clear();
    }
}
