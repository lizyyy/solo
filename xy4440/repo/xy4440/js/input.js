/**
 * 输入处理模块
 */

(function() {
    const KEYS = window.constants.KEYS;
    const MOUSE_BUTTONS = window.constants.MOUSE_BUTTONS;
    const OBJECT_TYPE = window.constants.OBJECT_TYPE;

// 输入管理器类
class InputManager {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.game = game;
        this.keys = {};
        this.mouse = { x: 0, y: 0, buttons: {} };
        this.selectedObject = null;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.pathMode = false;
        this.tempPath = [];
        
        this.setupEventListeners();
    }
    
    // 设置事件监听器
    setupEventListeners() {
        // 键盘事件
        window.addEventListener('keydown', (e) => {
            this.keys[e.keyCode] = true;
            this.handleKeyPress(e);
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.keyCode] = false;
        });
        
        // 鼠标事件
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
            this.mouse.buttons[e.button] = true;
            
            this.handleMouseDown(e);
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
            
            this.handleMouseMove(e);
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            this.mouse.buttons[e.button] = false;
            this.handleMouseUp(e);
        });
        
        this.canvas.addEventListener('mouseleave', (e) => {
            this.mouse.buttons = {};
            this.isDragging = false;
        });
        
        // 上下文菜单
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleContextMenu(e);
        });
        
        // 触摸事件
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = touch.clientX - rect.left;
            this.mouse.y = touch.clientY - rect.top;
            this.mouse.buttons[MOUSE_BUTTONS.LEFT] = true;
            
            this.handleMouseDown({ button: MOUSE_BUTTONS.LEFT });
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = touch.clientX - rect.left;
            this.mouse.y = touch.clientY - rect.top;
            
            this.handleMouseMove(e);
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.mouse.buttons[MOUSE_BUTTONS.LEFT] = false;
            this.handleMouseUp({ button: MOUSE_BUTTONS.LEFT });
        });
    }
    
    // 处理键盘按键
    handleKeyPress(e) {
        // 方向键控制选中对象
        if (this.selectedObject && this.selectedObject.type === OBJECT_TYPE.BOAT) {
            const moveSpeed = 5;
            
            if (this.keys[KEYS.UP] || this.keys[KEYS.W]) {
                this.selectedObject.y -= moveSpeed;
            }
            if (this.keys[KEYS.DOWN] || this.keys[KEYS.S]) {
                this.selectedObject.y += moveSpeed;
            }
            if (this.keys[KEYS.LEFT] || this.keys[KEYS.A]) {
                this.selectedObject.x -= moveSpeed;
            }
            if (this.keys[KEYS.RIGHT] || this.keys[KEYS.D]) {
                this.selectedObject.x += moveSpeed;
            }
        }
        
        // 删除键删除选中对象
        if (e.keyCode === 46 && this.selectedObject) {
            // 只允许删除救援绳
            if (this.selectedObject.type === OBJECT_TYPE.ROPE) {
                this.game.removeObject(this.selectedObject);
                this.selectedObject = null;
                this.updateSelectedObjectInfo();
            }
        }
        
        // 空格键开始/暂停游戏
        if (e.keyCode === KEYS.SPACE) {
            // 暂不处理，由游戏按钮控制
        }
        
        // ESC键取消选择
        if (e.keyCode === KEYS.ESC) {
            this.cancelSelection();
        }
    }
    
    // 处理鼠标按下
    handleMouseDown(e) {
        const { x, y } = this.mouse;
        const button = e.button;
        
        // 左键点击
        if (button === MOUSE_BUTTONS.LEFT) {
            // 如果在路径模式，添加路径点
            if (this.pathMode && this.selectedObject && this.selectedObject.type === OBJECT_TYPE.BOAT) {
                this.tempPath.push({ x, y });
                this.selectedObject.setPath([...this.tempPath]);
                return;
            }
            
            // 查找点击的对象
            const clickedObject = this.getObjectAtPosition(x, y);
            
            if (clickedObject) {
                // 如果点击了对象
                this.selectObject(clickedObject);
                this.isDragging = true;
                this.dragStartX = x;
                this.dragStartY = y;
            } else {
                // 如果点击了空白处，取消选择
                this.cancelSelection();
            }
        }
        
        // 右键点击
        if (button === MOUSE_BUTTONS.RIGHT) {
            // 如果选择了救援艇，开始路径规划模式
            if (this.selectedObject && this.selectedObject.type === OBJECT_TYPE.BOAT) {
                this.pathMode = !this.pathMode;
                if (!this.pathMode) {
                    this.tempPath = [];
                }
            }
        }
    }
    
    // 处理鼠标移动
    handleMouseMove(e) {
        const { x, y } = this.mouse;
        
        // 拖拽对象
        if (this.isDragging && this.selectedObject) {
            // 只有救援艇和救援绳可以拖拽
            if (this.selectedObject.type === OBJECT_TYPE.BOAT || 
                this.selectedObject.type === OBJECT_TYPE.ROPE) {
                const deltaX = x - this.dragStartX;
                const deltaY = y - this.dragStartY;
                
                if (this.selectedObject.type === OBJECT_TYPE.BOAT) {
                    this.selectedObject.x += deltaX;
                    this.selectedObject.y += deltaY;
                } else if (this.selectedObject.type === OBJECT_TYPE.ROPE) {
                    // 拖拽救援绳的终点
                    this.selectedObject.endX = x;
                    this.selectedObject.endY = y;
                }
                
                this.dragStartX = x;
                this.dragStartY = y;
            }
        }
    }
    
    // 处理鼠标释放
    handleMouseUp(e) {
        const button = e.button;
        
        if (button === MOUSE_BUTTONS.LEFT) {
            this.isDragging = false;
        }
    }
    
    // 处理右键菜单
    handleContextMenu(e) {
        // 这里可以实现右键菜单功能
    }
    
    // 获取指定位置的对象
    getObjectAtPosition(x, y) {
        // 逆序检查，确保最上面的对象被选中
        const allObjects = [
            ...this.game.ropes,
            ...this.game.boats,
            ...this.game.students,
            ...this.game.safeZones,
            ...this.game.shallows,
            ...this.game.rivers
        ];
        
        for (const obj of allObjects) {
            if (obj.type === OBJECT_TYPE.ROPE) {
                // 救援绳的检测特殊处理
                if (obj.distanceToPoint(x, y) < 10) {
                    return obj;
                }
            } else if (obj.containsPoint(x, y)) {
                return obj;
            }
        }
        
        return null;
    }
    
    // 选择对象
    selectObject(obj) {
        // 取消之前的选择
        if (this.selectedObject) {
            this.selectedObject.isSelected = false;
        }
        
        // 选中新对象
        this.selectedObject = obj;
        obj.isSelected = true;
        
        // 更新选中对象信息
        this.updateSelectedObjectInfo();
        
        // 发射事件
        this.game.emit('objectSelected', obj);
    }
    
    // 取消选择
    cancelSelection() {
        if (this.selectedObject) {
            this.selectedObject.isSelected = false;
            this.selectedObject = null;
        }
        
        this.pathMode = false;
        this.tempPath = [];
        
        // 更新选中对象信息
        this.updateSelectedObjectInfo();
        
        // 发射事件
        this.game.emit('objectDeselected');
    }
    
    // 更新选中对象信息
    updateSelectedObjectInfo() {
        const infoElement = document.getElementById('selected-object-info');
        
        if (!this.selectedObject) {
            infoElement.innerHTML = '<p>未选中任何对象</p>';
            return;
        }
        
        let html = '';
        
        switch (this.selectedObject.type) {
            case OBJECT_TYPE.BOAT:
                html = `
                    <h4>救援艇: ${this.selectedObject.name}</h4>
                    <p>位置: (${Math.round(this.selectedObject.x)}, ${Math.round(this.selectedObject.y)})</p>
                    <p>能量: ${Math.round(this.selectedObject.energy)}/${this.selectedObject.maxEnergy}</p>
                    <p>乘客: ${this.selectedObject.passengers.length}/${this.selectedObject.maxPassengers}</p>
                    <p>速度: ${Math.round(Math.sqrt(this.selectedObject.velocityX ** 2 + this.selectedObject.velocityY ** 2))}</p>
                    <p style="font-style: italic; color: #666;">右键点击开始路径规划，左键添加路径点</p>
                `;
                break;
                
            case OBJECT_TYPE.STUDENT:
                html = `
                    <h4>学员: ${this.selectedObject.name}</h4>
                    <p>位置: (${Math.round(this.selectedObject.x)}, ${Math.round(this.selectedObject.y)})</p>
                    <p>健康: ${Math.round(this.selectedObject.health)}/${this.selectedObject.maxHealth}</p>
                    <p>状态: ${this.selectedObject.isRescued ? '已救援' : '待救援'}</p>
                    <p>危险: ${this.selectedObject.isInDanger ? '是' : '否'}</p>
                    ${this.selectedObject.rescuedBy ? `<p>救援者: ${this.selectedObject.rescuedBy}</p>` : ''}
                `;
                break;
                
            case OBJECT_TYPE.ROPE:
                html = `
                    <h4>救援绳</h4>
                    <p>起点: (${Math.round(this.selectedObject.startX)}, ${Math.round(this.selectedObject.startY)})</p>
                    <p>终点: (${Math.round(this.selectedObject.endX)}, ${Math.round(this.selectedObject.endY)})</p>
                    <p>长度: ${Math.round(this.selectedObject.length)}</p>
                    <p style="font-style: italic; color: #666;">按 Delete 键删除</p>
                `;
                break;
                
            case OBJECT_TYPE.SAFE_ZONE:
                html = `
                    <h4>安全区</h4>
                    <p>中心: (${Math.round(this.selectedObject.centerX)}, ${Math.round(this.selectedObject.centerY)})</p>
                    <p>半径: ${this.selectedObject.radius}</p>
                `;
                break;
                
            case OBJECT_TYPE.SHALLOW:
                html = `
                    <h4>浅滩</h4>
                    <p>位置: (${Math.round(this.selectedObject.x)}, ${Math.round(this.selectedObject.y)})</p>
                    <p>大小: ${this.selectedObject.width} x ${this.selectedObject.height}</p>
                    <p>减速因子: ${this.selectedObject.slowFactor}</p>
                `;
                break;
                
            case OBJECT_TYPE.RIVER:
                html = `
                    <h4>河流</h4>
                    <p>位置: (${Math.round(this.selectedObject.x)}, ${Math.round(this.selectedObject.y)})</p>
                    <p>大小: ${this.selectedObject.width} x ${this.selectedObject.height}</p>
                    <p>流向: ${this.selectedObject.flowDirection}°</p>
                    <p>流速: ${this.selectedObject.flowSpeed}</p>
                `;
                break;
        }
        
        infoElement.innerHTML = html;
    }
    
    // 检查按键是否按下
    isKeyPressed(keyCode) {
        return this.keys[keyCode] === true;
    }
    
    // 检查鼠标按钮是否按下
    isMouseButtonPressed(button) {
        return this.mouse.buttons[button] === true;
    }
    
    // 获取鼠标位置
    getMousePosition() {
        return { ...this.mouse };
    }
    
    // 重置输入状态
    reset() {
        this.keys = {};
        this.mouse = { x: 0, y: 0, buttons: {} };
        this.selectedObject = null;
        this.isDragging = false;
        this.pathMode = false;
        this.tempPath = [];
    }
}

// 导出模块
window.input = {
    InputManager
};
})();