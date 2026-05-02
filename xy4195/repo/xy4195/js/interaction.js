// 交互状态管理模块
const Interaction = {
    isDragging: false,
    draggedElement: null,
    dragStartX: 0,
    dragStartY: 0,
    dragStartPos: null,
    
    // 回调函数
    onElementDrag: null,
    onElementClick: null,
    onCanvasClick: null,
    
    // 初始化交互
    init: function(canvas, appState) {
        this.setupEventListeners(canvas, appState);
    },
    
    // 设置事件监听器
    setupEventListeners: function(canvas, appState) {
        // 鼠标按下
        canvas.addEventListener('mousedown', (e) => {
            this.handleMouseDown(e, canvas, appState);
        });
        
        // 鼠标移动
        canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e, canvas, appState);
        });
        
        // 鼠标释放
        canvas.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e, canvas, appState);
        });
        
        // 鼠标离开
        canvas.addEventListener('mouseleave', (e) => {
            this.handleMouseUp(e, canvas, appState);
        });
        
        // 触摸事件支持
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY
            };
            this.handleMouseDown(mouseEvent, canvas, appState);
        });
        
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY
            };
            this.handleMouseMove(mouseEvent, canvas, appState);
        });
        
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleMouseUp({}, canvas, appState);
        });
    },
    
    // 处理鼠标按下
    handleMouseDown: function(e, canvas, appState) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 获取鼠标下的元素
        const element = Visualization.getElementAtPosition(x, y, appState.data);
        
        if (element && element.type === 'light') {
            this.isDragging = true;
            this.draggedElement = element;
            this.dragStartX = x;
            this.dragStartY = y;
            
            // 保存原始位置
            this.dragStartPos = {
                x: element.element.position.x,
                y: element.element.position.y,
                z: element.element.position.z
            };
            
            // 改变鼠标样式
            canvas.style.cursor = 'grabbing';
        } else {
            // 点击空白区域
            if (this.onCanvasClick) {
                this.onCanvasClick(x, y);
            }
        }
    },
    
    // 处理鼠标移动
    handleMouseMove: function(e, canvas, appState) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (this.isDragging && this.draggedElement) {
            // 计算位移
            const dx = x - this.dragStartX;
            const dy = y - this.dragStartY;
            
            // 转换为世界坐标位移
            const worldDx = dx / Visualization.scale;
            const worldDy = dy / Visualization.scale;
            
            // 更新位置
            if (Visualization.viewMode === 'plan') {
                // 平面图：更新X和Y
                this.draggedElement.element.position.x = this.dragStartPos.x + worldDx;
                this.draggedElement.element.position.y = this.dragStartPos.y + worldDy;
            } else {
                // 侧视图：更新X和Z
                this.draggedElement.element.position.x = this.dragStartPos.x + worldDx;
                this.draggedElement.element.position.z = this.dragStartPos.z + worldDy;
            }
            
            // 重新计算风险
            if (appState.data) {
                appState.risks = Geometry.evaluateAllRisks(appState.data);
            }
            
            // 触发重绘
            if (this.onElementDrag) {
                this.onElementDrag(this.draggedElement);
            }
            
            // 标记为已修改
            appState.modified = true;
        } else {
            // 悬停效果
            const element = Visualization.getElementAtPosition(x, y, appState.data);
            canvas.style.cursor = element ? 'grab' : 'default';
        }
    },
    
    // 处理鼠标释放
    handleMouseUp: function(e, canvas, appState) {
        if (this.isDragging && this.draggedElement) {
            // 拖拽结束
            if (this.onElementDrag) {
                this.onElementDrag(this.draggedElement, true); // true 表示完成
            }
            
            // 显示通知
            Utils.showNotification(`灯具 ${this.draggedElement.element.id} 已移动`, 'info');
        }
        
        this.isDragging = false;
        this.draggedElement = null;
        canvas.style.cursor = 'default';
    },
    
    // 键盘事件处理
    handleKeyDown: function(e, appState) {
        // 删除选中的灯具
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (appState.selectedElement && appState.selectedElement.type === 'light') {
                const lightIndex = appState.data.lights.findIndex(
                    l => l.id === appState.selectedElement.element.id
                );
                if (lightIndex !== -1) {
                    appState.data.lights.splice(lightIndex, 1);
                    appState.selectedElement = null;
                    appState.modified = true;
                    
                    // 重新计算风险
                    if (appState.data) {
                        appState.risks = Geometry.evaluateAllRisks(appState.data);
                    }
                    
                    Utils.showNotification('灯具已删除', 'info');
                    return true;
                }
            }
        }
        
        // 撤销/重做支持
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
                if (e.shiftKey) {
                    // Ctrl+Shift+Z: 重做
                    this.redo(appState);
                } else {
                    // Ctrl+Z: 撤销
                    this.undo(appState);
                }
                return true;
            }
            
            if (e.key === 'y') {
                // Ctrl+Y: 重做
                this.redo(appState);
                return true;
            }
            
            if (e.key === 's') {
                // Ctrl+S: 保存
                e.preventDefault();
                if (appState.saveScheme) {
                    appState.saveScheme();
                }
                return true;
            }
        }
        
        return false;
    },
    
    // 撤销
    undo: function(appState) {
        if (!appState.history || appState.historyIndex <= 0) {
            Utils.showNotification('没有可撤销的操作', 'warning');
            return;
        }
        
        appState.historyIndex--;
        appState.data = Utils.deepClone(appState.history[appState.historyIndex]);
        appState.modified = true;
        
        // 重新计算风险
        if (appState.data) {
            appState.risks = Geometry.evaluateAllRisks(appState.data);
        }
        
        Utils.showNotification('已撤销', 'info');
    },
    
    // 重做
    redo: function(appState) {
        if (!appState.history || appState.historyIndex >= appState.history.length - 1) {
            Utils.showNotification('没有可重做的操作', 'warning');
            return;
        }
        
        appState.historyIndex++;
        appState.data = Utils.deepClone(appState.history[appState.historyIndex]);
        appState.modified = true;
        
        // 重新计算风险
        if (appState.data) {
            appState.risks = Geometry.evaluateAllRisks(appState.data);
        }
        
        Utils.showNotification('已重做', 'info');
    },
    
    // 保存历史记录
    saveHistory: function(appState) {
        if (!appState.history) {
            appState.history = [];
            appState.historyIndex = -1;
        }
        
        // 清除重做历史
        appState.history = appState.history.slice(0, appState.historyIndex + 1);
        
        // 添加新状态
        appState.history.push(Utils.deepClone(appState.data));
        appState.historyIndex = appState.history.length - 1;
        
        // 限制历史记录数量
        if (appState.history.length > 50) {
            appState.history.shift();
            appState.historyIndex--;
        }
    },
    
    // 显示灯具属性编辑
    showLightProperties: function(light, onUpdate) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        modalTitle.textContent = `灯具属性 - ${light.id}`;
        
        modalBody.innerHTML = `
            <div class="property-group">
                <label>位置 X (米):</label>
                <input type="number" id="prop-x" value="${light.position.x}" step="0.1">
            </div>
            <div class="property-group">
                <label>位置 Y (米):</label>
                <input type="number" id="prop-y" value="${light.position.y}" step="0.1">
            </div>
            <div class="property-group">
                <label>高度 Z (米):</label>
                <input type="number" id="prop-z" value="${light.position.z}" step="0.1">
            </div>
            <div class="property-group">
                <label>水平角度 (度):</label>
                <input type="number" id="prop-angle-y" value="${light.angle.y}" step="1" min="0" max="360">
            </div>
            <div class="property-group">
                <label>倾斜角度 (度):</label>
                <input type="number" id="prop-angle-x" value="${light.angle.x}" step="1" min="0" max="90">
            </div>
            <div class="property-group">
                <label>光强 (单位):</label>
                <input type="number" id="prop-intensity" value="${light.intensity}" step="100">
            </div>
            <div class="property-group">
                <label>光束角 (度):</label>
                <input type="number" id="prop-beam" value="${light.beamAngle}" step="1" min="5" max="120">
            </div>
            <div class="property-actions">
                <button id="prop-apply" class="btn btn-primary">应用</button>
                <button id="prop-cancel" class="btn btn-secondary">取消</button>
            </div>
        `;
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .property-group {
                margin-bottom: 1rem;
            }
            .property-group label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 500;
            }
            .property-group input {
                width: 100%;
                padding: 0.5rem;
                border: 1px solid #ddd;
                border-radius: 4px;
            }
            .property-actions {
                display: flex;
                gap: 0.5rem;
                margin-top: 1.5rem;
            }
        `;
        modalBody.appendChild(style);
        
        // 绑定事件
        document.getElementById('prop-apply').onclick = () => {
            light.position.x = parseFloat(document.getElementById('prop-x').value) || 0;
            light.position.y = parseFloat(document.getElementById('prop-y').value) || 0;
            light.position.z = parseFloat(document.getElementById('prop-z').value) || 2;
            light.angle.x = parseFloat(document.getElementById('prop-angle-x').value) || 45;
            light.angle.y = parseFloat(document.getElementById('prop-angle-y').value) || 0;
            light.intensity = parseFloat(document.getElementById('prop-intensity').value) || 1000;
            light.beamAngle = parseFloat(document.getElementById('prop-beam').value) || 30;
            
            if (onUpdate) {
                onUpdate(light);
            }
            
            modal.style.display = 'none';
            Utils.showNotification('灯具属性已更新', 'success');
        };
        
        document.getElementById('prop-cancel').onclick = () => {
            modal.style.display = 'none';
        };
        
        modal.style.display = 'block';
    }
};
