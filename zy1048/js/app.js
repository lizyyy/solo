class StickerLayoutApp {
    constructor() {
        this.canvas = null;
        this.materials = [];
        this.canvasItems = [];
        this.selectedItem = null;
        this.history = [];
        this.historyIndex = -1;
        this.snapMode = 'none';
        this.issues = [];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupCanvas();
        this.loadDefaultSettings();
        this.addHistory('新建工程');
    }
    
    setupEventListeners() {
        // 画布尺寸选择
        document.getElementById('canvas-size-select').addEventListener('change', (e) => {
            const customGroup = document.getElementById('custom-size-group');
            if (e.target.value === 'custom') {
                customGroup.style.display = 'flex';
            } else {
                customGroup.style.display = 'none';
                this.setStandardSize(e.target.value);
            }
        });
        
        // 应用画布设置
        document.getElementById('apply-canvas-settings').addEventListener('click', () => {
            this.applyCanvasSettings();
        });
        
        // 吸附模式
        document.getElementById('snap-mode').addEventListener('change', (e) => {
            this.snapMode = e.target.value;
            this.updateGrid();
        });
        
        // 素材导入
        document.getElementById('import-materials').addEventListener('click', () => {
            document.getElementById('material-input').click();
        });
        
        document.getElementById('material-input').addEventListener('change', (e) => {
            this.importMaterials(e.target.files);
        });
        
        // 文字标签
        document.getElementById('add-text-label').addEventListener('click', () => {
            this.addTextLabel();
        });
        
        // 属性面板关闭
        document.getElementById('close-properties').addEventListener('click', () => {
            this.hidePropertiesPanel();
        });
        
        // 属性面板操作
        document.getElementById('prop-layer-up').addEventListener('click', () => {
            this.moveLayerUp();
        });
        
        document.getElementById('prop-layer-down').addEventListener('click', () => {
            this.moveLayerDown();
        });
        
        document.getElementById('prop-delete').addEventListener('click', () => {
            this.deleteSelectedItem();
        });
        
        // 属性输入框事件
        this.setupPropertyInputs();
        
        // 保存/加载草稿
        document.getElementById('save-project').addEventListener('click', () => {
            this.saveProjectToLocalStorage();
        });
        
        document.getElementById('load-project').addEventListener('click', () => {
            this.loadProjectFromLocalStorage();
        });
        
        // 新建工程
        document.getElementById('new-project').addEventListener('click', () => {
            if (confirm('确定要新建工程吗？当前未保存的修改将会丢失。')) {
                this.newProject();
            }
        });
        
        // JSON 导入导出
        document.getElementById('export-json').addEventListener('click', () => {
            this.exportJSON();
        });
        
        document.getElementById('import-json').addEventListener('click', () => {
            this.triggerJSONImport();
        });
        
        // 问题检查
        document.getElementById('run-checks').addEventListener('click', () => {
            this.runAllChecks();
        });
        
        // 撤销/重做
        document.getElementById('undo').addEventListener('click', () => {
            this.undo();
        });
        
        document.getElementById('redo').addEventListener('click', () => {
            this.redo();
        });
        
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });
        
        // 点击画布空白处取消选择
        document.getElementById('canvas-container').addEventListener('click', (e) => {
            if (e.target.id === 'canvas-container' || e.target.classList.contains('canvas-content')) {
                this.deselectAll();
            }
        });
    }
    
    setupPropertyInputs() {
        const inputs = ['prop-name', 'prop-notes', 'prop-x', 'prop-y', 'prop-width', 'prop-height', 'prop-rotation', 'prop-opacity'];
        
        inputs.forEach(id => {
            const input = document.getElementById(id);
            input.addEventListener('change', () => {
                if (this.selectedItem) {
                    this.updateItemFromProperties();
                }
            });
            
            if (id === 'prop-opacity') {
                input.addEventListener('input', () => {
                    if (this.selectedItem) {
                        this.selectedItem.element.style.opacity = input.value / 100;
                    }
                });
            }
        });
    }
    
    setupCanvas() {
        this.canvas = {
            width: 210, // mm
            height: 297, // mm
            bleed: 3, // mm
            safeMargin: 5, // mm
            scale: 2 // px per mm (缩放比例)
        };
        
        this.renderCanvas();
    }
    
    loadDefaultSettings() {
        document.getElementById('snap-mode').value = this.snapMode;
        document.getElementById('bleed-size').value = this.canvas.bleed;
        document.getElementById('safe-margin').value = this.canvas.safeMargin;
    }
    
    setStandardSize(size) {
        const sizes = {
            'A4': { width: 210, height: 297 },
            'A5': { width: 148, height: 210 }
        };
        
        if (sizes[size]) {
            document.getElementById('canvas-width').value = sizes[size].width;
            document.getElementById('canvas-height').value = sizes[size].height;
        }
    }
    
    applyCanvasSettings() {
        const sizeSelect = document.getElementById('canvas-size-select').value;
        
        if (sizeSelect === 'custom') {
            this.canvas.width = parseInt(document.getElementById('canvas-width').value);
            this.canvas.height = parseInt(document.getElementById('canvas-height').value);
        } else {
            this.setStandardSize(sizeSelect);
            this.canvas.width = parseInt(document.getElementById('canvas-width').value);
            this.canvas.height = parseInt(document.getElementById('canvas-height').value);
        }
        
        this.canvas.bleed = parseInt(document.getElementById('bleed-size').value);
        this.canvas.safeMargin = parseInt(document.getElementById('safe-margin').value);
        this.snapMode = document.getElementById('snap-mode').value;
        
        this.renderCanvas();
        this.updateGrid();
        this.addHistory('修改画布设置');
        this.runAllChecks();
    }
    
    renderCanvas() {
        const container = document.getElementById('canvas-container');
        
        // 计算像素尺寸
        const pxWidth = this.canvas.width * this.canvas.scale;
        const pxHeight = this.canvas.height * this.canvas.scale;
        const blexPx = this.canvas.bleed * this.canvas.scale;
        const safePx = this.canvas.safeMargin * this.canvas.scale;
        
        // 设置容器尺寸
        container.style.width = `${pxWidth + blexPx * 2}px`;
        container.style.height = `${pxHeight + blexPx * 2}px`;
        container.style.padding = `${blexPx}px`;
        container.style.backgroundColor = '#fff';
        
        // 清空容器
        container.innerHTML = '';
        
        // 创建出血线区域
        const bleedArea = document.createElement('div');
        bleedArea.className = 'bleed-area';
        container.appendChild(bleedArea);
        
        // 创建安全区
        const safeArea = document.createElement('div');
        safeArea.className = 'safe-area';
        safeArea.style.top = `${safePx}px`;
        safeArea.style.left = `${safePx}px`;
        safeArea.style.right = `${safePx}px`;
        safeArea.style.bottom = `${safePx}px`;
        safeArea.style.width = `auto`;
        safeArea.style.height = `auto`;
        container.appendChild(safeArea);
        
        // 创建内容区域
        const contentArea = document.createElement('div');
        contentArea.className = 'canvas-content';
        contentArea.id = 'canvas-content';
        contentArea.style.width = `${pxWidth}px`;
        contentArea.style.height = `${pxHeight}px`;
        contentArea.style.position = 'relative';
        container.appendChild(contentArea);
        
        // 重新添加已有的画布项
        this.canvasItems.forEach(item => {
            this.renderCanvasItem(item);
        });
    }
    
    updateGrid() {
        // 移除现有的网格
        const existingGrid = document.querySelector('.grid-overlay');
        if (existingGrid) {
            existingGrid.remove();
        }
        
        // 如果启用网格对齐，添加网格覆盖层
        if (this.snapMode === 'grid' || this.snapMode === 'both') {
            const grid = document.createElement('div');
            grid.className = 'grid-overlay';
            document.getElementById('canvas-container').appendChild(grid);
        }
    }
    
    importMaterials(files) {
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const material = {
                    id: this.generateId(),
                    name: file.name,
                    type: file.type.includes('svg') ? 'svg' : 'image',
                    data: e.target.result,
                    createdAt: new Date().toISOString()
                };
                
                this.materials.push(material);
                this.renderMaterialItem(material);
                this.addHistory(`导入素材: ${material.name}`);
            };
            
            reader.readAsDataURL(file);
        });
        
        // 清空文件输入
        document.getElementById('material-input').value = '';
    }
    
    renderMaterialItem(material) {
        const list = document.getElementById('materials-list');
        
        const item = document.createElement('div');
        item.className = 'material-item';
        item.dataset.id = material.id;
        item.draggable = true;
        
        // 预览
        const preview = document.createElement('div');
        preview.className = 'material-preview';
        
        if (material.type === 'svg') {
            const img = document.createElement('img');
            img.src = material.data;
            img.alt = material.name;
            preview.appendChild(img);
        } else {
            const img = document.createElement('img');
            img.src = material.data;
            img.alt = material.name;
            preview.appendChild(img);
        }
        
        // 名称
        const name = document.createElement('div');
        name.className = 'material-name';
        name.textContent = material.name;
        
        item.appendChild(preview);
        item.appendChild(name);
        
        // 拖拽事件
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({
                type: 'material',
                id: material.id
            }));
        });
        
        // 双击添加到画布
        item.addEventListener('dblclick', () => {
            this.addMaterialToCanvas(material);
        });
        
        list.appendChild(item);
    }
    
    addMaterialToCanvas(material) {
        const canvasItem = {
            id: this.generateId(),
            materialId: material.id,
            type: material.type,
            name: material.name,
            notes: '',
            data: material.data,
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            rotation: 0,
            opacity: 100,
            zIndex: this.canvasItems.length + 1
        };
        
        this.canvasItems.push(canvasItem);
        this.renderCanvasItem(canvasItem);
        this.selectItem(canvasItem);
        this.addHistory(`添加素材: ${canvasItem.name}`);
        this.runAllChecks();
        
        return canvasItem;
    }
    
    addTextLabel() {
        const textInput = document.getElementById('text-label-input');
        const text = textInput.value.trim();
        
        if (!text) {
            alert('请输入文字内容');
            return;
        }
        
        const fontSize = parseInt(document.getElementById('text-size-input').value);
        const color = document.getElementById('text-color-input').value;
        
        const canvasItem = {
            id: this.generateId(),
            type: 'text',
            name: `文字: ${text}`,
            notes: '',
            text: text,
            fontSize: fontSize,
            color: color,
            x: 50,
            y: 50,
            width: text.length * fontSize * 0.6 + 20,
            height: fontSize + 10,
            rotation: 0,
            opacity: 100,
            zIndex: this.canvasItems.length + 1
        };
        
        this.canvasItems.push(canvasItem);
        this.renderCanvasItem(canvasItem);
        this.selectItem(canvasItem);
        this.addHistory(`添加文字: ${text}`);
        this.runAllChecks();
        
        // 清空输入
        textInput.value = '';
    }
    
    renderCanvasItem(item) {
        const contentArea = document.getElementById('canvas-content');
        if (!contentArea) return;
        
        // 移除已存在的元素
        const existing = document.getElementById(`canvas-item-${item.id}`);
        if (existing) {
            existing.remove();
        }
        
        const element = document.createElement('div');
        element.className = 'canvas-item';
        element.id = `canvas-item-${item.id}`;
        element.dataset.id = item.id;
        
        // 设置样式
        element.style.left = `${item.x * this.canvas.scale}px`;
        element.style.top = `${item.y * this.canvas.scale}px`;
        element.style.width = `${item.width * this.canvas.scale}px`;
        element.style.height = `${item.height * this.canvas.scale}px`;
        element.style.transform = `rotate(${item.rotation}deg)`;
        element.style.opacity = item.opacity / 100;
        element.style.zIndex = item.zIndex;
        
        // 添加内容
        if (item.type === 'text') {
            const textDiv = document.createElement('div');
            textDiv.className = 'text-item';
            textDiv.textContent = item.text;
            textDiv.style.fontSize = `${item.fontSize * this.canvas.scale}px`;
            textDiv.style.color = item.color;
            element.appendChild(textDiv);
        } else {
            const img = document.createElement('img');
            img.src = item.data;
            img.alt = item.name;
            element.appendChild(img);
        }
        
        // 添加调整手柄
        this.addResizeHandles(element, item);
        this.addRotateHandle(element, item);
        
        // 事件监听
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectItem(item);
        });
        
        element.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('resize-handle') || e.target.classList.contains('rotate-handle')) {
                return;
            }
            this.startDrag(e, item);
        });
        
        contentArea.appendChild(element);
        item.element = element;
    }
    
    addResizeHandles(element, item) {
        const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        
        handles.forEach(position => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${position}`;
            handle.dataset.position = position;
            
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startResize(e, item, position);
            });
            
            element.appendChild(handle);
        });
    }
    
    addRotateHandle(element, item) {
        const line = document.createElement('div');
        line.className = 'rotate-center-line';
        element.appendChild(line);
        
        const handle = document.createElement('div');
        handle.className = 'rotate-handle';
        
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.startRotate(e, item);
        });
        
        element.appendChild(handle);
    }
    
    startDrag(e, item) {
        this.selectItem(item);
        
        const startX = e.clientX;
        const startY = e.clientY;
        const startItemX = item.x;
        const startItemY = item.y;
        
        const onMouseMove = (moveEvent) => {
            const dx = (moveEvent.clientX - startX) / this.canvas.scale;
            const dy = (moveEvent.clientY - startY) / this.canvas.scale;
            
            item.x = startItemX + dx;
            item.y = startItemY + dy;
            
            // 吸附对齐
            if (this.snapMode === 'grid' || this.snapMode === 'both') {
                item.x = Math.round(item.x / 5) * 5;
                item.y = Math.round(item.y / 5) * 5;
            }
            
            if (this.snapMode === 'object' || this.snapMode === 'both') {
                this.snapToObjects(item);
            }
            
            this.updateItemPosition(item);
        };
        
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            this.addHistory(`移动: ${item.name}`);
            this.runAllChecks();
            this.saveState();
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }
    
    startResize(e, item, position) {
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = item.width;
        const startHeight = item.height;
        const startXPos = item.x;
        const startYPos = item.y;
        
        // 保持宽高比
        const aspectRatio = startWidth / startHeight;
        
        const onMouseMove = (moveEvent) => {
            const dx = (moveEvent.clientX - startX) / this.canvas.scale;
            const dy = (moveEvent.clientY - startY) / this.canvas.scale;
            
            let newWidth = startWidth;
            let newHeight = startHeight;
            let newX = startXPos;
            let newY = startYPos;
            
            // 根据手柄位置调整
            switch (position) {
                case 'e':
                    newWidth = Math.max(20, startWidth + dx);
                    break;
                case 'w':
                    newWidth = Math.max(20, startWidth - dx);
                    newX = startXPos + startWidth - newWidth;
                    break;
                case 's':
                    newHeight = Math.max(20, startHeight + dy);
                    break;
                case 'n':
                    newHeight = Math.max(20, startHeight - dy);
                    newY = startYPos + startHeight - newHeight;
                    break;
                case 'se':
                    newWidth = Math.max(20, startWidth + dx);
                    newHeight = Math.max(20, startHeight + dy);
                    break;
                case 'sw':
                    newWidth = Math.max(20, startWidth - dx);
                    newHeight = Math.max(20, startHeight + dy);
                    newX = startXPos + startWidth - newWidth;
                    break;
                case 'ne':
                    newWidth = Math.max(20, startWidth + dx);
                    newHeight = Math.max(20, startHeight - dy);
                    newY = startYPos + startHeight - newHeight;
                    break;
                case 'nw':
                    newWidth = Math.max(20, startWidth - dx);
                    newHeight = Math.max(20, startHeight - dy);
                    newX = startXPos + startWidth - newWidth;
                    newY = startYPos + startHeight - newHeight;
                    break;
            }
            
            item.width = newWidth;
            item.height = newHeight;
            item.x = newX;
            item.y = newY;
            
            this.updateItemSize(item);
        };
        
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            this.addHistory(`调整大小: ${item.name}`);
            this.runAllChecks();
            this.saveState();
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }
    
    startRotate(e, item) {
        const centerX = e.clientX;
        const centerY = e.clientY;
        const startRotation = item.rotation;
        
        // 计算中心点相对于画布的位置
        const element = item.element;
        const rect = element.getBoundingClientRect();
        const itemCenterX = rect.left + rect.width / 2;
        const itemCenterY = rect.top + rect.height / 2;
        
        const onMouseMove = (moveEvent) => {
            const angle1 = Math.atan2(centerY - itemCenterY, centerX - itemCenterX);
            const angle2 = Math.atan2(moveEvent.clientY - itemCenterY, moveEvent.clientX - itemCenterX);
            const angleDiff = (angle2 - angle1) * (180 / Math.PI);
            
            item.rotation = Math.round((startRotation + angleDiff) / 5) * 5;
            this.updateItemRotation(item);
        };
        
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            this.addHistory(`旋转: ${item.name}`);
            this.saveState();
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }
    
    updateItemPosition(item) {
        if (item.element) {
            item.element.style.left = `${item.x * this.canvas.scale}px`;
            item.element.style.top = `${item.y * this.canvas.scale}px`;
        }
        
        // 更新属性面板
        if (this.selectedItem === item) {
            document.getElementById('prop-x').value = Math.round(item.x);
            document.getElementById('prop-y').value = Math.round(item.y);
        }
    }
    
    updateItemSize(item) {
        if (item.element) {
            item.element.style.width = `${item.width * this.canvas.scale}px`;
            item.element.style.height = `${item.height * this.canvas.scale}px`;
            item.element.style.left = `${item.x * this.canvas.scale}px`;
            item.element.style.top = `${item.y * this.canvas.scale}px`;
        }
        
        // 更新属性面板
        if (this.selectedItem === item) {
            document.getElementById('prop-width').value = Math.round(item.width);
            document.getElementById('prop-height').value = Math.round(item.height);
            document.getElementById('prop-x').value = Math.round(item.x);
            document.getElementById('prop-y').value = Math.round(item.y);
        }
    }
    
    updateItemRotation(item) {
        if (item.element) {
            item.element.style.transform = `rotate(${item.rotation}deg)`;
        }
        
        // 更新属性面板
        if (this.selectedItem === item) {
            document.getElementById('prop-rotation').value = item.rotation;
        }
    }
    
    snapToObjects(item) {
        const snapThreshold = 5; // mm
        let snapped = false;
        
        this.canvasItems.forEach(other => {
            if (other.id === item.id) return;
            
            // 检查对齐点
            const edges = [
                { itemEdge: item.x, otherEdge: other.x },
                { itemEdge: item.x + item.width, otherEdge: other.x + other.width },
                { itemEdge: item.x, otherEdge: other.x + other.width },
                { itemEdge: item.x + item.width, otherEdge: other.x }
            ];
            
            edges.forEach(edge => {
                if (Math.abs(edge.itemEdge - edge.otherEdge) < snapThreshold) {
                    item.x += edge.otherEdge - edge.itemEdge;
                    snapped = true;
                }
            });
            
            // Y轴
            const yEdges = [
                { itemEdge: item.y, otherEdge: other.y },
                { itemEdge: item.y + item.height, otherEdge: other.y + other.height },
                { itemEdge: item.y, otherEdge: other.y + other.height },
                { itemEdge: item.y + item.height, otherEdge: other.y }
            ];
            
            yEdges.forEach(edge => {
                if (Math.abs(edge.itemEdge - edge.otherEdge) < snapThreshold) {
                    item.y += edge.otherEdge - edge.itemEdge;
                    snapped = true;
                }
            });
        });
    }
    
    selectItem(item) {
        // 取消之前的选择
        if (this.selectedItem && this.selectedItem.element) {
            this.selectedItem.element.classList.remove('selected');
        }
        
        this.selectedItem = item;
        
        if (item.element) {
            item.element.classList.add('selected');
        }
        
        // 显示属性面板
        this.showPropertiesPanel(item);
    }
    
    deselectAll() {
        if (this.selectedItem && this.selectedItem.element) {
            this.selectedItem.element.classList.remove('selected');
        }
        
        this.selectedItem = null;
        this.hidePropertiesPanel();
    }
    
    showPropertiesPanel(item) {
        const panel = document.getElementById('properties-panel');
        panel.style.display = 'block';
        
        // 填充属性
        document.getElementById('prop-name').value = item.name || '';
        document.getElementById('prop-notes').value = item.notes || '';
        document.getElementById('prop-x').value = Math.round(item.x);
        document.getElementById('prop-y').value = Math.round(item.y);
        document.getElementById('prop-width').value = Math.round(item.width);
        document.getElementById('prop-height').value = Math.round(item.height);
        document.getElementById('prop-rotation').value = item.rotation;
        document.getElementById('prop-opacity').value = item.opacity;
    }
    
    hidePropertiesPanel() {
        document.getElementById('properties-panel').style.display = 'none';
    }
    
    updateItemFromProperties() {
        if (!this.selectedItem) return;
        
        const item = this.selectedItem;
        
        item.name = document.getElementById('prop-name').value;
        item.notes = document.getElementById('prop-notes').value;
        item.x = parseFloat(document.getElementById('prop-x').value) || 0;
        item.y = parseFloat(document.getElementById('prop-y').value) || 0;
        item.width = parseFloat(document.getElementById('prop-width').value) || 100;
        item.height = parseFloat(document.getElementById('prop-height').value) || 100;
        item.rotation = parseFloat(document.getElementById('prop-rotation').value) || 0;
        item.opacity = parseFloat(document.getElementById('prop-opacity').value) || 100;
        
        this.renderCanvasItem(item);
        this.runAllChecks();
    }
    
    moveLayerUp() {
        if (!this.selectedItem) return;
        
        const index = this.canvasItems.findIndex(item => item.id === this.selectedItem.id);
        if (index < this.canvasItems.length - 1) {
            const temp = this.canvasItems[index];
            this.canvasItems[index] = this.canvasItems[index + 1];
            this.canvasItems[index + 1] = temp;
            
            // 更新 zIndex
            this.updateZIndexes();
            this.addHistory(`上移一层: ${this.selectedItem.name}`);
        }
    }
    
    moveLayerDown() {
        if (!this.selectedItem) return;
        
        const index = this.canvasItems.findIndex(item => item.id === this.selectedItem.id);
        if (index > 0) {
            const temp = this.canvasItems[index];
            this.canvasItems[index] = this.canvasItems[index - 1];
            this.canvasItems[index - 1] = temp;
            
            // 更新 zIndex
            this.updateZIndexes();
            this.addHistory(`下移一层: ${this.selectedItem.name}`);
        }
    }
    
    updateZIndexes() {
        this.canvasItems.forEach((item, index) => {
            item.zIndex = index + 1;
            if (item.element) {
                item.element.style.zIndex = item.zIndex;
            }
        });
    }
    
    deleteSelectedItem() {
        if (!this.selectedItem) return;
        
        const itemName = this.selectedItem.name;
        const index = this.canvasItems.findIndex(item => item.id === this.selectedItem.id);
        
        if (index !== -1) {
            if (this.selectedItem.element) {
                this.selectedItem.element.remove();
            }
            
            this.canvasItems.splice(index, 1);
            this.hidePropertiesPanel();
            this.addHistory(`删除: ${itemName}`);
            this.runAllChecks();
        }
    }
    
    runAllChecks() {
        this.issues = [];
        
        // 检查 1: 素材越过安全区
        this.checkSafeArea();
        
        // 检查 2: 两个裁切边太近
        this.checkCloseEdges();
        
        // 检查 3: 素材没有命名
        this.checkNames();
        
        // 检查 4: 颜色/工艺备注漏填
        this.checkNotes();
        
        // 检查 5: 素材越界
        this.checkOutOfBounds();
        
        this.renderIssues();
    }
    
    checkSafeArea() {
        const safeLeft = this.canvas.safeMargin;
        const safeRight = this.canvas.width - this.canvas.safeMargin;
        const safeTop = this.canvas.safeMargin;
        const safeBottom = this.canvas.height - this.canvas.safeMargin;
        
        this.canvasItems.forEach(item => {
            const itemLeft = item.x;
            const itemRight = item.x + item.width;
            const itemTop = item.y;
            const itemBottom = item.y + item.height;
            
            // 检查是否有部分在安全区外
            if (itemLeft < safeLeft || itemRight > safeRight || itemTop < safeTop || itemBottom > safeBottom) {
                this.issues.push({
                    type: 'warning',
                    title: '素材越过安全区',
                    description: `"${item.name}" 部分内容在安全区外，打印时可能被裁切。建议将素材移至安全区内。`,
                    itemId: item.id
                });
            }
        });
    }
    
    checkCloseEdges() {
        const minDistance = 3; // mm
        
        for (let i = 0; i < this.canvasItems.length; i++) {
            for (let j = i + 1; j < this.canvasItems.length; j++) {
                const item1 = this.canvasItems[i];
                const item2 = this.canvasItems[j];
                
                // 计算水平距离
                const hDistance = Math.min(
                    Math.abs(item1.x + item1.width - item2.x),
                    Math.abs(item2.x + item2.width - item1.x),
                    Math.abs(item1.x - item2.x),
                    Math.abs(item1.x + item1.width - item2.x - item2.width)
                );
                
                // 计算垂直距离
                const vDistance = Math.min(
                    Math.abs(item1.y + item1.height - item2.y),
                    Math.abs(item2.y + item2.height - item1.y),
                    Math.abs(item1.y - item2.y),
                    Math.abs(item1.y + item1.height - item2.y - item2.height)
                );
                
                // 检查是否重叠或太近
                const overlap = !(item1.x + item1.width < item2.x || 
                                 item2.x + item2.width < item1.x || 
                                 item1.y + item1.height < item2.y || 
                                 item2.y + item2.height < item1.y);
                
                if (overlap) {
                    this.issues.push({
                        type: 'error',
                        title: '素材重叠',
                        description: `"${item1.name}" 和 "${item2.name}" 互相重叠，这会影响裁切和打印。`,
                        itemId: item1.id
                    });
                } else if (hDistance < minDistance && vDistance < 100) {
                    this.issues.push({
                        type: 'warning',
                        title: '裁切边太近',
                        description: `"${item1.name}" 和 "${item2.name}" 水平距离只有 ${hDistance.toFixed(1)}mm，建议至少 ${minDistance}mm 以便裁切。`,
                        itemId: item1.id
                    });
                } else if (vDistance < minDistance && hDistance < 100) {
                    this.issues.push({
                        type: 'warning',
                        title: '裁切边太近',
                        description: `"${item1.name}" 和 "${item2.name}" 垂直距离只有 ${vDistance.toFixed(1)}mm，建议至少 ${minDistance}mm 以便裁切。`,
                        itemId: item1.id
                    });
                }
            }
        }
    }
    
    checkNames() {
        this.canvasItems.forEach(item => {
            if (!item.name || item.name.trim() === '' || 
                (item.name.startsWith('文字: ') && item.name.length <= 4)) {
                this.issues.push({
                    type: 'info',
                    title: '素材未命名',
                    description: `"${item.name || '未命名素材'}" 没有明确的名称。建议给素材命名以便印厂识别。`,
                    itemId: item.id
                });
            }
        });
    }
    
    checkNotes() {
        this.canvasItems.forEach(item => {
            if (!item.notes || item.notes.trim() === '') {
                this.issues.push({
                    type: 'info',
                    title: '工艺备注缺失',
                    description: `"${item.name}" 没有填写颜色/工艺备注。如果有特殊工艺要求（如 UV 烫金、白墨等），请填写备注。`,
                    itemId: item.id
                });
            }
        });
    }
    
    checkOutOfBounds() {
        this.canvasItems.forEach(item => {
            const itemRight = item.x + item.width;
            const itemBottom = item.y + item.height;
            
            if (item.x < 0 || item.y < 0 || itemRight > this.canvas.width || itemBottom > this.canvas.height) {
                this.issues.push({
                    type: 'error',
                    title: '素材越界',
                    description: `"${item.name}" 部分内容在画布边界外，这部分内容将无法打印。`,
                    itemId: item.id
                });
            }
        });
    }
    
    renderIssues() {
        const list = document.getElementById('issues-list');
        const summary = document.getElementById('check-summary');
        
        list.innerHTML = '';
        
        // 更新摘要
        const errorCount = this.issues.filter(i => i.type === 'error').length;
        const warningCount = this.issues.filter(i => i.type === 'warning').length;
        const infoCount = this.issues.filter(i => i.type === 'info').length;
        
        summary.innerHTML = `
            <div class="check-item">
                <span class="check-icon">${errorCount > 0 ? '❌' : '✅'}</span>
                <span>错误: ${errorCount}</span>
            </div>
            <div class="check-item">
                <span class="check-icon">${warningCount > 0 ? '⚠️' : '✅'}</span>
                <span>警告: ${warningCount}</span>
            </div>
            <div class="check-item">
                <span class="check-icon">💡</span>
                <span>提示: ${infoCount}</span>
            </div>
        `;
        
        // 渲染问题列表
        this.issues.forEach((issue, index) => {
            const item = document.createElement('div');
            item.className = `issue-item ${issue.type}`;
            item.dataset.itemId = issue.itemId;
            
            item.innerHTML = `
                <div class="issue-title">${issue.title}</div>
                <div class="issue-description">${issue.description}</div>
            `;
            
            item.addEventListener('click', () => {
                const item = this.canvasItems.find(i => i.id === issue.itemId);
                if (item) {
                    this.selectItem(item);
                    if (item.element) {
                        item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            });
            
            list.appendChild(item);
        });
    }
    
    addHistory(action) {
        // 清除未来的历史
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // 保存当前状态
        const state = {
            action: action,
            timestamp: new Date().toISOString(),
            canvas: JSON.parse(JSON.stringify(this.canvas)),
            canvasItems: JSON.parse(JSON.stringify(this.canvasItems)),
            materials: JSON.parse(JSON.stringify(this.materials))
        };
        
        this.history.push(state);
        this.historyIndex = this.history.length - 1;
        
        // 限制历史记录数量
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
        
        this.renderHistory();
    }
    
    saveState() {
        // 用于在操作后保存状态到历史
    }
    
    renderHistory() {
        const list = document.getElementById('history-list');
        list.innerHTML = '';
        
        this.history.forEach((state, index) => {
            const item = document.createElement('div');
            item.className = 'history-item';
            if (index === this.historyIndex) {
                item.style.backgroundColor = '#e3f2fd';
                item.style.fontWeight = '500';
            }
            
            item.textContent = state.action;
            item.addEventListener('click', () => {
                this.goToHistory(index);
            });
            
            list.appendChild(item);
        });
        
        // 滚动到底部
        list.scrollTop = list.scrollHeight;
    }
    
    goToHistory(index) {
        if (index < 0 || index >= this.history.length) return;
        
        const state = this.history[index];
        this.historyIndex = index;
        
        // 恢复状态
        this.canvas = JSON.parse(JSON.stringify(state.canvas));
        this.canvasItems = JSON.parse(JSON.stringify(state.canvasItems));
        this.materials = JSON.parse(JSON.stringify(state.materials));
        
        // 重新渲染
        this.renderCanvas();
        this.renderMaterials();
        this.renderHistory();
        this.runAllChecks();
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.goToHistory(this.historyIndex - 1);
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.goToHistory(this.historyIndex + 1);
        }
    }
    
    renderMaterials() {
        const list = document.getElementById('materials-list');
        list.innerHTML = '';
        
        this.materials.forEach(material => {
            this.renderMaterialItem(material);
        });
    }
    
    handleKeyboard(e) {
        // 删除键
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                this.deleteSelectedItem();
            }
        }
        
        // Ctrl/Cmd + Z 撤销
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            this.undo();
        }
        
        // Ctrl/Cmd + Shift + Z 重做
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
            e.preventDefault();
            this.redo();
        }
        
        // Ctrl/Cmd + S 保存
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.saveProjectToLocalStorage();
        }
        
        // 方向键移动
        if (this.selectedItem) {
            const moveAmount = e.shiftKey ? 10 : 1;
            
            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    this.selectedItem.y -= moveAmount;
                    this.updateItemPosition(this.selectedItem);
                    this.runAllChecks();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.selectedItem.y += moveAmount;
                    this.updateItemPosition(this.selectedItem);
                    this.runAllChecks();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.selectedItem.x -= moveAmount;
                    this.updateItemPosition(this.selectedItem);
                    this.runAllChecks();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.selectedItem.x += moveAmount;
                    this.updateItemPosition(this.selectedItem);
                    this.runAllChecks();
                    break;
            }
        }
    }
    
    saveProjectToLocalStorage() {
        const project = {
            version: '1.0',
            savedAt: new Date().toISOString(),
            canvas: this.canvas,
            canvasItems: this.canvasItems,
            materials: this.materials
        };
        
        try {
            localStorage.setItem('stickerLayoutProject', JSON.stringify(project));
            alert('草稿已保存到本地存储');
            this.addHistory('保存草稿');
        } catch (e) {
            alert('保存失败: ' + e.message);
        }
    }
    
    loadProjectFromLocalStorage() {
        try {
            const saved = localStorage.getItem('stickerLayoutProject');
            if (!saved) {
                alert('没有找到已保存的草稿');
                return;
            }
            
            const project = JSON.parse(saved);
            
            // 确认加载
            if (confirm(`找到 ${project.savedAt} 保存的草稿，确定要加载吗？当前未保存的修改将会丢失。`)) {
                this.canvas = project.canvas;
                this.canvasItems = project.canvasItems || [];
                this.materials = project.materials || [];
                
                // 重新渲染
                this.renderCanvas();
                this.renderMaterials();
                this.loadDefaultSettings();
                
                this.history = [];
                this.historyIndex = -1;
                this.addHistory('加载草稿');
                this.runAllChecks();
            }
        } catch (e) {
            alert('加载失败: ' + e.message);
        }
    }
    
    newProject() {
        this.canvas = {
            width: 210,
            height: 297,
            bleed: 3,
            safeMargin: 5,
            scale: 2
        };
        
        this.canvasItems = [];
        this.materials = [];
        this.selectedItem = null;
        this.history = [];
        this.historyIndex = -1;
        
        this.renderCanvas();
        document.getElementById('materials-list').innerHTML = '';
        this.hidePropertiesPanel();
        this.addHistory('新建工程');
        this.runAllChecks();
    }
    
    exportJSON() {
        const project = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            canvas: this.canvas,
            canvasItems: this.canvasItems,
            materials: this.materials
        };
        
        const jsonStr = JSON.stringify(project, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `sticker-layout-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.addHistory('导出工程 JSON');
    }
    
    triggerJSONImport() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const project = JSON.parse(ev.target.result);
                    
                    if (confirm('确定要导入这个工程吗？当前未保存的修改将会丢失。')) {
                        this.canvas = project.canvas;
                        this.canvasItems = project.canvasItems || [];
                        this.materials = project.materials || [];
                        
                        this.renderCanvas();
                        this.renderMaterials();
                        this.loadDefaultSettings();
                        
                        this.history = [];
                        this.historyIndex = -1;
                        this.addHistory('导入工程');
                        this.runAllChecks();
                    }
                } catch (err) {
                    alert('导入失败: ' + err.message);
                }
            };
            
            reader.readAsText(file);
        });
        
        input.click();
    }
    
    generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    }
}

// 初始化应用
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new StickerLayoutApp();
});
