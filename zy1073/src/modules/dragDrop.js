/**
 * 拖拽界面模块
 * 负责网格渲染、摊位拖拽、碰撞检测、视觉反馈
 */

export class DragDropManager {
  constructor(gameState, ruleEngine) {
    this.gameState = gameState;
    this.ruleEngine = ruleEngine;
    this.container = null;
    this.gridElement = null;
    this.stallListElement = null;
    this.cellSize = 60;
    this.margin = 2;
    
    this.draggingStall = null;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragElement = null;
    this.currentGridX = -1;
    this.currentGridY = -1;
    this.isDragging = false;
    
    this.callbacks = {
      onLayoutChange: null
    };
  }

  /**
   * 初始化拖拽界面
   * @param {HTMLElement} container - 容器元素
   * @param {HTMLElement} gridElement - 网格元素
   * @param {HTMLElement} stallListElement - 摊位列表元素
   */
  init(container, gridElement, stallListElement) {
    this.container = container;
    this.gridElement = gridElement;
    this.stallListElement = stallListElement;
    
    this.setupEventListeners();
    this.render();
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          if (this.gameState.canUndo()) {
            this.gameState.undo();
            this.render();
            this.triggerLayoutChange();
          }
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          if (this.gameState.canRedo()) {
            this.gameState.redo();
            this.render();
            this.triggerLayoutChange();
          }
        }
      }
    });
  }

  /**
   * 渲染整个界面
   */
  render() {
    if (!this.gameState.currentLevel) return;
    
    this.renderGrid();
    this.renderStallList();
    this.renderPlacedStalls();
    this.renderHighlights();
  }

  /**
   * 渲染网格
   */
  renderGrid() {
    const level = this.gameState.currentLevel;
    this.gridElement.innerHTML = '';
    
    // 设置网格大小
    const width = level.gridSize.width;
    const height = level.gridSize.height;
    
    this.gridElement.style.display = 'grid';
    this.gridElement.style.gridTemplateColumns = `repeat(${width}, ${this.cellSize}px)`;
    this.gridElement.style.gridTemplateRows = `repeat(${height}, ${this.cellSize}px)`;
    this.gridElement.style.gap = `${this.margin}px`;
    this.gridElement.style.position = 'relative';
    
    // 创建单元格
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.x = x;
        cell.dataset.y = y;
        cell.style.width = `${this.cellSize}px`;
        cell.style.height = `${this.cellSize}px`;
        cell.style.border = '1px solid #ccc';
        cell.style.boxSizing = 'border-box';
        cell.style.backgroundColor = '#f9f9f9';
        
        // 检查单元格类型
        const cellType = this.getCellType(x, y, level);
        this.applyCellStyle(cell, cellType);
        
        this.gridElement.appendChild(cell);
      }
    }
    
    // 添加网格事件
    this.setupGridEvents();
  }

  /**
   * 获取单元格类型
   */
  getCellType(x, y, level) {
    // 检查入口
    for (const entrance of level.entrances) {
      if (entrance.position.x === x && entrance.position.y === y) {
        return 'entrance';
      }
    }
    
    // 检查主路
    for (const road of level.mainRoads) {
      if (road.cells.some(c => c.x === x && c.y === y)) {
        return 'road';
      }
    }
    
    // 检查消防通道
    for (const fireExit of level.fireExits) {
      if (fireExit.cells.some(c => c.x === x && c.y === y)) {
        return 'fireExit';
      }
    }
    
    // 检查障碍物
    for (const obstacle of level.obstacles) {
      if (this.isCellInObstacle(x, y, obstacle)) {
        return 'obstacle';
      }
    }
    
    return 'empty';
  }

  /**
   * 检查单元格是否在障碍物中
   */
  isCellInObstacle(x, y, obstacle) {
    return x >= obstacle.position.x && 
           x < obstacle.position.x + obstacle.size.width &&
           y >= obstacle.position.y && 
           y < obstacle.position.y + obstacle.size.height;
  }

  /**
   * 应用单元格样式
   */
  applyCellStyle(cell, cellType) {
    switch (cellType) {
      case 'entrance':
        cell.style.backgroundColor = '#e3f2fd';
        cell.style.border = '2px dashed #2196f3';
        cell.innerHTML = '<span style="font-size: 16px;">🚪</span>';
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        cell.style.justifyContent = 'center';
        break;
        
      case 'road':
        cell.style.backgroundColor = '#fff3e0';
        cell.style.border = '1px solid #ff9800';
        break;
        
      case 'fireExit':
        cell.style.backgroundColor = '#ffebee';
        cell.style.border = '2px dashed #f44336';
        cell.innerHTML = '<span style="font-size: 12px; color: #f44336;">🔥</span>';
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        cell.style.justifyContent = 'center';
        break;
        
      case 'obstacle':
        cell.style.backgroundColor = '#9e9e9e';
        cell.style.border = '2px solid #616161';
        cell.innerHTML = '<span style="font-size: 16px;">🌳</span>';
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        cell.style.justifyContent = 'center';
        break;
        
      default:
        cell.style.cursor = 'pointer';
    }
  }

  /**
   * 设置网格事件
   */
  setupGridEvents() {
    // 鼠标事件
    this.gridElement.addEventListener('mouseenter', (e) => {
      if (this.isDragging && this.draggingStall) {
        this.showDragPreview(e);
      }
    });

    // 点击网格单元格放置摊位
    this.gridElement.addEventListener('click', (e) => {
      const cell = e.target.closest('.grid-cell');
      if (!cell) return;
      
      const x = parseInt(cell.dataset.x);
      const y = parseInt(cell.dataset.y);
      
      // 如果正在拖拽，放置摊位
      if (this.isDragging && this.draggingStall) {
        this.placeStallAtPosition(x, y);
      }
    });

    // 鼠标移动
    this.gridElement.addEventListener('mousemove', (e) => {
      if (this.isDragging && this.draggingStall) {
        this.updateDragPreview(e);
      }
    });
  }

  /**
   * 渲染摊位列表
   */
  renderStallList() {
    if (!this.stallListElement) return;
    
    const availableStalls = this.gameState.availableStalls;
    this.stallListElement.innerHTML = '';
    
    if (availableStalls.length === 0) {
      this.stallListElement.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">所有摊位已放置</p>';
      return;
    }
    
    // 按分类分组
    const categories = {};
    availableStalls.forEach(stall => {
      if (!categories[stall.category]) {
        categories[stall.category] = [];
      }
      categories[stall.category].push(stall);
    });
    
    // 渲染每个分类
    Object.entries(categories).forEach(([category, stalls]) => {
      const categoryElement = document.createElement('div');
      categoryElement.className = 'stall-category';
      categoryElement.innerHTML = `<h3 style="margin: 0 0 10px 0; padding: 5px 10px; background: #f0f0f0; border-radius: 4px;">${this.getCategoryName(category)}</h3>`;
      
      const stallsContainer = document.createElement('div');
      stallsContainer.style.display = 'flex';
      stallsContainer.style.flexWrap = 'wrap';
      stallsContainer.style.gap = '10px';
      
      stalls.forEach(stall => {
        const stallCard = this.createStallCard(stall);
        stallsContainer.appendChild(stallCard);
      });
      
      categoryElement.appendChild(stallsContainer);
      this.stallListElement.appendChild(categoryElement);
    });
  }

  /**
   * 创建摊位卡片
   */
  createStallCard(stall) {
    const card = document.createElement('div');
    card.className = 'stall-card';
    card.dataset.stallId = stall.id;
    card.style.width = `${stall.size.width * (this.cellSize / 2) + (stall.size.width - 1) * this.margin}px`;
    card.style.padding = '10px';
    card.style.backgroundColor = stall.color + '20';
    card.style.border = `2px solid ${stall.color}`;
    card.style.borderRadius = '8px';
    card.style.cursor = 'grab';
    card.style.position = 'relative';
    
    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="font-size: 24px;">${stall.emoji}</span>
        <div>
          <div style="font-weight: bold; font-size: 14px;">${stall.name}</div>
          <div style="font-size: 12px; color: #666;">${stall.categoryName}</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px;">
        <span>💰 ${stall.cost}</span>
        <span>⚡ ${stall.electricity}</span>
        <span>🔊 ${stall.noise}</span>
        <span>👃 ${stall.odor}</span>
      </div>
    `;
    
    // 拖拽事件
    card.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.startDrag(stall, e);
    });
    
    return card;
  }

  /**
   * 开始拖拽
   */
  startDrag(stall, e) {
    this.isDragging = true;
    this.draggingStall = stall;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    
    // 创建拖拽元素
    this.dragElement = document.createElement('div');
    this.dragElement.style.position = 'fixed';
    this.dragElement.style.zIndex = '9999';
    this.dragElement.style.pointerEvents = 'none';
    this.dragElement.style.opacity = '0.8';
    
    const width = stall.size.width * (this.cellSize + this.margin) - this.margin;
    const height = stall.size.height * (this.cellSize + this.margin) - this.margin;
    
    this.dragElement.style.width = `${width}px`;
    this.dragElement.style.height = `${height}px`;
    this.dragElement.style.backgroundColor = stall.color;
    this.dragElement.style.borderRadius = '8px';
    this.dragElement.style.display = 'flex';
    this.dragElement.style.alignItems = 'center';
    this.dragElement.style.justifyContent = 'center';
    this.dragElement.style.fontSize = '32px';
    this.dragElement.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    this.dragElement.innerHTML = stall.emoji;
    
    document.body.appendChild(this.dragElement);
    
    // 全局鼠标事件
    const onMouseMove = (e) => {
      if (this.dragElement) {
        this.dragElement.style.left = `${e.clientX - width/2}px`;
        this.dragElement.style.top = `${e.clientY - height/2}px`;
      }
      
      // 检查是否在网格上
      this.updateGridHighlight(e);
    };
    
    const onMouseUp = (e) => {
      // 检查是否在网格范围内
      const gridRect = this.gridElement.getBoundingClientRect();
      if (e.clientX >= gridRect.left && e.clientX <= gridRect.right &&
          e.clientY >= gridRect.top && e.clientY <= gridRect.bottom) {
        // 计算网格位置
        const gridX = Math.floor((e.clientX - gridRect.left) / (this.cellSize + this.margin));
        const gridY = Math.floor((e.clientY - gridRect.top) / (this.cellSize + this.margin));
        
        this.placeStallAtPosition(gridX, gridY);
      }
      
      this.endDrag();
      
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * 更新网格高亮
   */
  updateGridHighlight(e) {
    const gridRect = this.gridElement.getBoundingClientRect();
    const gridX = Math.floor((e.clientX - gridRect.left) / (this.cellSize + this.margin));
    const gridY = Math.floor((e.clientY - gridRect.top) / (this.cellSize + this.margin));
    
    if (gridX !== this.currentGridX || gridY !== this.currentGridY) {
      this.currentGridX = gridX;
      this.currentGridY = gridY;
      
      // 清除之前的高亮
      this.clearHighlights();
      
      // 检查是否可以放置
      const canPlace = this.ruleEngine.canPlaceStall(
        this.gameState.currentLevel,
        this.draggingStall,
        { x: gridX, y: gridY },
        this.gameState.placedStalls
      );
      
      // 高亮显示预览区域
      this.highlightPreviewArea(gridX, gridY, canPlace.canPlace);
    }
  }

  /**
   * 高亮预览区域
   */
  highlightPreviewArea(x, y, isValid) {
    if (!this.draggingStall) return;
    
    const stall = this.draggingStall;
    const cells = this.gridElement.querySelectorAll('.grid-cell');
    
    for (let dx = 0; dx < stall.size.width; dx++) {
      for (let dy = 0; dy < stall.size.height; dy++) {
        const cellX = x + dx;
        const cellY = y + dy;
        
        const cellIndex = cellY * this.gameState.currentLevel.gridSize.width + cellX;
        const cell = cells[cellIndex];
        
        if (cell) {
          cell.style.backgroundColor = isValid ? '#c8e6c9' : '#ffcdd2';
          cell.style.border = `2px solid ${isValid ? '#4caf50' : '#f44336'}`;
        }
      }
    }
  }

  /**
   * 清除高亮
   */
  clearHighlights() {
    const cells = this.gridElement.querySelectorAll('.grid-cell');
    const level = this.gameState.currentLevel;
    
    cells.forEach(cell => {
      const x = parseInt(cell.dataset.x);
      const y = parseInt(cell.dataset.y);
      const cellType = this.getCellType(x, y, level);
      this.applyCellStyle(cell, cellType);
    });
  }

  /**
   * 在指定位置放置摊位
   */
  placeStallAtPosition(x, y) {
    if (!this.draggingStall) return;
    
    const position = { x, y };
    const canPlace = this.ruleEngine.canPlaceStall(
      this.gameState.currentLevel,
      this.draggingStall,
      position,
      this.gameState.placedStalls
    );
    
    if (canPlace.canPlace) {
      this.gameState.placeStall(this.draggingStall, position);
      this.render();
      this.triggerLayoutChange();
    } else {
      // 显示错误提示
      this.showTooltip(canPlace.reason, 'error');
    }
  }

  /**
   * 结束拖拽
   */
  endDrag() {
    this.isDragging = false;
    this.draggingStall = null;
    this.currentGridX = -1;
    this.currentGridY = -1;
    
    if (this.dragElement) {
      this.dragElement.remove();
      this.dragElement = null;
    }
    
    this.clearHighlights();
  }

  /**
   * 渲染已放置的摊位
   */
  renderPlacedStalls() {
    // 移除旧的摊位元素
    const oldStalls = this.gridElement.querySelectorAll('.placed-stall');
    oldStalls.forEach(s => s.remove());
    
    // 渲染新的
    this.gameState.placedStalls.forEach(stall => {
      this.renderPlacedStall(stall);
    });
  }

  /**
   * 渲染单个已放置的摊位
   */
  renderPlacedStall(stall) {
    const stallElement = document.createElement('div');
    stallElement.className = 'placed-stall';
    stallElement.dataset.stallId = stall.id;
    
    const width = stall.size.width * (this.cellSize + this.margin) - this.margin;
    const height = stall.size.height * (this.cellSize + this.margin) - this.margin;
    
    stallElement.style.position = 'absolute';
    stallElement.style.left = `${stall.position.x * (this.cellSize + this.margin)}px`;
    stallElement.style.top = `${stall.position.y * (this.cellSize + this.margin)}px`;
    stallElement.style.width = `${width}px`;
    stallElement.style.height = `${height}px`;
    stallElement.style.backgroundColor = stall.color + 'cc';
    stallElement.style.borderRadius = '8px';
    stallElement.style.display = 'flex';
    stallElement.style.flexDirection = 'column';
    stallElement.style.alignItems = 'center';
    stallElement.style.justifyContent = 'center';
    stallElement.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    stallElement.style.cursor = 'grab';
    stallElement.style.zIndex = '10';
    stallElement.style.transition = 'transform 0.1s';
    
    stallElement.innerHTML = `
      <span style="font-size: 28px; margin-bottom: 4px;">${stall.emoji}</span>
      <span style="font-size: 11px; color: white; text-align: center; padding: 0 4px; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${stall.name}</span>
      <button class="remove-stall" style="position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 50%; border: none; background: rgba(255,0,0,0.8); color: white; font-size: 12px; cursor: pointer; padding: 0; line-height: 1;">×</button>
    `;
    
    // 移除按钮事件
    const removeBtn = stallElement.querySelector('.remove-stall');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.gameState.removeStall(stall.id);
      this.render();
      this.triggerLayoutChange();
    });
    
    // 拖拽已放置的摊位
    stallElement.addEventListener('mousedown', (e) => {
      if (e.target === removeBtn) return;
      
      e.preventDefault();
      
      // 先移除当前位置的摊位
      this.gameState.removeStall(stall.id);
      this.render();
      this.triggerLayoutChange();
      
      // 开始拖拽
      this.startDrag(stall, e);
    });
    
    this.gridElement.appendChild(stallElement);
  }

  /**
   * 渲染高亮显示
   */
  renderHighlights() {
    // 这里可以添加冲突和加成的高亮
  }

  /**
   * 显示提示信息
   */
  showTooltip(message, type = 'info') {
    // 创建临时提示
    const tooltip = document.createElement('div');
    tooltip.style.position = 'fixed';
    tooltip.style.top = '20px';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translateX(-50%)';
    tooltip.style.padding = '12px 24px';
    tooltip.style.borderRadius = '8px';
    tooltip.style.zIndex = '9999';
    tooltip.style.fontSize = '14px';
    tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    
    if (type === 'error') {
      tooltip.style.backgroundColor = '#ffebee';
      tooltip.style.color = '#c62828';
      tooltip.style.border = '1px solid #ef9a9a';
    } else {
      tooltip.style.backgroundColor = '#e3f2fd';
      tooltip.style.color = '#1565c0';
      tooltip.style.border = '1px solid #90caf9';
    }
    
    tooltip.textContent = message;
    document.body.appendChild(tooltip);
    
    setTimeout(() => {
      tooltip.style.transition = 'opacity 0.3s';
      tooltip.style.opacity = '0';
      setTimeout(() => tooltip.remove(), 300);
    }, 2000);
  }

  /**
   * 触发布局变更回调
   */
  triggerLayoutChange() {
    if (this.callbacks.onLayoutChange) {
      this.callbacks.onLayoutChange();
    }
  }

  /**
   * 设置回调
   */
  setCallback(name, callback) {
    this.callbacks[name] = callback;
  }

  /**
   * 获取分类名称
   */
  getCategoryName(category) {
    const names = {
      coffee: '☕ 咖啡饮品',
      food: '🍔 热食餐饮',
      handicraft: '🎨 手作文创',
      band: '🎸 乐队表演',
      children: '👶 儿童游乐'
    };
    return names[category] || category;
  }
}
